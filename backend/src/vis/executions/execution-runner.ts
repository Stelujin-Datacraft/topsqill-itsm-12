/**
 * Integration Execution Engine (Phase 3).
 *
 * APPROVED DESIGN → ExecutionPlan → Queue → Worker Pool →
 * Source → Transform → Map → Validate → Target CREATE/UPDATE → Metrics/Logs
 *
 * Vendor-agnostic. No AI per record. Credentials never in queue payloads.
 */
import type { ExecutionPlan, ExecutionStatus } from '../core/types/index';
import type { VisStore } from '../store/vis.store';
import { maskSecrets } from '../core/security/index';
import { ExecutionPlanError } from './execution-plan';
import { MetricsCollector } from './metrics';
import { CheckpointManager } from './checkpoint-manager';
import { ReferenceCache } from './reference-cache';
import { RateLimiter } from './rate-limiter';
import { CircuitBreaker } from './circuit-breaker';
import { ConfigurableConcurrency } from './adaptive-concurrency';
import { VisQueueManager, type RecordJob, type DeadLetterRecord } from './in-memory-queue';
import { processRecord, type TargetAdapter, buildIdempotencyKey } from './record-pipeline';
import { paginateSource, type SourceReader } from './source-processor';
import { withRetries, sleep } from './retry-manager';
import { isRetryableStatus, classifyThrown } from './execution-errors';
import { canCancel, isTerminal } from './lifecycle';
import type { TokenManager } from './token-manager';

export interface ExecutionLogger {
  log(input: {
    executionId: string;
    integrationId: string;
    correlationId: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    step: string;
    message: string;
    recordId?: string | null;
    workerId?: string | null;
    errorCode?: string | null;
    metadata?: unknown;
  }): void;
}

export interface ExecutionStateCallbacks {
  updateExecution(id: string, patch: Record<string, unknown>): void;
  saveDeadLetter(row: DeadLetterRecord): void;
  loadDeadLetters(executionId: string): DeadLetterRecord[];
  updateDeadLetter(id: string, patch: Record<string, unknown>): void;
}

export interface RecordTraceEvent {
  at: string;
  step: string;
  message: string;
}

export interface RunnerOptions {
  plan: ExecutionPlan;
  executionId: string;
  integrationId: string;
  source: SourceReader;
  target: TargetAdapter;
  logger: ExecutionLogger;
  callbacks: ExecutionStateCallbacks;
  tokenManager?: TokenManager | null;
  credentialRefId?: string | null;
  /** Cap pages for tests / safety */
  maxPages?: number;
  /** Max queue depth before source pauses (backpressure) */
  maxQueueDepth?: number;
  /** Persist processed idempotency keys */
  processedKeys?: Set<string>;
}

export class ExecutionRunner {
  private cancelled = false;
  private status: ExecutionStatus = 'QUEUED';
  private readonly queue = new VisQueueManager();
  private readonly metrics = new MetricsCollector();
  private readonly checkpoints = new CheckpointManager();
  private readonly referenceCache = new ReferenceCache();
  private readonly circuit: CircuitBreaker;
  private readonly rateLimiter: RateLimiter;
  private readonly concurrency: ConfigurableConcurrency;
  private readonly traces = new Map<string, RecordTraceEvent[]>();
  private readonly processedKeys: Set<string>;
  private activeWorkers = 0;
  private sourceDone = false;
  private pageIndex = 0;

  constructor(private readonly opts: RunnerOptions) {
    const plan = opts.plan;
    this.circuit = new CircuitBreaker(5, 15000, 2);
    this.rateLimiter = new RateLimiter(
      plan.rateLimit.perMinute,
      plan.rateLimit.maxConcurrent,
    );
    const initial =
      plan.workers.count * plan.workers.concurrencyPerWorker;
    this.concurrency = new ConfigurableConcurrency(Math.min(initial, plan.rateLimit.maxConcurrent), {
      min: 1,
      max: plan.rateLimit.maxConcurrent,
    });
    this.processedKeys = opts.processedKeys || new Set();
  }

  getMetrics() {
    return {
      ...this.metrics.snapshot(),
      activeWorkers: this.activeWorkers,
      queueDepth: this.queue.records.depth + this.queue.retry.depth,
      circuitState: this.circuit.getState(),
      concurrencyLimit: this.concurrency.getLimit(),
    };
  }

  getTraces(recordId: string): RecordTraceEvent[] {
    return this.traces.get(recordId) || [];
  }

