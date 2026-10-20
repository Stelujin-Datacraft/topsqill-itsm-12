# Dev validation — after applying repairs 01–05

**Do not run against Production.**

**Before apply:** run `capture_prod_readonly.sql` on **both** Dev and Prod (read-only) and attach results to the PR. Agents could not execute those queries (no DB credentials in Cursor).

## Pre-flight (read-only)

```sql
-- Confirm target project (expect Dev URL / project ref)
SELECT current_database(), current_user;

-- Inventory current policies (expect deny-all / few names before repair)
SELECT c.relname, pol.polname, pol.polcmd
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('forms','form_fields','form_submissions','form_audit_logs')
ORDER BY 1, 2;

-- Inventory helpers (expect 0 rows / missing org users before repair)
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'can_modify_form','can_access_form','can_modify_forms_row','can_access_forms_row',
    'user_has_form_role_permission','can_act_for','can_act_for_submission',
    'get_user_project_invitations','get_organization_users','can_view_project'
  );

-- 05 preflight: user_profiles columns used by captured get_organization_users
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name IN ('organization_id','status','first_name','last_name','email','role')
ORDER BY 1;
```

## Apply order (Dev only, after explicit approval)

```bash
# Example — use Dev DB URL only. Do NOT supabase db push to Prod.
psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql \
  -f supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql \
  -f supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql \
  -f supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql \
  -f supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql
```

## Post-flight SQL

```sql
-- Helpers present (incl. get_organization_users)
SELECT proname, prosecdef, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'can_modify_form','can_access_form','can_modify_forms_row','can_access_forms_row',
    'user_has_form_role_permission','user_has_project_form_role_permissions',
    'can_act_for','can_act_for_submission','get_user_project_invitations',
    'get_organization_users','can_view_project'
  )
ORDER BY 1;

-- get_organization_users: definition must match Prod capture (no search_path)
SELECT pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_organization_users';

-- Expect: SECURITY DEFINER, STABLE, body filters organization_id + status = 'active'
-- Expect: NO `SET search_path` unless team later approves hardening separately

-- get_organization_users: execute grants must include Prod set
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'get_organization_users'
ORDER BY 1;

-- Expect grantees (at least): PUBLIC, anon, authenticated, service_role, postgres

-- No USING (true) policies on core tables
SELECT c.relname, pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('forms','form_fields','form_submissions','form_audit_logs');

-- form_fields FK should be CASCADE (confdeltype 'c')
SELECT conname, confdeltype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.form_fields'::regclass AND contype = 'f';

-- form_audit_logs FK should be SET NULL (confdeltype 'n')
SELECT conname, confdeltype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.form_audit_logs'::regclass AND contype = 'f';

-- form_submissions FK — report only (may still block delete)
SELECT conname, confdeltype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.form_submissions'::regclass AND contype = 'f';
```

## UI / API smoke (authenticated Dev user)

1. **Forms list** — SELECT returns org/project forms (not empty due to RLS).
2. **Create form** — succeeds; Status field created; `form_audit_logs` row `form_created` with `user_id = auth.uid()`.
3. **Update form** — succeeds; audit `form_updated` (or skipped if within create window).
4. **Submit record** — INSERT into `form_submissions` succeeds for accessible form.
5. **Delete empty form** (fields only, no submissions) — succeeds after FK CASCADE.
6. **Delete form with submissions** — if still FK error, record `form_submissions` `confdeltype` for follow-up (expected until P1 decision).
7. **Invitations** — `rpc('get_user_project_invitations')` no longer PGRST202.
8. **Org users / AI** — `rpc('get_organization_users', { org_id })` returns active org members (no PGRST202) after migration 05.
9. **Negative** — user A cannot INSERT `form_audit_logs` with user B’s `user_id`.

## Automated tests to add (follow-up PR)

- Nest/integration: form create → audit insert → delete form with fields.
- RPC smoke: `get_user_project_invitations` returns 200/empty array for user with no invites.
- RPC smoke: `get_organization_users` returns active profiles for caller’s org.
- Regression: deny cross-user audit insert.
