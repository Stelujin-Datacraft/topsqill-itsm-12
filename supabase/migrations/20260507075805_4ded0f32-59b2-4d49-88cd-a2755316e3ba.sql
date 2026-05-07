DROP POLICY IF EXISTS "Project members can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Dashboard owners can update" ON public.dashboards;
DROP POLICY IF EXISTS "Dashboard owners can delete" ON public.dashboards;

CREATE POLICY "Project members can create dashboards"
ON public.dashboards
FOR INSERT
WITH CHECK (
  created_by = (auth.uid())::text
  AND (
    project_id IN (
      SELECT pu.project_id FROM project_users pu
      WHERE pu.user_id = auth.uid() AND pu.role IN ('admin','editor')
    )
    OR EXISTS (SELECT 1 FROM projects p WHERE p.id = dashboards.project_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles up JOIN projects p ON p.organization_id = up.organization_id WHERE up.id = auth.uid() AND up.role = 'admin' AND p.id = dashboards.project_id)
  )
);

CREATE POLICY "Dashboard owners can update"
ON public.dashboards
FOR UPDATE
USING (
  created_by = (auth.uid())::text
  OR EXISTS (SELECT 1 FROM project_users pu WHERE pu.project_id = dashboards.project_id AND pu.user_id = auth.uid() AND pu.role = 'admin')
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = dashboards.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM user_profiles up JOIN projects p ON p.organization_id = up.organization_id WHERE up.id = auth.uid() AND up.role = 'admin' AND p.id = dashboards.project_id)
);

CREATE POLICY "Dashboard owners can delete"
ON public.dashboards
FOR DELETE
USING (
  created_by = (auth.uid())::text
  OR EXISTS (SELECT 1 FROM project_users pu WHERE pu.project_id = dashboards.project_id AND pu.user_id = auth.uid() AND pu.role = 'admin')
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = dashboards.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM user_profiles up JOIN projects p ON p.organization_id = up.organization_id WHERE up.id = auth.uid() AND up.role = 'admin' AND p.id = dashboards.project_id)
);