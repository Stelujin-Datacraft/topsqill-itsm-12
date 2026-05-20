
-- Generic helpers per resource type ----------------------------------------

-- WORKFLOWS
CREATE OR REPLACE FUNCTION public.user_has_workflow_role_permission(_workflow_id uuid, _user_id uuid, _permission_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'workflow'
      AND rp.permission_type = _permission_type
      AND rp.resource_id = _workflow_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_workflow_role_permissions(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.workflows w ON w.id = rp.resource_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'workflow'
      AND w.project_id = _project_id
  );
$$;

-- REPORTS
CREATE OR REPLACE FUNCTION public.user_has_report_role_permission(_report_id uuid, _user_id uuid, _permission_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'report'
      AND rp.permission_type = _permission_type
      AND rp.resource_id = _report_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_report_role_permissions(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.reports r ON r.id = rp.resource_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'report'
      AND r.project_id = _project_id
  );
$$;

-- DASHBOARDS
CREATE OR REPLACE FUNCTION public.user_has_dashboard_role_permission(_dashboard_id uuid, _user_id uuid, _permission_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'dashboard'
      AND rp.permission_type = _permission_type
      AND rp.resource_id = _dashboard_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_dashboard_role_permissions(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.dashboards d ON d.id = rp.resource_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'dashboard'
      AND d.project_id = _project_id
  );
$$;

-- POLICIES (Docs)
CREATE OR REPLACE FUNCTION public.user_has_policy_role_permission(_policy_id uuid, _user_id uuid, _permission_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'policy'
      AND rp.permission_type = _permission_type
      AND rp.resource_id = _policy_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_policy_role_permissions(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.policies p ON p.id = rp.resource_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'policy'
      AND p.project_id = _project_id
  );
$$;

-- Replace SELECT policies --------------------------------------------------

-- WORKFLOWS
DROP POLICY IF EXISTS "Users can view organization workflows" ON public.workflows;
CREATE POLICY "Users can view organization workflows"
ON public.workflows FOR SELECT
USING (
  -- Org admin
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'admin'
            AND up.organization_id = workflows.organization_id)
  -- Creator
  OR created_by = auth.uid()
  -- Project admin
  OR EXISTS (SELECT 1 FROM public.project_users pu
             WHERE pu.project_id = workflows.project_id
               AND pu.user_id = auth.uid() AND pu.role = 'admin')
  -- Role grants read on this specific workflow
  OR public.user_has_workflow_role_permission(workflows.id, auth.uid(), 'read')
  -- Legacy org-wide visibility only if user has no workflow role assignments in this project
  OR (
    organization_id = public.get_current_user_organization_id()
    AND NOT public.user_has_project_workflow_role_permissions(workflows.project_id, auth.uid())
  )
);

-- REPORTS
DROP POLICY IF EXISTS "Users can view reports in their organization" ON public.reports;
CREATE POLICY "Users can view reports in their organization"
ON public.reports FOR SELECT
USING (
  -- Org admin
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'admin'
            AND up.organization_id = reports.organization_id)
  -- Creator
  OR created_by = auth.uid()
  -- Project admin
  OR EXISTS (SELECT 1 FROM public.project_users pu
             WHERE pu.project_id = reports.project_id
               AND pu.user_id = auth.uid() AND pu.role = 'admin')
  -- Role grants read on this specific report
  OR public.user_has_report_role_permission(reports.id, auth.uid(), 'read')
  -- Legacy org-wide visibility only if user has no report role assignments in this project
  OR (
    organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
    AND NOT public.user_has_project_report_role_permissions(reports.project_id, auth.uid())
  )
);

-- DASHBOARDS
DROP POLICY IF EXISTS "Project members can view dashboards" ON public.dashboards;
CREATE POLICY "Project members can view dashboards"
ON public.dashboards FOR SELECT
USING (
  created_by = (auth.uid())::text
  OR EXISTS (SELECT 1 FROM public.project_users pu
             WHERE pu.project_id = dashboards.project_id
               AND pu.user_id = auth.uid() AND pu.role = 'admin')
  OR public.user_has_dashboard_role_permission(dashboards.id, auth.uid(), 'read')
  OR (
    EXISTS (SELECT 1 FROM public.project_users pu
            WHERE pu.project_id = dashboards.project_id
              AND pu.user_id = auth.uid())
    AND NOT public.user_has_project_dashboard_role_permissions(dashboards.project_id, auth.uid())
  )
);

-- POLICIES (Docs)
DROP POLICY IF EXISTS "Users can view policies in their projects" ON public.policies;
CREATE POLICY "Users can view policies in their projects"
ON public.policies FOR SELECT
USING (
  -- Org admin
  EXISTS (SELECT 1 FROM public.projects p
          JOIN public.user_profiles up ON up.organization_id = p.organization_id
          WHERE p.id = policies.project_id AND up.id = auth.uid() AND up.role = 'admin')
  -- Project admin
  OR EXISTS (SELECT 1 FROM public.project_users pu
             WHERE pu.project_id = policies.project_id
               AND pu.user_id = auth.uid() AND pu.role = 'admin')
  -- Role grants read
  OR public.user_has_policy_role_permission(policies.id, auth.uid(), 'read')
  -- Legacy project visibility only if user has no policy role assignments in this project
  OR (
    public.can_view_project(policies.project_id, auth.uid())
    AND NOT public.user_has_project_policy_role_permissions(policies.project_id, auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';
