/**
 * Phase 4 — Real-time / event-driven integration tests.
 * Run: VIS_STORE_MEMORY=1 npx tsx backend/test/vis/vis.phase4.test.ts
 */
import { resolve } from 'path';
import { rmSync, existsSync } from 'fs';
import { VisService } from '../../src/vis/integrations/vis.service';
import { resetVisStoreForTests, getVisStore } from '../../src/vis/store/vis.store';
import {
  resetEventIngestionService,
  normalizeEvent,
  validateEventSchema,
  EventDeduplicationService,
  EventLoopPreventionService,
  evaluateEventFilter,
  signHmac,
  WebhookSecurityService,
  defaultRealtimeConfig,
  EventOrderingService,
} from '../../src/vis/events/index';
import { defaultMatchingStrategy } from '../../src/vis/core/mapping/index';
import type { FieldMappingSpec } from '../../src/vis/core/types/index';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const SAMPLE_MAPPINGS: FieldMappingSpec[] = [
  { id: 'm1', sourceField: 'id', targetField: 'vulnerability_id', enabled: true, confidence: 'HIGH' },
  {
    id: 'm2',
    sourceField: 'severity',
    targetField: 'priority',
    transformation: 'Critical→1;High→2;Medium→3;Low→4',
    enabled: true,
    confidence: 'HIGH',
  },
  { id: 'm3', sourceField: 'description', targetField: 'description', enabled: true, confidence: 'HIGH' },
];

async function prepareRealtime(vis: VisService, prompt?: string) {
  const created = vis.createIntegration({
    name: 'RT Sync',
    promptText:
      prompt
      || 'Whenever a vulnerability is created in DEV, create it in UAT immediately.',
  });
  await vis.analyzeIntegration(created.id);
  vis.saveMappings(created.id, SAMPLE_MAPPINGS);
  vis.setDirectionConnections(created.id, { selectedFormId: 'form-vulnerability' });
  vis.setMatchingStrategy(created.id, defaultMatchingStrategy(SAMPLE_MAPPINGS) as any);
  await vis.validateIntegration(created.id);
  vis.approveIntegration(created.id);
  vis.setEventConfig(created.id, defaultRealtimeConfig({
    eventEnabled: true,
    webhookAuthType: 'NONE',
    sourceEnvironmentId: 'DEV',
    targetEnvironmentId: 'UAT',
    loopPreventionEnabled: true,
    maxHopCount: 1,
    payloadStrategy: 'EVENT_PAYLOAD',
    orderingStrategy: 'PER_ENTITY',
  }));
  const activated = vis.activateIntegration(created.id);
  const endpoint = vis.getRealtimeStatus(created.id).endpoint;
  return { integrationId: created.id, endpointId: String(endpoint?.id), activated };
}

