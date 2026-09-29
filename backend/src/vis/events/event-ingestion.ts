/**
 * Event ingestion → validate → dedupe → queue → Phase 3 ExecutionRunner.
 * Long-running work never blocks the webhook HTTP response.
 */
import { randomUUID } from 'crypto';
import type { VisStore } from '../store/vis.store';
import type {
  DirectionConfig,
  EventEnvelope,
  IntegrationDesign,
  RealtimeEventConfig,
} from '../core/types/index';
import { maskSecrets } from '../core/security/index';
import {
  buildCorrelationId,
  buildExecutionPlan,
  createArraySourceReader,
  createStoreTargetAdapter,
  ExecutionRunner,
} from '../executions/index';
import { WebhookSecurityService, type WebhookSecurityConfig } from './webhook-security';
import { normalizeEvent, validateEventSchema, MAX_PAYLOAD_BYTES } from './event-normalizer';
import { EventDeduplicationService } from './event-deduplication';
import { EventRouter } from './event-router';
import { EventLoopPreventionService } from './loop-prevention';
import { EventOrderingService } from './event-ordering';
import { EventMetricsService } from './event-metrics';
import { EventQueueManager, type EventJob } from './event-queue';
import { defaultRealtimeConfig } from './realtime-config';
import { evaluateEventFilter } from './event-filter';

export interface IngestResult {
  status: number;
  body: Record<string, unknown>;
}

export class EventIngestionService {
  readonly metrics = new EventMetricsService();
  readonly dedup = new EventDeduplicationService();
  readonly router = new EventRouter();
  readonly loops = new EventLoopPreventionService();
  readonly ordering = new EventOrderingService();
  readonly queues = new EventQueueManager();
  private workersStarted = false;
  private security: WebhookSecurityService;

  constructor(
    private readonly store: VisStore,
    private readonly opts?: {
      onExecutionComplete?: (executionId: string, eventRecordId: string) => void;
    },
  ) {
    this.security = new WebhookSecurityService(async (refId) => {
      const cred = this.store.get('credentials', refId);
      if (!cred) return null;
      // credential stores secret under `secret` or nested
      return String((cred as any).secret || (cred as any).value || (cred as any).token || '');
    });
  }

  ensureWorkers(concurrency = 10) {
    if (this.workersStarted) return;
    this.workersStarted = true;
    for (let i = 0; i < concurrency; i++) {
      void this.workerLoop(`EW${i + 1}`);
    }
  }

