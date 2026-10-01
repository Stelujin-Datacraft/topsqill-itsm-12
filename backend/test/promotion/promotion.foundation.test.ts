/**
 * DEV-only platform promotion foundation tests.
 * Round-trip export → validate → dry-run → import into isolated namespace → verify.
 * Does not create QA/PROD. Does not touch live projects.
 */
import assert from 'node:assert/strict';
import {
  exportPlatformPackage,
  planImport,
  applyImport,
  verifyRoundTrip,
  validatePackage,
  scrubSecrets,
  assertNoSecrets,
  resolveLogicalKey,
  rewriteUuidRefs,
  PromotionNamespaceStore,
  PromotionService,
} from '../../src/promotion';

function sampleExportInput() {
  return {
    packageKey: 'grc',
    version: '1.0.0',
    displayName: 'GRC Package',
    createdBy: 'test',
    project: {
      name: 'GRC',
      logicalKey: 'grc',
      description: 'Governance Risk Compliance',
    },
    forms: [
      {
        name: 'Risk',
        logicalKey: 'grc.risk',
        description: 'Risk register',
        status: 'published',
        fields: [
          {
            label: 'Owner',
            fieldType: 'text',
            logicalKey: 'grc.risk.owner',
            required: true,
            fieldOrder: 1,
          },
          {
            label: 'Status',
            fieldType: 'select',
            logicalKey: 'grc.risk.status',
            options: ['open', 'closed'],
            fieldOrder: 2,
          },
        ],
      },
    ],
    workflows: [
      {
        name: 'Risk Approval',
        logicalKey: 'grc.risk.approval',
        formRefs: ['grc.risk'],
        definition: {
          states: ['draft', 'pending', 'approved'],
          actions: [{ type: 'notify', template: 'grc.risk.approval-required' }],
        },
      },
    ],
    roles: [
      {
        name: 'Risk Manager',
        logicalKey: 'grc.manager',
        permissions: [
          { resourceType: 'form', resourceKey: 'grc.risk', permissionType: 'read' },
          { resourceType: 'form', resourceKey: 'grc.risk', permissionType: 'update' },
        ],
      },
    ],
    reports: [
      {
        name: 'Open Risks',
        logicalKey: 'grc.open-risks',
        formKey: 'grc.risk',
        config: { filters: [{ field: 'grc.risk.status', op: 'eq', value: 'open' }] },
      },
    ],
    dashboards: [
      {
        name: 'Executive',
        logicalKey: 'grc.executive',
        reportKeys: ['grc.open-risks'],
      },
    ],
    integrations: [
      {
        name: 'External Risk',
        logicalKey: 'grc.external-risk',
        provider: 'generic_http',
        authType: 'api_key',
        credentialReferenceId: 'secret://grc/external-risk',
        credentials: { apiKey: 'sk_live_SHOULD_NEVER_EXPORT', password: 'hunter2' },
        baseUrlSlot: 'GRC_EXTERNAL_RISK_URL',
      },
    ],
    referenceData: [
      {
        key: 'grc.risk-category',
        domain: 'risk-category',
        items: [
          { key: 'financial', label: 'Financial' },
          { key: 'operational', label: 'Operational' },
        ],
      },
    ],
    notificationTemplates: [
      {
        key: 'grc.risk.approval-required',
        name: 'Approval Required',
        channel: 'email',
        subject: 'Risk approval needed',
        body: 'Please approve {{grc.risk}}',
        trigger: 'workflow:grc.risk.approval',
      },
    ],
  };
}

