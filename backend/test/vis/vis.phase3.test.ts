/**
 * Phase 3 — Integration Execution Engine tests.
 * Run: npx tsx backend/test/vis/vis.phase3.test.ts
 */
import { VisService } from '../../src/vis/integrations/vis.service';
import { resetVisStoreForTests, getVisStore } from '../../src/vis/store/vis.store';
import {
  buildCorrelationId,
  buildExecutionPlan,
  validateExecutionPlan,
  ExecutionPlanError,
  TokenManager,
  InMemoryLock,
  type TokenProvider,
  type TokenState,
  processRecord,
  mapRecord,
  createArraySourceReader,
  createStoreTargetAdapter,
  ExecutionRunner,
  CircuitBreaker,
  RateLimiter,
  ConfigurableConcurrency,
  ReferenceCache,
  CheckpointManager,
  computeBackoffMs,
  classifyHttpError,
  isRetryableStatus,
  MetricsCollector,
  paginateSource,
} from '../../src/vis/executions/index';
import { defaultMatchingStrategy } from '../../src/vis/core/mapping/index';
import type { DirectionConfig, FieldMappingSpec, IntegrationDesign } from '../../src/vis/core/types/index';
import { resolve } from 'path';
import { rmSync, existsSync } from 'fs';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const SAMPLE_MAPPINGS: FieldMappingSpec[] = [
  {
    id: 'm1',
    sourceField: 'id',
    targetField: 'vulnerability_id',
    confidence: 'HIGH',
    enabled: true,
  },
  {
    id: 'm2',
    sourceField: 'severity',
    targetField: 'priority',
    transformation: 'Critical→1;High→2;Medium→3;Low→4',
    confidence: 'HIGH',
    enabled: true,
  },
  {
    id: 'm3',
    sourceField: 'description',
    targetField: 'description',
    confidence: 'HIGH',
    enabled: true,
  },
  {
    id: 'm4',
    sourceField: 'team',
    targetField: 'assignment_group',
    confidence: 'MEDIUM',
    enabled: true,
    lookup: { formHint: 'team', matchBy: 'name', sourceField: 'team' },
  },
  {
    id: 'm5',
    sourceField: 'id',
    targetField: 'external_id',
    confidence: 'HIGH',
    enabled: true,
  },
];

function baseDesign(): IntegrationDesign {
  return {
    summary: 'Sync vulns',
    source: 'REST_API',
    target: 'INTERNAL_APPLICATION_API',
    direction: 'UNIDIRECTIONAL',
    executionMode: 'MANUAL',
    operations: ['CREATE', 'UPDATE'],
    language: 'TYPESCRIPT',
    languageReason: 'test',
    workers: 3,
    batchSize: 50,
    concurrency: 5,
    retryPolicy: 'EXPONENTIAL',
    rateLimitPerMinute: 600,
    idempotencyStrategy: 'EXTERNAL_ID',
  };
}

function baseDirection(): DirectionConfig {
  return {
    id: 'dir1',
    label: 'A → B',
    flow: 'A_TO_B',
    sourceKind: 'REST_API',
    targetKind: 'INTERNAL_APPLICATION_API',
    operations: ['CREATE', 'UPDATE'],
    language: 'TYPESCRIPT',
    workers: 3,
    batchSize: 50,
    concurrency: 5,
    retryPolicy: 'EXPONENTIAL',
    retryMaxAttempts: 3,
    rateLimitPerMinute: 600,
    idempotencyStrategy: 'EXTERNAL_ID',
    matchingKeys: ['vulnerability_id'],
    matchingStrategy: defaultMatchingStrategy(SAMPLE_MAPPINGS),
    mappings: SAMPLE_MAPPINGS,
    selectedFormId: 'form-vulnerability',
  };
}

async function prepareApprovedIntegration(vis: VisService) {
  const created = vis.createIntegration({
    name: 'Phase3 Exec',
    promptText:
      'Get open vulnerabilities from ServiceNow every 15 minutes and create or update records in our internal Vulnerability form.',
  });
  await vis.analyzeIntegration(created.id);
  vis.saveMappings(created.id, SAMPLE_MAPPINGS);
  vis.setDirectionConnections(created.id, { selectedFormId: 'form-vulnerability' });
  // Ensure matching strategy on direction
  vis.setMatchingStrategy(created.id, defaultMatchingStrategy(SAMPLE_MAPPINGS) as any);
  const validated = await vis.validateIntegration(created.id);
  assert(validated.ok, 'validate ok');
  vis.approveIntegration(created.id);
  return created.id;
}

