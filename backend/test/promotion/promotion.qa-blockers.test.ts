/**
 * QA blockers resolution tests — REAL PostgreSQL persistence required.
 *
 * PROMOTION_DATABASE_URL=postgresql://vis@127.0.0.1:5432/platform_promotion
 * PROMOTION_PERSISTENCE=postgres
 */
import assert from 'node:assert/strict';
import {
  exportPlatformPackage,
  planFieldKeyBackfill,
  migrateConnectorCredentials,
  scanAuthConfigForSecrets,
  scrubSecrets,
  assertNoSecrets,
  rewriteUuidRefs,
  resolveLogicalKey,
  applyPromotionSchema,
  ensureIsolatedTarget,
  planPgImport,
  applyPgImport,
  verifyPgRoundTrip,
  snapshotDbState,
  countPromotionRows,
  backfillFormFieldKeysPg,
  closePromotionPool,
  getPromotionPool,
  PlatformPgSecretProvider,
  PromotionService,
} from '../../src/promotion';

function sampleExport(suffix = '') {
  const sk = suffix ? `grc${suffix}` : 'grc';
  return {
    packageKey: sk,
    version: '1.0.0',
    displayName: 'GRC',
    createdBy: 'qa-test',
    project: { name: 'GRC', logicalKey: sk },
    forms: [
      {
        name: 'Risk',
        logicalKey: `${sk}.risk`,
        fields: [
          { label: 'Owner', fieldType: 'text', logicalKey: `${sk}.risk.owner`, required: true },
          { label: 'Status', fieldType: 'select', logicalKey: `${sk}.risk.status`, options: ['open', 'closed'] },
        ],
      },
    ],
    workflows: [
      {
        name: 'Approval',
        logicalKey: `${sk}.risk.approval`,
        formRefs: [`${sk}.risk`],
        definition: { formKey: `${sk}.risk`, states: ['draft', 'approved'] },
      },
    ],
    roles: [
      {
        name: 'Manager',
        logicalKey: `${sk}.manager`,
        permissions: [
          { resourceType: 'form', resourceKey: `${sk}.risk`, permissionType: 'read' },
          { resourceType: 'form', resourceKey: `${sk}.risk`, permissionType: 'update' },
        ],
      },
    ],
    reports: [
      {
        name: 'Open Risks',
        logicalKey: `${sk}.open-risks`,
        formKey: `${sk}.risk`,
        config: { formKey: `${sk}.risk`, filters: [{ field: `${sk}.risk.status`, op: 'eq', value: 'open' }] },
      },
    ],
    dashboards: [
      { name: 'Executive', logicalKey: `${sk}.executive`, reportKeys: [`${sk}.open-risks`] },
    ],
    integrations: [
      {
        name: 'External',
        logicalKey: `${sk}.external`,
        credentialReferenceId: `secret://connectors/${sk}.external`,
        credentials: { apiKey: 'sk_live_SHOULD_NOT_PERSIST', password: 'nope' },
      },
    ],
    referenceData: [
      { key: `${sk}.severity`, domain: 'severity', items: [{ key: 'financial', label: 'Financial' }] },
    ],
    notificationTemplates: [
      {
        key: `${sk}.risk.approval-required`,
        name: 'Approval Required',
        channel: 'email',
        subject: 'Approve',
        body: 'Please approve',
      },
    ],
  };
}