async function waitForEvent(
  vis: VisService,
  integrationId: string,
  eventId: string,
  timeoutMs = 5000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const events = vis.listEvents({ integrationId });
    const hit = events.find((e) => e.eventId === eventId);
    if (hit && ['SUCCESS', 'FAILED', 'DEAD_LETTER', 'DUPLICATE', 'REJECTED', 'IGNORED'].includes(String(hit.status))) {
      return hit;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  return vis.listEvents({ integrationId }).find((e) => e.eventId === eventId) || null;
}

async function main() {
  console.log('VIS_PHASE4_START');
  process.env.VIS_STORE_MEMORY = '1';
  const storePath = resolve(process.cwd(), '.vis-data/test-store-phase4.json');
  process.env.VIS_STORE_PATH = storePath;
  if (existsSync(storePath)) rmSync(storePath);
  resetVisStoreForTests(storePath);
  resetEventIngestionService();
  const vis = new VisService();

  // ── AI understands realtime prompts ────────────────────────────────────
  const created = vis.createIntegration({
    name: 'AI RT',
    promptText: 'Whenever a vulnerability is created in DEV, create it in UAT immediately.',
  });
  const analyzed = await vis.analyzeIntegration(created.id);
  assert(
    analyzed.design?.executionMode === 'REAL_TIME'
      || analyzed.design?.executionMode === 'REALTIME'
      || analyzed.design?.executionMode === 'EVENT_DRIVEN',
    `executionMode realtime got ${analyzed.design?.executionMode}`,
  );
  assert(analyzed.eventConfig?.eventEnabled, 'event config seeded');

  // ── Envelope + schema ──────────────────────────────────────────────────
  const env = normalizeEvent({
    body: {
      eventType: 'RECORD_CREATED',
      entityId: 'VUL-RT-1',
      entityType: 'Vulnerability',
      payload: { id: 'VUL-RT-1', severity: 'Critical', description: 'rt' },
    },
    sourceEnvironment: 'DEV',
  });
  assert(env.eventId && env.correlationId, 'envelope ids');
  const schemaOk = validateEventSchema(env, { allowedTypes: ['RECORD_CREATED'] });
  assert(schemaOk.ok, 'schema ok');
  const schemaBad = validateEventSchema(env, { allowedTypes: ['RECORD_DELETED'] });
  assert(!schemaBad.ok, 'schema rejects wrong type');

  // ── Filters ────────────────────────────────────────────────────────────
  assert(
    evaluateEventFilter(env, {
      logic: 'AND',
      conditions: [{ field: 'payload.severity', op: 'equals', value: 'Critical' }],
    }),
    'filter match',
  );
  assert(
    !evaluateEventFilter(env, {
      logic: 'AND',
      conditions: [{ field: 'payload.severity', op: 'equals', value: 'Low' }],
    }),
    'filter miss',
  );

  // ── Dedup ──────────────────────────────────────────────────────────────
  const dedup = new EventDeduplicationService();
  assert(dedup.check(env) === 'FIRST_SEEN', 'first');
  assert(dedup.check(env) === 'DUPLICATE', 'dup');
  for (let i = 0; i < 100; i++) assert(dedup.check(env) === 'DUPLICATE', 'dup100');

  // ── HMAC security ──────────────────────────────────────────────────────
  const store = getVisStore();
  const cred = store.create('credentials', { name: 'wh', secret: 'super-secret' });
  const sec = new WebhookSecurityService(async (id) => {
    const c = store.get('credentials', id);
    return c ? String((c as any).secret) : null;
  });
  const body = JSON.stringify({ hello: 'world' });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = signHmac('super-secret', body, ts);
  const ok = await sec.verify(
    {
      authType: 'HMAC',
      credentialRefId: cred.id,
      signatureHeader: 'x-signature',
      timestampHeader: 'x-timestamp',
    },
    { 'x-signature': sig, 'x-timestamp': ts },
    body,
  );
  assert(ok.ok, 'hmac ok');
  const bad = await sec.verify(
    { authType: 'HMAC', credentialRefId: cred.id },
    { 'x-signature': 'deadbeef', 'x-timestamp': ts },
    body,
  );
  assert(!bad.ok, 'hmac reject');

  // ── Loop prevention ────────────────────────────────────────────────────
  const loops = new EventLoopPreventionService();
  const loopEnv = normalizeEvent({
    body: {
      eventType: 'RECORD_CREATED',
      entityId: 'X',
      originIntegrationId: 'int-1',
      hopCount: 1,
      payload: { id: 'X' },
    },
  });
  assert(
    !loops.check(loopEnv, { integrationId: 'int-1', maxHopCount: 1, enabled: true }).allow,
    'loop blocked',
  );
  assert(
    loops.check({ ...loopEnv, hopCount: 0, originIntegrationId: null }, {
      integrationId: 'int-2',
      maxHopCount: 1,
      enabled: true,
    }).allow,
    'loop allow',
  );

  // ── Ordering ───────────────────────────────────────────────────────────
  const ordering = new EventOrderingService();
  const order: string[] = [];
  await Promise.all([
    ordering.withOrder('PER_ENTITY', { integrationId: 'i', entityId: 'e1' }, async () => {
      order.push('a-start');
      await new Promise((r) => setTimeout(r, 30));
      order.push('a-end');
    }),
    ordering.withOrder('PER_ENTITY', { integrationId: 'i', entityId: 'e1' }, async () => {
      order.push('b-start');
      order.push('b-end');
    }),
  ]);
  assert(order.indexOf('a-end') < order.indexOf('b-start'), `order ${order}`);

  // ── End-to-end webhook → execution ─────────────────────────────────────
  resetEventIngestionService();
  const vis2 = new VisService();
  const { integrationId, endpointId } = await prepareRealtime(vis2);
  assert(endpointId, 'endpoint');

  const eventBody = {
    eventId: 'evt-e2e-1',
    eventType: 'RECORD_CREATED',
    entityType: 'Vulnerability',
    entityId: 'VUL-E2E-1',
    sourceEnvironment: 'DEV',
    payload: {
      id: 'VUL-E2E-1',
      severity: 'High',
      description: 'Realtime e2e',
      team: 'Platform',
    },
  };
  const ingest = await vis2.ingestWebhook(endpointId, {}, JSON.stringify(eventBody), eventBody);
  assert(ingest.status === 202, `ingest ${ingest.status}`);
  assert((ingest.body as any).accepted === true, 'accepted');

  const done = await waitForEvent(vis2, integrationId, 'evt-e2e-1');
  assert(done, 'event completed');
  assert(String(done.status) === 'SUCCESS', `event status ${done.status}`);
  assert(Number(done.endToEndLatencyMs) >= 0, 'latency measured');

  // Duplicate webhook — no second create
  const before = getVisStore().list('mockRecords').filter((r) => {
    const d = r.data as any;
    return d?.vulnerability_id === 'VUL-E2E-1' || d?.id === 'VUL-E2E-1';
  }).length;
  const dup = await vis2.ingestWebhook(endpointId, {}, JSON.stringify(eventBody), eventBody);
  assert((dup.body as any).duplicate === true, 'duplicate flagged');
  await new Promise((r) => setTimeout(r, 100));
  const after = getVisStore().list('mockRecords').filter((r) => {
    const d = r.data as any;
    return d?.vulnerability_id === 'VUL-E2E-1' || d?.id === 'VUL-E2E-1';
  }).length;
  assert(after === before, 'no duplicate target');

  // Invalid signature when HMAC enabled
  vis2.setEventConfig(integrationId, {
    webhookAuthType: 'HMAC',
    webhookCredentialRefId: cred.id,
  });
  const rejected = await vis2.ingestWebhook(
    endpointId,
    { 'x-signature': 'nope' },
    JSON.stringify(eventBody),
    { ...eventBody, eventId: 'evt-bad-sig' },
  );
  assert(rejected.status === 401, `sig reject ${rejected.status}`);

  // Switch back to NONE for remaining tests
  vis2.setEventConfig(integrationId, { webhookAuthType: 'NONE', webhookCredentialRefId: null });

  // Filter reject
  vis2.setEventConfig(integrationId, {
    filters: {
      logic: 'AND',
      conditions: [{ field: 'payload.severity', op: 'equals', value: 'Critical' }],
    },
  });
  const filtered = await vis2.ingestWebhook(
    endpointId,
    {},
    JSON.stringify({ ...eventBody, eventId: 'evt-filtered', payload: { id: 'VUL-F', severity: 'Low', description: 'x' } }),
    { ...eventBody, eventId: 'evt-filtered', entityId: 'VUL-F', payload: { id: 'VUL-F', severity: 'Low', description: 'x' } },
  );
  assert((filtered.body as any).reason === 'FILTERED', 'filtered');

  vis2.setEventConfig(integrationId, { filters: null });

  // Pause / resume
  vis2.pauseIntegration(integrationId);
  assert(vis2.getIntegration(integrationId).status === 'PAUSED', 'paused');
  const pausedIngest = await vis2.ingestWebhook(
    endpointId,
    {},
    JSON.stringify({ ...eventBody, eventId: 'evt-paused', entityId: 'VUL-PAUSE', payload: { id: 'VUL-PAUSE', severity: 'High', description: 'p' } }),
    { ...eventBody, eventId: 'evt-paused', entityId: 'VUL-PAUSE', payload: { id: 'VUL-PAUSE', severity: 'High', description: 'p' } },
  );
  assert(pausedIngest.status === 202, 'queued while paused');
  vis2.resumeIntegration(integrationId);
  assert(vis2.getIntegration(integrationId).status === 'ACTIVE', 'resumed');

  // Loop prevention on ingest
  const loopBody = {
    eventId: 'evt-loop',
    eventType: 'RECORD_CREATED',
    entityId: 'VUL-LOOP',
    sourceEnvironment: 'DEV',
    originIntegrationId: integrationId,
    hopCount: 1,
    payload: { id: 'VUL-LOOP', severity: 'High', description: 'loop' },
  };
  const loopRes = await vis2.ingestWebhook(endpointId, {}, JSON.stringify(loopBody), loopBody);
  assert((loopRes.body as any).reason === 'LOOP_PREVENTED', 'loop prevented');

  // Test event dry-run
  const dry = await vis2.testEvent(integrationId, {
    eventType: 'RECORD_CREATED',
    entityId: 'VUL-DRY',
    payload: { id: 'VUL-DRY', severity: 'Critical', description: 'dry' },
  }, { dryRun: true });
  assert(dry.dryRun === true, 'dry run');
  assert(dry.schema?.ok, 'dry schema');

  // Replay
  const successEvents = vis2.listEvents({ integrationId }).filter((e) => e.status === 'SUCCESS');
  if (successEvents.length) {
    const replayed = await vis2.replayEvent(String(successEvents[0].id));
    assert(replayed, 'replay created');
  }

  // Polling fallback
  vis2.setEventConfig(integrationId, {
    eventSourceType: 'POLLING',
    pollingIntervalSeconds: 60,
    webhookAuthType: 'NONE',
  });
  getVisStore().create('mockRecords', {
    formId: 'form-vulnerability',
    data: { id: 'VUL-POLL-1', vulnerability_id: 'VUL-POLL-1', severity: 'Medium', description: 'polled', priority: '3' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const polled = await vis2.pollIntegration(integrationId);
  assert(polled.emitted >= 1, `poll emitted ${polled.emitted}`);

  // Status / metrics
  const status = vis2.getRealtimeStatus(integrationId);
  assert(status.health === 'HEALTHY' || status.health === 'DEGRADED', `health ${status.health}`);
  assert(status.metrics.eventsReceived >= 1, 'metrics received');

  // Load sample — 1,000 events (measured)
  resetEventIngestionService();
  const vis3 = new VisService();
  const prep = await prepareRealtime(vis3);
  const loadCount = Number(process.env.VIS_EVENT_LOAD || 1000);
  console.log(`VIS_PHASE4_LOAD_START count=${loadCount}`);
  const t0 = Date.now();
  let accepted = 0;
  let duplicates = 0;
  for (let i = 0; i < loadCount; i++) {
    const ev = {
      eventId: `load-${i}`,
      eventType: 'RECORD_CREATED',
      entityType: 'Vulnerability',
      entityId: `VUL-L${i}`,
      sourceEnvironment: 'DEV',
      payload: {
        id: `VUL-L${i}`,
        severity: 'Low',
        description: `load ${i}`,
      },
    };
    const res = await vis3.ingestWebhook(prep.endpointId, {}, JSON.stringify(ev), ev);
    if ((res.body as any).duplicate) duplicates += 1;
    else if (res.status < 300) accepted += 1;
  }
  // Wait for drain
  const drainStart = Date.now();
  while (Date.now() - drainStart < 30_000) {
    const pending = vis3.listEvents({ integrationId: prep.integrationId }).filter((e) =>
      ['QUEUED', 'PROCESSING', 'RETRYING'].includes(String(e.status)),
    );
    if (pending.length === 0) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const elapsed = Date.now() - t0;
  const st = vis3.getRealtimeStatus(prep.integrationId);
  const succeeded = st.metrics.eventsSucceeded;
  const eps = succeeded / (elapsed / 1000 || 1);
  console.log(
    `LOAD_SAMPLE count=${loadCount} accepted=${accepted} duplicates=${duplicates} succeeded=${succeeded} elapsedMs=${elapsed} eventsPerSec=${eps.toFixed(1)} p50=${st.metrics.p50LatencyMs} p95=${st.metrics.p95LatencyMs} p99=${st.metrics.p99LatencyMs}`,
  );
  assert(succeeded >= loadCount * 0.9, `most succeeded got ${succeeded}`);

  console.log('VIS_PHASE4_TESTS_OK');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
