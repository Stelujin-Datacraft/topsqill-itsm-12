/**
 * A solution exports as one package: its forms and fields, the workflows and reports that use
 * them, and nothing environment- or tenant-specific.
 *
 *   npx tsx test/packages/solution-export.test.ts
 */
import assert from 'assert';
import { buildSolutionObjects, portableRow } from '../../src/packages/solution-export';
import { parseExportRequest, signerFromEnv } from '../../src/packages/packages.service';
import { buildPackage, generateSigningKeys, validatePackage, verifyIntegrity } from '../../src/packages/spec';

const ORG = 'aaaaaaaa-0000-4000-8000-000000000000';
const PROJECT = 'bbbbbbbb-0000-4000-8000-000000000000';
const SOLUTION = 'cccccccc-0000-4000-8000-000000000000';
const ASSET_FORM = '10000000-0000-4000-8000-000000000001';
const TYPE_FORM = '10000000-0000-4000-8000-000000000002';
const UNRELATED_FORM = '10000000-0000-4000-8000-000000000003';
const SCORE_FIELD = '20000000-0000-4000-8000-000000000001';
const TYPE_FIELD = '20000000-0000-4000-8000-000000000002';
const NOTIFY_WF = '30000000-0000-4000-8000-000000000001';
const TRIGGERED_WF = '30000000-0000-4000-8000-000000000002';
const OTHER_WF = '30000000-0000-4000-8000-000000000003';
const ASSET_REPORT = '40000000-0000-4000-8000-000000000001';
const OTHER_REPORT = '40000000-0000-4000-8000-000000000002';

const tenant = { organization_id: ORG, project_id: PROJECT, created_by: 'user-1', created_at: '2026-01-01', updated_at: '2026-01-02' };

const rows = {
  solution: { id: SOLUTION, name: 'Asset Management', color: '#0ea5e9', ...tenant },
  formIds: [ASSET_FORM, TYPE_FORM],
  forms: [
    { id: ASSET_FORM, name: 'Asset Register', reference_id: 'grc.asset-register', pages: [{ id: 'p1', fields: [SCORE_FIELD] }], permissions: { roles: ['role-x'] }, share_settings: { url: 'https://dev.example' }, ...tenant },
    { id: TYPE_FORM, name: 'Asset Type Register', pages: [], ...tenant },
    { id: UNRELATED_FORM, name: 'HR Leave', pages: [], ...tenant },
  ],
  fields: [
    { id: SCORE_FIELD, form_id: ASSET_FORM, label: 'Score', field_type: 'query-field', field_order: 2, current_value: 'secret-runtime', custom_config: { query: `select 1 from x where form_id='${TYPE_FORM}'`, api_key: 'sk_live_123' } },
    { id: TYPE_FIELD, form_id: ASSET_FORM, label: 'Type', field_type: 'cross-reference', field_order: 1, custom_config: { targetFormId: TYPE_FORM } },
    { id: '20000000-0000-4000-8000-000000000009', form_id: UNRELATED_FORM, label: 'Days', field_type: 'number' },
  ],
  workflows: [
    { id: NOTIFY_WF, name: 'Notify owner', status: 'active', ...tenant },
    { id: TRIGGERED_WF, name: 'On new asset', status: 'active', ...tenant },
    { id: OTHER_WF, name: 'Leave approval', status: 'active', ...tenant },
  ],
  nodes: [
    { id: '50000000-0000-4000-8000-000000000001', workflow_id: NOTIFY_WF, node_type: 'update', config: { formId: ASSET_FORM } },
    { id: '50000000-0000-4000-8000-000000000002', workflow_id: TRIGGERED_WF, node_type: 'start', config: {} },
    { id: '50000000-0000-4000-8000-000000000003', workflow_id: OTHER_WF, node_type: 'start', config: { formId: UNRELATED_FORM } },
  ],
  connections: [
    { id: '60000000-0000-4000-8000-000000000001', workflow_id: NOTIFY_WF, source_node_id: 'a', target_node_id: 'b' },
    { id: '60000000-0000-4000-8000-000000000002', workflow_id: OTHER_WF, source_node_id: 'c', target_node_id: 'd' },
  ],
  triggers: [
    { id: '70000000-0000-4000-8000-000000000001', source_form_id: ASSET_FORM, target_workflow_id: TRIGGERED_WF, trigger_type: 'on_submit', organization_id: ORG, created_by: 'user-1' },
  ],
  reports: [
    { id: ASSET_REPORT, name: 'Asset scores', dashboard_id: 'dash-1', ...tenant },
    { id: OTHER_REPORT, name: 'Leave balance', ...tenant },
  ],
  components: [
    { id: '80000000-0000-4000-8000-000000000001', report_id: ASSET_REPORT, type: 'chart', config: { formId: ASSET_FORM }, layout: {} },
    { id: '80000000-0000-4000-8000-000000000002', report_id: OTHER_REPORT, type: 'table', config: { formId: UNRELATED_FORM }, layout: {} },
  ],
};