  async ingestWebhook(input: {
    endpointId: string;
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
    parsedBody: Record<string, unknown>;
  }): Promise<IngestResult> {
    this.ensureWorkers();
    this.metrics.inc('eventsReceived');
    const receivedAt = new Date().toISOString();

    if (Buffer.byteLength(input.rawBody || '', 'utf8') > MAX_PAYLOAD_BYTES) {
      this.metrics.inc('eventsRejected');
      return { status: 413, body: { error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' } };
    }

    const endpoint = this.store.get('eventEndpoints', input.endpointId);
    if (!endpoint) {
      this.metrics.inc('eventsRejected');
      return { status: 404, body: { error: 'Endpoint not found' } };
    }

    const integrationId = String(endpoint.integrationId);
    const integration = this.store.get('integrations', integrationId);
    if (!integration) {
      this.metrics.inc('eventsRejected');
      return { status: 404, body: { error: 'Integration not found' } };
    }

    if (String(integration.status) === 'DISABLED' || String(integration.status) === 'INACTIVE') {
      this.metrics.inc('eventsRejected');
      return { status: 403, body: { error: 'Integration disabled', code: 'INTEGRATION_DISABLED' } };
    }

    const cfg = this.getEventConfig(integrationId);
    const sec: WebhookSecurityConfig = {
      authType: cfg.webhookAuthType || 'NONE',
      credentialRefId: cfg.webhookCredentialRefId,
      signatureHeader: cfg.webhookSignatureHeader || 'x-signature',
      timestampHeader: cfg.webhookTimestampHeader || 'x-timestamp',
      maxSkewSeconds: cfg.webhookMaxSkewSeconds ?? 300,
    };
    const verified = await this.security.verify(sec, input.headers, input.rawBody);
    if (!verified.ok) {
      this.metrics.inc('eventsRejected');
      this.audit(integrationId, 'EVENT_REJECTED', { reason: verified.message, code: verified.code });
      return {
        status: verified.code === 'AUTHENTICATION_ERROR' ? 401 : 400,
        body: { error: verified.message, code: verified.code },
      };
    }

    const envelope = normalizeEvent({
      body: input.parsedBody,
      sourceSystem: String(endpoint.sourceSystem || 'InternalApplication'),
      sourceEnvironment: String(cfg.sourceEnvironmentId || endpoint.environment || 'DEV'),
      receivedAt,
    });

    const schema = validateEventSchema(envelope, {
      allowedTypes: cfg.eventTriggerTypes,
      allowedVersions: cfg.supportedEventVersions,
    });
    if (!schema.ok) {
      this.metrics.inc('eventsRejected');
      const rejected = this.persistEvent(envelope, integrationId, input.endpointId, 'REJECTED', {
        errorMessage: schema.errors.join('; '),
        errorCode: 'VALIDATION_ERROR',
      });
      this.toDeadLetter(rejected.id, envelope, integrationId, 'VALIDATION_ERROR', schema.errors.join('; '));
      return { status: 400, body: { error: 'Invalid event schema', details: schema.errors } };
    }

    if (cfg.filters && !evaluateEventFilter(envelope, cfg.filters)) {
      this.metrics.inc('eventsRejected');
      this.persistEvent(envelope, integrationId, input.endpointId, 'IGNORED', {
        errorMessage: 'Filtered out',
      });
      return { status: 202, body: { accepted: false, reason: 'FILTERED', eventId: envelope.eventId } };
    }

    const loop = this.loops.check(envelope, {
      integrationId,
      maxHopCount: cfg.maxHopCount,
      sourceEnvironment: cfg.sourceEnvironmentId,
      targetEnvironment: cfg.targetEnvironmentId,
      enabled: cfg.loopPreventionEnabled,
    });
    if (!loop.allow) {
      this.metrics.inc('eventsRejected');
      this.persistEvent(envelope, integrationId, input.endpointId, 'REJECTED', {
        errorMessage: loop.reason,
        errorCode: 'LOOP_DETECTED',
      });
      this.audit(integrationId, 'EVENT_LOOP_PREVENTED', { eventId: envelope.eventId, reason: loop.reason });
      return { status: 202, body: { accepted: false, reason: 'LOOP_PREVENTED', message: loop.reason } };
    }

    const dedupOutcome = this.dedup.check(
      envelope,
      cfg.deduplicationStrategy,
      (cfg.deduplicationTtlSeconds || 86400) * 1000,
    );
    if (dedupOutcome === 'DUPLICATE') {
      this.metrics.inc('eventsDuplicated');
      this.persistEvent(envelope, integrationId, input.endpointId, 'DUPLICATE', {});
      return {
        status: 202,
        body: { accepted: true, duplicate: true, eventId: envelope.eventId, correlationId: envelope.correlationId },
      };
    }

    if (String(integration.status) === 'PAUSED') {
      if (cfg.pauseBehavior === 'REJECT_WITH_RETRY') {
        this.metrics.inc('eventsRejected');
        return { status: 429, body: { error: 'Integration paused', code: 'PAUSED', retryAfter: 30 } };
      }
      if (cfg.pauseBehavior === 'DISABLE_ENDPOINT') {
        this.metrics.inc('eventsRejected');
        return { status: 403, body: { error: 'Endpoint disabled while paused' } };
      }
      // QUEUE — accept and hold
    }

    const row = this.persistEvent(envelope, integrationId, input.endpointId, 'QUEUED', {});
    this.metrics.inc('eventsAccepted');
    this.queues.processing.enqueue({
      eventRecordId: row.id,
      integrationId,
      endpointId: input.endpointId,
      envelope,
      attempt: 1,
    });
    this.metrics.set('queueDepth', this.queues.processing.depth);
    this.audit(integrationId, 'EVENT_ACCEPTED', {
      eventId: envelope.eventId,
      correlationId: envelope.correlationId,
    });

    return {
      status: 202,
      body: {
        accepted: true,
        eventId: envelope.eventId,
        correlationId: envelope.correlationId,
        recordId: row.id,
      },
    };
  }

  /** Inject a test event (dry-run or execute). */
  async testEvent(
    integrationId: string,
    body: Record<string, unknown>,
    opts?: { execute?: boolean; dryRun?: boolean },
  ) {
    const endpoint =
      this.store.list('eventEndpoints').find((e) => e.integrationId === integrationId)
      || this.ensureEndpoint(integrationId);
    const envelope = normalizeEvent({
      body,
      sourceEnvironment: String(this.getEventConfig(integrationId).sourceEnvironmentId || 'DEV'),
    });
    const schema = validateEventSchema(envelope, {
      allowedTypes: this.getEventConfig(integrationId).eventTriggerTypes,
    });
    const filterOk = evaluateEventFilter(envelope, this.getEventConfig(integrationId).filters);
    const preview = {
      envelope: maskSecrets(envelope as any),
      schema,
      filterMatched: filterOk,
      dryRun: opts?.dryRun !== false && !opts?.execute,
    };
    if (opts?.execute) {
      const result = await this.ingestWebhook({
        endpointId: endpoint.id,
        headers: {},
        rawBody: JSON.stringify(body),
        parsedBody: body,
      });
      return { ...preview, ingest: result };
    }
    return preview;
  }

  async replayEvent(eventRecordId: string) {
    const row = this.store.get('events', eventRecordId);
    if (!row) throw new Error('Event not found');
    const envelope = row.envelope as EventEnvelope;
    const replayEnvelope: EventEnvelope = {
      ...envelope,
      correlationId: buildCorrelationId('REPLAY'),
      metadata: { ...(envelope.metadata || {}), replayOf: row.id, originalEventId: envelope.eventId },
    };
    const newRow = this.persistEvent(
      replayEnvelope,
      String(row.integrationId),
      String(row.endpointId || ''),
      'QUEUED',
      { replayOf: row.id },
    );
    this.metrics.inc('eventsReplayed');
    this.ensureWorkers();
    this.queues.processing.enqueue({
      eventRecordId: newRow.id,
      integrationId: String(row.integrationId),
      endpointId: String(row.endpointId || ''),
      envelope: replayEnvelope,
      attempt: 1,
      replayOf: row.id,
    });
    this.audit(String(row.integrationId), 'EVENT_REPLAYED', {
      eventId: envelope.eventId,
      replayRecordId: newRow.id,
    });
    return this.store.get('events', newRow.id);
  }

  getEventConfig(integrationId: string): RealtimeEventConfig {
    const version = this.currentVersion(integrationId);
    const fromVersion = (version?.eventConfig || version?.realtimeConfig) as RealtimeEventConfig | undefined;
    if (fromVersion) return { ...defaultRealtimeConfig(), ...fromVersion };
    return defaultRealtimeConfig({ eventEnabled: false });
  }

  setEventConfig(integrationId: string, config: Partial<RealtimeEventConfig>) {
    const version = this.currentVersion(integrationId);
    if (!version) throw new Error('Version not found');
    const next = { ...defaultRealtimeConfig(), ...(version.eventConfig as object), ...config };
    this.store.update('versions', version.id, { eventConfig: next });
    return next;
  }

  ensureEndpoint(integrationId: string, opts?: { environment?: string }) {
    const existing = this.store.list('eventEndpoints').find((e) => e.integrationId === integrationId);
    if (existing) return existing;
    const cfg = this.getEventConfig(integrationId);
    return this.store.create('eventEndpoints', {
      integrationId,
      environment: opts?.environment || cfg.sourceEnvironmentId || 'DEV',
      sourceSystem: 'InternalApplication',
      status: 'ACTIVE',
      path: `/vis/events/webhook`,
      createdAt: new Date().toISOString(),
    });
  }

  listEvents(filters?: { integrationId?: string; status?: string }) {
    let rows = this.store.list('events');
    if (filters?.integrationId) rows = rows.filter((e) => e.integrationId === filters.integrationId);
    if (filters?.status) rows = rows.filter((e) => e.status === filters.status);
    return rows.slice().reverse();
  }

  getEvent(id: string) {
    const row = this.store.get('events', id);
    if (!row) return null;
    const traces = this.store.list('logs').filter((l) => l.eventId === id || l.correlationId === row.correlationId);
    return { ...row, traces };
  }

  listEventDeadLetters(integrationId?: string) {
    let rows = this.store.list('eventDeadLetters');
    if (integrationId) rows = rows.filter((d) => d.integrationId === integrationId);
    return rows.slice().reverse();
  }

  private async workerLoop(workerId: string) {
    for (;;) {
      let job = await this.queues.retry.dequeue(20);
      if (!job) job = await this.queues.processing.dequeue(100);
      if (!job) {
        this.metrics.set('queueDepth', this.queues.processing.depth);
        continue;
      }
      this.metrics.inc('eventsProcessing');
      this.metrics.set('activeWorkers', (this.metrics.snapshot().activeWorkers || 0) + 1);
      try {
        await this.processJob(job, workerId);
      } catch (err: any) {
        this.handleJobFailure(job, err);
      } finally {
        this.metrics.inc('eventsProcessing', -1);
        const snap = this.metrics.snapshot();
        this.metrics.set('activeWorkers', Math.max(0, (snap.activeWorkers || 1) - 1));
        this.metrics.set('queueDepth', this.queues.processing.depth);
      }
    }
  }

  private async processJob(job: EventJob, workerId: string) {
    const started = Date.now();
    const integration = this.store.get('integrations', job.integrationId);
    if (!integration) throw new Error('Integration missing');
    if (String(integration.status) === 'PAUSED') {
      // re-queue later
      this.queues.processing.enqueue(job);
      await new Promise((r) => setTimeout(r, 50));
      return;
    }

    const cfg = this.getEventConfig(job.integrationId);
    await this.ordering.withOrder(cfg.orderingStrategy, {
      integrationId: job.integrationId,
      entityId: job.envelope.entityId,
    }, async () => {
      this.store.update('events', job.eventRecordId, {
        status: 'PROCESSING',
        workerId,
        processingStartedAt: new Date().toISOString(),
      });

      const version = this.currentVersion(job.integrationId);
      const design = version?.design as IntegrationDesign | undefined;
      const direction = ((version?.directions as DirectionConfig[]) || [])[0];
      if (!design || !direction) throw Object.assign(new Error('Integration design missing'), { retryable: false });

      let sourceRecord = { ...job.envelope.payload };
      if (cfg.payloadStrategy === 'FETCH_RECORD' || cfg.payloadStrategy === 'HYBRID') {
        // Prefer store mock record by entity id when available
        const formId = direction.selectedFormId || 'form-vulnerability';
        const found = this.store.list('mockRecords').find((r) => {
          if (r.formId !== formId) return false;
          const d = (r.data || {}) as Record<string, unknown>;
          return String(d.id || d.vulnerability_id || d.external_id || r.id) === job.envelope.entityId;
        });
        if (found) {
          sourceRecord = { id: job.envelope.entityId, ...(found.data as object) };
        } else if (cfg.payloadStrategy === 'FETCH_RECORD' && !Object.keys(job.envelope.payload || {}).length) {
          throw Object.assign(new Error('Authoritative record not found'), {
            code: 'SOURCE_ERROR',
            retryable: true,
          });
        } else {
          sourceRecord = { id: job.envelope.entityId, ...job.envelope.payload };
        }
      }

      // Stamp loop-prevention metadata into mapped target via payload side-channel
      sourceRecord = {
        ...sourceRecord,
        _visOriginIntegrationId: job.integrationId,
        _visOriginEventId: job.envelope.eventId,
        _visHopCount: Number(job.envelope.hopCount || 0) + 1,
      };

      const correlationId = job.envelope.correlationId || buildCorrelationId('EVT');
      const plan = buildExecutionPlan({
        integrationId: job.integrationId,
        versionId: version?.id || null,
        versionNumber: version?.version != null ? Number(version.version) : null,
        design,
        direction: {
          ...direction,
          workers: Math.min(direction.workers || 2, 3),
          concurrency: Math.min(direction.concurrency || 5, cfg.maxEventConcurrency || 10),
          rateLimitPerMinute: direction.rateLimitPerMinute ?? null,
        },
        correlationId,
      });
      (plan as any).triggerType = 'EVENT';
      (plan as any).eventId = job.envelope.eventId;
      (plan as any).causationId = job.envelope.causationId || null;

      const formId = direction.selectedFormId || 'form-vulnerability';
      const target = createStoreTargetAdapter(this.store, formId, plan.matchingStrategy.targetFields);

      const op = String(job.envelope.eventType || '');
      if (op === 'RECORD_DELETED') {
        // Soft-delete path: mark target if found
        const existing = await target.findByKeys(
          Object.fromEntries(
            plan.matchingStrategy.targetFields.map((f, i) => [
              f,
              sourceRecord[plan.matchingStrategy.sourceFields[i]] || job.envelope.entityId,
            ]),
          ),
        );
        if (existing) {
          this.store.update('mockRecords', existing.id, {
            deleted: true,
            updatedAt: new Date().toISOString(),
          });
        }
        this.completeEvent(job, 'SUCCESS', null, Date.now() - started);
        return;
      }

      const execution = this.store.create('executions', {
        integrationId: job.integrationId,
        versionId: version?.id || null,
        status: 'QUEUED',
        triggerType: 'EVENT',
        eventId: job.envelope.eventId,
        eventRecordId: job.eventRecordId,
        correlationId,
        causationId: job.envelope.causationId || null,
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        createdAt: new Date().toISOString(),
      });

      this.store.update('events', job.eventRecordId, { executionId: execution.id });

      const runner = new ExecutionRunner({
        plan,
        executionId: execution.id,
        integrationId: job.integrationId,
        source: createArraySourceReader([sourceRecord]),
        target,
        logger: {
          log: (input) => {
            this.store.create('logs', {
              executionId: input.executionId,
              integrationId: input.integrationId,
              correlationId: input.correlationId,
              eventId: job.eventRecordId,
              level: input.level === 'DEBUG' ? 'DEBUG' : input.level,
              step: input.step,
              message: input.message,
              recordId: input.recordId || null,
              errorCode: input.errorCode || null,
              metadata: input.metadata ? maskSecrets(input.metadata) : null,
              timestamp: new Date().toISOString(),
            });
          },
        },
        callbacks: {
          updateExecution: (id, patch) => this.store.update('executions', id, patch),
          saveDeadLetter: (r) => this.store.create('deadLetters', { ...r, ignored: false }),
          loadDeadLetters: () => [],
          updateDeadLetter: () => undefined,
        },
      });

      const result = await runner.run();
      const latency = Date.now() - started;
      if (result.status === 'SUCCESS' || result.status === 'PARTIAL_SUCCESS') {
        this.dedup.markProcessed(job.envelope, cfg.deduplicationStrategy);
        this.completeEvent(job, 'SUCCESS', execution.id, latency, {
          recordsCreated: result.metrics.recordsCreated,
          recordsUpdated: result.metrics.recordsUpdated,
        });
        this.opts?.onExecutionComplete?.(execution.id, job.eventRecordId);
      } else {
        throw Object.assign(new Error(result.status), {
          retryable: result.status === 'FAILED',
          executionId: execution.id,
        });
      }
    });
  }

  private handleJobFailure(job: EventJob, err: any) {
    const cfg = this.getEventConfig(job.integrationId);
    const retryable = err?.retryable !== false;
    const maxAttempts = 5;
    if (retryable && job.attempt < maxAttempts) {
      this.metrics.inc('eventsRetried');
      this.store.update('events', job.eventRecordId, {
        status: 'RETRYING',
        errorMessage: String(err?.message || err),
        retryCount: job.attempt,
      });
      this.queues.retry.enqueue({ ...job, attempt: job.attempt + 1 });
      return;
    }
    this.metrics.inc('eventsFailed');
    this.metrics.inc('eventsDlq');
    this.dedup.markFailed(job.envelope, cfg.deduplicationStrategy);
    this.store.update('events', job.eventRecordId, {
      status: 'DEAD_LETTER',
      errorMessage: String(err?.message || err),
      errorCode: err?.code || 'UNKNOWN_ERROR',
      completedAt: new Date().toISOString(),
    });
    this.toDeadLetter(
      job.eventRecordId,
      job.envelope,
      job.integrationId,
      err?.code || 'UNKNOWN_ERROR',
      String(err?.message || err),
      job.attempt,
    );
  }

  private completeEvent(
    job: EventJob,
    status: string,
    executionId: string | null,
    latencyMs: number,
    extra?: Record<string, unknown>,
  ) {
    this.metrics.inc('eventsSucceeded');
    this.metrics.recordLatency(latencyMs);
    this.store.update('events', job.eventRecordId, {
      status,
      executionId,
      completedAt: new Date().toISOString(),
      endToEndLatencyMs: latencyMs,
      ...extra,
    });
    this.audit(job.integrationId, 'EVENT_PROCESSED', {
      eventId: job.envelope.eventId,
      status,
      latencyMs,
      executionId,
    });
  }

  private persistEvent(
    envelope: EventEnvelope,
    integrationId: string,
    endpointId: string,
    status: string,
    extra: Record<string, unknown>,
  ) {
    return this.store.create('events', {
      integrationId,
      endpointId,
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      entityType: envelope.entityType,
      entityId: envelope.entityId,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId || null,
      status,
      envelope: maskSecrets(envelope as any),
      receivedAt: envelope.receivedAt,
      createdAt: new Date().toISOString(),
      ...extra,
    });
  }

  private toDeadLetter(
    eventRecordId: string,
    envelope: EventEnvelope,
    integrationId: string,
    errorCode: string,
    errorMessage: string,
    retryCount = 0,
  ) {
    this.store.create('eventDeadLetters', {
      eventRecordId,
      integrationId,
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      entityId: envelope.entityId,
      correlationId: envelope.correlationId,
      errorCode,
      errorMessage,
      retryCount,
      firstSeenAt: envelope.receivedAt,
      lastAttemptAt: new Date().toISOString(),
      ignored: false,
    });
  }

  private currentVersion(integrationId: string) {
    const integ = this.store.get('integrations', integrationId);
    if (integ?.currentVersionId) return this.store.get('versions', String(integ.currentVersionId));
    return this.store.list('versions').filter((v) => v.integrationId === integrationId)[0] || null;
  }

  private audit(integrationId: string, action: string, detail: unknown) {
    this.store.create('audits', {
      organizationId: null,
      integrationId,
      versionId: null,
      actorId: null,
      action,
      detail: maskSecrets(detail),
      createdAt: new Date().toISOString(),
    });
  }
}

/** Shared singleton for Nest + tests */
let _events: EventIngestionService | null = null;
export function getEventIngestionService(store: VisStore): EventIngestionService {
  if (!_events) _events = new EventIngestionService(store);
  return _events;
}

export function resetEventIngestionService() {
  _events = null;
}
