-- Fix missing / incomplete RLS policies that blocked admin CRUD delete operations.
-- UI access control grants org/project admins full delete rights, but RLS did not match.

-- ============ Helper: workflow create permission ============
CREATE OR REPLACE FUNCTION public.user_can_create_workflow_in_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_view_project(_project_id, _user_id)
    AND EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      WHERE ura.user_id = _user_id
        AND rp.permission_type = 'create'
        AND (
          (rp.resource_type = 'workflow' AND rp.resource_id IS NULL)
          OR (rp.resource_type = 'project' AND rp.resource_id = _project_id)
        )
    );
$$;

-- ============ Helper: workflow modify (update/delete nodes, connections, workflow row) ============
CREATE OR REPLACE FUNCTION public.can_modify_workflow(_workflow_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workflows w
    WHERE w.id = _workflow_id
      AND (
        -- Org admin
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = _user_id
            AND up.role = 'admin'
            AND up.organization_id = w.organization_id
        )
        -- Creator
        OR w.created_by = _user_id
        -- Project admin
        OR EXISTS (
          SELECT 1 FROM public.project_users pu
          WHERE pu.project_id = w.project_id
            AND pu.user_id = _user_id
            AND pu.role = 'admin'
        )
        -- Role-based permission
        OR public.user_has_workflow_role_permission(w.id, _user_id, 'update')
        OR public.user_has_workflow_role_permission(w.id, _user_id, 'delete')
      )
  );
$$;

-- ============ projects: missing DELETE policy ============
DROP POLICY IF EXISTS "Admins and project creators can delete projects" ON public.projects;
CREATE POLICY "Admins and project creators can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.can_user_create_project(organization_id)
);

-- ============ workflows: missing INSERT/UPDATE/DELETE policies ============
DROP POLICY IF EXISTS "Admins and authorized users can create workflows" ON public.workflows;
CREATE POLICY "Admins and authorized users can create workflows"
ON public.workflows
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
        AND up.organization_id = workflows.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = workflows.project_id
        AND pu.user_id = auth.uid()
        AND pu.role = 'admin'
    )
    OR public.user_can_create_workflow_in_project(project_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins and authorized users can update workflows" ON public.workflows;
CREATE POLICY "Admins and authorized users can update workflows"
ON public.workflows
FOR UPDATE
TO authenticated
USING (public.can_modify_workflow(id, auth.uid()))
WITH CHECK (public.can_modify_workflow(id, auth.uid()));

DROP POLICY IF EXISTS "Admins and authorized users can delete workflows" ON public.workflows;
CREATE POLICY "Admins and authorized users can delete workflows"
ON public.workflows
FOR DELETE
TO authenticated
USING (public.can_modify_workflow(id, auth.uid()));

-- ============ workflow_nodes / workflow_connections: RLS enabled but no policies ============
DROP POLICY IF EXISTS "Authorized users can manage workflow nodes" ON public.workflow_nodes;
CREATE POLICY "Authorized users can manage workflow nodes"
ON public.workflow_nodes
FOR ALL
TO authenticated
USING (public.can_modify_workflow(workflow_id, auth.uid()))
WITH CHECK (public.can_modify_workflow(workflow_id, auth.uid()));

DROP POLICY IF EXISTS "Authorized users can manage workflow connections" ON public.workflow_connections;
CREATE POLICY "Authorized users can manage workflow connections"
ON public.workflow_connections
FOR ALL
TO authenticated
USING (public.can_modify_workflow(workflow_id, auth.uid()))
WITH CHECK (public.can_modify_workflow(workflow_id, auth.uid()));

-- ============ forms: project admins could not delete/update in RLS ============
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
      AND pu.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = forms.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
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
      AND pu.role = 'admin'
  )
);

-- ============ form_submissions: allow form editors/project admins to delete ============
DROP POLICY IF EXISTS "Form editors can delete submissions" ON public.form_submissions;
CREATE POLICY "Form editors can delete submissions"
ON public.form_submissions
FOR DELETE
TO authenticated
USING (public.can_modify_form(form_id, auth.uid()));

-- ============ reports: org/project admin bypass for update/delete ============
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = reports.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = reports.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
  OR created_by = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = reports.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = reports.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Admins can delete reports" ON public.reports;
CREATE POLICY "Admins can delete reports"
ON public.reports
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = reports.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = reports.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
  OR created_by = auth.uid()
);

-- ============ dashboards: org admin bypass for update/delete ============
DROP POLICY IF EXISTS "Org admins can update dashboards" ON public.dashboards;
CREATE POLICY "Org admins can update dashboards"
ON public.dashboards
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = dashboards.organization_id
  )
  OR created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = dashboards.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = dashboards.organization_id
  )
  OR created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = dashboards.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Org admins can delete dashboards" ON public.dashboards;
CREATE POLICY "Org admins can delete dashboards"
ON public.dashboards
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = dashboards.organization_id
  )
  OR created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = dashboards.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
);

NOTIFY pgrst, 'reload schema';