  getDeadLetters(): DeadLetterRecord[] {
    return this.queue.deadLetter.slice();
  }

  cancel(): void {
    if (!canCancel(this.status) && this.status !== 'RUNNING') {
      // still allow cancel while runners drain
    }
    this.cancelled = true;
    this.status = 'CANCELLED';
    this.sourceDone = true;
    this.opts.callbacks.updateExecution(this.opts.executionId, {
      status: 'CANCELLED',
      completedAt: new Date().toISOString(),
    });
    this.log('WARN', 'cancel', 'Cancel requested — stopping new records, draining in-flight');
    this.queue.close();
  }

  /** Pause/Resume designed for later — Phase 3 stubs throw via UnsupportedPauseResume. */

  async run(): Promise<{ status: ExecutionStatus; metrics: ReturnType<MetricsCollector['snapshot']> }> {
    const { plan, executionId, integrationId } = this.opts;
    try {
      this.setStatus('STARTING');
      this.metrics.start();
      this.opts.callbacks.updateExecution(executionId, {
        status: 'STARTING',
        startedAt: new Date().toISOString(),
        plan: maskSecrets(plan as unknown as Record<string, unknown>),
        correlationId: plan.correlationId,
      });
      this.log('INFO', 'plan', `Execution plan validated — workers=${plan.workers.count} concurrency=${plan.workers.concurrencyPerWorker}`);

      this.setStatus('RUNNING');
      this.opts.callbacks.updateExecution(executionId, { status: 'RUNNING' });

      const workerCount = plan.workers.count;
      const perWorker = plan.workers.concurrencyPerWorker;
      const workers = Array.from({ length: workerCount }, (_, i) =>
        this.workerLoop(`W${i + 1}`, perWorker),
      );

      // Source pagination → enqueue (with backpressure)
      await this.sourceLoop();
      this.sourceDone = true;

      await Promise.all(workers);

      if (this.cancelled) {
        this.metrics.complete();
        this.persistMetrics('CANCELLED');
        return { status: 'CANCELLED', metrics: this.metrics.snapshot() };
      }

      this.setStatus('COMPLETING');
      this.metrics.complete();
      const m = this.metrics.snapshot();
      let final: ExecutionStatus = 'SUCCESS';
      if (m.recordsFailed > 0 && m.recordsProcessed > m.recordsFailed) final = 'PARTIAL_SUCCESS';
      else if (m.recordsFailed > 0 && m.recordsCreated + m.recordsUpdated === 0) final = 'FAILED';
      else if (m.recordsRead === 0) final = 'SUCCESS';
      this.persistMetrics(final);
      this.log(
        'INFO',
        'complete',
        `Execution ${final}: read=${m.recordsRead} created=${m.recordsCreated} updated=${m.recordsUpdated} failed=${m.recordsFailed}`,
      );
      return { status: final, metrics: m };
    } catch (err) {
      const classified = classifyThrown(err, plan.correlationId);
      this.metrics.complete();
      this.opts.callbacks.updateExecution(executionId, {
        status: 'FAILED',
        completedAt: new Date().toISOString(),
        errorMessage: classified.message,
        errorCode: classified.code,
        metrics: this.metrics.snapshot(),
      });
      this.log('ERROR', 'fatal', classified.message, null, classified.code);
      return { status: 'FAILED', metrics: this.metrics.snapshot() };
    } finally {
      this.queue.close();
    }
  }

  /** Retry only dead-letter / failed records for an execution. */
  async retryFailed(deadLetters: DeadLetterRecord[]): Promise<{
    status: ExecutionStatus;
    metrics: ReturnType<MetricsCollector['snapshot']>;
  }> {
    this.setStatus('RUNNING');
    this.metrics.start();
    this.opts.callbacks.updateExecution(this.opts.executionId, {
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
    });
    this.log('INFO', 'retry', `Retrying ${deadLetters.length} failed records`);

    for (const dl of deadLetters) {
      if (dl.ignored) continue;
      this.queue.enqueueRecord({
        executionId: this.opts.executionId,
        integrationId: this.opts.integrationId,
        correlationId: this.opts.plan.correlationId,
        credentialRefId: this.opts.credentialRefId || null,
        sourceRecordId: String(dl.sourceRecord.id || dl.sourceRecord.vulnerability_id || 'unknown'),
        sourceRecord: dl.sourceRecord,
        attempt: 1,
      });
      this.metrics.metrics.recordsRead += 1;
    }
    this.sourceDone = true;

    const workerCount = Math.min(this.opts.plan.workers.count, 5);
    const workers = Array.from({ length: workerCount }, (_, i) =>
      this.workerLoop(`RW${i + 1}`, this.opts.plan.workers.concurrencyPerWorker),
    );
    await Promise.all(workers);

    this.metrics.complete();
    const m = this.metrics.snapshot();
    let final: ExecutionStatus = 'SUCCESS';
    if (m.recordsFailed > 0 && m.recordsCreated + m.recordsUpdated > 0) final = 'PARTIAL_SUCCESS';
    else if (m.recordsFailed > 0) final = 'FAILED';
    this.persistMetrics(final);
    return { status: final, metrics: m };
  }

