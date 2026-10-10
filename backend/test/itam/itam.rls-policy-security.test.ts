/**
 * Static security review of ITAM Supabase migration SQL.
 * Does not connect to a database — validates policy expressions in repo files.
 *
 *   ITAM_DISCOVERY_UNIT_TEST=1 npx tsx test/itam/itam.rls-policy-security.test.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const ROOT = resolve(__dirname, '../../..');

const HELPER = 'supabase/migrations/20260930110000_get_current_user_org_id.sql';
const M120 = 'supabase/migrations/20260930120000_itam_network_discovery.sql';
const M130 = 'supabase/migrations/20260930130000_itam_phases_b_d.sql';
const M140 = 'supabase/migrations/20260930140000_itam_form_sync.sql';

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

function load(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function assertRlsEnabled(sql: string, table: string) {
  const re = new RegExp(
    `ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`,
    'i',
  );
  assert(re.test(sql), `RLS not enabled on ${table}`);
}

function assertSelectOrgScoped(sql: string, table: string) {
  const re = new RegExp(
    `CREATE POLICY "[^"]+" ON public\\.${table}[\\s\\S]*?FOR SELECT TO authenticated[\\s\\S]*?` +
      `organization_id = public\\.get_current_user_org_id\\(\\)`,
    'i',
  );
  assert(re.test(sql), `${table} SELECT must be org-scoped via get_current_user_org_id()`);
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

function assertNoLooseAdminForAll(sql: string) {
  // Old insecure pattern: FOR ALL with only org membership (no admin check)
  const loose = /FOR ALL TO authenticated\s+USING\s*\(\s*organization_id = public\.get_current_user_org_id\(\)\s*\)/gi;
  assert(!loose.test(sql), 'found insecure FOR ALL policy with org check only (no admin)');
}

async function main() {
  console.log('ITAM RLS policy security (static)');

  const helper = load(HELPER);
  assert(/get_current_user_org_id/.test(helper), 'helper defines get_current_user_org_id');
  assert(/is_org_admin_of/.test(helper), 'helper defines is_org_admin_of');
  assert(/role = 'admin'/.test(helper), 'admin check uses user_profiles.role = admin');
  assert(/SET search_path = public/.test(helper), 'SECURITY DEFINER sets search_path');
  assert(!/projects_migration_deny|ON public\.projects/.test(helper), 'helper must not touch projects');
  assert(
    !/\brole\s*=\s*'ITAM_ADMIN'|\brole\s*=\s*'itam_admin'|\brole\s*=\s*'org_admin'|\brole\s*=\s*'super_admin'/i.test(helper),
    'must not invent Nest-only role strings in SQL',
  );
  console.log('  ✓ helper migration authorization model');

  const m120 = load(M120);
  assertNoLooseAdminForAll(m120);
  for (const t of PHASE_A_TABLES) {
    assertRlsEnabled(m120, t);
  }
  for (const t of PHASE_A_TABLES) {
    if (t === 'itam_software_aliases') {
      // aliases scoped via catalog join
      assert(/itam_software_aliases[\s\S]*is_org_admin_of/.test(m120), 'aliases admin writes');
      continue;
    }
    if (t === 'itam_software_catalog') {
      assert(/organization_id IS NULL/.test(m120), 'catalog allows intentional global read');
      assertAdminWrite(m120, t, 'INSERT');
      assertAdminWrite(m120, t, 'UPDATE');
      assertAdminWrite(m120, t, 'DELETE');
      continue;
    }
    assertSelectOrgScoped(m120, t);
  }
  assertAdminWrite(m120, 'itam_network_scopes', 'INSERT');
  assertAdminWrite(m120, 'itam_network_scopes', 'UPDATE');
  assertAdminWrite(m120, 'itam_network_scopes', 'DELETE');
  assertAdminWrite(m120, 'itam_discovery_jobs', 'INSERT');
  assertNoAuthenticatedUpdateDelete(m120, 'itam_discovery_audit');
  assertAdminWrite(m120, 'itam_discovery_audit', 'INSERT');
  assert(/REVOKE ALL ON TABLE[\s\S]*FROM anon/.test(m120), 'revokes anon on discovery tables');
  assert(/GRANT ALL ON TABLE[\s\S]*TO service_role/.test(m120), 'grants service_role');
  // Cross-org isolation: writes always bind organization_id to caller's org
  assert(
    (m120.match(/organization_id = public\.get_current_user_org_id\(\)/g) || []).length >= 20,
    'org isolation expressions present',
  );
  console.log('  ✓ phase A network discovery RLS');

  const m130 = load(M130);
  assertNoLooseAdminForAll(m130);
  for (const t of PHASE_BD_TABLES) {
    assertRlsEnabled(m130, t);
    assertSelectOrgScoped(m130, t);
    assertAdminWrite(m130, t, 'INSERT');
  }
  assertAdminWrite(m130, 'itam_cloud_providers', 'UPDATE');
  assertAdminWrite(m130, 'itam_cloud_providers', 'DELETE');
  assertAdminWrite(m130, 'itam_telemetry_sources', 'UPDATE');
  // credential-bearing tables must not be writable without admin
  assert(/itam_cloud_providers[\s\S]*is_org_admin_of/.test(m130), 'providers admin-gated');
  assert(/itam_telemetry_sources[\s\S]*is_org_admin_of/.test(m130), 'telemetry admin-gated');
  assertNoAuthenticatedUpdateDelete(m130, 'itam_cloud_changes');
  assertNoAuthenticatedUpdateDelete(m130, 'itam_passive_events');
  assertNoAuthenticatedUpdateDelete(m130, 'itam_topology_history');
  console.log('  ✓ phases B–D RLS');

  const m140 = load(M140);
  assertNoLooseAdminForAll(m140);
  for (const t of FORM_SYNC_ORG_TABLES) {
    assertRlsEnabled(m140, t);
    assertSelectOrgScoped(m140, t);
    assertAdminWrite(m140, t, 'INSERT');
  }
  assertAdminWrite(m140, 'itam_sync_targets', 'UPDATE');
  assertAdminWrite(m140, 'itam_sync_targets', 'DELETE');
  assertAdminWrite(m140, 'itam_sync_mappings', 'UPDATE');
  assertNoAuthenticatedUpdateDelete(m140, 'itam_sync_history');
  assertNoAuthenticatedUpdateDelete(m140, 'itam_sync_provenance');
  assertRlsEnabled(m140, 'itam_sync_schema_cache');
  // schema cache: no authenticated SELECT policy (deny-by-default)
  assert(
    !/CREATE POLICY "[^"]+" ON public\.itam_sync_schema_cache[\s\S]*?FOR SELECT TO authenticated/i.test(m140),
    'schema_cache must not expose SELECT to authenticated without org column',
  );
  assert(/REVOKE ALL ON TABLE public\.itam_sync_schema_cache FROM authenticated/.test(m140),
    'schema_cache revoke authenticated');
  console.log('  ✓ form sync RLS');

  // Documented authorization distinction (regression guard)
  assert(
    !/role\s*=\s*'ITAM_ADMIN'|role\s*=\s*'itam_admin'/i.test(m120 + m130 + m140 + helper),
    'SQL must not treat Nest ITAM_ADMIN header role as DB admin',
  );
  console.log('  ✓ no invented Nest role strings in SQL');

  console.log('All ITAM RLS policy security tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
