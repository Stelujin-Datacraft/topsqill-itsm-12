-- =============================================================================
-- Run in Dev (and Prod) SQL Editor while signed in as postgres/service role.
-- Paste results back if delete still fails after 20261021120000.
-- =============================================================================

-- 1) Policies on forms (look for RESTRICTIVE / migration_deny / USING false)
SELECT
  pol.polname AS policy,
  CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
       WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END AS cmd,
  CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS kind,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'forms'
ORDER BY 1;

-- 2) Helpers present + grants
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('can_modify_form', 'can_modify_forms_row', 'can_access_form')
ORDER BY 1, 2;

-- 3) Pick the failing form (adjust name if needed)
SELECT id, name, created_by, organization_id, project_id
FROM public.forms
WHERE name ILIKE '%form_submissions_ref_id_trigger%'
   OR name ILIKE '%form_submissions%'
ORDER BY created_at DESC
LIMIT 5;

-- 4) FKs pointing at forms (confdeltype: a=NO ACTION, c=CASCADE, n=SET NULL)
SELECT
  con.conname,
  rel.relname AS from_table,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_class ref ON ref.oid = con.confrelid
JOIN pg_namespace n ON n.oid = ref.relnamespace
WHERE n.nspname = 'public'
  AND ref.relname = 'forms'
  AND con.contype = 'f'
ORDER BY 2, 1;

-- 5) Triggers on forms
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.forms'::regclass
  AND NOT tgisinternal;

-- 6) Simulate can_modify_form for a user UUID (REPLACE both UUIDs)
-- SELECT public.can_modify_form('FORM_UUID'::uuid, 'USER_UUID'::uuid);
-- SELECT public.can_modify_forms_row(
--   (SELECT organization_id FROM forms WHERE id = 'FORM_UUID'),
--   (SELECT created_by FROM forms WHERE id = 'FORM_UUID'),
--   'USER_UUID'::uuid
-- );