function main() {
  console.log('solution-export');

  const { objects, summary } = buildSolutionObjects(rows);
  assert.deepEqual(summary, { forms: 2, fields: 2, workflows: 2, reports: 1, stripped: summary.stripped });
  assert.ok(summary.stripped > 0);

  const keys = objects.map((o) => o.key);
  assert.ok(keys.includes(`solution:${SOLUTION}`));
  assert.ok(keys.includes(`form:${ASSET_FORM}`) && keys.includes(`form:${TYPE_FORM}`));
  assert.ok(!keys.includes(`form:${UNRELATED_FORM}`), 'forms outside the solution are not exported');
  assert.ok(keys.includes(`workflow:${NOTIFY_WF}`), 'workflow whose node uses a solution form');
  assert.ok(keys.includes(`workflow:${TRIGGERED_WF}`), 'workflow started by a trigger on a solution form');
  assert.ok(!keys.includes(`workflow:${OTHER_WF}`));
  assert.ok(keys.includes(`report:${ASSET_REPORT}`) && !keys.includes(`report:${OTHER_REPORT}`));

  const asset = objects.find((o) => o.key === `form:${ASSET_FORM}`)!.data as any;
  assert.deepEqual(asset.fields.map((f: any) => f.label), ['Type', 'Score'], 'fields keep their order');
  for (const column of ['organization_id', 'project_id', 'created_by', 'created_at', 'permissions', 'share_settings']) {
    assert.ok(!(column in asset.form), `${column} is not exported`);
  }
  assert.equal(asset.form.reference_id, 'grc.asset-register', 'stable reference ids are kept');
  const score = asset.fields.find((f: any) => f.label === 'Score');
  assert.ok(!('current_value' in score), 'runtime values are not exported');
  assert.ok(!('api_key' in score.custom_config), 'secrets in config are stripped');
  assert.ok(score.custom_config.query.includes(TYPE_FORM), 'query SQL is kept for remapping on install');

  const triggered = objects.find((o) => o.key === `workflow:${TRIGGERED_WF}`)!.data as any;
  assert.equal(triggered.triggers.length, 1);
  assert.ok(!('organization_id' in triggered.triggers[0]));
  const notify = objects.find((o) => o.key === `workflow:${NOTIFY_WF}`)!.data as any;
  assert.equal(notify.connections.length, 1);
  const report = objects.find((o) => o.key === `report:${ASSET_REPORT}`)!.data as any;
  assert.ok(!('dashboard_id' in report.report));
  assert.equal(report.components.length, 1);

  const solution = objects.find((o) => o.type === 'solution')!.data as any;
  assert.deepEqual(solution, { solution: { id: SOLUTION, name: 'Asset Management', color: '#0ea5e9', description: null }, formIds: [ASSET_FORM, TYPE_FORM] });

  const pkg = buildPackage(
    { key: 'asset-management', name: 'Asset Management', version: '1.0.0', publisher: 'Topsqill', description: '', license: 'paid', requires: { modules: [] }, createdAt: '2026-11-03T00:00:00Z' },
    objects,
  );
  const result = validatePackage(pkg);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, [], 'every form reference resolves inside the package');
  assert.ok(!JSON.stringify(pkg).includes(ORG), 'the source organisation id never leaves');

  assert.deepEqual(portableRow({ id: 'x', name: 'n', organization_id: ORG }, 'form'), { id: 'x', name: 'n' });

  assert.throws(() => parseExportRequest({ solutionId: 'nope' }), /UUID/);
  assert.throws(() => parseExportRequest({ solutionId: SOLUTION, key: 'Asset Mgmt', name: 'x', version: '1.0.0' }), /lowercase/);
  assert.throws(() => parseExportRequest({ solutionId: SOLUTION, key: 'assets', name: 'x', version: '1' }), /1.0.0/);
  assert.throws(() => parseExportRequest({ solutionId: SOLUTION, key: 'assets', name: 'x', version: '1.0.0', requiresModules: ['crm'] }), /Unknown module/);
  assert.deepEqual(parseExportRequest({ solutionId: SOLUTION, key: 'assets', name: ' Assets ', version: '1.0.0', requiresModules: ['asset-discovery', 'asset-discovery'] }), {
    solutionId: SOLUTION, key: 'assets', name: 'Assets', version: '1.0.0', description: '', license: 'private', requiresModules: ['asset-discovery'],
  });

  assert.equal(signerFromEnv({}), null);
  const keysPair = generateSigningKeys();
  const signer = signerFromEnv({ PACKAGE_SIGNING_KEY_ID: 'topsqill-2026', PACKAGE_SIGNING_PRIVATE_KEY: keysPair.privateKey.replace(/\n/g, '\\n') });
  assert.equal(signer?.keyId, 'topsqill-2026');
  const signed = buildPackage(pkg.manifest, objects, signer);
  assert.equal(verifyIntegrity(signed, { 'topsqill-2026': keysPair.publicKey }, { requireSignature: true }).ok, true, '.env-style escaped keys work');

  console.log('solution-export checks passed');
}

main();
