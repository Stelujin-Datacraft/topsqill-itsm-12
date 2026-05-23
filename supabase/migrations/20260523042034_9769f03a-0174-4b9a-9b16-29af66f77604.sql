DROP POLICY IF EXISTS "Role-based users can create dashboards" ON public.dashboards;

CREATE POLICY "Role-based users can create dashboards"
ON public.dashboards
FOR INSERT
WITH CHECK (
  (created_by = (auth.uid())::text)
  AND (
    public.user_can_create_dashboard_in_project(project_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = dashboards.project_id
        AND pu.user_id = auth.uid()
        AND pu.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = dashboards.project_id
        AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.projects p ON p.organization_id = up.organization_id
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
        AND p.id = dashboards.project_id
    )
  )
);