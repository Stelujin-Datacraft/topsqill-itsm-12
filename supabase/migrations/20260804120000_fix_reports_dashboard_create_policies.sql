-- Fix Reports analytics: dashboards and reports could not be created because RLS
-- INSERT policies did not match UI permissions (org admin, project members, legacy users).

-- Org admins can view any project in their organization (used by create helpers).
CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id AND pu.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_permissions pp
    WHERE pp.project_id = _project_id AND pp.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.created_by = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_profiles up ON up.organization_id = p.organization_id
    WHERE p.id = _project_id
      AND up.id = _user_id
      AND up.role = 'admin'
  );
$$;

-- Shared create check for dashboards and reports (matches frontend access rules).
CREATE OR REPLACE FUNCTION public.user_can_create_analytics_in_project(
  _project_id uuid,
  _user_id uuid,
  _resource_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Organization admin
    EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.user_profiles up ON up.organization_id = p.organization_id
      WHERE p.id = _project_id
        AND up.id = _user_id
        AND up.role = 'admin'
    )
    -- Project creator
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id AND p.created_by = _user_id
    )
    -- Project admin or editor
    OR EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = _project_id
        AND pu.user_id = _user_id
        AND pu.role IN ('admin', 'editor')
    )
    -- Explicit role-based create (dashboard / report / project scope)
    OR EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      WHERE ura.user_id = _user_id
        AND rp.permission_type = 'create'
        AND (
          (rp.resource_type = _resource_type AND rp.resource_id IS NULL)
          OR (rp.resource_type = 'dashboard' AND _resource_type = 'report' AND rp.resource_id IS NULL)
          OR (rp.resource_type = 'project' AND rp.resource_id = _project_id)
        )
    )
    -- Legacy default: project members without custom role assignments
    OR (
      public.can_view_project(_project_id, _user_id)
      AND NOT public.user_has_any_role_assignment(_user_id)
    );
$$;

-- Keep existing function names for compatibility; delegate to shared helper.
CREATE OR REPLACE FUNCTION public.user_can_create_dashboard_in_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_create_analytics_in_project(_project_id, _user_id, 'dashboard');
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_report_in_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_create_analytics_in_project(_project_id, _user_id, 'report');
$$;

-- ============ dashboards INSERT ============
DROP POLICY IF EXISTS "Users can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Project members can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Role-based users can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Authorized users can create dashboards" ON public.dashboards;

CREATE POLICY "Authorized users can create dashboards"
ON public.dashboards
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()::text
  AND public.user_can_create_analytics_in_project(project_id, auth.uid(), 'dashboard')
);

-- ============ reports INSERT ============
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Users can create reports in their organization" ON public.reports;
DROP POLICY IF EXISTS "Role-based users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Authorized users can create reports" ON public.reports;

CREATE POLICY "Authorized users can create reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.user_can_create_analytics_in_project(project_id, auth.uid(), 'report')
);

NOTIFY pgrst, 'reload schema';