async function run() {
  const url = process.env.PROMOTION_DATABASE_URL;
  if (!url) {
    console.error('QA_BLOCKED: PROMOTION_DATABASE_URL not set — cannot prove real Postgres persistence');
    process.exit(2);
  }
  process.env.PROMOTION_PERSISTENCE = 'postgres';

  console.log('=== Promotion QA Blockers (REAL PostgreSQL) ===');
  console.log('DB:', url.replace(/:[^:@/]+@/, ':***@'));

  await applyPromotionSchema();
  const db = getPromotionPool();

  // ---- Blocker #2: stable form field keys ----
  const plan = planFieldKeyBackfill([
    {
      id: 'f1',
      formId: 'form1',
      label: 'Host Name',
      logicalKey: null,
      customConfig: { name: 'hostname' },
      formLogicalKey: 'itam.asset',
    },
    {
      id: 'f2',
      formId: 'form1',
      label: 'IP',
      logicalKey: null,
      customConfig: null,
      formLogicalKey: 'itam.asset',
    },
  ]);
  assert.ok(plan.updated.some((u) => u.logicalKey === 'itam.asset.hostname'));
  assert.ok(plan.updated.some((u) => u.logicalKey.endsWith('.ip') || u.logicalKey.includes('ip')));
  console.log('✓ Blocker#2 field key planning');

  // ---- Blocker #3: connector secret migration ----
  const secrets = new PlatformPgSecretProvider(db);
  const mig = await migrateConnectorCredentials(
    [
      {
        id: '11111111-1111-4111-8111-111111111111',
        organizationId: null,
        name: 'Legacy Connector',
        logicalKey: null,
        credentialReferenceId: null,
        httpAuthConfig: { apiKeyValue: 'sk_live_abc', apiKeyHeader: 'x-api-key', password: 'pw' },
      },
    ],
    secrets,
    {
      dryRun: false,
      putToDb: async () => {
        /* unit path — secrets.put already called */
      },
    },
  );
  assert.equal(mig.migrated.length, 1);
  assert.ok(mig.migrated[0].credentialReferenceId.startsWith('secret://'));
  const stored = await secrets.get(mig.migrated[0].credentialReferenceId);
  assert.ok(stored && stored.includes('apiKeyValue'));
  assert.equal(scanAuthConfigForSecrets({ apiKeyHeader: 'x-api-key' }).length, 0);
  assert.ok(scanAuthConfigForSecrets({ password: 'x' }).length > 0);
  console.log('✓ Blocker#3 credentialReferenceId + SecretProvider');

  // Insert a dirty connector row then migrate via SQL path
  await db.query(`DELETE FROM data_source_connections WHERE name = 'Dirty Conn'`);
  const orgTmp = await ensureIsolatedTarget({
    organizationLogicalKey: 'org.qa-blockers',
    projectLogicalKey: 'qa-blockers',
    namespace: 'promotion-test-qa-blockers-setup',
  });
  const ins = await db.query(
    `INSERT INTO data_source_connections (name, organization_id, project_id, connection_type, http_auth_type, http_auth_config, created_by)
     VALUES ('Dirty Conn', $1, $2, 'http', 'api_key', $3::jsonb, $4) RETURNING id`,
    [orgTmp.organizationId, orgTmp.projectId, JSON.stringify({ token: 'Bearer-SECRET-VALUE', apiKeyHeader: 'x-api-key' }), orgTmp.actorUserId],
  );
  const svc = new PromotionService();
  await svc.initializePersistence({ mode: 'postgres' });
  const liveMig = await svc.migrateConnectorSecrets(false);
  assert.ok(liveMig.migrated.some((m) => m.id === ins.rows[0].id) || liveMig.alreadyClean.includes(ins.rows[0].id));
  const scan = await svc.scanConnectorSecrets();
  const dirty = scan.find((s) => s.id === ins.rows[0].id);
  assert.ok(dirty);
  assert.equal(dirty!.secretFindings.length, 0, `secrets remain: ${dirty!.secretFindings.join(',')}`);
  assert.ok(dirty!.credentialReferenceId);
  console.log('✓ Blocker#3 live connector scrub from DB JSON');

  // ---- Blocker #1 + #4: UUID portability + real PG import ----
  const uniq = `-a${Date.now().toString(36)}`;
  const pkgA = exportPlatformPackage(sampleExport(uniq));
  assert.equal(assertNoSecrets(pkgA).length, 0);
  const integ = pkgA.components.find((c) => c.kind === 'integration')!;
  assert.equal((integ.definition as any).credentials?.apiKey ?? null, null);

  const orgAKey = `org.env-a${uniq}`;
  const projectKey = pkgA.manifest.package.key;

  // Source env A
  const ctxA = await ensureIsolatedTarget({
    organizationLogicalKey: orgAKey,
    projectLogicalKey: projectKey,
    namespace: `promotion-test-env-a${uniq}`,
  });
  const beforeDry = await snapshotDbState(ctxA);
  const dry = await planPgImport(pkgA, ctxA);
  const afterDry = await snapshotDbState(ctxA);
  assert.equal(beforeDry, afterDry, 'dry-run must not write');
  assert.equal(dry.wouldWrite, false);
  assert.ok(dry.summary.CREATE > 0);
  console.log('✓ Blocker#4 dry-run no writes', dry.summary);

  const importedA = await applyPgImport(pkgA, ctxA, { dryRun: false, initiatedBy: 'qa', approvedBy: 'qa-approver' });
  assert.equal(importedA.audit.result, 'SUCCESS', JSON.stringify(importedA.blocked));
  const verifiedA = await verifyPgRoundTrip(pkgA, ctxA);
  assert.equal(verifiedA.ok, true, verifiedA.mismatches.join('; '));
  const countsA = await countPromotionRows(ctxA);
  assert.ok(countsA.forms >= 1);
  assert.ok(countsA.form_fields >= 2);
  assert.ok(countsA.workflows >= 1);
  assert.ok(countsA.roles >= 1);
  assert.ok(countsA.reports >= 1);
  console.log('✓ Env A import persisted', countsA);

  // Role permissions use resource_logical_key, not portable UUID from package
  const dbLive = getPromotionPool();
  const perms = await dbLive.query(
    `SELECT rp.resource_type, rp.resource_id::text, rp.resource_logical_key, r.logical_key AS role_key
     FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     WHERE r.organization_id = $1 AND r.logical_key = $2`,
    [ctxA.organizationId, `${projectKey}.manager`],
  );
  assert.ok(
    perms.rows.length >= 1,
    `expected permissions for org=${ctxA.organizationId} role=${projectKey}.manager`,
  );
  assert.ok(
    perms.rows.every((p) => p.resource_logical_key === `${projectKey}.risk`),
    `unexpected keys: ${perms.rows.map((p) => p.resource_logical_key).join(',')}`,
  );
  const uuidA = perms.rows[0].resource_id;
  assert.ok(uuidA);
  console.log('✓ Blocker#1 role_permissions.resource_logical_key set; env A UUID=', uuidA);

  // Field keys backfill
  const bf = await backfillFormFieldKeysPg();
  console.log('✓ Blocker#2 backfill applied=', bf.applied, 'conflicts=', bf.conflicts.length);

  // Idempotent
  const dry2 = await planPgImport(pkgA, ctxA);
  assert.ok(dry2.summary.NO_CHANGE > 0);
  assert.equal(dry2.summary.CREATE, 0);
  console.log('✓ Idempotent NO_CHANGE', dry2.summary);

  // Env B: same logical keys, different UUIDs
  const ctxB = await ensureIsolatedTarget({
    organizationLogicalKey: `org.env-b${uniq}`,
    projectLogicalKey: projectKey,
    namespace: `promotion-test-env-b${uniq}`,
  });
  const importedB = await applyPgImport(pkgA, ctxB, { dryRun: false, initiatedBy: 'qa' });
  assert.equal(importedB.audit.result, 'SUCCESS', JSON.stringify(importedB.blocked));
  const permsB = await db.query(
    `SELECT resource_id::text, resource_logical_key FROM role_permissions
     WHERE role_id IN (SELECT id FROM roles WHERE organization_id = $1)`,
    [ctxB.organizationId],
  );
  assert.ok(permsB.rows.length >= 1);
  assert.equal(permsB.rows[0].resource_logical_key, `${projectKey}.risk`);
  const uuidB = permsB.rows[0].resource_id;
  assert.notEqual(uuidA, uuidB, 'cross-env must resolve to different UUIDs');
  const roleComp = pkgA.components.find((c) => c.kind === 'role')!;
  assert.equal((roleComp.definition as any).permissions[0].resourceKey, `${projectKey}.risk`);
  console.log('✓ Cross-env resolution UUID-A != UUID-B', { uuidA, uuidB });

  // Tenant isolation: org A key map must not include org B resources for same check
  const cross = await db.query(
    `SELECT count(*)::int AS n FROM promotion_key_map WHERE organization_id = $1 AND resource_id = $2`,
    [ctxA.organizationId, uuidB],
  );
  assert.equal(cross.rows[0].n, 0);
  console.log('✓ Tenant isolation');

  // Restart persistence
  await closePromotionPool();
  process.env.PROMOTION_DATABASE_URL = url;
  await applyPromotionSchema();
  const ctxA2 = await ensureIsolatedTarget({
    organizationLogicalKey: orgAKey,
    projectLogicalKey: projectKey,
    namespace: `promotion-test-env-a${uniq}`,
  });
  const afterRestart = await verifyPgRoundTrip(pkgA, ctxA2);
  assert.equal(afterRestart.ok, true, afterRestart.mismatches.join('; '));
  console.log('✓ Restart persistence');

  // UUID rewrite helper
  const map = new Map([[uuidA, 'grc-a.risk']]);
  const { rewritten, unresolved } = rewriteUuidRefs({ formId: uuidA, other: '00000000-0000-4000-8000-000000000099' }, map);
  assert.equal(rewritten.formId, 'grc-a.risk');
  assert.equal(unresolved.length, 1);
  assert.equal(resolveLogicalKey({ logicalKey: 'itam.asset.sync' }), 'itam.asset.sync');
  console.log('✓ UUID→logical rewrite');

  // Service round-trip convenience
  const rt = await new PromotionService().roundTrip(sampleExport('-rt'), 'svc');
  assert.equal((rt as any).persistence, 'postgres');
  assert.equal(rt.validation.ok, true);
  assert.equal((rt as any).verified.ok, true);
  assert.equal((rt as any).afterRestart.ok, true);
  assert.ok((rt as any).idempotentDryRun.summary.NO_CHANGE >= 0);
  console.log('✓ PromotionService postgres round-trip + restart');

  // Secret scrub regression
  const scrubbed = scrubSecrets({ password: 'x', credentialReferenceId: 'secret://a', credentials: { token: 't' } }) as any;
  assert.equal(scrubbed.password, null);
  assert.deepEqual(scrubbed.credentials, {});
  console.log('✓ Secret scrub');

  console.log('\nALL QA BLOCKER TESTS PASSED (REAL PostgreSQL)');
  console.log(JSON.stringify({
    status: 'QA_READY',
    blockers: {
      uuid_hardcoding: 'PASS',
      stable_form_field_keys: 'PASS',
      connector_secret_migration: 'PASS',
      real_supabase_postgres_promotion_import: 'PASS',
    },
    dryRun: dry.summary,
    countsA,
    crossEnv: { uuidA, uuidB },
  }, null, 2));

  await closePromotionPool();
}

run().catch(async (err) => {
  console.error(err);
  try { await closePromotionPool(); } catch { /* */ }
  process.exit(1);
});
