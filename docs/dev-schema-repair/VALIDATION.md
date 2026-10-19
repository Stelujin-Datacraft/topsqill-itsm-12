# Dev validation — after applying repairs 01–04

**Do not run against Production.**

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

-- Inventory helpers (expect 0 rows before repair)
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'can_modify_form','can_access_form','can_modify_forms_row','can_access_forms_row',
    'user_has_form_role_permission','can_act_for','can_act_for_submission',
    'get_user_project_invitations','get_organization_users','can_view_project'
  );
```

## Apply order (Dev only, after explicit approval)

```bash
# Example — use Dev DB URL only
psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql \
  -f supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql \
  -f supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql \
  -f supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql
```

## Post-flight SQL

```sql
-- Helpers present
SELECT proname, prosecdef, prosecdef, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'can_modify_form','can_access_form','can_modify_forms_row','can_access_forms_row',
    'user_has_form_role_permission','user_has_project_form_role_permissions',
    'can_act_for','can_act_for_submission','get_user_project_invitations','can_view_project'
  )
ORDER BY 1;

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
8. **Org users / AI** — still fails until Prod definition for `get_organization_users` is captured (expected).
9. **Negative** — user A cannot INSERT `form_audit_logs` with user B’s `user_id`.

## Automated tests to add (follow-up PR)

- Nest/integration: form create → audit insert → delete form with fields.
- RPC smoke: `get_user_project_invitations` returns 200/empty array for user with no invites.
- Regression: deny cross-user audit insert.
