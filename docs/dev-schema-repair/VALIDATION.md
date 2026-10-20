# Dev validation — after applying repairs 01–05

**Do not run against Production.**

**Before apply:** confirm Dev target project ref; optionally re-run `capture_prod_readonly.sql` on Dev for a before-snapshot.

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

-- Inventory helpers
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'can_modify_form','can_access_form','can_modify_forms_row','can_access_forms_row',
    'user_has_form_role_permission','can_act_for','can_act_for_submission',
    'get_user_project_invitations','get_organization_users','can_view_project'
  );

-- 01 preflight: record_delegations.grant_delegator_access
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'record_delegations'
  AND column_name IN ('grant_delegator_access','scope_submission_id','scope_form_id','active');

-- 04 preflight: FKs → forms (expect submissions confdeltype 'a' = NO ACTION on Dev before repair)
SELECT rel.relname AS child_table, c.conname, c.confdeltype,
       CASE c.confdeltype
         WHEN 'a' THEN 'NO ACTION'
         WHEN 'r' THEN 'RESTRICT'
         WHEN 'c' THEN 'CASCADE'
         WHEN 'n' THEN 'SET NULL'
         WHEN 'd' THEN 'SET DEFAULT'
       END AS on_delete,
       pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class rel ON rel.oid = c.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND c.contype = 'f'
  AND c.confrelid = 'public.forms'::regclass
  AND rel.relname IN ('form_fields','form_submissions','form_audit_logs','form_user_access','form_access_requests')
ORDER BY 1, 2;

-- 05 preflight: user_profiles columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name IN ('organization_id','status','first_name','last_name','email','role')
ORDER BY 1;
```

## Apply order (Dev only, after explicit approval)

```bash
# Use Dev DB URL only. Do NOT supabase db push to Prod. Do NOT point at Production.
psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql \
  -f supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql \
  -f supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql \
  -f supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql \
  -f supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql
```

Exact filenames (order mandatory):

1. `supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql`
2. `supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql`
3. `supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql`
4. `supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql`
5. `supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql`

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

SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'get_organization_users'
ORDER BY 1;
-- Expect: PUBLIC, anon, authenticated, service_role, postgres

-- Policy count / names (expect 22; see POLICY_COMPARISON.md)
SELECT c.relname, pol.polname, pol.polcmd,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('forms','form_fields','form_submissions','form_audit_logs')
ORDER BY 1, 2;

-- FKs after repair 04
SELECT rel.relname AS child_table, c.conname, c.confdeltype,
       CASE c.confdeltype
         WHEN 'c' THEN 'CASCADE'
         WHEN 'n' THEN 'SET NULL'
         WHEN 'a' THEN 'NO ACTION'
         ELSE c.confdeltype::text
       END AS on_delete
FROM pg_constraint c
JOIN pg_class rel ON rel.oid = c.conrelid
WHERE c.contype = 'f'
  AND c.confrelid = 'public.forms'::regclass
  AND rel.relname IN ('form_fields','form_submissions','form_audit_logs')
ORDER BY 1;
-- Expect: form_fields CASCADE (c), form_submissions CASCADE (c), form_audit_logs SET NULL (n)
```

## UI / API smoke (authenticated Dev user)

1. **Forms list** — SELECT returns org/project forms (not empty due to RLS).
2. **Create form** — succeeds; Status field created; `form_audit_logs` row `form_created` with `user_id = auth.uid()`.
3. **Update form** — succeeds; audit `form_updated` (or skipped if within create window).
4. **Submit record** — INSERT into `form_submissions` succeeds for accessible form.
5. **Delete empty form** (fields only) — succeeds after FK CASCADE.
6. **Delete form with submissions** — **must succeed** (submissions CASCADE matches Prod); audit rows retained with `form_id` NULL.
7. **Invitations** — `rpc('get_user_project_invitations')` no longer PGRST202.
8. **Org users / AI** — `rpc('get_organization_users', { org_id })` returns active org members.
9. **Negative** — user A cannot INSERT `form_audit_logs` with user B’s `user_id`.

## Automated tests (repo)

```bash
cd backend && npm run test:database && npm run build
```

Static tests cover migrations 01–05 (including submissions CASCADE + policy matrix). They do **not** prove Dev DB is repaired.
