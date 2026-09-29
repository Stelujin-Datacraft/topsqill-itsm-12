/**
 * Stage 10A–10C — Advanced AI ops: failure analysis, optimization, docs, tests.
 * AI recommends; platform validates; humans/policy approve. Runtime never calls LLM.
 */
import { randomUUID } from 'crypto';
import type { AiRecommendation, AiRecommendationStatus } from '../enterprise/types';
import { AiContextSanitizer } from '../security/enterprise-security';
import type { VisStore } from '../store/vis.store';

export class AiOpsService {
  private readonly sanitizer = new AiContextSanitizer();

  constructor(private readonly store: VisStore) {}

  /**
   * Analyze failure using only safe diagnostic context + evidence from store.
   * Does not invent evidence.
   */
  analyzeFailure(opts: {
    executionId: string;
    integrationId?: string;
  }): AiRecommendation {
    const execution = this.store.get('executions', opts.executionId);
    if (!execution) throw Object.assign(new Error('Execution not found'), { status: 404 });

    const logs = this.store
      .list('logs')
      .filter((l) => l.executionId === opts.executionId)
      .slice(-50);
    const errorLogs = logs.filter((l) => l.level === 'ERROR' || l.level === 'WARN');

    const evidence: string[] = [];
    evidence.push(`execution.status=${execution.status}`);
    if (execution.errorCode) evidence.push(`errorCode=${execution.errorCode}`);
    if (execution.failedRecords != null) evidence.push(`failedRecords=${execution.failedRecords}`);
    if (execution.retryCount != null) evidence.push(`retryCount=${execution.retryCount}`);

    for (const l of errorLogs.slice(0, 10)) {
      evidence.push(`log[${l.step || 'unknown'}]: ${String(l.message || '').slice(0, 200)}`);
    }

    const joined = evidence.join(' ').toLowerCase();
    let reason = 'Execution failed; see evidence.';
    let proposedChange: Record<string, unknown> = { action: 'REVIEW_LOGS' };
    let confidence: AiRecommendation['confidence'] = 'LOW';
    let risk: AiRecommendation['risk'] = 'LOW';

    if (/429|rate.?limit|retry-after/.test(joined)) {
      reason = 'Target returned 429 / rate limiting signals in logs.';
      proposedChange = {
        action: 'REDUCE_CONCURRENCY',
        honorRetryAfter: true,
        suggestedWorkers: Math.max(1, Number(execution.workers || 4) - 2),
      };
      confidence = errorLogs.some((l) => /429/.test(String(l.message))) ? 'HIGH' : 'MEDIUM';
      risk = 'LOW';
      if (errorLogs.some((l) => /Retry-After.*?(\d+)/i.test(String(l.message)))) {
        const m = errorLogs.map((l) => String(l.message)).join(' ').match(/Retry-After.*?(\d+)/i);
        if (m) evidence.push(`Retry-After observed: ${m[1]}s`);
      }
    } else if (/401|403|unauthorized|authentication|oauth/.test(joined)) {
      reason = 'Authentication or OAuth failure indicated by logs.';
      proposedChange = { action: 'REFRESH_OAUTH', then: 'RETRY' };
      confidence = 'HIGH';
      risk = 'MEDIUM';
    } else if (/timeout|ETIMEDOUT|ECONNRESET/.test(joined)) {
      reason = 'Transient network/timeout failures observed.';
      proposedChange = { action: 'RETRY_TRANSIENT', maxAttempts: 3 };
      confidence = 'MEDIUM';
      risk = 'LOW';
    } else if (/reference|lookup|not found/.test(joined)) {
      reason = 'Reference lookup failures indicated.';
      proposedChange = {
        action: 'MAPPING_IMPROVEMENT',
        suggestion: 'Prefer stable identifiers (email/sys_id) over displayName',
        requiresApproval: true,
      };
      confidence = 'MEDIUM';
      risk = 'MEDIUM';
    } else if (errorLogs.length === 0) {
      reason = 'No error logs available for this execution; cannot determine root cause from evidence.';
      proposedChange = { action: 'COLLECT_MORE_DIAGNOSTICS' };
      confidence = 'LOW';
    }

    // Never claim causation without correlated change evidence
    const rec = this.createRecommendation({
      type: 'FAILURE_ANALYSIS',
      reason,
      evidence: this.sanitizer.sanitize(evidence) as string[],
      confidence,
      affectedIntegrationId: String(opts.integrationId || execution.integrationId || ''),
      affectedVersionId: execution.integrationVersion ? String(execution.integrationVersion) : null,
      proposedChange,
      risk,
    });
    return rec;
  }

