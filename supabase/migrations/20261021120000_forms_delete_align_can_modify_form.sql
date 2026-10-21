-- =============================================================================
-- Forms UPDATE/DELETE: align with can_modify_form (creator email OR uuid,
-- org admin, project admin/editor). Fixes "delete blocked by security policy"
-- when can_modify_forms_row only matched created_by = auth.uid()::text and
-- org role=admin — missing email creators and project editors.
--
-- Safe on Dev and Prod. Idempotent. No data changes.
-- =============================================================================

BEGIN;

-- Broaden row helper (still used by older policies / callers)
CREATE OR REPLACE FUNCTION public.can_modify_forms_row(
  _org_id uuid,
  _created_by text,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = _user_id
        AND up.role = 'admin'
        AND up.organization_id = _org_id
    )
    OR _created_by = _user_id::text
    OR _created_by = (SELECT up.email FROM public.user_profiles up WHERE up.id = _user_id);
$$;

-- Ensure can_modify_form includes the same creator + project editor rules
CREATE OR REPLACE FUNCTION public.can_modify_form(_form_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forms f
    WHERE f.id = _form_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.user_profiles up
          WHERE up.id = _user_id
            AND up.role = 'admin'
            AND up.organization_id = f.organization_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.project_users pu
          WHERE pu.project_id = f.project_id
            AND pu.user_id = _user_id
            AND pu.role IN ('admin', 'editor')
        )
        OR f.created_by = (SELECT up.email FROM public.user_profiles up WHERE up.id = _user_id)
        OR f.created_by = _user_id::text
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_modify_forms_row(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_modify_forms_row(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_modify_form(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_modify_form(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_modify_forms_row(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_modify_form(uuid, uuid) TO authenticated, service_role;

-- Point UPDATE/DELETE at the full helper (form id → project membership)
DROP POLICY IF EXISTS forms_update ON public.forms;
CREATE POLICY forms_update ON public.forms
FOR UPDATE
TO authenticated
USING (public.can_modify_form(id, auth.uid()))
WITH CHECK (public.can_modify_form(id, auth.uid()));

DROP POLICY IF EXISTS forms_delete ON public.forms;
CREATE POLICY forms_delete ON public.forms
FOR DELETE
TO authenticated
USING (public.can_modify_form(id, auth.uid()));

-- Keep project-admin policy but also allow project editors (matches can_modify_form)
DROP POLICY IF EXISTS "Project admins can update forms" ON public.forms;
CREATE POLICY "Project admins can update forms"
ON public.forms
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = forms.project_id
      AND pu.user_id = auth.uid()
      AND pu.role IN ('admin', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = forms.project_id
      AND pu.user_id = auth.uid()
      AND pu.role IN ('admin', 'editor')
  )
);

DROP POLICY IF EXISTS "Project admins can delete forms" ON public.forms;
CREATE POLICY "Project admins can delete forms"
ON public.forms
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = forms.project_id
      AND pu.user_id = auth.uid()
      AND pu.role IN ('admin', 'editor')
  )
);

NOTIFY pgrst, 'reload schema';

COMMIT;
