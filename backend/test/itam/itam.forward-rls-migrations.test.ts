/**
 * Static verification of ITAM forward-only migrations (after VIS revoke).
 * Does not connect to a database — validates SQL files in the repo.
 *
 * Covers:
 *   - migration ordering after 20261017130500
 *   - unique-index preflight (non-destructive; RAISE with row details)
 *   - Phase A / B–D / form-sync RLS forward files (admin writes, append-only,
 *     schema_cache service_role-only)
 *   - migration-history scenario: shipped 1200/1300/1400 edits are NOT the
 *     apply path for already-recorded versions — forward files are
 *   - Nest ITAM_DISCOVERY_APPLY_SCHEMA remains default-off
 *
 *   ITAM_DISCOVERY_UNIT_TEST=1 npx tsx test/itam/itam.forward-rls-migrations.test.ts
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { shouldApplyDiscoverySchema } from '../../src/itam/discovery/persistence-config';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

/**
 * Mirrors 20261017140000 asset_software preflight under Postgres UNIQUE NULL
 * semantics (no NULLS NOT DISTINCT): only non-NULL version collisions violate.
 * Does not connect to a database — used for regression fixtures only.
 */
type AssetSoftwareRow = {
  id: string;
  asset_id: string;
  software_name: string;
  version: string | null;
};

function findAssetSoftwareUniqueViolations(
  rows: AssetSoftwareRow[],
): Array<{ asset_id: string; software_name: string; version: string; ids: string[] }> {
  const groups = new Map<string, AssetSoftwareRow[]>();
  for (const row of rows) {
    // Match SQL GROUP BY: NULL versions share a group key, but HAVING filters them out.
    const key = `${row.asset_id}\0${row.software_name}\0${row.version === null ? '\0NULL' : row.version}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const violations: Array<{
    asset_id: string;
    software_name: string;
    version: string;
    ids: string[];
  }> = [];
  for (const list of groups.values()) {
    if (list.length <= 1) continue;
    const version = list[0].version;
    // HAVING count(*) > 1 AND version IS NOT NULL
    if (version === null) continue;
    violations.push({
      asset_id: list[0].asset_id,
      software_name: list[0].software_name,
      version,
      ids: list.map((r) => r.id).sort(),
    });
  }
  return violations;
}

const ROOT = resolve(__dirname, '../../..');
const MIG = resolve(ROOT, 'supabase/migrations');

const VIS_REVOKE = '20261017130500_vis_revoke_client_table_grants.sql';
const UNIQUE_PRE = '20261017140000_itam_unique_indexes_preflight.sql';
const PHASE_A = '20261017141000_itam_phase_a_rls_forward.sql';
const PHASE_BD = '20261017142000_itam_phases_b_d_rls_forward.sql';
const FORM_SYNC = '20261017143000_itam_form_sync_rls_forward.sql';

const SHIPPED = [
  '20260930120000_itam_network_discovery.sql',
  '20260930130000_itam_phases_b_d.sql',
  '20260930140000_itam_form_sync.sql',
] as const;

const PHASE_A_TABLES = [
  'itam_network_scopes',
  'itam_discovery_jobs',
  'itam_discovery_runs',
  'itam_discovered_hosts',
  'itam_asset_identities',
  'itam_software_catalog',
  'itam_software_aliases',
  'itam_discovery_diffs',
  'itam_discovery_audit',
  'itam_asset_services',
  'itam_field_provenance',
] as const;

const PHASE_BD_TABLES = [
  'itam_cloud_providers',
  'itam_cloud_accounts',
  'itam_cloud_resources',
  'itam_cloud_discovery_jobs',
  'itam_cloud_changes',
  'itam_telemetry_sources',
  'itam_network_observations',
  'itam_ip_history',
  'itam_mac_history',
  'itam_passive_events',
  'itam_topology_nodes',
  'itam_topology_edges',
  'itam_topology_history',
] as const;

const FORM_SYNC_ORG_TABLES = [
  'itam_sync_targets',
  'itam_sync_mappings',
  'itam_sync_runs',
  'itam_sync_history',
  'itam_sync_provenance',
  'itam_sync_links',
] as const;

const APPEND_ONLY = [
  'itam_discovery_audit',
  'itam_cloud_changes',
  'itam_passive_events',
  'itam_topology_history',
  'itam_sync_history',
  'itam_sync_provenance',
] as const;

function loadMig(name: string): string {
  const p = resolve(MIG, name);
  assert(existsSync(p), `missing migration ${name}`);
  return readFileSync(p, 'utf8');
}

function assertRlsEnabled(sql: string, table: string) {
  const re = new RegExp(
    `ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`,
    'i',
  );
  assert(re.test(sql), `RLS not enabled on ${table}`);
}

function assertAdminWrite(sql: string, table: string, op: 'INSERT' | 'UPDATE' | 'DELETE') {
  const re = new RegExp(
    `CREATE POLICY "[^"]+" ON public\\.${table}[\\s\\S]*?FOR ${op} TO authenticated[\\s\\S]*?` +
      `is_org_admin_of\\(`,
    'i',
  );
  assert(re.test(sql), `${table} ${op} must require is_org_admin_of(...)`);
}

