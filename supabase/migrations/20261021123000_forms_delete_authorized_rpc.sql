-- =============================================================================
-- Reliable form delete for Dev + Prod.
-- Direct DELETE ... RETURNING often returns [] under overlapping RLS even when
-- the user should be allowed. This SECURITY DEFINER RPC:
--   1) Requires auth.uid()
--   2) Checks public.can_modify_form(form_id, auth.uid())
--   3) Deletes children then the form as definer (after authz)
-- Also drops leftover RESTRICTIVE deny policies on forms / form_fields if present.
-- =============================================================================

BEGIN;

-- Drop leftover deny-all gates (safe if absent)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('forms', 'form_fields', 'form_user_access', 'form_access_requests')
      AND (
        policyname ILIKE '%migration_deny%'
        OR (
          cmd = 'ALL'
          AND (
            COALESCE(qual, '') ILIKE '%false%'
            OR COALESCE(with_check, '') ILIKE '%false%'
          )
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.delete_form_authorized(_form_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to delete form'
      USING ERRCODE = '42501';
  END IF;

  IF _form_id IS NULL THEN
    RAISE EXCEPTION 'form id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.forms WHERE id = _form_id) THEN
    RAISE EXCEPTION 'Form not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_modify_form(_form_id, uid) THEN
    RAISE EXCEPTION 'Not authorized to delete this form (need creator, org admin, or project admin/editor)'
      USING ERRCODE = '42501';
  END IF;

  -- Children (ignore missing tables)
  BEGIN
    DELETE FROM public.form_fields WHERE form_id = _form_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    DELETE FROM public.form_user_access WHERE form_id = _form_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    DELETE FROM public.form_access_requests WHERE form_id = _form_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  -- Submissions: CASCADE on Prod; if NO ACTION, remove rows so parent can delete
  BEGIN
    DELETE FROM public.form_submissions WHERE form_id = _form_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  DELETE FROM public.forms WHERE id = _form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form delete failed'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN _form_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_form_authorized(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_form_authorized(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_form_authorized(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
