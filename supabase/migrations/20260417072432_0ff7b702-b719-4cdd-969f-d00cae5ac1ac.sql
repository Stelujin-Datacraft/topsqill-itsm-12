
-- 1. PERFORMANCE_PROJECTS: Enable RLS
ALTER TABLE public.performance_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view perf projects" ON public.performance_projects;
DROP POLICY IF EXISTS "Project admins can insert perf projects" ON public.performance_projects;
DROP POLICY IF EXISTS "Project admins can update perf projects" ON public.performance_projects;
DROP POLICY IF EXISTS "Project admins can delete perf projects" ON public.performance_projects;

CREATE POLICY "Project members can view perf projects"
ON public.performance_projects FOR SELECT TO authenticated
USING (
  project_id IN (SELECT pu.project_id FROM public.project_users pu WHERE pu.user_id = auth.uid())
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin' AND up.organization_id = performance_projects.organization_id)
);

CREATE POLICY "Project admins can insert perf projects"
ON public.performance_projects FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.project_users pu WHERE pu.project_id = performance_projects.project_id AND pu.user_id = auth.uid() AND pu.role IN ('admin','editor'))
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin' AND up.organization_id = performance_projects.organization_id)
  )
);

CREATE POLICY "Project admins can update perf projects"
ON public.performance_projects FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.project_users pu WHERE pu.project_id = performance_projects.project_id AND pu.user_id = auth.uid() AND pu.role IN ('admin','editor'))
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin' AND up.organization_id = performance_projects.organization_id)
);

CREATE POLICY "Project admins can delete perf projects"
ON public.performance_projects FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.project_users pu WHERE pu.project_id = performance_projects.project_id AND pu.user_id = auth.uid() AND pu.role = 'admin')
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin' AND up.organization_id = performance_projects.organization_id)
);

-- 2. ORGANIZATIONS: Remove public/overly broad policies
DROP POLICY IF EXISTS "Anyone can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow all authenticated users to view organizations" ON public.organizations;

-- 3. USER_PROFILES: Remove privilege-escalation policies
DROP POLICY IF EXISTS "Allow all authenticated users to view user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Org members can view profiles in their organization" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Org members can view profiles in their organization"
ON public.user_profiles FOR SELECT TO authenticated
USING (
  organization_id = public.get_current_user_organization_id()
  OR id = auth.uid()
);

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. WORKFLOW_QUEUE: Restrict to service_role
DROP POLICY IF EXISTS "Service role can manage all queue items" ON public.workflow_queue;
CREATE POLICY "Service role can manage all queue items"
ON public.workflow_queue FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 5. SMTP_CONFIGS: Admins only for SELECT
DROP POLICY IF EXISTS "Organization users can view SMTP configs" ON public.smtp_configs;
DROP POLICY IF EXISTS "Organization admins can view SMTP configs" ON public.smtp_configs;
CREATE POLICY "Organization admins can view SMTP configs"
ON public.smtp_configs FOR SELECT TO authenticated
USING (
  organization_id = public.get_current_user_organization_id()
  AND public.is_current_user_admin_of_org(organization_id)
);

-- 6. WORKFLOW_EXECUTIONS: Service-role-only management
DROP POLICY IF EXISTS "System can manage workflow executions" ON public.workflow_executions;
DROP POLICY IF EXISTS "Service role can manage workflow executions" ON public.workflow_executions;
CREATE POLICY "Service role can manage workflow executions"
ON public.workflow_executions FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 7. WORKFLOW_INSTANCE_LOGS: Service-role-only
DROP POLICY IF EXISTS "System can manage workflow logs" ON public.workflow_instance_logs;
DROP POLICY IF EXISTS "Service role can manage workflow logs" ON public.workflow_instance_logs;
CREATE POLICY "Service role can manage workflow logs"
ON public.workflow_instance_logs FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 8. ORGANIZATION_REQUESTS: Remove broad SELECT (admins-only retained from existing policies)
DROP POLICY IF EXISTS "Users can view requests for their organization" ON public.organization_requests;

-- 9. DASHBOARDS: Project-scoped + authenticated only (created_by is TEXT here)
DROP POLICY IF EXISTS "Users can view dashboards in their projects" ON public.dashboards;
DROP POLICY IF EXISTS "Users can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Users can update their dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Users can delete their dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Project members can view dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Project members can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Dashboard owners can update" ON public.dashboards;
DROP POLICY IF EXISTS "Dashboard owners can delete" ON public.dashboards;

CREATE POLICY "Project members can view dashboards"
ON public.dashboards FOR SELECT TO authenticated
USING (
  project_id IN (SELECT pu.project_id FROM public.project_users pu WHERE pu.user_id = auth.uid())
  OR created_by = auth.uid()::text
);

CREATE POLICY "Project members can create dashboards"
ON public.dashboards FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()::text AND (
    project_id IN (SELECT pu.project_id FROM public.project_users pu WHERE pu.user_id = auth.uid() AND pu.role IN ('admin','editor'))
  )
);

CREATE POLICY "Dashboard owners can update"
ON public.dashboards FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()::text
  OR project_id IN (SELECT pu.project_id FROM public.project_users pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin')
);

CREATE POLICY "Dashboard owners can delete"
ON public.dashboards FOR DELETE TO authenticated
USING (
  created_by = auth.uid()::text
  OR project_id IN (SELECT pu.project_id FROM public.project_users pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin')
);