  private async sourceLoop(): Promise<void> {
    const { plan, source } = this.opts;
    const maxQueue = this.opts.maxQueueDepth ?? plan.batching.batchSize * 4;
    const pageSize = plan.source.pageSize || plan.batching.batchSize;

    for await (const batch of paginateSource(source, {
      pageSize,
      style: (plan.source.pagination as any) || 'PAGE',
      path: plan.source.listPath || undefined,
      maxPages: this.opts.maxPages,
      shouldPause: () => !this.cancelled && this.queue.records.depth >= maxQueue,
      shouldStop: () => this.cancelled,
    })) {
      if (this.cancelled) break;
      this.pageIndex += 1;
      this.metrics.metrics.recordsRead += batch.length;
      this.log('DEBUG', 'source', `Page ${this.pageIndex}: ${batch.length} records`);

      for (const rec of batch) {
        if (this.cancelled) break;
        const sourceRecordId = String(rec.id ?? rec.vulnerability_id ?? rec.external_id ?? '');
        this.trace(sourceRecordId, 'source', 'Source retrieved');
        this.queue.enqueueRecord({
          executionId: this.opts.executionId,
          integrationId: this.opts.integrationId,
          correlationId: plan.correlationId,
          credentialRefId: this.opts.credentialRefId || null,
          sourceRecordId,
          sourceRecord: rec,
          attempt: 1,
        });
      }

      // Checkpoint only after page successfully enqueued for processing —
      // consistency: commit page after workers finish would be safer; we commit
      // page number after enqueue but mark success on target confirm per-record.
      // PAGE checkpoint advances after the page is fully processed below via
      // waiting for queue drain when depth is low.
      while (
        !this.cancelled
        && this.queue.records.depth > maxQueue / 2
      ) {
        await sleep(20);
      }

      // Commit checkpoint after successful enqueue + partial drain (at-least-once)
      // Only advance when queue depth is manageable (records were accepted).
      this.checkpoints.commit(
        this.opts.integrationId,
        String(plan.source.kind),
        'PAGE',
        String(this.pageIndex),
      );

      this.persistLiveMetrics();
    }
  }

  private async workerLoop(workerId: string, concurrency: number): Promise<void> {
    const slots: Promise<void>[] = [];
    const runOne = async () => {
      while (!this.cancelled) {
        // Prefer retry queue
        let job = await this.queue.retry.dequeue(5);
        if (!job) job = await this.queue.records.dequeue(50);
        if (!job) {
          if (this.sourceDone && this.queue.records.depth === 0 && this.queue.retry.depth === 0) {
            break;
          }
          continue;
        }
        this.activeWorkers += 1;
        try {
          await this.processJob(job, workerId);
        } finally {
          this.activeWorkers -= 1;
        }
      }
    };
    for (let i = 0; i < concurrency; i++) slots.push(runOne());
    await Promise.all(slots);
  }