  /**
   * Correlate timeline of changes vs failures — correlation statements only.
   */
  correlateIncident(opts: { integrationId: string; windowMinutes?: number }) {
    const windowMs = (opts.windowMinutes || 60) * 60_000;
    const now = Date.now();
    const since = now - windowMs;

    const audits = this.store
      .list('audits')
      .filter((a) => a.integrationId === opts.integrationId && Date.parse(String(a.createdAt)) >= since);
    const executions = this.store
      .list('executions')
      .filter((e) => e.integrationId === opts.integrationId && Date.parse(String(e.createdAt || e.startedAt || 0)) >= since);
    const upgrades = this.store
      .list('connectorUpgrades')
      .filter((u) => Date.parse(String(u.createdAt || u.appliedAt || 0)) >= since);
    const drifts = this.store
      .list('driftFindings')
      .filter((d) => Date.parse(String(d.detectedAt || d.createdAt || 0)) >= since);

    const timeline = [
      ...audits.map((a) => ({ at: String(a.createdAt), kind: 'CONFIG_CHANGE', detail: String(a.action) })),
      ...upgrades.map((u) => ({
        at: String(u.appliedAt || u.createdAt),
        kind: 'CONNECTOR_UPGRADE',
        detail: `${u.fromVersion} → ${u.toVersion} (${u.status})`,
      })),
      ...drifts.map((d) => ({ at: String(d.detectedAt || d.createdAt), kind: 'SCHEMA_DRIFT', detail: `severity=${d.maxSeverity}` })),
      ...executions
        .filter((e) => e.status === 'FAILED' || e.status === 'PARTIAL_SUCCESS')
        .map((e) => ({ at: String(e.createdAt || e.startedAt), kind: 'EXECUTION_FAILURE', detail: `id=${e.id}` })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    const statements: string[] = [];
    const firstFailure = timeline.find((t) => t.kind === 'EXECUTION_FAILURE');
    const priorChange = firstFailure
      ? [...timeline].reverse().find((t) => t.at < firstFailure.at && t.kind !== 'EXECUTION_FAILURE')
      : null;
    if (firstFailure && priorChange) {
      const deltaMin = Math.round((Date.parse(firstFailure.at) - Date.parse(priorChange.at)) / 60000);
      statements.push(
        `Failures began approximately ${deltaMin} minute(s) after ${priorChange.kind} (${priorChange.detail}). This is correlation, not proven causation.`,
      );
    } else if (firstFailure) {
      statements.push('Failures observed; no preceding deployment/config/schema change found in the evidence window.');
    } else {
      statements.push('No failures found in the evidence window.');
    }

    return {
      timeline,
      statements,
      evidenceCount: timeline.length,
    };
  }

  recommendOptimization(opts: {
    integrationId: string;
    current: {
      workers: number;
      batchSize: number;
      concurrency?: number;
      latencyMs?: number;
      rate429?: number;
      queueDepth?: number;
    };
    limits: {
      maxWorkers: number;
      maxConcurrency: number;
      maxBatchSize: number;
      maxRequestsPerSecond: number;
    };
  }): AiRecommendation {
    const { current, limits } = opts;
    const evidence: string[] = [
      `workers=${current.workers}`,
      `batchSize=${current.batchSize}`,
      `latencyMs=${current.latencyMs ?? 'n/a'}`,
      `rate429=${current.rate429 ?? 0}`,
      `queueDepth=${current.queueDepth ?? 0}`,
    ];

    let workers = current.workers;
    let batchSize = current.batchSize;
    let reason = 'No significant optimization suggested from provided metrics.';

    if ((current.rate429 || 0) > 0.05) {
      workers = Math.max(1, Math.min(workers - 2, limits.maxWorkers));
      batchSize = Math.min(Math.max(batchSize, 20), limits.maxBatchSize);
      reason = 'Elevated 429 rate — recommend fewer workers and larger batches within safety limits.';
    } else if ((current.latencyMs || 0) > 3000 && (current.queueDepth || 0) > 100) {
      workers = Math.min(workers + 2, limits.maxWorkers);
      reason = 'High latency with queue backlog — cautiously increase workers within limits.';
    }

    // Hard clamp — AI cannot exceed policy limits
    workers = clamp(workers, 1, limits.maxWorkers);
    batchSize = clamp(batchSize, 1, limits.maxBatchSize);

    return this.createRecommendation({
      type: 'OPTIMIZATION',
      reason,
      evidence,
      confidence: (current.rate429 || 0) > 0.05 ? 'HIGH' : 'MEDIUM',
      affectedIntegrationId: opts.integrationId,
      proposedChange: {
        workers,
        batchSize,
        concurrency: clamp(current.concurrency || workers, 1, limits.maxConcurrency),
        requiresApproval: true,
        respectsLimits: true,
      },
      risk: workers < current.workers ? 'LOW' : 'MEDIUM',
    });
  }

  generateTransformSpec(instruction: string): {
    ok: boolean;
    transformation: string | null;
    error?: string;
  } {
    // Deterministic parse of "Convert X values: A → 1; B → 2"
    const body = instruction.replace(/^convert\s+\w+\s+values:\s*/i, '').trim();
    const parts = body.split(/;|\n/).map((s) => s.trim()).filter(Boolean);
    const pairs: string[] = [];
    for (const part of parts) {
      const m = part.match(/^(.+?)\s*(?:→|->|=)\s*(.+)$/);
      if (!m) return { ok: false, transformation: null, error: `Unparseable mapping: ${part}` };
      pairs.push(`${m[1].trim()}→${m[2].trim()}`);
    }
    if (!pairs.length) return { ok: false, transformation: null, error: 'No mappings found' };
    return { ok: true, transformation: pairs.join(';') };
  }

  generateTests(opts: { integrationId: string; mappings: Array<{ sourceField: string; targetField: string }> }) {
    const cases = [
      { name: 'happy_path', focus: 'valid mapped fields' },
      { name: 'null_values', focus: 'null/empty sources' },
      { name: 'invalid_types', focus: 'wrong types' },
      { name: 'missing_fields', focus: 'absent required fields' },
      { name: 'duplicates', focus: 'duplicate match keys' },
      { name: 'http_429', focus: 'rate limit' },
      { name: 'http_500', focus: 'server error' },
      { name: 'http_401', focus: 'auth failure' },
      { name: 'timeout', focus: 'request timeout' },
      { name: 'reference_failures', focus: 'lookup miss' },
      { name: 'schema_changes', focus: 'field removed' },
      { name: 'large_payloads', focus: 'oversized records' },
      { name: 'pagination', focus: 'multi-page source' },
    ];
    const tests = cases.map((c) => ({
      id: randomUUID(),
      integrationId: opts.integrationId,
      name: c.name,
      focus: c.focus,
      sampleInput: opts.mappings.reduce((acc, m) => {
        acc[m.sourceField] = c.name === 'null_values' ? null : 'sample';
        return acc;
      }, {} as Record<string, unknown>),
      harness: 'vis-test-harness',
    }));
    this.store.create('generatedTests', {
      integrationId: opts.integrationId,
      tests,
      createdAt: new Date().toISOString(),
    });
    return tests;
  }

  generateDocumentation(opts: {
    integrationId: string;
    name: string;
    design?: Record<string, unknown> | null;
    version?: { id: string; version: number };
    approvals?: unknown[];
  }) {
    const safe = this.sanitizer.sanitize({
      purpose: opts.design?.summary || opts.name,
      source: opts.design?.source || null,
      target: opts.design?.target || null,
      event: opts.design?.executionMode || null,
      schedule: opts.design?.schedule || null,
      mapping: 'See version mappings',
      transformation: 'See mapping transformations',
      authentication: 'credentialReferenceId only — secrets excluded',
      retry: opts.design?.retryPolicy || null,
      rateLimit: opts.design?.rateLimit || null,
      failureBehavior: 'DLQ + bounded retry',
      dependencies: [],
      version: opts.version || null,
      approvalHistory: opts.approvals || [],
    }) as Record<string, unknown>;

    const markdown = [
      `# ${opts.name}`,
      '',
      `## Purpose`,
      String(safe.purpose || ''),
      '',
      `## Version`,
      JSON.stringify(safe.version),
      '',
      `## Authentication`,
      String(safe.authentication),
      '',
      `## Failure behavior`,
      String(safe.failureBehavior),
      '',
      `_Generated by VIS AI Documentation — contains no secrets._`,
    ].join('\n');

    return this.store.create('generatedDocs', {
      integrationId: opts.integrationId,
      markdown,
      structured: safe,
      createdAt: new Date().toISOString(),
    });
  }

  createRecommendation(input: Omit<AiRecommendation, 'id' | 'createdAt' | 'status'> & { status?: AiRecommendationStatus }) {
    const rec = this.store.create('aiRecommendations', {
      ...input,
      evidence: this.sanitizer.sanitize(input.evidence) as string[],
      proposedChange: this.sanitizer.sanitize(input.proposedChange) as Record<string, unknown>,
      status: input.status || 'PROPOSED',
      createdAt: new Date().toISOString(),
    });
    return rec as unknown as AiRecommendation;
  }

  setRecommendationStatus(id: string, status: AiRecommendationStatus) {
    const row = this.store.get('aiRecommendations', id);
    if (!row) throw Object.assign(new Error('Recommendation not found'), { status: 404 });
    return this.store.update('aiRecommendations', id, { status, updatedAt: new Date().toISOString() });
  }

  listRecommendations(integrationId?: string) {
    const all = this.store.list('aiRecommendations');
    return integrationId
      ? all.filter((r) => r.affectedIntegrationId === integrationId)
      : all;
  }

  /** Validate AI structured output against expected keys — never trust raw AI. */
  validateAiOutput(output: unknown, requiredKeys: string[]): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!output || typeof output !== 'object') {
      return { ok: false, errors: ['Output must be an object'] };
    }
    for (const k of requiredKeys) {
      if (!(k in (output as object))) errors.push(`Missing key: ${k}`);
    }
    const joined = JSON.stringify(output);
    if (/password|api[_-]?key\s*[:=]|Bearer\s+\S+/i.test(joined)) {
      errors.push('Secret-like material in AI output');
    }
    return { ok: errors.length === 0, errors };
  }

  buildSafePrompt(opts: {
    system: string;
    userRequirement: string;
    metadata?: Record<string, unknown>;
    externalData?: unknown;
  }) {
    return this.sanitizer.buildPromptSections(opts);
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
