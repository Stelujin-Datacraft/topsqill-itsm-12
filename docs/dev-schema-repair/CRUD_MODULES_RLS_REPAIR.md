# Dev CRUD modules RLS repair (08–10)

**Branch:** `cursor/fix-crud-rls-modules-e654`  
**Date:** 2026-10-20  
**Scope:** Dev-only. No Production apply. No Promotional Transfer / CI config copy.

SQL has **not** been applied from this agent environment.

---

## 1. Root cause

Dev carries temporary **RESTRICTIVE** policies named `{table}_migration_deny` with `USING (false)` / `WITH CHECK (false)` for `authenticated`. PostgreSQL ANDs RESTRICTIVE policies with PERMISSIVE ones, so authenticated CRUD stays denied even when intended policies exist.

Compounding issues for Reports / Dashboards / Access Control:

| Gap | Effect |
|-----|--------|
| `user_has_any_role_assignment(uuid)` missing | `20260804120000` create helpers / policies cannot evaluate |
| `get_current_user_organization_id()` missing (Dev has `get_current_user_org_id()`) | Older SELECT policies fail at runtime |
| `reports` / `dashboards` have **only** deny policies on Dev | Create/list/edit/delete blocked |
| Access Control tab loads `roles`, `role_permissions`, `user_role_assignments`, `project_top_level_permissions`, plus reports/dashboards pickers | Tab fails open when those tables are deny-only or missing helpers |

Workflows / workflow_nodes / workflow_connections were already restored on Dev (out of scope for 08–10). Forms repairs 01–05 remain separate.

---

## 2. Affected tables and intended access

| Table | Intended access | Repair |
|-------|-----------------|--------|
| `reports` | Org admin / project admin / creator / role grants; legacy org visibility when no project report roles; create via analytics helper | **09** |
| `dashboards` | Creator / project admin / role grants; project members when no dashboard roles; create via analytics helper | **09** |
| `roles` | Org admin manage; assignees can SELECT | **10** |
| `role_permissions` | Org admin manage (via `is_admin_of_role`); assignees SELECT | **10** |
| `user_role_assignments` | Org admin manage; self SELECT | **10** |
| `project_top_level_permissions` | Project/org admin manage; members/self SELECT | **10** |
| `groups` / `group_memberships` / `group_roles` / `group_role_assignments` | Org admin manage; org members view (where applicable) | **10** (if tables exist) |
| `security_templates` / `user_security_parameters` / `organization_security_defaults` | Org members view templates/defaults; org admin manage; users view own security params | **10** (Users / Access Control open path) |

**Access Control UI note:** Sidebar “Access Control” is `/users` (`Users.tsx`); `/roles-and-access` hosts the same role tabs. Repair 10 covers both open paths.

**SELECT legacy path (reports/dashboards):** Final semantics from `20260521123035` — org-wide/project-member legacy visibility only when `NOT user_has_any_role_assignment(auth.uid())` (not the superseded project-scoped gate from the prior day).

**Intentionally not opened to authenticated:** secrets/credentials (`smtp_configs`, `api_keys`, MFA/password history), service-only queue/execution logs, and **`projects_migration_deny`** (leave alone per ITAM guidance).

---

## 3. Migrations

| File | Purpose |
|------|---------|
| `20261020140000_dev_repair_08_auth_helpers.sql` | Restore helpers: org id alias, `user_has_any_role_assignment`, role/permission helpers, analytics create helpers |
| `20261020140100_dev_repair_09_reports_dashboards_rls.sql` | Restore reports/dashboards CRUD policies, **then** drop `reports_migration_deny` / `dashboards_migration_deny` |
| `20261020140200_dev_repair_10_access_control_rls.sql` | Restore Access Control policies, **then** drop matching `*_migration_deny` on those tables only |

Order is mandatory: **08 → 09 → 10**. Deny policies are dropped only after replacements exist.

---

## 4. Dev apply procedure

```bash
# Confirm Dev target
psql "$DEV_DATABASE_URL" -c "SELECT current_database(), current_user;"

psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261020140000_dev_repair_08_auth_helpers.sql \
  -f supabase/migrations/20261020140100_dev_repair_09_reports_dashboards_rls.sql \
  -f supabase/migrations/20261020140200_dev_repair_10_access_control_rls.sql
```

Post-flight:

```sql
-- Helpers
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN (
  'get_current_user_organization_id','get_current_user_org_id',
  'user_has_any_role_assignment','user_can_create_analytics_in_project'
);

-- Deny gone
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%_migration_deny'
  AND tablename IN (
    'reports','dashboards','roles','role_permissions',
    'user_role_assignments','project_top_level_permissions',
    'groups','group_memberships','group_roles','group_role_assignments'
  );
-- expect 0 rows

-- Intended policies present
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('reports','dashboards','roles')
ORDER BY 1, 2;
```

Smoke: create/list/edit/delete Report + Dashboard as org admin and project admin; open Roles and Access (User Roles / Create Roles / Group Roles); confirm Forms + Workflow create still work.

---

## 5. Production rollout (requires explicit human approval)

1. Capture Prod policy + helper inventory (read-only).
2. Diff against 08–10; **do not** apply deny drops that do not exist on Prod.
3. Prefer applying only missing helpers / missing permissive policies; skip deny drops if Prod never had `*_migration_deny`.
4. Separate change ticket + approval. **NO-GO** until approved.
5. Promotional Transfer remains a manual config promotion path — not part of this migration package or CI/CD.

---

## 6. Verdict

| Scope | Decision |
|-------|----------|
| Apply **08–10** on **Dev** after approval | **CONDITIONAL GO** |
| Claim Access Control / Reports fixed without live smoke | **NO-GO** |
| Production | **NO-GO** without explicit approval |