  /**
 * Prevent worker deadlock when concurrency limit drops below active workers
 * while rate-limiter slots are held.
 */
private async processJob(job: RecordJob, workerId: string): Promise<void> {
    const { plan } = this.opts;
    const idemKey = buildIdempotencyKey(
      job.integrationId,
      String(plan.source.kind),
      job.sourceRecordId,
    );
    if (this.processedKeys.has(idemKey)) {
      this.metrics.metrics.recordsSkipped += 1;
      this.trace(job.sourceRecordId, 'idempotency', 'Skipped — already processed');
      return;
    }

    this.trace(job.sourceRecordId, 'worker', `Assigned to ${workerId}`);

    try {
      // Wait for concurrency slot BEFORE acquiring rate limiter
      while (this.activeWorkers > this.concurrency.getLimit() && !this.cancelled) {
        await sleep(10);
      }
      if (this.cancelled) return;

      await this.rateLimiter.acquire();

      const result = await withRetries(
        async (attempt) => {
          if (attempt > 1) {
            this.metrics.metrics.recordsRetried += 1;
            this.trace(job.sourceRecordId, 'retry', `Attempt ${attempt}`);
          }
          this.metrics.metrics.requests += 1;

          // Proactive token check (credentialRef only — never embed secrets in job)
          if (this.opts.tokenManager && job.credentialRefId) {
            await this.opts.tokenManager.getAccessToken(job.credentialRefId);
            this.metrics.metrics.authenticationRefreshes =
              this.opts.tokenManager.getRefreshCount();
          }

          return this.circuit.exec(async () => {
            const r = await processRecord({
              source: job.sourceRecord,
              plan,
              target: this.opts.target,
              referenceCache: this.referenceCache,
              correlationId: job.correlationId,
            });
            if (!r.ok) {
              const err: any = new Error(r.error?.message || 'Record processing failed');
              err.code = r.error?.code;
              err.retryable = r.error?.retryable;
              throw err;
            }
            return r;
          });
        },
        {
          type: plan.retryPolicy.type,
          maxAttempts: plan.retryPolicy.maxAttempts,
          initialDelayMs: plan.retryPolicy.initialDelayMs,
          maxDelayMs: plan.retryPolicy.maxDelayMs,
          shouldRetry: (err) => {
            const e = err as any;
            if (e?.httpStatus === 429) {
              this.metrics.metrics.rateLimitResponses += 1;
              this.concurrency.onRateLimit();
              const retryAfter = Number(e.retryAfter || 1);
              void this.rateLimiter.respectRetryAfter(retryAfter);
              return true;
            }
            if (e?.httpStatus === 401 && this.opts.tokenManager && job.credentialRefId) {
              // Token refresh then one retry handled by TokenManager + withRetries
              void this.opts.tokenManager.refreshAfterUnauthorized(job.credentialRefId);
              return true;
            }
            if (isRetryableStatus(e?.httpStatus)) return true;
            if (e?.retryable) return true;
            const c = classifyThrown(err, job.correlationId);
            return c.retryable;
          },
          onRetry: (err, attempt, delayMs) => {
            this.log(
              'WARN',
              'retry',
              `Retry ${attempt} in ${delayMs}ms: ${(err as Error).message}`,
              job.sourceRecordId,
            );
          },
        },
      );

      this.metrics.metrics.successfulRequests += 1;
      this.metrics.metrics.recordsProcessed += 1;
      this.metrics.recordLatency(result.latencyMs);
      if (result.action === 'CREATE') this.metrics.metrics.recordsCreated += 1;
      else if (result.action === 'UPDATE') this.metrics.metrics.recordsUpdated += 1;
      else this.metrics.metrics.recordsSkipped += 1;

      this.processedKeys.add(idemKey);
      this.trace(
        job.sourceRecordId,
        'target',
        `${result.action} → ${result.existingTargetId || 'n/a'}`,
      );
      this.log(
        'DEBUG',
        'record',
        `${result.action} ${job.sourceRecordId} → ${result.existingTargetId}`,
        job.sourceRecordId,
        null,
        { action: result.action, targetId: result.existingTargetId, workerId },
      );
    } catch (err) {
      this.metrics.metrics.failedRequests += 1;
      this.metrics.metrics.recordsFailed += 1;
      this.metrics.metrics.recordsProcessed += 1;
      const classified = classifyThrown(err, job.correlationId);
      const code = (err as any)?.code || classified.code;
      this.trace(job.sourceRecordId, 'error', classified.message);
      this.log('ERROR', 'record', classified.message, job.sourceRecordId, code);

      const dl: DeadLetterRecord = {
        integrationId: job.integrationId,
        executionId: job.executionId,
        correlationId: job.correlationId,
        sourceRecord: job.sourceRecord,
        transformedRecord: null,
        errorCode: code,
        errorMessage: classified.message,
        retryCount: job.attempt,
        timestamp: new Date().toISOString(),
      };
      this.queue.toDeadLetter(dl);
      this.opts.callbacks.saveDeadLetter(dl);
    } finally {
      this.rateLimiter.release();
      this.persistLiveMetrics();
    }
  }

  private setStatus(s: ExecutionStatus) {
    this.status = s;
  }

  private lastPersistMetricsAt = 0;

