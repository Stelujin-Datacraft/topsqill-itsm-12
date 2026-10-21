# Fix create/delete on Dev + Prod — operator checklist

**Answer:** Yes. On **Dev Supabase**, missing RLS policies **or** leftover RESTRICTIVE
`*_migration_deny` policies (`USING (false)` / `WITH CHECK (false)`) will block
authenticated create/delete across modules. PostgreSQL ANDs RESTRICTIVE policies
with permissive ones, so deny wins even if “good” policies exist.

**Production Supabase:** schema/policies are already present — do **not** run Dev
repairs `01–10` on Prod. Prod needs VM env + app deploy only.

Agent side (repo) is ready on `develop` (repairs 01–10 + auth helper grants) and
PR #234 (Nest user-JWT mutations + `/api/health/crud`). Live SQL and VM env cannot
be changed from the agent without your access.

---

## A. Dev Supabase (SQL Editor) — apply in order

Paste and run **one file at a time** from `origin/develop` (or this repo):

| # | File |
|---|------|
| 01 | `supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql` |
| 02 | `supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql` |
| 03 | `supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql` |
| 04 | `supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql` |
| 05 | `supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql` |
| 06 | `supabase/migrations/20261020080000_dev_repair_06_sla_canonical_columns.sql` |
| 07 | `supabase/migrations/20261020080100_dev_repair_07_workflow_queue_additive.sql` |
| 08 | `supabase/migrations/20261020140000_dev_repair_08_auth_helpers.sql` |
| 09 | `supabase/migrations/20261020140100_dev_repair_09_reports_dashboards_rls.sql` |
| 10 | `supabase/migrations/20261020140200_dev_repair_10_access_control_rls.sql` |

Skip any step already applied successfully. Stop on error; paste the error back.

### After apply — paste this verification (Dev only)

```sql
-- Remaining migration_deny policies (expect 0 rows for modules you care about;
-- projects_migration_deny may remain intentionally)
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%migration_deny%'
ORDER BY tablename, policyname;

-- Auth helpers that CRUD policies need (expect all true)
SELECT
  to_regprocedure('public.get_current_user_organization_id()') IS NOT NULL AS has_org_id,
  to_regprocedure('public.user_has_any_role_assignment(uuid)') IS NOT NULL AS has_any_role,
  to_regprocedure('public.get_organization_users(uuid)') IS NOT NULL AS has_org_users;
```

---

## B. Both VMs (Dev + Prod) — env + deploy

1. Merge / deploy PR #234 (Nest user JWT + service_role boot gate + `/api/health/crud`).
2. On **each** VM `.env` (never cross Dev↔Prod keys):

| Variable | Must be |
|----------|---------|
| `ENVIRONMENT` | `development` (Dev VM) / `production` (Prod VM) |
| `SUPABASE_URL` | That environment’s project URL |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | That project’s **anon** key |
| `SUPABASE_SERVICE_ROLE_KEY` | That project’s **service_role** secret (JWT `role` = `service_role`, **not** anon) |

3. Rebuild Nest **and** frontend so `VITE_SUPABASE_URL` matches Nest `SUPABASE_URL`.
4. On each VM:

```bash
curl -sS http://127.0.0.1:3001/api/health/crud
```

Expect: `"status":"ok"`, `"serviceRoleJwtRole":"service_role"`.

5. Smoke: sign in → create + delete one Form, one Report/Dashboard (or Access Control row) as an org/project admin.

---

## C. What to send the agent if anything still fails

1. Output of the Dev verification SQL above.
2. Output of `curl …/api/health/crud` from **Dev VM** and **Prod VM** (no secrets).
3. One failing browser Network error body for `POST /api/database/insert` or `delete` (status + JSON message).
4. Confirm: PR #234 merged and both VMs rebuilt after merge.
