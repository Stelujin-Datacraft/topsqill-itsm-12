/**
 * Static review of Dev CRUD RLS module repairs 08–10.
 * Does not connect to a database.
 *
 *   npx tsx test/database/dev-crud-rls-modules-repair.test.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const ROOT = resolve(__dirname, '../../..');

function load(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function assertContains(sql: string, needle: string | RegExp, msg: string) {
  const ok = typeof needle === 'string' ? sql.includes(needle) : needle.test(sql);
  assert(ok, msg);
}

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
}

const M08 = 'supabase/migrations/20261020140000_dev_repair_08_auth_helpers.sql';
const M09 = 'supabase/migrations/20261020140100_dev_repair_09_reports_dashboards_rls.sql';
const M10 = 'supabase/migrations/20261020140200_dev_repair_10_access_control_rls.sql';
const SRC_ANY =
  'supabase/migrations/20260521123035_564da882-7dfe-4a4c-a639-984183c2afa0.sql';
const SRC_CREATE =
  'supabase/migrations/20260804120000_fix_reports_dashboard_create_policies.sql';
const ACCESS_HOOK = 'src/hooks/useUnifiedAccessControl.ts';
const ROLES_PAGE = 'src/pages/RolesAndAccess.tsx';

console.log('dev-crud-rls-modules-repair static review');

{
  const m08 = load(M08);
  const code = stripSqlComments(m08);
  assertContains(m08, 'BEGIN;', '08 transactional');
  assertContains(m08, 'COMMIT;', '08 commit');
  assertContains(m08, 'CREATE OR REPLACE FUNCTION public.get_current_user_org_id()', '08 defines get_current_user_org_id');
  assertContains(
    m08,
    'CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()',
    '08 defines get_current_user_organization_id alias',
  );
  assertContains(m08, 'SELECT public.get_current_user_org_id()', '08 organization_id aliases to org_id');
  assertContains(
    m08,
    'CREATE OR REPLACE FUNCTION public.user_has_any_role_assignment(_user_id uuid)',
    '08 restores user_has_any_role_assignment',
  );
  assertContains(load(SRC_ANY), 'user_has_any_role_assignment', 'source migration defines the helper');
  assertContains(m08, 'user_can_create_analytics_in_project', '08 restores analytics create helper');
  assertContains(m08, 'NOT public.user_has_any_role_assignment(_user_id)', '08 preserves legacy create path');
  assertContains(m08, 'can_view_project', '08 restores can_view_project');
  assertContains(m08, 'is_admin_of_role', '08 restores is_admin_of_role');
  assertContains(m08, 'is_project_member', '08 restores is_project_member');
  assertContains(m08, 'user_has_report_role_permission', '08 restores report role permission helper');
  assertContains(m08, 'user_has_dashboard_role_permission', '08 restores dashboard role permission helper');
  assert(!/USING\s*\(\s*true\s*\)/i.test(code), '08 must not use USING(true)');
  assert(!/\bDROP\s+TABLE\b/i.test(code), '08 must not DROP TABLE');

  // SECURITY DEFINER privilege hardening: every GRANT EXECUTE must be preceded by
  // REVOKE ALL … FROM PUBLIC for the same signature (no PUBLIC execute left).
  const definerFns = [
    'public.get_current_user_org_id()',
    'public.get_current_user_organization_id()',
    'public.is_org_admin_of(uuid)',
    'public.is_current_user_admin_of_org(uuid)',
    'public.is_project_member(uuid, uuid)',
    'public.can_view_project(uuid, uuid)',
    'public.user_has_any_role_assignment(uuid)',
    'public.user_has_role_assignment(uuid, uuid)',
    'public.is_admin_of_role(uuid)',
    'public.is_admin_of_group(uuid)',
    'public.can_view_group(uuid)',
    'public.user_has_report_role_permission(uuid, uuid, text)',
    'public.user_has_dashboard_role_permission(uuid, uuid, text)',
    'public.user_has_project_report_role_permissions(uuid, uuid)',
    'public.user_has_project_dashboard_role_permissions(uuid, uuid)',
    'public.user_has_policy_role_permission(uuid, uuid, text)',
    'public.user_has_project_policy_role_permissions(uuid, uuid)',
    'public.user_can_create_analytics_in_project(uuid, uuid, text)',
    'public.user_can_create_dashboard_in_project(uuid, uuid)',
    'public.user_can_create_report_in_project(uuid, uuid)',
  ];
  for (const sig of definerFns) {
    const revoke = `REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC`;
    const grant = `GRANT EXECUTE ON FUNCTION ${sig} TO authenticated, service_role`;
    assertContains(m08, revoke, `08 revokes PUBLIC execute on ${sig}`);
    assertContains(m08, grant, `08 grants execute to authenticated+service_role on ${sig}`);
    const revokePos = m08.indexOf(revoke);
    const grantPos = m08.indexOf(grant);
    assert(revokePos >= 0 && grantPos > revokePos, `08 REVOKE PUBLIC before GRANT for ${sig}`);
  }
  // Explicit coverage for the six helpers that previously lacked REVOKE
  assertContains(
    m08,
    'REVOKE ALL ON FUNCTION public.user_has_report_role_permission(uuid, uuid, text) FROM PUBLIC',
    '08 revokes PUBLIC on user_has_report_role_permission',
  );
  assertContains(
    m08,
    'REVOKE ALL ON FUNCTION public.user_has_dashboard_role_permission(uuid, uuid, text) FROM PUBLIC',
    '08 revokes PUBLIC on user_has_dashboard_role_permission',
  );
  assertContains(
    m08,
    'REVOKE ALL ON FUNCTION public.user_has_project_report_role_permissions(uuid, uuid) FROM PUBLIC',
    '08 revokes PUBLIC on user_has_project_report_role_permissions',
  );
  assertContains(
    m08,
    'REVOKE ALL ON FUNCTION public.user_has_project_dashboard_role_permissions(uuid, uuid) FROM PUBLIC',
    '08 revokes PUBLIC on user_has_project_dashboard_role_permissions',
  );
  assertContains(
    m08,
    'REVOKE ALL ON FUNCTION public.user_has_policy_role_permission(uuid, uuid, text) FROM PUBLIC',
    '08 revokes PUBLIC on user_has_policy_role_permission',
  );
  assertContains(
    m08,
    'REVOKE ALL ON FUNCTION public.user_has_project_policy_role_permissions(uuid, uuid) FROM PUBLIC',
    '08 revokes PUBLIC on user_has_project_policy_role_permissions',
  );
  console.log('  ✓ migration 08 auth helpers + SECURITY DEFINER privilege hardening');
}

{
  const m09 = load(M09);
  const code = stripSqlComments(m09);
  assertContains(m09, 'BEGIN;', '09 transactional');
  assertContains(m09, 'preflight failed — user_has_any_role_assignment missing', '09 requires repair 08');
  assertContains(m09, 'CREATE POLICY "Users can view reports in their organization"', '09 report SELECT');
  assertContains(m09, 'CREATE POLICY "Authorized users can create reports"', '09 report INSERT');
  assertContains(m09, 'CREATE POLICY "Admins can update reports"', '09 report UPDATE');
  assertContains(m09, 'CREATE POLICY "Admins can delete reports"', '09 report DELETE');
  assertContains(m09, 'CREATE POLICY "Role-based users can update reports"', '09 report role UPDATE');
  assertContains(m09, 'CREATE POLICY "Role-based users can delete reports"', '09 report role DELETE');
  assertContains(m09, 'CREATE POLICY "Project members can view dashboards"', '09 dashboard SELECT');
  assertContains(m09, 'CREATE POLICY "Authorized users can create dashboards"', '09 dashboard INSERT');
  assertContains(m09, 'CREATE POLICY "Org admins can update dashboards"', '09 dashboard UPDATE');
  assertContains(m09, 'CREATE POLICY "Org admins can delete dashboards"', '09 dashboard DELETE');
  assertContains(m09, 'CREATE POLICY "Role-based users can update dashboards"', '09 dashboard role UPDATE');
  assertContains(m09, 'CREATE POLICY "Role-based users can delete dashboards"', '09 dashboard role DELETE');

  // Final SELECT legacy path uses user_has_any_role_assignment (20260521123035)
  assertContains(m09, 'NOT public.user_has_any_role_assignment(auth.uid())', '09 SELECT legacy gate matches final migration');
  assert(!/user_has_project_report_role_permissions\(reports\.project_id/.test(stripSqlComments(m09)), '09 SELECT must not use superseded project-scoped legacy gate');

  // Org / project isolation markers
  assertContains(m09, "up.role = 'admin'", '09 org-admin checks');
  assertContains(m09, 'up.organization_id = reports.organization_id', '09 report org isolation');
  assertContains(m09, 'up.organization_id = dashboards.organization_id', '09 dashboard org isolation');
  assertContains(m09, "pu.role = 'admin'", '09 project-admin checks');
  assertContains(m09, 'user_can_create_analytics_in_project', '09 create uses analytics helper');

  // Deny drops AFTER policy creates
  const reportPolicyPos = m09.indexOf('CREATE POLICY "Authorized users can create reports"');
  const dashPolicyPos = m09.indexOf('CREATE POLICY "Authorized users can create dashboards"');
  const reportDenyPos = m09.indexOf('DROP POLICY IF EXISTS "reports_migration_deny"');
  const dashDenyPos = m09.indexOf('DROP POLICY IF EXISTS "dashboards_migration_deny"');
  assert(reportPolicyPos >= 0 && reportDenyPos > reportPolicyPos, '09 drops reports deny after policies');
  assert(dashPolicyPos >= 0 && dashDenyPos > dashPolicyPos, '09 drops dashboards deny after policies');

  assertContains(load(SRC_CREATE), 'user_has_any_role_assignment', 'create migration references missing helper');
  assert(!/USING\s*\(\s*true\s*\)/i.test(code), '09 must not recreate USING(true)');
  assert(!/WITH CHECK\s*\(\s*true\s*\)/i.test(code), '09 must not recreate WITH CHECK(true)');
  assert(!/projects_migration_deny/.test(code), '09 must not touch projects_migration_deny');
  assert(!/\bDROP\s+TABLE\b/i.test(code), '09 must not DROP TABLE');
  console.log('  ✓ migration 09 reports/dashboards policies + deny drop order');
}

{
  const m10 = load(M10);
  const code = stripSqlComments(m10);
  assertContains(m10, 'BEGIN;', '10 transactional');
  assertContains(m10, 'CREATE POLICY "Organization admins can manage roles"', '10 roles admin manage');
  assertContains(m10, 'CREATE POLICY "Users can view assigned roles"', '10 roles self view');
  assertContains(m10, 'CREATE POLICY "Organization admins can manage role permissions"', '10 role_permissions admin');
  assertContains(m10, 'CREATE POLICY "Users can view permissions for assigned roles"', '10 role_permissions self view');
  assertContains(m10, 'CREATE POLICY "Organization admins can manage user role assignments"', '10 assignments admin');
  assertContains(m10, 'CREATE POLICY "Users can view their own role assignments"', '10 assignments self view');
  assertContains(m10, 'CREATE POLICY "Users can view project top-level permissions"', '10 top-level SELECT');
  assertContains(m10, 'CREATE POLICY "Project admins can manage top-level permissions"', '10 top-level manage');
  assertContains(m10, 'up.organization_id = roles.organization_id', '10 roles org isolation');
  assertContains(m10, 'user_id = auth.uid()', '10 self-scoped assignment SELECT');

  const rolesPolicyPos = m10.indexOf('CREATE POLICY "Organization admins can manage roles"');
  const rolesDenyPos = m10.indexOf('DROP POLICY IF EXISTS "roles_migration_deny"');
  assert(rolesPolicyPos >= 0 && rolesDenyPos > rolesPolicyPos, '10 drops roles deny after policies');
  assertContains(m10, 'DROP POLICY IF EXISTS "role_permissions_migration_deny"', '10 drops role_permissions deny');
  assertContains(m10, 'DROP POLICY IF EXISTS "user_role_assignments_migration_deny"', '10 drops assignments deny');
  assertContains(
    m10,
    'DROP POLICY IF EXISTS "project_top_level_permissions_migration_deny"',
    '10 drops top-level deny',
  );
  assertContains(m10, 'groups_migration_deny', '10 drops groups deny when table exists');
  assertContains(m10, 'CREATE POLICY "Members can view org security templates"', '10 security_templates SELECT');
  assertContains(m10, 'CREATE POLICY "Users can view their own security parameters"', '10 user_security_parameters self SELECT');
  assertContains(m10, 'security_templates_migration_deny', '10 drops security_templates deny when present');
  assertContains(m10, 'user_security_parameters_migration_deny', '10 drops user_security_parameters deny when present');
  assert(!/projects_migration_deny/.test(code), '10 must not drop projects_migration_deny');
  assert(!/smtp_configs|api_keys|password_history|mfa_/.test(code), '10 must not touch secrets tables');
  assert(!/USING\s*\(\s*true\s*\)/i.test(code), '10 must not recreate USING(true)');
  assert(!/WITH CHECK\s*\(\s*true\s*\)/i.test(code), '10 must not recreate WITH CHECK(true)');
  console.log('  ✓ migration 10 Access Control policies + selective deny drops');
}

{
  // Access Control tab query targets must be covered by repair 10
  // Primary sidebar "Access Control" is /users; RolesAndAccess is /roles-and-access
  const hook = load(ACCESS_HOOK);
  const page = load(ROLES_PAGE);
  const usersPage = load('src/pages/Users.tsx');
  assertContains(page, 'RolesAndAccess', 'Roles and Access page exists');
  assertContains(usersPage, 'Access', 'Users/Access Control page exists');
  assertContains(hook, "from('project_top_level_permissions')", 'hook queries top-level permissions');
  assertContains(hook, "from('user_role_assignments')", 'hook queries role assignments');
  assertContains(hook, "from('role_permissions')", 'hook queries role permissions');
  assertContains(hook, "from('project_users')", 'hook queries project membership');
  const m10 = load(M10);
  assertContains(m10, 'project_top_level_permissions', '10 covers top-level table');
  assertContains(m10, 'user_role_assignments', '10 covers assignments');
  assertContains(m10, 'role_permissions', '10 covers role_permissions');
  assertContains(m10, 'security_templates', '10 covers security_templates for Users open path');
  assertContains(m10, 'user_security_parameters', '10 covers user_security_parameters for Users open path');
  console.log('  ✓ Access Control / Users query targets covered by repair 10');
}

{
  // Ensure Forms / workflow create policies are not rewritten here
  const all = [load(M08), load(M09), load(M10)].join('\n');
  assert(!/ON public\.forms\b/.test(stripSqlComments(all)), '08–10 must not alter forms policies');
  assert(!/ON public\.workflows\b/.test(stripSqlComments(all)), '08–10 must not alter workflows policies');
  assert(!/ON public\.workflow_nodes\b/.test(stripSqlComments(all)), '08–10 must not alter workflow_nodes');
  assert(!/ON public\.workflow_connections\b/.test(stripSqlComments(all)), '08–10 must not alter workflow_connections');
  assert(!/promotional_transfer|promotion_/i.test(stripSqlComments(all)), '08–10 must not touch promotional transfer');
  console.log('  ✓ Forms / workflows / promo left intact');
}

console.log('dev-crud-rls-modules-repair: all static checks passed');
