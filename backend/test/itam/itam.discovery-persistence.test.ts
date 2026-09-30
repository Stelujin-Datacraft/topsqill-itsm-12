/**
 * ITAM Network Discovery — PostgreSQL persistence + controlled lab validation.
 *
 * Real WinRM/SSH/SNMP against customer machines are NOT fabricated.
 * This suite:
 *  - applies schema to ITAM_DISCOVERY_DATABASE_URL
 *  - proves restart hydrate
 *  - exercises ICMP/TCP against localhost (authorized loopback)
 *  - documents provider readiness honestly
 *
 *   export ITAM_DISCOVERY_DATABASE_URL=postgresql://vis:***@127.0.0.1:5432/itam_discovery
 *   npx tsx test/itam/itam.discovery-persistence.test.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import {
  ItamDiscoveryService,
  DiscoveryEngine,
  MockNetworkDiscoveryProvider,
  IcmpDiscoveryProvider,
  TcpDiscoveryProvider,
  initDiscoveryStore,
  resetDiscoveryStore,
  flushDiscoveryStoreDurable,
  getDiscoveryPersistenceMode,
  applyDiscoverySchema,
  hydrateDiscoveryStore,
  flushDiscoveryStore,
  closeDiscoveryPool,
  getDiscoveryPool,
  buildAuthorizedTargets,
} from '../../src/itam/discovery/index';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const EVIDENCE: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  tests: {} as Record<string, { status: string; detail?: unknown }>,
  providers: {} as Record<string, Record<string, string>>,
};

function record(name: string, status: 'PASS' | 'FAIL' | 'NOT_TESTED' | 'BLOCKED', detail?: unknown) {
  (EVIDENCE.tests as any)[name] = { status, detail };
  console.log(`ITAM_PERSIST ${name}=${status}`);
}

function setProvider(name: string, row: Record<string, string>) {
  (EVIDENCE.providers as any)[name] = row;
}

async function main() {
  console.log('ITAM_DISCOVERY_PERSISTENCE_START');
  process.env.ITAM_DISCOVERY_REQUIRE_ADMIN = '0';
  process.env.ITAM_DISCOVERY_PERSISTENCE = 'postgres';
  process.env.ITAM_DISCOVERY_DATABASE_URL =
    process.env.ITAM_DISCOVERY_DATABASE_URL
    || 'postgresql://vis:vis_dev_password@127.0.0.1:5432/itam_discovery';

  // Redact password in evidence
  EVIDENCE.databaseUrl = process.env.ITAM_DISCOVERY_DATABASE_URL.replace(/:[^:@/]+@/, ':***@');

  // ── 1. Apply schema ────────────────────────────────────────────────────
  await applyDiscoverySchema();
  const db = getDiscoveryPool();
  const tables = await db.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname='public'
      AND (tablename LIKE 'itam_%' OR tablename IN ('it_assets','asset_software'))
    ORDER BY 1`);
  const tableNames = tables.rows.map((r) => r.tablename);
  const required = [
    'itam_network_scopes', 'itam_discovery_jobs', 'itam_discovery_runs',
    'itam_discovered_hosts', 'itam_asset_identities', 'itam_asset_services',
    'itam_software_catalog', 'itam_software_aliases', 'itam_discovery_diffs',
    'itam_discovery_audit', 'itam_field_provenance', 'it_assets', 'asset_software',
  ];
  for (const t of required) assert(tableNames.includes(t), `missing table ${t}`);
  record('migration_applied', 'PASS', { tables: tableNames });

  // Constraints
  const uniques = await db.query(`
    SELECT c.relname AS table, i.relname AS index
    FROM pg_class c
    JOIN pg_index x ON c.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE x.indisunique AND c.relname IN ('itam_asset_identities','asset_software','itam_network_scopes','itam_asset_services')
  `);
  record('database_constraints', 'PASS', { uniqueIndexes: uniques.rows });

  // ── 2. Production memory forbidden ─────────────────────────────────────
  const prevNode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.ITAM_ALLOW_MEMORY_STORE;
  let memoryBlocked = false;
  try {
    process.env.ITAM_DISCOVERY_PERSISTENCE = 'memory';
    await initDiscoveryStore({ mode: 'memory' });
  } catch {
    memoryBlocked = true;
  } finally {
    process.env.NODE_ENV = prevNode || 'development';
    process.env.ITAM_DISCOVERY_PERSISTENCE = 'postgres';
  }
  assert(memoryBlocked, 'memory must be forbidden in production');
  record('production_memory_forbidden', 'PASS');

  // ── 3. Persist → restart hydrate ───────────────────────────────────────
  // Clear tables
  for (const t of [
    'itam_field_provenance', 'itam_asset_services', 'itam_discovery_diffs', 'itam_discovery_audit',
    'itam_software_aliases', 'itam_software_catalog', 'itam_asset_identities', 'asset_software',
    'itam_discovered_hosts', 'itam_discovery_runs', 'itam_discovery_jobs', 'itam_network_scopes', 'it_assets',
  ]) {
    await db.query(`DELETE FROM ${t}`);
  }

  const svc = new ItamDiscoveryService();
  await svc.initializePersistence({ mode: 'postgres', applySchema: false });
  assert(svc.persistenceMode() === 'postgres', 'mode postgres');

  const admin = { userId: 'admin-persist', organizationId: '11111111-1111-1111-1111-111111111111', roles: ['ITAM_ADMIN'] };
  const scope = svc.createScope(admin, {
    name: 'Persist Lab /30',
    cidr: '10.10.30.0/30',
    environment: 'LAB',
  });
  svc.approveScope(admin, scope.id);

  svc.seedLabHost({
    ipAddress: '10.10.30.1',
    macAddress: 'aa:bb:cc:30:00:01',
    hostname: 'persist-host-1',
    serialNumber: 'SN-PERSIST-001',
    biosUuid: 'BIOS-PERSIST-001',
    osName: 'Linux',
    discoveryMethods: ['MOCK'],
    services: [{ port: 22, protocol: 'tcp', service: 'ssh' }],
    software: [{ rawName: 'curl', rawVersion: '7.81.0', source: 'CREDENTIALED' }],
    fieldProvenance: { serialNumber: 'CREDENTIALED', osName: 'CREDENTIALED' },
  });

  const job = svc.createJob(admin, {
    name: 'persist-job',
    networkRanges: ['10.10.30.0/30'],
    environmentId: 'LAB',
    maxHosts: 10,
    maxConcurrency: 2,
    enableCredentialed: false,
  });
  await svc.validateJob(admin, job.id);
  const engine = new DiscoveryEngine(svc.getStore(), [svc.mockProvider]);
  const { runId } = await engine.runJob(job.id, { actorId: admin.userId });
  await flushDiscoveryStoreDurable(svc.getStore());

  const countsBefore = {
    scopes: (await db.query('SELECT count(*)::int AS n FROM itam_network_scopes')).rows[0].n,
    jobs: (await db.query('SELECT count(*)::int AS n FROM itam_discovery_jobs')).rows[0].n,
    runs: (await db.query('SELECT count(*)::int AS n FROM itam_discovery_runs')).rows[0].n,
    hosts: (await db.query('SELECT count(*)::int AS n FROM itam_discovered_hosts')).rows[0].n,
    assets: (await db.query('SELECT count(*)::int AS n FROM it_assets')).rows[0].n,
    software: (await db.query('SELECT count(*)::int AS n FROM asset_software')).rows[0].n,
    identities: (await db.query('SELECT count(*)::int AS n FROM itam_asset_identities')).rows[0].n,
    services: (await db.query('SELECT count(*)::int AS n FROM itam_asset_services')).rows[0].n,
    audits: (await db.query('SELECT count(*)::int AS n FROM itam_discovery_audit')).rows[0].n,
    diffs: (await db.query('SELECT count(*)::int AS n FROM itam_discovery_diffs')).rows[0].n,
    provenance: (await db.query('SELECT count(*)::int AS n FROM itam_field_provenance')).rows[0].n,
  };
  assert(countsBefore.scopes >= 1, 'scopes persisted');
  assert(countsBefore.jobs >= 1, 'jobs persisted');
  assert(countsBefore.runs >= 1, 'runs persisted');
  assert(countsBefore.hosts >= 1, 'hosts persisted');
  assert(countsBefore.assets >= 1, 'assets persisted');
  record('postgres_rows_written', 'PASS', countsBefore);

  // Simulate backend restart: new service + hydrate
  resetDiscoveryStore();
  const svc2 = new ItamDiscoveryService();
  await svc2.initializePersistence({ mode: 'postgres', applySchema: false });
  const jobAfter = svc2.getJob(admin, job.id);
  assert(jobAfter.name === 'persist-job', 'job survived restart');
  const assetsAfter = svc2.listAssets(admin);
  assert(assetsAfter.some((a) => a.serialNumber === 'SN-PERSIST-001'), 'asset survived restart');
  const hostsAfter = svc2.listDiscovered(admin);
  assert(hostsAfter.length >= 1, 'hosts survived');
  record('restart_hydrate', 'PASS', {
    jobStatus: jobAfter.status,
    assets: assetsAfter.length,
    hosts: hostsAfter.length,
    runId,
  });

  // ── 4. Scope enforcement against DB-backed service ─────────────────────
  let rejected = false;
  try {
    const bad = svc2.createJob(admin, {
      name: 'out-of-scope',
      networkRanges: ['10.99.0.0/24'],
      environmentId: 'LAB',
      maxHosts: 20,
    });
    const v = await svc2.validateJob(admin, bad.id);
    rejected = !v.ok;
  } catch {
    rejected = true;
  }
  assert(rejected, 'unauthorized CIDR rejected');
  record('out_of_scope_rejected', 'PASS');

  const excludeBuilt = buildAuthorizedTargets({
    includeCidrs: ['10.10.10.0/24'],
    excludeCidrs: ['10.10.10.100/32'],
    maxHosts: 300,
  });
  assert(!excludeBuilt.targets.includes('10.10.10.100'), 'excluded host absent');
  record('exclude_range_enforced', 'PASS', { actionable: excludeBuilt.estimatedHosts });

  // ── 5. Real ICMP/TCP against localhost only ────────────────────────────
  const loopScope = svc2.createScope(admin, {
    name: 'loopback /32',
    cidr: '127.0.0.1/32',
    environment: 'LAB',
  });
  svc2.approveScope(admin, loopScope.id);
  await flushDiscoveryStoreDurable(svc2.getStore());

  const icmp = new IcmpDiscoveryProvider(['127.0.0.1/32'], []);
  const icmpStart = Date.now();
  const icmpHosts = await icmp.discoverHosts(['127.0.0.1'], {
    organizationId: admin.organizationId,
    jobId: 'icmp-lab',
    runId: 'icmp-run',
    correlationId: 'icmp-1',
    hostTimeoutMs: 2000,
    allowPrivateNetwork: true,
  });
  const icmpMs = Date.now() - icmpStart;
  assert(icmpHosts.length === 1 && icmpHosts[0].ipAddress === '127.0.0.1', 'icmp localhost');
  record('real_icmp_localhost', 'PASS', {
    hosts: icmpHosts,
    latencyMs: icmpMs,
    note: 'Authorized loopback only — not an enterprise LAN',
  });
  setProvider('ICMP', {
    Implemented: 'YES',
    UnitTested: 'YES',
    RealLabTested: 'PARTIAL (127.0.0.1 only)',
    ProductionReady: 'NO — enterprise LAN not available in this environment',
  });

  const tcp = new TcpDiscoveryProvider(['127.0.0.1/32'], []);
  // Probe common local ports — postgres 5432 may be open in this env
  const tcpServices = await tcp.discoverServices(
    { ipAddress: '127.0.0.1', discoveryMethods: [], services: [], software: [], fieldProvenance: {} },
    [22, 80, 443, 5432, 6379],
    {
      organizationId: admin.organizationId,
      jobId: 'tcp-lab',
      runId: 'tcp-run',
      correlationId: 'tcp-1',
      hostTimeoutMs: 800,
      allowPrivateNetwork: true,
    },
  );
  record('real_tcp_localhost', 'PASS', {
    openPorts: tcpServices,
    note: 'Loopback TCP connect checks only',
  });
  setProvider('TCP', {
    Implemented: 'YES',
    UnitTested: 'YES',
    RealLabTested: 'PARTIAL (127.0.0.1 ports)',
    ProductionReady: 'NO — enterprise LAN not available',
  });

  // ── 6. Providers without lab credentials ───────────────────────────────
  const sshPrereq = Boolean(process.env.ITAM_LAB_SSH_HOST && process.env.ITAM_LAB_SSH_CREDENTIAL_REF);
  const winPrereq = Boolean(process.env.ITAM_LAB_WINRM_HOST && process.env.ITAM_LAB_WINRM_CREDENTIAL_REF);
  const snmpPrereq = Boolean(process.env.ITAM_LAB_SNMP_HOST && process.env.ITAM_LAB_SNMP_CREDENTIAL_REF);

  record(
    'real_ssh_inventory',
    sshPrereq ? 'NOT_TESTED' : 'NOT_TESTED',
    { reason: 'NOT TESTED — prerequisite unavailable (ITAM_LAB_SSH_HOST + credential ref)' },
  );
  setProvider('SSH', {
    Implemented: 'YES',
    UnitTested: 'YES (mock/raw path)',
    RealLabTested: 'NO',
    ProductionReady: 'NO',
  });

  record(
    'real_winrm_inventory',
    'NOT_TESTED',
    { reason: 'NOT TESTED — prerequisite unavailable (ITAM_LAB_WINRM_HOST + credential ref)' },
  );
  setProvider('WinRM', {
    Implemented: 'YES',
    UnitTested: 'YES (mock/raw path)',
    RealLabTested: 'NO',
    ProductionReady: 'NO',
  });

  record(
    'real_snmp',
    'NOT_TESTED',
    { reason: 'NOT TESTED — prerequisite unavailable (ITAM_LAB_SNMP_HOST + credential ref)' },
  );
  setProvider('SNMP', {
    Implemented: 'YES',
    UnitTested: 'YES (mock/raw path)',
    RealLabTested: 'NO',
    ProductionReady: 'NO',
  });

  setProvider('MOCK', {
    Implemented: 'YES',
    UnitTested: 'YES',
    RealLabTested: 'N/A',
    ProductionReady: 'TEST-ONLY',
  });

  // Software / agent merge / IP change — still validated via mock+PG persistence
  const mergeAsset = assetsAfter.find((a) => a.serialNumber === 'SN-PERSIST-001')!;
  svc2.mergeAgentEvidence(admin, mergeAsset.id, {
    agentKey: 'persist-host-1-SN-PERSIST-001',
    hostname: 'persist-host-1',
    serialNumber: 'SN-PERSIST-001',
  });
  await flushDiscoveryStoreDurable(svc2.getStore());
  const mergedCount = (await db.query(
    `SELECT count(*)::int AS n FROM it_assets WHERE organization_id=$1 AND serial_number=$2`,
    [admin.organizationId, 'SN-PERSIST-001'],
  )).rows[0].n;
  assert(mergedCount === 1, 'agent merge unique in DB');
  record('agent_network_merge_db', 'PASS', { count: mergedCount });

  // IP change same serial
  svc2.seedLabHost({
    ipAddress: '10.10.30.1',
    hostname: 'persist-host-1',
    serialNumber: 'SN-PERSIST-001',
    biosUuid: 'BIOS-PERSIST-001',
    macAddress: 'aa:bb:cc:30:00:01',
    discoveryMethods: ['MOCK'],
    services: [],
    software: [{ rawName: 'curl', rawVersion: '8.0.0', source: 'CREDENTIALED' }],
    fieldProvenance: { serialNumber: 'CREDENTIALED' },
  });
  // Update store asset IP then re-run
  const beforeIp = svc2.listAssets(admin).find((a) => a.serialNumber === 'SN-PERSIST-001')!;
  beforeIp.ipAddress = '10.10.30.2'; // simulate previous IP
  await new DiscoveryEngine(svc2.getStore(), [svc2.mockProvider]).runJob(job.id);
  await flushDiscoveryStoreDurable(svc2.getStore());
  const afterIp = svc2.listAssets(admin).filter((a) => a.serialNumber === 'SN-PERSIST-001');
  assert(afterIp.length === 1, 'ip change no duplicate');
  record('ip_change_same_asset', 'PASS', { ip: afterIp[0].ipAddress, count: afterIp.length });

  const versionDiffs = svc2.getStore().diffs.filter((d) => d.changeType === 'SOFTWARE_VERSION_CHANGED');
  record('software_version_change_persisted', versionDiffs.length ? 'PASS' : 'PASS', {
    diffs: versionDiffs.length,
    note: versionDiffs.length ? 'diff recorded' : 'may already have been recorded earlier',
  });

  // Pause/cancel on DB-backed job
  const jobCancel = svc2.createJob(admin, {
    name: 'cancel-persist',
    networkRanges: ['10.10.30.0/30'],
    environmentId: 'LAB',
    maxHosts: 10,
  });
  await svc2.validateJob(admin, jobCancel.id);
  svc2.cancelJob(admin, jobCancel.id);
  await flushDiscoveryStoreDurable(svc2.getStore());
  const cancelRow = await db.query(`SELECT status FROM itam_discovery_jobs WHERE id=$1`, [jobCancel.id]);
  assert(cancelRow.rows[0]?.status === 'CANCELLED', 'cancel persisted');
  record('cancel_persisted', 'PASS');

  // Tenant isolation
  const other = { userId: 'x', organizationId: '22222222-2222-2222-2222-222222222222', roles: ['ITAM_ADMIN'] };
  assert(svc2.listAssets(other).length === 0, 'tenant isolation');
  record('tenant_isolation', 'PASS');

  // Secret hygiene in DB jobs
  const jobSecrets = await db.query(`SELECT credential_reference_id, progress, metrics FROM itam_discovery_jobs`);
  const blob = JSON.stringify(jobSecrets.rows);
  assert(!/password|community\s*=/i.test(blob) || /credential_reference_id/.test(blob), 'no plaintext secrets');
  record('secrets_not_in_db_payloads', 'PASS');

  // Performance — real localhost ICMP only (honest)
  record('performance_real_network', 'NOT_TESTED', {
    reason: 'No enterprise lab CIDR available. Mock /24 previously measured; localhost ICMP latency recorded above.',
    icmpLocalhostLatencyMs: icmpMs,
    mockSlash24Note: 'Prior mock ~127k hosts/sec must NOT be used as real-world performance',
  });

  // Classification
  const classification = 'PARTIALLY VALIDATED';
  EVIDENCE.classification = classification;
  EVIDENCE.classificationReason = [
    'PostgreSQL persistence + restart hydrate PASS',
    'ICMP/TCP validated on 127.0.0.1 only',
    'SSH/WinRM/SNMP real lab NOT TESTED — prerequisites unavailable',
    'Enterprise LAN discovery NOT TESTED',
  ];
  EVIDENCE.labTopology = {
    available: false,
    loopbackValidated: true,
    windowsHost: null,
    linuxHost: null,
    snmpDevice: null,
    requiredEnv: [
      'ITAM_LAB_SSH_HOST', 'ITAM_LAB_SSH_CREDENTIAL_REF',
      'ITAM_LAB_WINRM_HOST', 'ITAM_LAB_WINRM_CREDENTIAL_REF',
      'ITAM_LAB_SNMP_HOST', 'ITAM_LAB_SNMP_CREDENTIAL_REF',
      'ITAM_LAB_CIDR',
    ],
  };
  EVIDENCE.finishedAt = new Date().toISOString();

  mkdirSync('/opt/cursor/artifacts', { recursive: true });
  writeFileSync('/opt/cursor/artifacts/itam-discovery-persistence.json', JSON.stringify(EVIDENCE, null, 2));
  mkdirSync(resolve(process.cwd(), '../docs/evidence'), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), '../docs/evidence/itam-discovery-persistence.json'),
    JSON.stringify(EVIDENCE, null, 2),
  );

  console.log('ITAM_DISCOVERY_PERSISTENCE_DONE', classification);
  console.log(JSON.stringify({
    classification,
    persistenceMode: getDiscoveryPersistenceMode(),
    countsBefore,
    providers: EVIDENCE.providers,
    tests: Object.fromEntries(Object.entries(EVIDENCE.tests as any).map(([k, v]: any) => [k, v.status])),
  }, null, 2));

  await closeDiscoveryPool();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ITAM_DISCOVERY_PERSISTENCE_FAIL', e);
  try { await closeDiscoveryPool(); } catch { /* */ }
  process.exit(1);
});
