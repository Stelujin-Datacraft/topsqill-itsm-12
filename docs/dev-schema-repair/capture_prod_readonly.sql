-- =============================================================================
-- READ-ONLY capture for Production (and Dev comparison)
-- Safe: SELECT / catalog queries only. Do NOT run DDL.
-- Paste results into the PR review thread before approving Dev apply.
-- =============================================================================

-- 0) Identity
SELECT current_database() AS db, current_user AS role, now() AS captured_at;

-- 1) Helpers present?
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'can_modify_form','can_access_form','can_modify_forms_row','can_access_forms_row',
    'user_has_form_role_permission','user_has_project_form_role_permissions',
    'can_act_for','can_act_for_submission','can_view_project',
    'get_user_project_invitations','get_organization_users'
  )
ORDER BY 2, 3;

-- 2) get_organization_users full definition (Prod only — for Dev migration)
SELECT pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_organization_users';

SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'get_organization_users';

-- 3) Policies on core form tables
SELECT c.relname AS table_name, pol.polname AS policy_name, pol.polcmd AS cmd,
       CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS kind,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('forms','form_fields','form_submissions','form_audit_logs')
ORDER BY 1, 2;

-- 4) FKs referencing forms (esp. form_submissions / form_fields / form_audit_logs)
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
ORDER BY 1, 2;

-- 5) Dev preflight tables / record_delegations column
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'forms','form_fields','form_submissions','form_audit_logs','user_profiles',
    'project_users','projects','project_permissions','user_role_assignments',
    'role_permissions','project_invitations','record_delegations'
  )
ORDER BY 1;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'record_delegations'
  AND column_name IN ('grant_delegator_access','scope_submission_id','scope_form_id','active')
ORDER BY 1;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'form_audit_logs'
  AND column_name = 'form_id';
