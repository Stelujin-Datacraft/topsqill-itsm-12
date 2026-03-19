-- Harden and stabilize insert policy for performance projects
DROP POLICY IF EXISTS "Users can insert performance projects" ON public.performance_projects;

CREATE POLICY "Users can insert performance projects"
ON public.performance_projects
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND public.can_view_project(project_id, auth.uid())
);