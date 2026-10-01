/**
 * Execution planner — convert approved design into a validated ExecutionPlan.
 */
import type {
  DirectionConfig,
  ExecutionPlan,
  FieldMappingSpec,
  IntegrationDesign,
  MatchingStrategy,
} from '../core/types/index';
import { defaultMatchingStrategy } from '../core/mapping/index';

export class ExecutionPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionPlanError';
  }
}

export function buildCorrelationId(prefix = 'INT'): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${y}${m}${day}-${rand}`;
}

export function buildExecutionPlan(input: {
  integrationId: string;
  versionId?: string | null;
  versionNumber?: number | null;
  design: IntegrationDesign;
  direction: DirectionConfig;
  correlationId?: string;
  sourceAuthType?: string;
  sourceCredentialRefId?: string | null;
  sourceListPath?: string | null;
}): ExecutionPlan {
  const { design, direction } = input;
  const mappings = (direction.mappings || []).filter((m) => m.enabled !== false);
  const matching: MatchingStrategy =
    direction.matchingStrategy || defaultMatchingStrategy(mappings as FieldMappingSpec[]);

  const plan: ExecutionPlan = {
    integrationId: input.integrationId,
    versionId: input.versionId || null,
    versionNumber: input.versionNumber ?? null,
    correlationId: input.correlationId || buildCorrelationId('INT'),
    source: {
      kind: direction.sourceKind || design.source,
      connectionId: direction.sourceConnectionId || null,
      listPath: input.sourceListPath || '/vulnerabilities',
      pagination: 'PAGE',
      pageSize: direction.batchSize || design.batchSize || 500,
    },
    target: {
      kind: direction.targetKind || design.target,
      connectionId: direction.targetConnectionId || null,
      formId: direction.selectedFormId || null,
    },
    direction: design.direction,
    operations: direction.operations?.length ? direction.operations : design.operations,
    mappings: mappings as FieldMappingSpec[],
    matchingStrategy: matching,
    authentication: {
      authType: (input.sourceAuthType as any) || design.authHint || 'NONE',
      credentialRefId: input.sourceCredentialRefId || null,
    },
    batching: {
      batchSize: direction.batchSize || design.batchSize || 500,
      preferBulk: false,
    },
    workers: {
      count: Math.max(1, Math.min(50, direction.workers || design.workers || 5)),
      concurrencyPerWorker: Math.max(
        1,
        Math.min(50, direction.concurrency || design.concurrency || 10),
      ),
    },
    retryPolicy: {
      type: direction.retryPolicy || design.retryPolicy || 'EXPONENTIAL',
      maxAttempts: direction.retryMaxAttempts || 5,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
    },
    rateLimit: {
      perMinute:
        direction.rateLimitPerMinute === undefined
          ? (design.rateLimitPerMinute ?? 120)
          : direction.rateLimitPerMinute,
      maxConcurrent:
        Math.max(1, (direction.workers || 5) * (direction.concurrency || 10)),
    },
    idempotency: {
      strategy: direction.idempotencyStrategy || design.idempotencyStrategy || 'EXTERNAL_ID',
    },
    timeouts: {
      connectionMs: 5000,
      readMs: 30000,
      totalMs: 60000,
    },
    language: direction.language || design.language,
  };

  validateExecutionPlan(plan);
  return plan;
}

export function validateExecutionPlan(plan: ExecutionPlan): void {
  if (!plan.integrationId) throw new ExecutionPlanError('integrationId is required');
  if (!plan.correlationId) throw new ExecutionPlanError('correlationId is required');
  if (!plan.operations?.length) throw new ExecutionPlanError('operations are required');
  if (!plan.mappings?.length) {
    throw new ExecutionPlanError('At least one enabled mapping is required');
  }
  if (!plan.matchingStrategy?.sourceFields?.length || !plan.matchingStrategy?.targetFields?.length) {
    throw new ExecutionPlanError('matchingStrategy source/target fields are required');
  }
  if (!plan.source.connectionId && plan.source.kind !== 'REST_API') {
    // allow missing for mock in-process runs with injected connectors
  }
  if (plan.workers.count < 1) throw new ExecutionPlanError('workers.count must be >= 1');
  if (plan.batching.batchSize < 1) throw new ExecutionPlanError('batchSize must be >= 1');
}
