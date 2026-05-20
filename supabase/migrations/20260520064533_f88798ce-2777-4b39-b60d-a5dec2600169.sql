
-- Allow users to access a form when they have an explicit role_permissions entry for it,
-- even if they are not (yet) listed in project_users.

CREATE OR REPLACE FUNCTION public.user_has_form_role_permission(
  _form_id uuid,
  _user_id uuid,
  _permission text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'form'
      AND rp.resource_id = _form_id
      AND rp.permission_type = _permission
  );
$$;

-- Extend can_access_forms_row to include role-based form permissions.
CREATE OR REPLACE FUNCTION public.can_access_forms_row(
  _org_id uuid,
  _project_id uuid,
  _created_by text,
  _is_public boolean,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (SELECT 1 FROM user_profiles WHERE id = _user_id AND role = 'admin' AND organization_id = _org_id)
    OR EXISTS (SELECT 1 FROM project_users WHERE project_id = _project_id AND user_id = _user_id)
    OR _created_by = _user_id::text
    OR _is_public = true;
$$;

-- Replace the SELECT policy on forms so it also grants visibility to users with
-- a role_permissions read entry for the specific form id.
DROP POLICY IF EXISTS forms_select ON public.forms;

CREATE POLICY forms_select ON public.forms
FOR SELECT
USING (
  public.can_access_forms_row(organization_id, project_id, created_by, is_public, auth.uid())
  OR public.user_has_form_role_permission(id, auth.uid(), 'read')
);

NOTIFY pgrst, 'reload schema';
