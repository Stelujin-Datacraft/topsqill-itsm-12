
-- Fix: Allow all users in the same organization to view policies
DROP POLICY "Users can view policies in their projects" ON public.policies;

CREATE POLICY "Users can view policies in their projects"
ON public.policies
FOR SELECT
USING (
  can_view_project(project_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM projects p
    JOIN user_profiles up ON up.organization_id = p.organization_id
    WHERE p.id = policies.project_id
    AND up.id = auth.uid()
  )
);
