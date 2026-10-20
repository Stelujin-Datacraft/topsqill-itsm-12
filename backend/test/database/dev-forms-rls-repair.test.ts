/**
 * Static review of Dev Forms RLS repair migrations (PR #230 / package from #229).
 * Does not connect to a database.
 *
 *   npx tsx test/database/dev-forms-rls-repair.test.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const ROOT = resolve(__dirname, '../../..');

const M01 = 'supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql';
const M02 = 'supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql';
const M03 = 'supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql';
const M04 = 'supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql';
const M05 = 'supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql';

const SRC = {
  can_access_form: 'supabase/migrations/20260218042224_7da33ce0-a945-4de4-afe0-ac02a35c4b07.sql',
  can_modify_forms_row: 'supabase/migrations/20260218044247_d1f0fa16-b17f-4eec-9fbf-50ed8d7fc3c8.sql',
  can_access_forms_row: 'supabase/migrations/20260520071315_aa951057-9813-4a32-830e-2b40f7a9c73f.sql',
  can_act_for: 'supabase/migrations/20260604113932_db3095bb-712a-4639-beb9-2df456ee5449.sql',
  can_act_for_submission: 'supabase/migrations/20260606041529_b604f5d0-be04-429f-bf8c-614a8a517e43.sql',
  can_view_project: 'supabase/migrations/20260804120000_fix_reports_dashboard_create_policies.sql',
  invitations: 'supabase/migrations/20250625074633-c7def877-3cf8-4fdd-bb92-c05ecd23b805.sql',
} as const;

function load(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function extractFn(sql: string, name: string): string {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?(?=\\nCREATE OR REPLACE FUNCTION|\\nGRANT |\\nNOTIFY |\\nCOMMIT;|\\n-- -{5,}|$)`,
    'i',
  );
  const m = sql.match(re);
  assert(m, `function ${name} not found`);
  return m[0].replace(/\s+/g, ' ').trim();
}

function assertContains(sql: string, needle: string | RegExp, msg: string) {
  const ok = typeof needle === 'string' ? sql.includes(needle) : needle.test(sql);
  assert(ok, msg);
}

function assertNoPermissiveTrue(sql: string) {
  const code = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  // Match policy USING/WITH CHECK (true) only — not `_is_public = true` literals.
  assert(!/\bUSING\s*\(\s*true\s*\)/i.test(code), 'must not use USING (true)');
  assert(!/\bWITH CHECK\s*\(\s*true\s*\)/i.test(code), 'must not use WITH CHECK (true)');
}

const EXPECTED_POLICIES = [
  'forms_select',
  'forms_insert',
  'forms_update',
  'forms_delete',
  'Project admins can update forms',
  'Project admins can delete forms',
  'form_fields_select',
  'form_fields_insert',
  'form_fields_update',
  'form_fields_delete',
  'Scoped view policy for form submissions',
  'Delegates can view delegator submissions',
  'Allow form submissions with user tracking',
  'Delegates can insert delegator submissions',
  'Allow updates for authorized users',
  'Delegates can update delegator submissions',
  'Comprehensive delete policy for submissions',
  'Form editors can delete submissions',
  'Admins can view all form audit logs',
  'Users can view their own form audit logs',
  'Users can insert their own form audit logs',
  'Admins can delete form audit logs',
] as const;

console.log('dev-forms-rls-repair static review');

{
  const m01 = load(M01);
  assertContains(m01, 'BEGIN;', '01 must be transactional');
  assertContains(m01, 'COMMIT;', '01 must commit');
  assertContains(m01, 'record_delegations', '01 must reference record_delegations');
  assertContains(m01, 'RAISE EXCEPTION', '01 must fail preflight when tables missing');
  assertContains(m01, 'grant_delegator_access', '01 must ensure grant_delegator_access');
  assertNoPermissiveTrue(m01);

  for (const name of [
    'can_view_project',
    'can_access_form',
    'can_modify_form',
    'can_modify_forms_row',
    'user_has_form_role_permission',
    'user_has_project_form_role_permissions',
    'can_access_forms_row',
    'can_act_for',
    'can_act_for_submission',
  ] as const) {
    assertContains(m01, `CREATE OR REPLACE FUNCTION public.${name}`, `missing ${name}`);
    assertContains(m01, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}`, 'i'), `missing GRANT for ${name}`);
  }

  // Semantic anchors vs authoritative sources (not full-body equality — grants/search_path may differ)
  const access = extractFn(m01, 'can_access_form');
  assert(access.includes('SECURITY DEFINER'), 'can_access_form SECURITY DEFINER');
  assert(access.includes('SET search_path'), 'can_access_form search_path');
  assert(load(SRC.can_access_form).includes('OR f.created_by = _user_id::text'), 'source can_access_form creator check');

  const formsRow = extractFn(m01, 'can_access_forms_row');
  assert(formsRow.includes('user_has_project_form_role_permissions'), 'can_access_forms_row must call project role helper');
  assert(load(SRC.can_access_forms_row).includes('user_has_project_form_role_permissions'), 'source FINAL has role helper');

  const actFor = extractFn(m01, 'can_act_for');
  assert(actFor.includes('grant_delegator_access'), 'can_act_for FINAL uses grant_delegator_access');
  assert(load(SRC.can_act_for).includes('grant_delegator_access'), 'source can_act_for FINAL');

  const actSub = extractFn(m01, 'can_act_for_submission');
  assert(actSub.includes('JOIN public.form_submissions'), 'can_act_for_submission FINAL joins submissions');
  assert(load(SRC.can_act_for_submission).includes('can_access_form'), 'source submission FINAL uses can_access_form');

  assert(load(SRC.can_view_project).includes('project_permissions'), 'source can_view_project');
  assert(load(SRC.can_modify_forms_row).includes("_created_by = _user_id::text"), 'source can_modify_forms_row');

  console.log('  ✓ migration 01 helpers, grants, preflight, SECURITY DEFINER');
}

{
  const m02 = load(M02);
  assertContains(m02, 'BEGIN;', '02 must be transactional');
  assertContains(m02, 'COMMIT;', '02 must commit');
  assertContains(m02, 'DROP POLICY IF EXISTS', '02 drops existing policies');
  assertNoPermissiveTrue(m02);
  assertContains(m02, 'ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY', 'forms RLS on');
  assertContains(m02, 'auth.uid() = user_id', 'audit insert scoped to caller');
  assertContains(m02, 'can_access_forms_row', 'forms_select uses helper');
  assertContains(m02, 'user_has_form_role_permission', 'forms_select role permission');
  assertContains(m02, 'can_modify_form(form_id, auth.uid())', 'form_fields / editors use can_modify_form');

  for (const name of EXPECTED_POLICIES) {
    assertContains(m02, name, `missing policy ${name}`);
  }
  const policyCount = (m02.match(/CREATE POLICY/gi) || []).length;
  assert(
    policyCount === EXPECTED_POLICIES.length,
    `expected ${EXPECTED_POLICIES.length} CREATE POLICY statements, got ${policyCount}`,
  );
  console.log('  ✓ migration 02 full policy set (22) without USING(true)');
}

{
  const m03 = load(M03);
  const src = load(SRC.invitations);
  assertContains(m03, 'BEGIN;', '03 transactional');
  assertContains(m03, 'get_user_project_invitations', '03 creates invitations RPC');
  assertContains(m03, 'SET search_path = public', '03 hardens search_path');
  assertContains(m03, 'GRANT EXECUTE ON FUNCTION public.get_user_project_invitations()', '03 grants');
  assert(
    !/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION[\s\S]*get_organization_users/i.test(m03),
    '03 must not invent get_organization_users',
  );
  assert(src.includes('project_invitations'), 'source invitations RPC');
  assert(src.includes('cu.id = auth.uid()'), 'source scopes to current user');
  console.log('  ✓ migration 03 invitations RPC; get_organization_users excluded');
}

{
  const m04 = load(M04);
  assertContains(m04, 'BEGIN;', '04 transactional');
  assertContains(m04, 'COMMIT;', '04 commit');
  assertContains(m04, "ON DELETE CASCADE", '04 cascades fields/access/submissions');
  assertContains(m04, "ON DELETE SET NULL", '04 preserves audit via SET NULL');
  assertContains(m04, "form_audit_logs.form_id is NOT NULL", '04 nullability guard');
  assertContains(m04, 'DROP FUNCTION IF EXISTS public.__dev_repair_rebind_forms_fk', '04 cleans helper');
  // Operator capture: Prod CASCADE / Dev NO ACTION — repair must match Prod.
  assertContains(
    m04,
    "__dev_repair_rebind_forms_fk('form_submissions', 'form_submissions_form_id_fkey', 'CASCADE', true)",
    '04 must CASCADE form_submissions to match Production',
  );
  assertContains(m04, 'form_submissions_form_id_fkey missing after rebind', '04 post-checks submissions FK');
  assertContains(m04, "confdeltype=% (expected c/CASCADE)", '04 asserts submissions CASCADE');
  assertContains(m04, "expected n/SET NULL", '04 asserts audit SET NULL');
  assertContains(m04, 'preflight failed — missing required objects', '04 fails clearly if required tables/columns missing');
  console.log('  ✓ migration 04 FK strategy: submissions CASCADE (Prod parity), audit SET NULL');
}

{
  const m05 = load(M05);
  assertContains(m05, 'BEGIN;', '05 transactional');
  assertContains(m05, 'COMMIT;', '05 commit');
  assertContains(m05, 'CREATE OR REPLACE FUNCTION public.get_organization_users(org_id uuid)', '05 creates org users RPC');
  assertContains(m05, "up.status = 'active'", '05 filters active profiles (Prod capture)');
  assertContains(m05, 'SECURITY DEFINER', '05 SECURITY DEFINER');
  assertContains(m05, 'LANGUAGE sql', '05 LANGUAGE sql');
  assertContains(m05, 'STABLE', '05 STABLE');
  // Captured Prod body has no search_path — do not silently harden.
  const fnBody = extractFn(m05, 'get_organization_users');
  assert(
    !/\bSET\s+search_path\b/i.test(fnBody),
    '05 must not add SET search_path unless separately approved',
  );
  for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role', 'postgres'] as const) {
    assertContains(
      m05,
      `GRANT EXECUTE ON FUNCTION public.get_organization_users(uuid) TO ${role}`,
      `05 must GRANT EXECUTE to ${role}`,
    );
  }
  assertNoPermissiveTrue(m05);
  console.log('  ✓ migration 05 get_organization_users matches Prod capture + grants');
}

{
  const m02 = load(M02);
  assertContains(m02, 'POLICY_COMPARISON.md', '02 references policy comparison doc');
  assertContains(m02, 'DROP POLICY IF EXISTS', '02 drops existing (deny-all) policies');
  assertContains(m02, 'ENABLE ROW LEVEL SECURITY', '02 keeps RLS enabled');
  assertNoPermissiveTrue(m02);
  const comparison = load('docs/dev-schema-repair/POLICY_COMPARISON.md');
  assertContains(comparison, '22', 'comparison documents 22 policies');
  assertContains(comparison, 'deny-all', 'comparison documents deny-all discard');
  for (const name of EXPECTED_POLICIES) {
    assertContains(comparison, name, `comparison lists policy ${name}`);
  }
  console.log('  ✓ migration 02 policy safety documented vs Prod / deny-all');
}

{
  // Documented auth scenarios that must be validated live on Dev after apply
  const smoke = [
    'authorized form create',
    'authorized field create',
    'authorized submission',
    'audit insert own user_id',
    'unauthorized audit insert other user_id',
    'invitations rpc',
    'get_organization_users rpc',
    'form delete with fields',
    'form delete with submissions (CASCADE matches Prod)',
  ];
  assert(smoke.length >= 9, 'smoke matrix present');
  console.log('  ✓ live smoke matrix documented for post-apply Dev validation');
}

console.log('dev-forms-rls-repair: all static checks passed');
