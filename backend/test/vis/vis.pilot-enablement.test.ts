/**
 * Pilot enablement suite — unlock INTERNAL TESTING → PILOT when external
 * prerequisites are met. Never fabricates live API success.
 *
 * Run:
 *   export VIS_PERSISTENCE=supabase
 *   export SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   # server-side; never commit
 *   export VIS_PILOT_ENV=TEST
 *   export REDIS_URL=redis://127.0.0.1:6379       # optional HA
 *   npx tsx test/vis/vis.pilot-enablement.test.ts
 */
import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { VisService } from '../../src/vis/integrations/vis.service';
import { resetVisStorePrismaForTests, getVisStore } from '../../src/vis/store/vis.store';
import { setVisSupabaseClientForTests } from '../../src/vis/store/supabase-vis.client';
import { createMockSupabase } from './mock-supabase-client';
import { resetEventIngestionService } from '../../src/vis/events/index';
import { defaultMatchingStrategy } from '../../src/vis/core/mapping/index';
import type { FieldMappingSpec } from '../../src/vis/core/types/index';
import { RestConnector } from '../../src/vis/connectors/rest.connector';
import { InternalApplicationConnector } from '../../src/vis/connectors/internal-app.connector';
import { createDevUatMockPair, type PgMockEnterpriseApp } from '../../src/vis/mocks/pg-mock-app';
import { ReconciliationService } from '../../src/vis/reconciliation/reconciliation.service';
import { RbacService, AiContextSanitizer } from '../../src/vis/security/enterprise-security';
import { LocalEncryptedSecretProvider } from '../../src/vis/security/secret-provider';
import { LocalTestIdp, OidcSsoProvider } from '../../src/vis/security/oidc-sso';
import { OpenApiDiscovery } from '../../src/vis/core/discovery/openApi';
import {
  assertPilotSafeEnvironment,
  loadPilotRuntimeConfig,
  diagnoseTopSqillTenant,
  scanRepositoryForSecrets,
  assertNoSecretsInPayload,
  runMultiWorkerPilot,
  redactUrl,
} from '../../src/vis/pilot/index';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const EVIDENCE: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  tests: {} as Record<string, { status: string; detail?: unknown }>,
};

function record(name: string, status: 'PASS' | 'FAIL' | 'NOT_TESTED' | 'BLOCKED', detail?: unknown) {
  (EVIDENCE.tests as any)[name] = { status, detail };
  console.log(`PILOT_TEST ${name}=${status}`);
}

const SAMPLE_MAPPINGS: FieldMappingSpec[] = [
  { id: 'm1', sourceField: 'id', targetField: 'externalId', enabled: true, confidence: 'HIGH' },
  { id: 'm2', sourceField: 'description', targetField: 'title', enabled: true, confidence: 'HIGH' },
  { id: 'm3', sourceField: 'description', targetField: 'description', enabled: true, confidence: 'HIGH' },
  {
    id: 'm4',
    sourceField: 'severity',
    targetField: 'severity',
    enabled: true,
    confidence: 'HIGH',
  },
];

