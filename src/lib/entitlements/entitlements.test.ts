/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/lib/entitlements/entitlements.test.ts
 */
import assert from 'node:assert/strict';
import {
  ASSET_DISCOVERY_TABS,
  canUse,
  canView,
  daysUntil,
  moduleBanner,
  moduleForPath,
  openSnapshot,
  usageLines,
} from '@/lib/entitlements/modules';
import {
  activeModuleCount,
  auditToCsv,
  describeAudit,
  filterOrgs,
  levelOfRow,
  limitsFromInputs,
  orgAttention,
  paginate,
  summarizeOrgs,
  type AuditRow,
  type PlatformOverview,
} from '@/lib/entitlements/console';

assert.equal(moduleForPath('/build'), 'ai-builder');
assert.equal(moduleForPath('/vis/integrations/42'), 'integration-studio');
assert.equal(moduleForPath('/re/home'), 'real-estate');
assert.equal(moduleForPath('/promotional-transfer/new'), 'promotional-transfer');
assert.equal(moduleForPath('/report-view/1'), null, '/re must not match /report-view');
assert.equal(moduleForPath('/visual'), null);
assert.equal(moduleForPath('/it-assets'), null, 'IT assets stays core; only discovery tabs are paid');
assert.ok(ASSET_DISCOVERY_TABS.includes('topology'));

assert.ok(canUse('full') && canUse('grace') && !canUse('read_only') && !canUse('none'));
assert.ok(canView('read_only') && !canView('none'));
assert.equal(openSnapshot().modules['asset-discovery'].level, 'full', 'unknown state never locks the UI');

const now = new Date('2026-11-02T12:00:00Z');
assert.equal(daysUntil('2026-11-12T12:00:00Z', now), 10);
assert.equal(daysUntil(null, now), null);

const snapshot = openSnapshot();
snapshot.modules['ai-builder'].limits = { ai_requests: 100 };
snapshot.usage['ai-builder'] = { ai_requests: 85 };
assert.deepEqual(usageLines(snapshot, 'ai-builder'), [{ metric: 'ai_requests', label: 'AI requests', used: 85, limit: 100, ratio: 0.85 }]);
assert.match(moduleBanner(snapshot, 'ai-builder')!.text, /85 of 100 AI requests/);
snapshot.modules['ai-builder'].level = 'read_only';
assert.match(moduleBanner(snapshot, 'ai-builder')!.title, /read-only/);
assert.equal(moduleBanner(openSnapshot(), 'ai-builder'), null, 'no banner when nothing needs attention');

const row = { status: 'active', starts_at: '2026-01-01T00:00:00Z', ends_at: '2026-10-30T00:00:00Z', grace_days: 7 };
assert.equal(levelOfRow(row, now), 'grace');
assert.equal(levelOfRow({ ...row, grace_days: 1 }, now), 'read_only');
assert.equal(levelOfRow({ ...row, status: 'suspended' }, now), 'read_only');
assert.equal(levelOfRow(undefined, now), 'none');

assert.deepEqual(limitsFromInputs({ ai_requests: ' 500 ', discovery_jobs: '' }), { limits: { ai_requests: 500 }, error: null });
assert.match(limitsFromInputs({ ai_requests: '-1' }).error!, /whole number/);

const overview: PlatformOverview = {
  modules: [
    { key: 'ai-builder', name: 'AI Builder', description: '', metrics: {} },
    { key: 'asset-discovery', name: 'Asset Discovery', description: '', metrics: {} },
  ],
  plans: [{ key: 'starter', name: 'Starter', description: '', modules: [], limits: {}, is_default: false, active: true }],
  organizations: [{ id: 'org-1', name: 'Acme' }],
  subscriptions: [{ organization_id: 'org-1', plan_key: 'starter', status: 'active', current_period_end: null, grace_days: 14 }],
  entitlements: [
    { organization_id: 'org-1', module_key: 'asset-discovery', source: 'add_on', status: 'active', starts_at: '2026-01-01T00:00:00Z', ends_at: null, grace_days: 14, limits: { discovery_jobs: 10 } },
  ],
  usage: [{ organization_id: 'org-1', module_key: 'asset-discovery', metric: 'discovery_jobs', used: 3 }],
};
const [acme] = summarizeOrgs(overview, now);
assert.equal(acme.planName, 'Starter');
assert.deepEqual(acme.modules.map((m) => [m.key, m.level]), [['ai-builder', 'none'], ['asset-discovery', 'full']]);
assert.deepEqual(acme.modules[1].usage, { discovery_jobs: 3 });

const audit: AuditRow[] = [
  { id: 1, occurred_at: '2026-11-02T08:00:00Z', organization_id: 'org-1', actor_id: 'u1', actor_source: 'console', action: 'org_entitlements.insert', module_key: 'asset-discovery', reason: 'Invoice, "Q4"', before_state: null, after_state: { status: 'active' } },
];
const csv = auditToCsv(audit, { 'org-1': 'Acme' }).split('\n');
assert.equal(csv[0], 'time,organisation,action,module,actor,source,reason,before,after');
assert.ok(csv[1].includes('"Invoice, ""Q4"""'), 'commas and quotes are escaped');
assert.ok(csv[1].includes('Acme'));
assert.equal(describeAudit(audit[0]), 'Asset Discovery added');
assert.equal(describeAudit({ ...audit[0], action: 'access_denied' }), 'Access denied to Asset Discovery');

console.log('entitlements tests passed');

{
  const base = summarizeOrgs(overview, now)[0];
  const org = (patch: Partial<typeof base>) => ({ ...base, ...patch });
  assert.equal(orgAttention(base, now), null);
  assert.equal(orgAttention(org({ modules: [{ ...base.modules[0], level: 'grace' }] }), now), 'grace');
  assert.equal(orgAttention(org({ modules: [{ ...base.modules[0], level: 'grace' }, { ...base.modules[1], level: 'read_only' }] }), now), 'read_only', 'read-only outranks grace');
  assert.equal(orgAttention(org({ subscription: { ...base.subscription!, current_period_end: '2026-11-20T00:00:00Z' } }), now), 'expiring');
  assert.equal(orgAttention(org({ subscription: { ...base.subscription!, current_period_end: '2027-06-01T00:00:00Z' } }), now), null);

  const orgs = [org({ id: 'b', name: 'Beta' }), org({ id: 'a', name: 'Alpha', subscription: { ...base.subscription!, plan_key: 'pro', status: 'trial' } })];
  assert.deepEqual(filterOrgs(orgs, { term: '', plan: 'all', status: 'all' }, now).map((o) => o.name), ['Alpha', 'Beta'], 'sorted by name');
  assert.deepEqual(filterOrgs(orgs, { term: 'bet', plan: 'all', status: 'all' }, now).map((o) => o.name), ['Beta']);
  assert.deepEqual(filterOrgs(orgs, { term: '', plan: 'pro', status: 'all' }, now).map((o) => o.name), ['Alpha']);
  assert.deepEqual(filterOrgs(orgs, { term: '', plan: 'all', status: 'trial' }, now).map((o) => o.name), ['Alpha']);
  assert.deepEqual(filterOrgs(orgs, { term: '', plan: 'all', status: 'attention' }, now), []);
  assert.equal(activeModuleCount(base), 1);

  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2, 2), { rows: [3, 4], page: 2, pages: 3 });
  assert.deepEqual(paginate([1, 2, 3], 9, 2), { rows: [3], page: 2, pages: 2 }, 'page is clamped after filtering');
  assert.deepEqual(paginate([], 1, 20), { rows: [], page: 1, pages: 1 });
  console.log('organisation list helpers passed');
}