  private persistLiveMetrics() {
    if (isTerminal(this.status) && this.status !== 'COMPLETING') return;
    const now = Date.now();
    // Throttle store updates during high-throughput runs
    if (now - this.lastPersistMetricsAt < 200 && this.status === 'RUNNING') return;
    this.lastPersistMetricsAt = now;
    const m = this.metrics.snapshot();
    this.opts.callbacks.updateExecution(this.opts.executionId, {
      recordsRead: m.recordsRead,
      recordsProcessed: m.recordsProcessed,
      recordsCreated: m.recordsCreated,
      recordsUpdated: m.recordsUpdated,
      recordsFailed: m.recordsFailed,
      recordsRetried: m.recordsRetried,
      recordsSkipped: m.recordsSkipped,
      retryCount: m.recordsRetried,
      metrics: {
        ...m,
        activeWorkers: this.activeWorkers,
        queueDepth: this.queue.records.depth,
      },
      status: this.cancelled ? 'CANCELLED' : this.status,
    });
  }

  private persistMetrics(status: ExecutionStatus) {
    this.status = status;
    const m = this.metrics.snapshot();
    this.opts.callbacks.updateExecution(this.opts.executionId, {
      status,
      completedAt: new Date().toISOString(),
      recordsRead: m.recordsRead,
      recordsProcessed: m.recordsProcessed,
      recordsCreated: m.recordsCreated,
      recordsUpdated: m.recordsUpdated,
      recordsFailed: m.recordsFailed,
      recordsRetried: m.recordsRetried,
      recordsSkipped: m.recordsSkipped,
      retryCount: m.recordsRetried,
      metrics: m,
      traces: Object.fromEntries(this.traces),
    });
  }

  private log(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    step: string,
    message: string,
    recordId?: string | null,
    errorCode?: string | null,
    metadata?: unknown,
  ) {
    this.opts.logger.log({
      executionId: this.opts.executionId,
      integrationId: this.opts.integrationId,
      correlationId: this.opts.plan.correlationId,
      level,
      step,
      message,
      recordId,
      errorCode,
      metadata: metadata ? maskSecrets(metadata) : undefined,
    });
  }

  private trace(recordId: string, step: string, message: string) {
    if (!recordId) return;
    const list = this.traces.get(recordId) || [];
    list.push({ at: new Date().toISOString(), step, message });
    this.traces.set(recordId, list);
  }
}

/** In-memory target backed by VisStore mockRecords — used for local/mock runs. */
export function createStoreTargetAdapter(
  store: VisStore,
  formId: string,
  matchFields: string[],
): TargetAdapter {
  return {
    async findByKeys(keys) {
      const rows = store.list('mockRecords').filter((r) => r.formId === formId);
      for (const row of rows) {
        const data = (row.data || {}) as Record<string, unknown>;
        const ok = matchFields.every((f) => String(data[f] ?? '') === String(keys[f] ?? ''));
        if (ok) return { id: row.id };
      }
      return null;
    },
    async create(payload) {
      const row = store.create('mockRecords', {
        formId,
        data: payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { id: row.id, status: 201 };
    },
    async update(id, payload) {
      const existing = store.get('mockRecords', id);
      if (!existing) throw Object.assign(new Error('Target record not found'), { code: 'TARGET_ERROR', httpStatus: 404 });
      store.update('mockRecords', id, {
        data: { ...(existing.data as object), ...payload },
        updatedAt: new Date().toISOString(),
      });
      return { id, status: 200 };
    },
    async lookupReference(_hint, matchBy, value) {
      // Simple team name → synthetic id cacheable by ReferenceCache
      if (!value) return null;
      return `REF-${matchBy}-${value}`.replace(/\s+/g, '_');
    },
  };
}

/** In-memory source reader from a fixed array (supports PAGE pagination). */
export function createArraySourceReader(
  records: Record<string, unknown>[],
): SourceReader {
  return {
    async readPage({ page = 1, pageSize }) {
      const start = (page - 1) * pageSize;
      const items = records.slice(start, start + pageSize);
      return {
        items,
        nextPage: start + pageSize < records.length ? page + 1 : null,
        done: start + pageSize >= records.length || items.length === 0,
      };
    },
  };
}

/** Fail an execution before workers start when plan is invalid. */
export function failExecutionForPlanError(
  callbacks: ExecutionStateCallbacks,
  executionId: string,
  err: ExecutionPlanError | Error,
): void {
  callbacks.updateExecution(executionId, {
    status: 'FAILED',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    errorMessage: err.message,
    errorCode: 'CONFIGURATION_ERROR',
  });
}