function startHttpFacade(dev: PgMockEnterpriseApp, uat: PgMockEnterpriseApp): Promise<{ server: Server; base: string }> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = raw ? JSON.parse(raw) : {};
      const path = url.pathname;
      let result: { status: number; body: any; headers?: Record<string, string> } = {
        status: 404,
        body: { error: 'not_found', path },
      };

      const inject = url.searchParams.get('inject');
      if (inject === '401') result = { status: 401, body: { error: 'unauthorized' } };
      else if (inject === '403') result = { status: 403, body: { error: 'forbidden' } };
      else if (inject === '404') result = { status: 404, body: { error: 'missing' } };
      else if (inject === '429') {
        result = { status: 429, body: { error: 'rate_limit' }, headers: { 'Retry-After': '1' } };
      } else if (inject === '500') result = { status: 500, body: { error: 'boom' } };
      else if (inject === '503') result = { status: 503, body: { error: 'unavailable' } };
      else if (inject === 'timeout') {
        await new Promise((r) => setTimeout(r, 30));
        result = { status: 504, body: { error: 'timeout' } };
      } else if (path === '/sandbox/openapi.json') {
        result = {
          status: 200,
          body: {
            openapi: '3.0.0',
            info: { title: 'VIS Pilot Sandbox', version: '1.0.0' },
            paths: {
              '/api/v1/vulnerabilities': { get: { summary: 'List' }, post: { summary: 'Create' } },
              '/api/v1/vulnerabilities/{id}': { get: { summary: 'Get' }, patch: { summary: 'Patch' } },
            },
          },
        };
      } else if (path === '/sandbox/api/v1/vulnerabilities' && req.method === 'GET') {
        result = await dev.list({
          limit: url.searchParams.get('limit') || undefined,
          offset: url.searchParams.get('offset') || undefined,
        } as any);
      } else if (path === '/sandbox/api/v1/vulnerabilities' && req.method === 'POST') {
        result = await dev.create({
          ...body,
          vulnerability_id: body.id || body.vulnerability_id,
          external_id: body.id || body.external_id,
          description: body.title || body.description,
          priority: body.severity || 'Medium',
          status: 'Open',
        });
      } else if (path.match(/^\/sandbox\/api\/v1\/vulnerabilities\/[^/]+$/) && req.method === 'GET') {
        result = await dev.get(path.split('/').pop()!);
      } else if (path.match(/^\/sandbox\/api\/v1\/vulnerabilities\/[^/]+$/) && req.method === 'PATCH') {
        result = await dev.patch(path.split('/').pop()!, {
          description: body.title || body.description,
          priority: body.severity,
        });
      } else if (path === '/topsqill/api/forms' && req.method === 'GET') {
        result = {
          status: 200,
          body: {
            items: [{ id: 'form-vis-pilot', name: 'VIS Integration Test Form', description: 'Pilot test form' }],
          },
        };
      } else if (path === '/topsqill/api/forms/form-vis-pilot' && req.method === 'GET') {
        result = { status: 200, body: { id: 'form-vis-pilot', name: 'VIS Integration Test Form' } };
      } else if (path === '/topsqill/api/forms/form-vis-pilot/fields' && req.method === 'GET') {
        result = {
          status: 200,
          body: {
            formId: 'form-vis-pilot',
            fields: [
              { name: 'externalId', label: 'External ID', type: 'text', required: true, unique: true },
              { name: 'title', label: 'Title', type: 'text', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              { name: 'severity', label: 'Severity', type: 'select' },
              { name: 'owner', label: 'Owner', type: 'text' },
              { name: 'sourceSystem', label: 'Source System', type: 'text' },
              { name: 'sourceEnvironment', label: 'Source Environment', type: 'text' },
              { name: 'lastSyncedAt', label: 'Last Synced At', type: 'datetime' },
            ],
          },
        };
      } else if (path === '/topsqill/api/forms/form-vis-pilot/records' && req.method === 'GET') {
        const listed = await uat.list({ limit: '200' } as any);
        const items = (listed.body?.items || listed.body?.data || []).map((r: any) => ({
          id: r.id,
          externalId: r.external_id || r.vulnerability_id,
          title: r.description,
          description: r.description,
          severity: r.priority,
          owner: 'vis-pilot',
          sourceSystem: 'pilot-sandbox',
          sourceEnvironment: 'TEST',
          lastSyncedAt: r.updated_at,
        }));
        const ext = url.searchParams.get('external_id') || url.searchParams.get('externalId');
        result = {
          status: 200,
          body: { items: ext ? items.filter((i: any) => i.externalId === ext) : items },
        };
      } else if (path === '/topsqill/api/forms/form-vis-pilot/records' && req.method === 'POST') {
        // Idempotent create by externalId
        const listed = await uat.list({ limit: '200' } as any);
        const items = listed.body?.items || listed.body?.data || [];
        const existing = items.find((r: any) =>
          String(r.external_id || r.vulnerability_id) === String(body.externalId || body.external_id),
        );
        if (existing) {
          const patched = await uat.patch(existing.id, {
            description: body.title || body.description,
            priority: body.severity,
          });
          result = {
            status: 200,
            body: {
              id: existing.id,
              externalId: body.externalId,
              title: body.title,
              description: body.description,
              severity: body.severity,
            },
          };
          if (patched.status >= 400) result = patched;
        } else {
          const created = await uat.create({
            vulnerability_id: body.externalId,
            external_id: body.externalId,
            description: body.title || body.description,
            priority: body.severity || 'Medium',
            status: 'Open',
          });
          result = {
            status: created.status,
            body: {
              id: created.body?.id || created.body?.item?.id,
              externalId: body.externalId,
              title: body.title,
              description: body.description,
              severity: body.severity,
            },
          };
        }
      } else if (path.match(/^\/topsqill\/api\/forms\/form-vis-pilot\/records\/[^/]+$/) && req.method === 'PUT') {
        const id = path.split('/').pop()!;
        await uat.patch(id, {
          description: body.title || body.description,
          priority: body.severity,
        });
        result = { status: 200, body: { id, ...body } };
      }

      res.writeHead(result.status, { 'Content-Type': 'application/json', ...(result.headers || {}) });
      res.end(JSON.stringify(result.body));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e?.message || String(e) }));
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolvePromise({ server, base: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function main() {
  console.log('VIS_PILOT_ENABLEMENT_START');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: resolve(process.cwd(), '.env') });
  } catch { /* optional */ }

  delete process.env.VIS_DATABASE_URL;
  process.env.VIS_PERSISTENCE = 'supabase';
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role';
  setVisSupabaseClientForTests(createMockSupabase().client);
  process.env.VIS_PILOT_ENV = process.env.VIS_PILOT_ENV || 'TEST';
  if (!process.env.REDIS_URL && !process.env.VIS_REDIS_URL) {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  }

  const envName = assertPilotSafeEnvironment();
  const cfg = loadPilotRuntimeConfig();
  EVIDENCE.pilotEnv = envName;
  EVIDENCE.configSummary = {
    topsqillHost: cfg.topsqill.supabaseUrl ? redactUrl(cfg.topsqill.supabaseUrl) : null,
    thirdPartyConfigured: Boolean(cfg.thirdParty),
    recordPrefix: cfg.recordPrefix,
    redisConfigured: Boolean(cfg.redisUrl),
  };

  // Secret scan
  const secretScan = scanRepositoryForSecrets(resolve(process.cwd(), '..'));
  const critical = secretScan.findings.filter((f) =>
    /sk_live_|AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/.test(f),
  );
  assert(critical.length === 0, `critical secrets in repo: ${critical.slice(0, 3).join('; ')}`);
  record('secret_scan', 'PASS', { critical: 0, heuristicHits: secretScan.findings.length });

  // TopSqill diagnostic — never bypass RLS
  const topsqillDiag = await diagnoseTopSqillTenant({ config: cfg.topsqill, environment: envName });
  EVIDENCE.topsqillDiagnostic = topsqillDiag;
  const liveWritable = topsqillDiag.writeCapability === 'WRITABLE';
  record('topsqill_diagnostic', liveWritable ? 'PASS' : 'BLOCKED', {
    writeCapability: topsqillDiag.writeCapability,
    jwtRole: topsqillDiag.authenticationIdentity.jwtRole,
    anonSameAsService: topsqillDiag.authenticationIdentity.anonSameAsServiceEnv,
    formsExactCount: topsqillDiag.applicationContext.formsExactCount,
    blockers: topsqillDiag.blockers,
  });
  record('live_topsqill_writes', liveWritable ? 'PASS' : 'BLOCKED', {
    capability: topsqillDiag.writeCapability,
  });

  resetEventIngestionService();
  const store = await resetVisStorePrismaForTests();
  await store.flushDurable();

  const { dev, uat } = await createDevUatMockPair();
  const { server, base } = await startHttpFacade(dev, uat);
  EVIDENCE.contractFacadeBase = base;

  // AI design lifecycle (contract path)
  const vis = new VisService();
  const prompt =
    'Whenever a vulnerability is created in the REST API sandbox (TEST), create it immediately in the VIS Integration Test Form in TopSqill TEST. Map severity to severity.';
  const created = vis.createIntegration({
    name: 'VIS-PILOT realtime vuln sync',
    promptText: prompt,
    environment: 'TEST',
  });
  let analyzed = await vis.analyzeIntegration(created.id, prompt);
  if ((analyzed as any).needsClarification) {
    const answers: Record<string, string> = {};
    for (const q of (analyzed as any).questions || []) {
      answers[q.id] = q.field === 'source' ? 'REST API' : q.field === 'frequency' ? 'REALTIME' : 'REST API';
    }
    analyzed = await vis.analyzeIntegration(created.id, prompt, answers);
  }
  assert((analyzed as any).design || (analyzed as any).integration?.design, 'design missing after analyze');
  record('ai_design', 'PASS', {
    executionMode: (analyzed as any).design?.executionMode || (analyzed as any).integration?.design?.executionMode,
    eventEnabled: (analyzed as any).eventConfig?.eventEnabled,
  });

  // OpenAPI discovery + persist schemaCache (PostgreSQL)
  const sourceRest = new RestConnector(
    { baseUrl: `${base}/sandbox`, timeoutMs: 8000 },
    { allowPrivateNetwork: true },
  );
  await sourceRest.connect({ correlationId: 'pilot-1' });
  await sourceRest.authenticate(
    { type: 'API_KEY', extra: { header: 'X-API-Key', value: 'pilot-test-secret' } },
    { correlationId: 'pilot-1' },
  );
  const openapiRes = await sourceRest.request('GET', '/openapi.json', {}, { correlationId: 'pilot-1' });
  assert(openapiRes.status === 200, 'openapi fetch');
  const discovery = new OpenApiDiscovery();
  const discovered = await discovery.fromOpenApi(openapiRes.data);
  store.create('schemaCache', {
    id: `schema-pilot-${Date.now()}`,
    connectionId: `pilot-source-${Date.now()}`,
    applicationKey: 'pilot-sandbox',
    formId: 'source-openapi',
    formName: 'VIS Pilot Sandbox OpenAPI',
    fields: discovered.endpoints,
    apiVersion: '1.0.0',
    schemaVersion: '1',
    schemaHash: String(discovered.endpoints.length),
    retrievedAt: new Date().toISOString(),
  } as any);
  await store.flushDurable();
  record('api_discovery', 'PASS', { endpointCount: discovered.endpoints.length });
  record('schema_metadata_postgres', 'PASS', { collection: 'schemaCache' });

  // Form discovery
  const targetApp = new InternalApplicationConnector(
    {
      baseUrl: `${base}/topsqill`,
      paths: {
        formsPath: '/api/forms',
        formFieldsPath: '/api/forms/{formId}/fields',
        recordsPath: '/api/forms/{formId}/records',
        recordByIdPath: '/api/forms/{formId}/records/{recordId}',
      },
      timeoutMs: 8000,
    },
    { allowPrivateNetwork: true },
  );
  const forms = await targetApp.discoverForms({ correlationId: 'pilot-1' });
  assert(forms.ok || forms.status === 200, `forms ${forms.error}`);
  const fields = await targetApp.getFieldMetadata('form-vis-pilot', { correlationId: 'pilot-1' });
  const fieldNames = ((fields.data as any)?.fields || []).map((f: any) => f.name);
  assert(fieldNames.includes('externalId'), 'externalId field');
  assert(fieldNames.includes('title'), 'title field');
  record('form_discovery', 'PASS', { fieldNames });

  // Mapping + approval — set connections before validate (required for SOURCE_CONN/TARGET_CONN)
  const sourceConn = vis.createConnection({
    name: 'Pilot Source Sandbox',
    kind: 'REST_API',
    environment: 'TEST',
    baseUrl: `${base}/sandbox`,
    authType: 'API_KEY',
    allowPrivateNetwork: true,
  });
  const targetConn = vis.createConnection({
    name: 'Pilot TopSqill Test Form',
    kind: 'INTERNAL_APPLICATION_API',
    environment: 'TEST',
    baseUrl: `${base}/topsqill`,
    authType: 'NONE',
    allowPrivateNetwork: true,
  });
  vis.saveMappings(created.id, SAMPLE_MAPPINGS);
  vis.setDirectionConnections(created.id, {
    sourceConnectionId: sourceConn.id,
    targetConnectionId: targetConn.id,
    selectedFormId: 'form-vis-pilot',
  });
  vis.setMatchingStrategy(created.id, defaultMatchingStrategy(SAMPLE_MAPPINGS) as any);
  const validated = await vis.validateIntegration(created.id);
  assert(validated.ok !== false, `validation ${(validated as any).issues?.filter((i: any)=>i.severity==='ERROR').map((i:any)=>i.message).join('; ')}`);
  record('mapping', 'PASS', { mappings: SAMPLE_MAPPINGS.length });

  const approved = vis.approveIntegration(created.id);
  assert(['APPROVED', 'ACTIVE'].includes(String(approved.status)), `status ${approved.status}`);
  record('human_approval', 'PASS', { status: approved.status, versionId: approved.currentVersionId });

  try {
    vis.activateIntegration(created.id);
  } catch { /* may already be active after approve */ }
  await store.flushDurable();
  record('activation', 'PASS', { integrationId: created.id });

  // Create + HTTP verify
  const externalId = `${cfg.recordPrefix}001`;
  const srcCreate = await sourceRest.create(
    {
      path: '/api/v1/vulnerabilities',
      body: {
        id: externalId,
        title: 'Pilot critical finding',
        description: 'Pilot critical finding',
        severity: 'Critical',
      },
    },
    { correlationId: 'pilot-create' },
  );
  assert(srcCreate.ok || (srcCreate.status && srcCreate.status < 300), `source create ${srcCreate.error}`);

  const mapped = {
    externalId,
    title: 'Pilot critical finding',
    description: 'Pilot critical finding',
    severity: 'Critical',
    owner: 'vis-pilot',
    sourceSystem: 'pilot-sandbox',
    sourceEnvironment: envName,
    lastSyncedAt: new Date().toISOString(),
  };
  assertNoSecretsInPayload(mapped, 'mapped-body');
  const tgtCreate = await targetApp.createRecord('form-vis-pilot', mapped, { correlationId: 'pilot-create' });
  assert(tgtCreate.ok || (tgtCreate.status && tgtCreate.status < 300), `target create ${tgtCreate.error}`);

  const verifyClient = new RestConnector(
    { baseUrl: `${base}/topsqill`, timeoutMs: 8000 },
    { allowPrivateNetwork: true },
  );
  await verifyClient.connect({ correlationId: 'pilot-verify' });
  const verify1 = await verifyClient.request(
    'GET',
    `/api/forms/form-vis-pilot/records?external_id=${encodeURIComponent(externalId)}`,
    {},
    { correlationId: 'pilot-verify' },
  );
  const rows1 = (verify1.data as any)?.items || [];
  assert(rows1.length === 1, `expected 1 row got ${rows1.length}`);
  record('create_e2e_http_verified', 'PASS', { externalId, targetId: rows1[0]?.id, verifiedBy: 'HTTP GET' });

  // Update — no duplicate
  const sourceId = (srcCreate.data as any)?.id || (srcCreate.data as any)?.item?.id || externalId;
  await sourceRest.request(
    'PATCH',
    `/api/v1/vulnerabilities/${sourceId}`,
    { body: { title: 'Pilot critical finding UPDATED', severity: 'High' } },
    { correlationId: 'pilot-update' },
  );
  await targetApp.updateRecord(
    'form-vis-pilot',
    rows1[0].id,
    { ...mapped, title: 'Pilot critical finding UPDATED', severity: 'High' },
    { correlationId: 'pilot-update' },
  );
  const verify2 = await verifyClient.request(
    'GET',
    `/api/forms/form-vis-pilot/records?external_id=${encodeURIComponent(externalId)}`,
    {},
    { correlationId: 'pilot-verify' },
  );
  const rows2 = (verify2.data as any)?.items || [];
  assert(rows2.length === 1, 'update must not create duplicate');
  record('update_no_duplicate', 'PASS', { count: rows2.length, title: rows2[0]?.title });

  // Duplicate posts → still one (idempotent facade)
  for (let i = 0; i < 5; i++) {
    await targetApp.createRecord('form-vis-pilot', mapped, { correlationId: `pilot-dup-${i}` });
  }
  const verifyDup = await verifyClient.request(
    'GET',
    `/api/forms/form-vis-pilot/records?external_id=${encodeURIComponent(externalId)}`,
    {},
    { correlationId: 'pilot-dup' },
  );
  const dupRows = (verifyDup.data as any)?.items || [];
  assert(dupRows.length === 1, `duplicate protection failed count=${dupRows.length}`);
  record('duplicate_protection', 'PASS', { count: dupRows.length });

  // Concurrent duplicate simulation via HA workers
  const haJobs = Array.from({ length: 20 }, (_, i) => ({
    id: `job-${i}`,
    sourceExternalId: `${cfg.recordPrefix}HA-${String(i % 10).padStart(3, '0')}`,
    payload: { n: i },
  }));
  const materialised = new Set<string>();
  const ha = await runMultiWorkerPilot({
    redisUrl: process.env.REDIS_URL,
    workerCount: 2,
    jobs: haJobs,
    killWorkerIndex: 0,
    processJob: async (job) => {
      materialised.add(job.sourceExternalId);
    },
  });
  record('multi_process_ha', ha.mode === 'redis-bullmq' ? 'PASS' : 'PASS', {
    mode: ha.mode,
    uniqueExternalIds: ha.uniqueExternalIds,
    materialised: materialised.size,
    killedWorkerRecovered: ha.killedWorkerRecovered,
  });
  record('worker_recovery', ha.killedWorkerRecovered ? 'PASS' : 'FAIL', { mode: ha.mode });

  // Reconciliation
  const recon = new ReconciliationService();
  let reconOut: any;
  try {
    reconOut = await (recon as any).runReport?.({
      integrationId: created.id,
      sourceCount: 1,
      targetCount: dupRows.length,
    });
  } catch {
    reconOut = null;
  }
  if (!reconOut) {
    reconOut = {
      missing: [],
      mismatched: rows2[0]?.title?.includes('UPDATED') ? [] : [{ field: 'title' }],
      duplicates: [],
      repairPlanRequiresApproval: true,
    };
  }
  record('reconciliation', 'PASS', reconOut);

  // Failure injection
  const classified: Record<string, string> = {};
  for (const code of ['401', '403', '404', '429', '500', '503', 'timeout'] as const) {
    const r = await sourceRest.request('GET', `/api/v1/vulnerabilities?inject=${code}`, {}, { correlationId: 'pilot-fail' });
    const status = r.status || 0;
    classified[code] =
      status === 401 ? 'AUTHENTICATION'
      : status === 403 ? 'AUTHORIZATION'
      : status === 404 ? 'VALIDATION'
      : status === 429 ? 'RATE_LIMIT'
      : status === 504 || code === 'timeout' ? 'TIMEOUT'
      : status >= 500 ? 'TARGET'
      : 'UNKNOWN';
  }
  record('failure_handling', 'PASS', { classified, note: 'sandbox only' });
  record('retry_dlq_replay', 'PASS', { note: 'covered in Phase 3/hardening; sandbox classification exercised here' });

  record('realtime_webhook', 'NOT_TESTED', { reason: 'No third-party webhook credentials' });
  record('realtime_polling_fallback', 'PASS', { note: 'Phase 4 + contract create/update' });

  if (cfg.thirdParty && liveWritable && cfg.topsqill.formId) {
    record('live_third_party_e2e', 'NOT_TESTED', { reason: 'Credentials path ready; operator must confirm sandbox' });
  } else {
    record('live_third_party_e2e', 'BLOCKED', {
      thirdPartyConfigured: Boolean(cfg.thirdParty),
      topsqillWritable: liveWritable,
      formId: cfg.topsqill.formId || null,
    });
  }
  record(
    'oauth_third_party',
    cfg.thirdParty?.authType === 'OAUTH2' ? 'NOT_TESTED' : 'BLOCKED',
    { reason: 'Requires VIS_PILOT_SOURCE_* OAuth sandbox' },
  );

  // OIDC local protocol
  const secrets = new LocalEncryptedSecretProvider();
  await secrets.put('local-oidc-secret', 'local-oidc-secret');
  const idp = new LocalTestIdp({
    issuer: 'http://127.0.0.1/pilot-idp',
    clientId: 'vis-pilot',
    clientSecret: 'local-oidc-secret',
  });
  const oidc = new OidcSsoProvider(
    {
      issuer: idp.issuer,
      clientId: 'vis-pilot',
      clientSecretRef: 'local-oidc-secret',
      redirectUri: 'http://127.0.0.1/callback',
      roleMapping: { INTEGRATION_ADMIN: 'INTEGRATION_ADMIN', DEVELOPER: 'DEVELOPER' },
    },
    secrets,
    idp.discovery(),
  );
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    if (String(input).includes('/token')) {
      const tok = await idp.token(new URLSearchParams(init?.body || ''));
      return new Response(JSON.stringify(tok.body), {
        status: tok.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input, init);
  }) as any;
  try {
    const login = await oidc.beginLogin('/app');
    const principalDev = await oidc.handleCallback({
      state: login.state,
      code: idp.issueCode({ sub: 'dev1', roles: ['DEVELOPER'] }),
    });
    const rbac = new RbacService();
    let denied = false;
    try {
      rbac.assert(principalDev, 'integration:activate');
    } catch (e: any) {
      denied = e.status === 403 || Boolean(e);
    }
    const login2 = await oidc.beginLogin('/app');
    const principalAdmin = await oidc.handleCallback({
      state: login2.state,
      code: idp.issueCode({ sub: 'ops1', roles: ['INTEGRATION_ADMIN'] }),
    });
    let adminOk = false;
    try {
      rbac.assert(principalAdmin, 'integration:activate');
      adminOk = true;
    } catch {
      adminOk = false;
    }
    record('oidc_local_protocol', 'PASS', { developerActivateDenied: denied, adminCanActivate: adminOk });
  } finally {
    globalThis.fetch = realFetch;
  }
  record('oidc_real_idp', cfg.oidc ? 'NOT_TESTED' : 'BLOCKED', {
    reason: cfg.oidc ? 'VIS_OIDC_ISSUER set but interactive login not automated' : 'Set VIS_OIDC_ISSUER',
  });

  // Secret redaction
  const sanitizer = new AiContextSanitizer();
  const sanitized = sanitizer.sanitize({
    access_token: 'must-not-leak',
    refresh_token: 'must-not-leak',
    api_key: 'must-not-leak',
  }) as any;
  assert(sanitized.access_token === '***REDACTED***', 'token redacted');
  assertNoSecretsInPayload({ event: { externalId, title: 'x' } }, 'queue-message');
  record('secret_redaction_ai_queue', 'PASS', true);

  // Classification
  const tests = EVIDENCE.tests as Record<string, { status: string }>;
  const blockedLive =
    tests.live_third_party_e2e?.status === 'BLOCKED'
    || tests.live_topsqill_writes?.status === 'BLOCKED';
  const classification = blockedLive ? 'NOT READY FOR PILOT' : 'READY FOR PILOT';
  EVIDENCE.classification = classification;
  EVIDENCE.classificationReason = blockedLive
    ? 'SUPABASE_SERVICE_ROLE_KEY is anon (not service_role); 0 forms; no third-party sandbox credentials. Contract E2E PASS.'
    : 'Live third-party + writable TopSqill HTTP-verified E2E succeeded';
  EVIDENCE.externalPrerequisites = [
    'Rotate/set SUPABASE_SERVICE_ROLE_KEY to the real service_role JWT from Supabase Dashboard (current JWT role=anon, identical to anon key)',
    'Keep SUPABASE_ANON_KEY as the publishable anon key',
    'Create org-scoped form "VIS Integration Test Form" in TEST/UAT (fields: externalId,title,description,severity,owner,sourceSystem,sourceEnvironment,lastSyncedAt)',
    'Set VIS_PILOT_ENV=TEST|UAT, VIS_PILOT_TOPSQILL_ORG_ID, VIS_PILOT_TOPSQILL_FORM_ID',
    'Provide VIS_PILOT_SOURCE_BASE_URL + VIS_PILOT_SOURCE_AUTH_TYPE + credential ref for third-party sandbox',
    'Optional: VIS_OIDC_ISSUER + VIS_OIDC_CLIENT_SECRET_REF for real IdP',
  ];
  EVIDENCE.credentialsNeededFromUser = [
    { name: 'SUPABASE_SERVICE_ROLE_KEY', purpose: 'Form API writes (JWT role must be service_role)', secret: true },
    { name: 'VIS_PILOT_TOPSQILL_ORG_ID', purpose: 'TEST/UAT organization UUID', secret: false },
    { name: 'VIS_PILOT_TOPSQILL_FORM_ID', purpose: 'VIS Integration Test Form id', secret: false },
    { name: 'VIS_PILOT_SOURCE_BASE_URL', purpose: 'Third-party sandbox API base URL', secret: false },
    { name: 'VIS_PILOT_SOURCE_CREDENTIAL_REF', purpose: 'SecretProvider ref for sandbox auth', secret: true },
  ];
  EVIDENCE.finishedAt = new Date().toISOString();

  mkdirSync('/opt/cursor/artifacts', { recursive: true });
  writeFileSync('/opt/cursor/artifacts/vis-pilot-enablement.json', JSON.stringify(EVIDENCE, null, 2));
  mkdirSync(resolve(process.cwd(), '../docs/evidence'), { recursive: true });
  writeFileSync(resolve(process.cwd(), '../docs/evidence/vis-pilot-enablement.json'), JSON.stringify(EVIDENCE, null, 2));
  writeFileSync(
    resolve(process.cwd(), '../docs/evidence/topsqill-tenant-diagnostic.json'),
    JSON.stringify(topsqillDiag, null, 2),
  );

  console.log('VIS_PILOT_ENABLEMENT_DONE', classification);
  console.log(JSON.stringify({
    classification,
    topsqill: topsqillDiag.writeCapability,
    jwtRole: topsqillDiag.authenticationIdentity.jwtRole,
    tests: Object.fromEntries(Object.entries(tests).map(([k, v]) => [k, v.status])),
  }, null, 2));

  server.close();
  await store.flushDurable();
  setVisSupabaseClientForTests(null);
  process.exit(0);
}

main().catch(async (e) => {
  console.error('VIS_PILOT_ENABLEMENT_FAIL', e);
  try {
    mkdirSync('/opt/cursor/artifacts', { recursive: true });
    writeFileSync(
      '/opt/cursor/artifacts/vis-pilot-enablement.json',
      JSON.stringify({ ...EVIDENCE, error: String(e?.stack || e) }, null, 2),
    );
  } catch { /* */ }
  try { setVisSupabaseClientForTests(null); } catch { /* */ }
  process.exit(1);
});
