
-- Fix the circular dependency in project_users RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view project memberships for their projects" ON public.project_users;
DROP POLICY IF EXISTS "Project admins can manage project users" ON public.project_users;

-- Create simpler, non-recursive policies for project_users
CREATE POLICY "Users can view project memberships they belong to" 
  ON public.project_users 
  FOR SELECT 
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
      AND up.organization_id IN (
        SELECT p.organization_id FROM public.projects p WHERE p.id = project_id
      )
    )
  );

CREATE POLICY "Project creators and org admins can manage project users" 
  ON public.project_users 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
      AND up.organization_id IN (
        SELECT p.organization_id FROM public.projects p WHERE p.id = project_id
      )
    )
  );