async function run() {
  console.log('=== Platform Promotion Foundation (DEV-only) ===');

  // 1) Logical keys
  assert.equal(resolveLogicalKey({ logicalKey: 'grc.risk' }), 'grc.risk');
  assert.equal(
    resolveLogicalKey({ referenceId: 'My-Form', name: 'ignored', namespace: 'grc' }),
    'my-form',
  );
  assert.ok(resolveLogicalKey({ name: 'Risk Register', namespace: 'grc' }).startsWith('grc.'));

  // 2) Secret scrubbing
  const scrubbed = scrubSecrets({
    apiKey: 'sk_live_abc',
    password: 'x',
    credentialReferenceId: 'secret://x',
    credentials: { token: 'abc' },
    nested: { client_secret: 'shh' },
  }) as any;
  assert.equal(scrubbed.apiKey, null);
  assert.equal(scrubbed.password, null);
  assert.equal(scrubbed.credentialReferenceId, 'secret://x');
  assert.deepEqual(scrubbed.credentials, {});
  assert.equal(scrubbed.nested.client_secret, null);

  // 3) Export package (secrets stripped)
  const pkg = exportPlatformPackage(sampleExportInput());
  assert.equal(pkg.manifest.package.key, 'grc');
  assert.equal(pkg.manifest.package.sourceEnvironment, 'DEV');
  assert.equal(pkg.manifest.package.version, '1.0.0');
  const integ = pkg.components.find((c) => c.key === 'grc.external-risk');
  assert.ok(integ);
  assert.equal((integ!.definition as any).credentials?.apiKey ?? null, null);
  assert.equal((integ!.definition as any).credentialReferenceId, 'secret://grc/external-risk');
  const secretViolations = assertNoSecrets(pkg);
  assert.equal(secretViolations.length, 0, secretViolations.join('; '));

  const validation = validatePackage(pkg);
  assert.equal(validation.ok, true, validation.errors.join('; '));
  console.log('✓ export + validate + secret scrub');

  // 4) Dry-run into empty isolated namespace → all CREATE
  const store = new PromotionNamespaceStore();
  const ns = store.createNamespace({
    name: 'promotion-test-grc-empty',
    organizationLogicalKey: 'dev.org',
  });
  const dry = planImport(pkg, store, ns.id);
  assert.equal(dry.wouldWrite, false);
  assert.equal(dry.environment, 'DEV');
  assert.ok(dry.summary.CREATE > 0);
  assert.equal(dry.summary.UPDATE, 0);
  assert.equal(ns.records.size, 0, 'dry-run must not write');
  console.log('✓ dry-run CREATE plan (no writes)', dry.summary);

  // 5) Apply import
  const imported = applyImport(pkg, store, ns.id, {
    dryRun: false,
    initiatedBy: 'tester',
  });
  assert.equal(imported.audit.result, 'SUCCESS');
  assert.ok(imported.applied.length > 0);
  const verified = verifyRoundTrip(pkg, store, ns.id);
  assert.equal(verified.ok, true, verified.mismatches.join('; '));
  console.log('✓ import + round-trip verify');

  // 6) Second dry-run → NO_CHANGE
  const dry2 = planImport(pkg, store, ns.id);
  assert.ok(dry2.summary.NO_CHANGE > 0);
  assert.equal(dry2.summary.CREATE, 0);
  console.log('✓ idempotent NO_CHANGE', dry2.summary);

  // 7) Conflict detection
  store.upsertRecord(ns, 'form_field', 'grc.risk.owner', {
    label: 'Owner',
    fieldType: 'number', // incompatible with text
    formKey: 'grc.risk',
  });
  const conflictPlan = planImport(pkg, store, ns.id);
  assert.ok(conflictPlan.summary.CONFLICT >= 1);
  const failed = applyImport(pkg, store, ns.id, {
    dryRun: false,
    initiatedBy: 'tester',
    failOnConflict: true,
  });
  assert.equal(failed.audit.result, 'FAILED');
  assert.equal(failed.applied.length, 0);
  console.log('✓ conflict detection blocks silent overwrite');

  // 8) Missing dependency
  const leanPkg = exportPlatformPackage({
    packageKey: 'orphan',
    version: '1.0.0',
    project: { name: 'Orphan', logicalKey: 'orphan' },
    workflows: [
      {
        name: 'Needs Form',
        logicalKey: 'orphan.wf',
        formRefs: ['missing.form'],
      },
    ],
  });
  const ns2 = store.createNamespace({
    name: 'promotion-test-orphan',
    organizationLogicalKey: 'dev.org',
  });
  const miss = planImport(leanPkg, store, ns2.id);
  assert.ok(miss.summary.MISSING_DEPENDENCY >= 1);
  console.log('✓ missing dependency detection');

  // 9) UUID rewrite helper
  const map = new Map([['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'grc.risk']]);
  const { rewritten, unresolved } = rewriteUuidRefs(
    { formId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', other: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
    map,
  );
  assert.equal(rewritten.formId, 'grc.risk');
  assert.equal(unresolved.length, 1);
  console.log('✓ UUID→logical key rewrite');

  // 10) Service round-trip convenience
  const svc = new PromotionService();
  const rt = svc.roundTrip(sampleExportInput(), 'svc-test');
  assert.equal(rt.environment, 'DEV');
  assert.equal(rt.validation.ok, true);
  assert.equal(rt.verified.ok, true);
  assert.ok(rt.namespace.name.startsWith('promotion-test-'));
  console.log('✓ PromotionService.roundTrip');

  // Namespace naming guard
  assert.throws(() => store.createNamespace({ name: 'live-project', organizationLogicalKey: 'x' }));
  console.log('✓ isolated namespace prefix enforced');

  console.log('\nALL PROMOTION FOUNDATION TESTS PASSED (DEV-only)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