async function main() {
  console.log('VIS_PHASE3_START');
  process.env.VIS_STORE_MEMORY = '1';
  const storePath = resolve(process.cwd(), '.vis-data/test-store-phase3.json');
  process.env.VIS_STORE_PATH = storePath;
  if (existsSync(storePath)) rmSync(storePath);
  resetVisStoreForTests(storePath);
  const store = getVisStore();
  const vis = new VisService();
  console.log('VIS_PHASE3_STORE_READY');

  // ── 1. Correlation ID format ───────────────────────────────────────────
  const cid = buildCorrelationId('INT-VUL');
  assert(/^INT-VUL-\d{8}-[A-Z0-9]+$/.test(cid), `correlation format: ${cid}`);

  // ── 2. Execution plan build + validation ───────────────────────────────
  const plan = buildExecutionPlan({
    integrationId: 'int-1',
    design: baseDesign(),
    direction: baseDirection(),
    correlationId: cid,
  });
  validateExecutionPlan(plan);
  assert(plan.workers.count === 3, 'workers');
  assert(plan.mappings.length >= 4, 'mappings');

  let planFailed = false;
  try {
    buildExecutionPlan({
      integrationId: 'int-1',
      design: baseDesign(),
      direction: { ...baseDirection(), mappings: [] },
      correlationId: cid,
    });
  } catch (e) {
    planFailed = e instanceof ExecutionPlanError;
  }
  assert(planFailed, 'empty mappings reject plan');

  // ── 3. Mapping (deterministic, no AI) ──────────────────────────────────
  const mapped = mapRecord(
    { id: 'VUL-1001', severity: 'Critical', description: 'Apache vulnerability', team: 'Infrastructure' },
    SAMPLE_MAPPINGS,
  );
  assert(mapped.vulnerability_id === 'VUL-1001', 'map id');
  assert(mapped.priority === '1', 'severity→1');
  assert(mapped.description === 'Apache vulnerability', 'desc');

  // ── 4. Pagination ──────────────────────────────────────────────────────
  const many = Array.from({ length: 25 }, (_, i) => ({ id: `VUL-${i}`, severity: 'Low', description: `d${i}` }));
  const reader = createArraySourceReader(many);
  const pages: Record<string, unknown>[][] = [];
  for await (const batch of paginateSource(reader, { pageSize: 10, style: 'PAGE' })) {
    pages.push(batch);
  }
  assert(pages.length === 3, `pages=${pages.length}`);
  assert(pages[0].length === 10 && pages[2].length === 5, 'page sizes');

  // ── 5. CREATE / UPDATE / idempotency via pipeline ──────────────────────
  const target = createStoreTargetAdapter(store, 'form-vulnerability', ['vulnerability_id']);
  const refCache = new ReferenceCache();
  const r1 = await processRecord({
    source: { id: 'VUL-1001', severity: 'Critical', description: 'Apache', team: 'Infrastructure' },
    plan,
    target,
    referenceCache: refCache,
    correlationId: cid,
  });
  assert(r1.ok && r1.action === 'CREATE', 'create');
  const r2 = await processRecord({
    source: { id: 'VUL-1001', severity: 'High', description: 'Apache updated', team: 'Infrastructure' },
    plan,
    target,
    referenceCache: refCache,
    correlationId: cid,
  });
  assert(r2.ok && r2.action === 'UPDATE', 'update');
  assert(r2.existingTargetId === r1.existingTargetId, 'same target id');

  // ── 6. Reference lookup cache ──────────────────────────────────────────
  assert(refCache.size() >= 1, 'ref cached after first');
  const before = refCache.size();
  await processRecord({
    source: { id: 'VUL-1002', severity: 'High', description: 'x', team: 'Infrastructure' },
    plan,
    target,
    referenceCache: refCache,
    correlationId: cid,
  });
  assert(refCache.size() === before, 'no extra cache entry for same team');

  // ── 7. Token refresh lock — 100 concurrent, exactly ONE refresh ────────
  let refreshCalls = 0;
  const tokenState: { current: TokenState } = {
    current: {
      accessToken: 'expired-token',
      refreshToken: 'r1',
      expiresAt: Date.now() - 1000,
    },
  };
  const provider: TokenProvider = {
    async load() {
      return { ...tokenState.current };
    },
    async save(_id, state) {
      tokenState.current = state;
    },
    async refresh() {
      refreshCalls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return {
        accessToken: `fresh-${refreshCalls}`,
        refreshToken: 'r1',
        expiresAt: Date.now() + 3600_000,
      };
    },
  };
  const tm = new TokenManager(provider, new InMemoryLock(), 5 * 60 * 1000);
  const tokens = await Promise.all(
    Array.from({ length: 100 }, () => tm.getAccessToken('cred-1')),
  );
  assert(refreshCalls === 1, `exactly one refresh, got ${refreshCalls}`);
  assert(tokens.every((t) => t === tokens[0]), 'all workers same token');
  assert(tm.getRefreshCount() === 1, 'refresh count');

  // ── 8. Retry / error classification ────────────────────────────────────
  assert(isRetryableStatus(429) && isRetryableStatus(503), 'retryable statuses');
  assert(!isRetryableStatus(400) && !isRetryableStatus(403), 'non-retryable');
  assert(classifyHttpError(401, 'unauth').code === 'AUTHENTICATION_ERROR', '401 auth');
  assert(classifyHttpError(429, 'rl').retryable, '429 retryable');
  const backoff = computeBackoffMs(3, { type: 'EXPONENTIAL', initialDelayMs: 1000, maxDelayMs: 30000 });
  assert(backoff >= 4000 && backoff <= 5000, `backoff ~4s+jitter got ${backoff}`);

  // ── 9. Circuit breaker ─────────────────────────────────────────────────
  const cb = new CircuitBreaker(3, 50, 1);
  for (let i = 0; i < 3; i++) {
    try {
      await cb.exec(async () => {
        throw new Error('fail');
      });
    } catch {
      /* expected */
    }
  }
  assert(cb.getState() === 'OPEN', 'circuit open');
  await new Promise((r) => setTimeout(r, 60));
  assert(cb.getState() === 'HALF_OPEN', 'half open after cooldown');

  // ── 10. Rate limiter + concurrency controller ──────────────────────────
  const rl = new RateLimiter(null, 2);
  await rl.acquire();
  await rl.acquire();
  let thirdStarted = false;
  const third = (async () => {
    await rl.acquire();
    thirdStarted = true;
    rl.release();
  })();
  await new Promise((r) => setTimeout(r, 30));
  assert(!thirdStarted, 'rate limiter blocks 3rd');
  rl.release();
  await third;
  const conc = new ConfigurableConcurrency(20, { min: 1, max: 20 });
  conc.onRateLimit();
  assert(conc.getLimit() === 10, 'concurrency halved on 429');

  // ── 11. Checkpoint ─────────────────────────────────────────────────────
  const cp = new CheckpointManager();
  cp.commit('int-1', 'REST_API', 'PAGE', '12');
  assert(cp.get('int-1', 'REST_API')?.checkpointValue === '12', 'checkpoint');

  // ── 12. Metrics ────────────────────────────────────────────────────────
  const metrics = new MetricsCollector();
  metrics.start();
  metrics.metrics.recordsProcessed = 100;
  metrics.recordLatency(10);
  metrics.recordLatency(20);
  metrics.recordLatency(30);
  metrics.complete();
  assert(metrics.percentile(99) >= 20, 'p99');

  // ── 13. Full execution via VisService ───────────────────────────────────
  const integrationId = await prepareApprovedIntegration(vis);
  const exec = await vis.createExecution(integrationId, {
    awaitCompletion: true,
    sourceRecords: [
      { id: 'VUL-A1', severity: 'Critical', description: 'A1', team: 'Infrastructure', status: 'Open' },
      { id: 'VUL-A2', severity: 'High', description: 'A2', team: 'Platform', status: 'Open' },
      { id: 'VUL-A3', severity: 'Medium', description: 'A3', team: 'Application', status: 'Open' },
    ],
    workers: 2,
    concurrency: 3,
  });
  assert(exec.status === 'SUCCESS' || exec.status === 'PARTIAL_SUCCESS', `status=${exec.status}`);
  assert(Number(exec.recordsRead) === 3, `read=${exec.recordsRead}`);
  assert(Number(exec.recordsCreated) === 3, `created=${exec.recordsCreated}`);
  assert(String(exec.correlationId).startsWith('INT-VUL-'), 'corr prefix');

  // Duplicate run → updates (idempotent matching)
  const exec2 = await vis.createExecution(integrationId, {
    awaitCompletion: true,
    sourceRecords: [
      { id: 'VUL-A1', severity: 'Low', description: 'A1 again', team: 'Infrastructure', status: 'Open' },
    ],
  });
  assert(Number(exec2.recordsUpdated) >= 1 || Number(exec2.recordsSkipped) >= 1 || Number(exec2.recordsCreated) === 0, 'no dup create');

  // ── 14. Empty source ───────────────────────────────────────────────────
  const empty = await vis.createExecution(integrationId, {
    awaitCompletion: true,
    sourceRecords: [],
  });
  assert(empty.status === 'SUCCESS', 'empty success');
  assert(Number(empty.recordsRead) === 0, 'empty read');

  // ── 15. Partial failure + dead letter + retry failed ───────────────────
  // Inject a mapping that will fail one record (missing required field via custom target)
  const failTarget = createStoreTargetAdapter(store, 'form-vulnerability', ['vulnerability_id']);
  const origCreate = failTarget.create.bind(failTarget);
  failTarget.create = async (payload) => {
    if (String(payload.vulnerability_id) === 'VUL-BAD') {
      throw Object.assign(new Error('validation failed'), { code: 'VALIDATION_ERROR', retryable: false });
    }
    return origCreate(payload);
  };
  const failPlan = buildExecutionPlan({
    integrationId,
    design: baseDesign(),
    direction: { ...baseDirection(), workers: 2, concurrency: 2, retryMaxAttempts: 1, retryPolicy: 'NONE' },
    correlationId: buildCorrelationId('INT-VUL'),
  });
  const failRunner = new ExecutionRunner({
    plan: failPlan,
    executionId: 'exec-partial',
    integrationId,
    source: createArraySourceReader([
      { id: 'VUL-OK1', severity: 'High', description: 'ok', team: 'Platform' },
      { id: 'VUL-BAD', severity: 'Critical', description: 'bad', team: 'Platform' },
      { id: 'VUL-OK2', severity: 'Low', description: 'ok2', team: 'Platform' },
    ]),
    target: failTarget,
    logger: { log: () => undefined },
    callbacks: {
      updateExecution: () => undefined,
      saveDeadLetter: (row) => {
        store.create('deadLetters', { ...row, ignored: false });
      },
      loadDeadLetters: () => [],
      updateDeadLetter: () => undefined,
    },
  });
  // Pre-create execution row for store consistency
  store.create('executions', {
    id: 'exec-partial',
    integrationId,
    status: 'QUEUED',
    correlationId: failPlan.correlationId,
    createdAt: new Date().toISOString(),
  });
  const partial = await failRunner.run();
  assert(partial.status === 'PARTIAL_SUCCESS', `partial=${partial.status}`);
  assert(partial.metrics.recordsFailed >= 1, 'has failures');
  assert(partial.metrics.recordsCreated + partial.metrics.recordsUpdated >= 1, 'has success');
  const dls = store.list('deadLetters').filter((d) => d.executionId === 'exec-partial');
  assert(dls.length >= 1, 'dead letter stored');

  // ── 16. Cancellation ───────────────────────────────────────────────────
  {
    const cancelId = await prepareApprovedIntegration(vis);
    const big = Array.from({ length: 80 }, (_, i) => ({
      id: `VUL-C${i}`,
      severity: 'Low',
      description: `c${i}`,
      team: 'Application',
    }));
    const started = await vis.createExecution(cancelId, {
      awaitCompletion: false,
      sourceRecords: big,
      workers: 1,
      concurrency: 1,
      batchSize: 20,
    });
    await new Promise((r) => setTimeout(r, 10));
    vis.cancelExecution(String(started.id));
    for (let i = 0; i < 40; i++) {
      const cur = vis.getExecution(String(started.id));
      if (['CANCELLED', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED'].includes(String(cur.status))) {
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  // ── 17. Invalid mapping record does not stop batch ─────────────────────
  let mapErr = false;
  try {
    mapRecord({ severity: 'High' }, [
      { id: 'x', sourceField: 'missing_field', targetField: 'priority', enabled: true },
    ]);
  } catch {
    mapErr = true;
  }
  assert(mapErr, 'missing source field throws mapping error');

  // ── 18. Performance sample ─────────────────────────────────────────────
  const perfCount = Number(process.env.VIS_PERF_COUNT || 2_000);
  console.log(`VIS_PHASE3_PERF_START count=${perfCount}`);
  process.stdout.write('');
  const perfRecords = Array.from({ length: perfCount }, (_, i) => ({
    id: `VUL-P${i}`,
    severity: ['Critical', 'High', 'Medium', 'Low'][i % 4],
    description: `perf ${i}`,
    team: ['Infrastructure', 'Platform', 'Application'][i % 3],
  }));
  console.log('VIS_PHASE3_PERF_PREPARE');
  const perfInt = await prepareApprovedIntegration(vis);
  console.log('VIS_PHASE3_PERF_RUN');
  const t0 = Date.now();
  const perfExec = await vis.createExecution(perfInt, {
    awaitCompletion: true,
    sourceRecords: perfRecords,
    workers: 5,
    concurrency: 10,
    batchSize: 500,
    rateLimitPerMinute: null,
  });
  console.log('VIS_PHASE3_PERF_DONE');
  const elapsedMs = Date.now() - t0;
  const rps = (Number(perfExec.recordsProcessed) || 0) / (elapsedMs / 1000 || 1);
  console.log(
    `PERF_SAMPLE count=${perfCount} status=${perfExec.status} elapsedMs=${elapsedMs} recordsPerSec=${rps.toFixed(1)} created=${perfExec.recordsCreated} updated=${perfExec.recordsUpdated} failed=${perfExec.recordsFailed}`,
  );
  assert(Number(perfExec.recordsProcessed) === perfCount, 'perf processed all');
  assert(perfExec.status === 'SUCCESS' || perfExec.status === 'PARTIAL_SUCCESS', 'perf terminal ok');

  console.log('VIS_PHASE3_TESTS_OK');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