function policiesForTable(sql: string, table: string): string[] {
  const re = new RegExp(
    `CREATE POLICY "[^"]+" ON public\\.${table}\\b[\\s\\S]*?(?=CREATE POLICY |ALTER TABLE |REVOKE |GRANT |$)`,
    'gi',
  );
  return sql.match(re) || [];
}

function assertNoAuthenticatedUpdateDelete(sql: string, table: string) {
  const blocks = policiesForTable(sql, table);
  assert(
    !blocks.some((b) => /FOR UPDATE TO authenticated/i.test(b)),
    `${table} must not allow authenticated UPDATE`,
  );
  assert(
    !blocks.some((b) => /FOR DELETE TO authenticated/i.test(b)),
    `${table} must not allow authenticated DELETE`,
  );
}

function assertNoLooseForAll(sql: string) {
  const loose =
    /FOR ALL TO authenticated\s+USING\s*\(\s*organization_id = public\.get_current_user_org_id\(\)\s*\)/gi;
  assert(!loose.test(sql), 'insecure FOR ALL org-only policy must not appear');
}

function assertNoDestructiveDml(sql: string) {
  assert(!/\bDELETE\s+FROM\s+public\./i.test(sql), 'must not DELETE FROM tables');
  assert(!/\bTRUNCATE\s+/i.test(sql), 'must not TRUNCATE');
  assert(
    !/\bUPDATE\s+public\.(asset_software|itam_network_scopes)\b/i.test(sql),
    'preflight must not rewrite duplicate rows',
  );
}

async function main() {
  console.log('ITAM forward RLS / unique-index migrations (static)');

  // ── Ordering after VIS revoke ───────────────────────────────────────────
  const ts = (name: string) => name.slice(0, 14);
  assert(ts(UNIQUE_PRE) > ts(VIS_REVOKE), 'unique preflight after VIS revoke');
  assert(ts(PHASE_A) > ts(UNIQUE_PRE), 'phase A after unique preflight');
  assert(ts(PHASE_BD) > ts(PHASE_A), 'phase B–D after phase A');
  assert(ts(FORM_SYNC) > ts(PHASE_BD), 'form sync after phase B–D');
  for (const f of [VIS_REVOKE, UNIQUE_PRE, PHASE_A, PHASE_BD, FORM_SYNC]) {
    assert(existsSync(resolve(MIG, f)), `expected file ${f}`);
  }
  const all = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  const idxRevoke = all.indexOf(VIS_REVOKE);
  assert(idxRevoke >= 0, 'VIS revoke present');
  for (const f of [UNIQUE_PRE, PHASE_A, PHASE_BD, FORM_SYNC]) {
    assert(all.indexOf(f) > idxRevoke, `${f} must sort after VIS revoke`);
  }
  console.log('  ✓ migration timestamps ordered after VIS revoke');

  // ── Unique-index preflight ──────────────────────────────────────────────
  const pre = loadMig(UNIQUE_PRE);
  assertNoDestructiveDml(pre);
  assert(/RAISE EXCEPTION/i.test(pre), 'preflight raises on duplicates');
  assert(/array_agg\(id::text/i.test(pre), 'reports duplicate row ids');
  assert(/uq_asset_software_asset_name_ver/.test(pre), 'creates asset_software unique index');
  assert(/uq_itam_network_scopes_org_cidr_kind/.test(pre), 'creates scopes unique index');
  assert(/CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_software/.test(pre), 'idempotent index create');
  assert(/CREATE UNIQUE INDEX IF NOT EXISTS uq_itam_network_scopes/.test(pre), 'idempotent scopes index');
  {
    const ddlLines = pre
      .split('\n')
      .filter((l) => /^\s*CREATE UNIQUE INDEX\b/i.test(l) || /^\s*ON public\.(asset_software|itam_network_scopes)\b/i.test(l));
    assert(
      !ddlLines.some((l) => /NULLS NOT DISTINCT/i.test(l)),
      'must not change index DDL to NULLS NOT DISTINCT',
    );
  }
  assert(
    /GROUP BY asset_id, software_name, version\s+HAVING count\(\*\) > 1 AND version IS NOT NULL/i.test(
      pre,
    ),
    'asset_software preflight must ignore NULL version groups (Postgres UNIQUE semantics)',
  );
  assert(/Do not auto-delete/i.test(pre), 'documents non-destructive policy');
  assert(
    pre.indexOf('RAISE EXCEPTION') < pre.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_software'),
    'asset_software RAISE must precede unique index create',
  );
  assert(
    pre.lastIndexOf('itam_network_scopes duplicate') <
      pre.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS uq_itam_network_scopes'),
    'scopes RAISE must precede unique index create',
  );
  console.log('  ✓ unique-index preflight is non-destructive and ordered');

  // Regression: multiple NULL versions are allowed by UNIQUE; must not flag.
  {
    const nullVersionRows: AssetSoftwareRow[] = [
      { id: 'a1', asset_id: 'asset-1', software_name: 'Chrome', version: null },
      { id: 'a2', asset_id: 'asset-1', software_name: 'Chrome', version: null },
      { id: 'a3', asset_id: 'asset-1', software_name: 'Chrome', version: null },
    ];
    const v = findAssetSoftwareUniqueViolations(nullVersionRows);
    assert(v.length === 0, 'multiple version IS NULL rows must not be unique violations');
  }
  // Regression: true non-NULL duplicate key must be reported with ids.
  {
    const trueDupRows: AssetSoftwareRow[] = [
      { id: 'b1', asset_id: 'asset-2', software_name: 'Firefox', version: '1.0' },
      { id: 'b2', asset_id: 'asset-2', software_name: 'Firefox', version: '1.0' },
      { id: 'b3', asset_id: 'asset-2', software_name: 'Firefox', version: null },
      { id: 'b4', asset_id: 'asset-2', software_name: 'Firefox', version: null },
    ];
    const v = findAssetSoftwareUniqueViolations(trueDupRows);
    assert(v.length === 1, 'exactly one non-NULL duplicate group expected');
    assert(v[0].version === '1.0', 'duplicate version must be 1.0');
    assert(v[0].ids.join(',') === 'b1,b2', 'must report exact duplicate row ids');
  }
  console.log('  ✓ asset_software NULL-version vs true-duplicate preflight semantics');

  // ── Phase A forward RLS ─────────────────────────────────────────────────
  const a = loadMig(PHASE_A);
  assertNoLooseForAll(a);
  assertNoDestructiveDml(a);
  for (const t of PHASE_A_TABLES) assertRlsEnabled(a, t);
  assertAdminWrite(a, 'itam_network_scopes', 'INSERT');
  assertAdminWrite(a, 'itam_network_scopes', 'UPDATE');
  assertAdminWrite(a, 'itam_network_scopes', 'DELETE');
  assertAdminWrite(a, 'itam_discovery_jobs', 'INSERT');
  assertNoAuthenticatedUpdateDelete(a, 'itam_discovery_audit');
  assertAdminWrite(a, 'itam_discovery_audit', 'INSERT');
  assert(/organization_id IS NULL/.test(a), 'software catalog global read preserved');
  assert(/REVOKE ALL ON TABLE[\s\S]*FROM anon/.test(a), 'revokes anon');
  assert(/GRANT ALL ON TABLE[\s\S]*TO service_role/.test(a), 'grants service_role');
  assert(/DROP POLICY IF EXISTS/.test(a), 'repeatable DROP IF EXISTS');
  console.log('  ✓ phase A forward RLS');

  // ── Phase B–D forward RLS ───────────────────────────────────────────────
  const bd = loadMig(PHASE_BD);
  assertNoLooseForAll(bd);
  for (const t of PHASE_BD_TABLES) {
    assertRlsEnabled(bd, t);
    assertAdminWrite(bd, t, 'INSERT');
  }
  assertNoAuthenticatedUpdateDelete(bd, 'itam_cloud_changes');
  assertNoAuthenticatedUpdateDelete(bd, 'itam_passive_events');
  assertNoAuthenticatedUpdateDelete(bd, 'itam_topology_history');
  assertAdminWrite(bd, 'itam_cloud_providers', 'UPDATE');
  assertAdminWrite(bd, 'itam_cloud_providers', 'DELETE');
  console.log('  ✓ phase B–D forward RLS');

  // ── Form sync forward RLS ───────────────────────────────────────────────
  const fsSql = loadMig(FORM_SYNC);
  assertNoLooseForAll(fsSql);
  for (const t of FORM_SYNC_ORG_TABLES) {
    assertRlsEnabled(fsSql, t);
    assertAdminWrite(fsSql, t, 'INSERT');
  }
  assertNoAuthenticatedUpdateDelete(fsSql, 'itam_sync_history');
  assertNoAuthenticatedUpdateDelete(fsSql, 'itam_sync_provenance');
  assertRlsEnabled(fsSql, 'itam_sync_schema_cache');
  assert(
    !/CREATE POLICY "[^"]+" ON public\.itam_sync_schema_cache[\s\S]*?FOR SELECT TO authenticated/i.test(
      fsSql,
    ),
    'schema_cache must not grant authenticated SELECT policy',
  );
  assert(
    /REVOKE ALL ON TABLE public\.itam_sync_schema_cache FROM authenticated/.test(fsSql),
    'schema_cache revoke authenticated',
  );
  assert(/GRANT ALL ON TABLE[\s\S]*itam_sync_schema_cache[\s\S]*TO service_role/.test(fsSql),
    'schema_cache service_role grant');
  console.log('  ✓ form-sync forward RLS (schema_cache service_role-only)');

  // ── Append-only inventory across forward files ──────────────────────────
  const combined = a + bd + fsSql;
  for (const t of APPEND_ONLY) {
    assertNoAuthenticatedUpdateDelete(combined, t);
  }
  console.log('  ✓ append-only tables have no authenticated UPDATE/DELETE');

  // ── Migration-history scenario (read-only checklist encoded as asserts) ─
  // Already-recorded 1200/1300/1400 versions will NOT re-run if edited in git.
  // Forward files above are the apply path for those DBs.
  for (const shipped of SHIPPED) {
    assert(existsSync(resolve(MIG, shipped)), `shipped file still present: ${shipped}`);
  }
  assert(
    /FORWARD-ONLY/i.test(a) && /FORWARD-ONLY/i.test(bd) && /FORWARD-ONLY/i.test(fsSql),
    'forward files must be labeled FORWARD-ONLY',
  );
  assert(
    /already applied|already-migrated|FORWARD-ONLY ITAM repair/i.test(a + bd + fsSql),
    'documents already-applied migration history scenario',
  );
  console.log('  ✓ migration-history scenario documented (forward path, not re-edit)');

  // ── Nest must not auto-DDL on deployed boot ─────────────────────────────
  assert(
    shouldApplyDiscoverySchema({}) === false,
    'ITAM_DISCOVERY_APPLY_SCHEMA default must be off',
  );
  assert(
    shouldApplyDiscoverySchema({ ITAM_DISCOVERY_APPLY_SCHEMA: '0' }) === false,
    'explicit 0 keeps applySchema off',
  );
  assert(
    shouldApplyDiscoverySchema({
      ENVIRONMENT: 'production',
      ITAM_DISCOVERY_APPLY_SCHEMA: undefined,
    }) === false,
    'production default applySchema off',
  );
  console.log('  ✓ ITAM_DISCOVERY_APPLY_SCHEMA default-off for Nest boots');

  // ── Read-only Dev validation checklist (printed for operators) ──────────
  const checklist = [
    'Confirm schema_migrations already has 20260930120000/130000/140000 (if yes, rely on forward files only).',
    'Apply 20261017140000; if it RAISE EXCEPTION, resolve listed duplicate ids manually — do not delete via migration.',
    'Apply 20261017141000 → 17142000 → 17143000.',
    'As authenticated non-admin: SELECT org rows OK; INSERT/UPDATE/DELETE denied on ITAM tables.',
    'As org admin: writes allowed on non-append tables; append-only tables deny UPDATE/DELETE.',
    'itam_sync_schema_cache: authenticated denied; service_role OK.',
    'Keep ITAM_DISCOVERY_APPLY_SCHEMA=0 on Nest Dev/Prod boots.',
  ];
  console.log('  Read-only Dev validation checklist:');
  for (const step of checklist) console.log(`    [ ] ${step}`);

  console.log('All ITAM forward migration static tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
