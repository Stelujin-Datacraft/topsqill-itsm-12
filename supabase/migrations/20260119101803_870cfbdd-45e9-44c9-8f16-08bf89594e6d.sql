-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create data feeds in their projects" ON public.data_feeds;

-- Create a more comprehensive INSERT policy that allows:
-- 1. Users who are in project_users for this project
-- 2. The project creator
-- 3. Organization admins
CREATE POLICY "Users can create data feeds in their projects" 
ON public.data_feeds 
FOR INSERT 
WITH CHECK (
  -- User is a member of the project
  EXISTS (
    SELECT 1 FROM project_users pu
    WHERE pu.project_id = data_feeds.project_id 
    AND pu.user_id = auth.uid()
  )
  OR
  -- User is the project creator
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = data_feeds.project_id 
    AND p.created_by = auth.uid()
  )
  OR
  -- User is an admin in the same organization as the project
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN projects p ON p.organization_id = up.organization_id
    WHERE p.id = data_feeds.project_id 
    AND up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Also update SELECT, UPDATE, DELETE policies to be consistent
DROP POLICY IF EXISTS "Users can view data feeds in their projects" ON public.data_feeds;
CREATE POLICY "Users can view data feeds in their projects" 
ON public.data_feeds 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM project_users pu
    WHERE pu.project_id = data_feeds.project_id 
    AND pu.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = data_feeds.project_id 
    AND p.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN projects p ON p.organization_id = up.organization_id
    WHERE p.id = data_feeds.project_id 
    AND up.id = auth.uid()
    AND up.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can update data feeds in their projects" ON public.data_feeds;
CREATE POLICY "Users can update data feeds in their projects" 
ON public.data_feeds 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM project_users pu
    WHERE pu.project_id = data_feeds.project_id 
    AND pu.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = data_feeds.project_id 
    AND p.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN projects p ON p.organization_id = up.organization_id
    WHERE p.id = data_feeds.project_id 
    AND up.id = auth.uid()
    AND up.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can delete data feeds in their projects" ON public.data_feeds;
CREATE POLICY "Users can delete data feeds in their projects" 
ON public.data_feeds 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM project_users pu
    WHERE pu.project_id = data_feeds.project_id 
    AND pu.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = data_feeds.project_id 
    AND p.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN projects p ON p.organization_id = up.organization_id
    WHERE p.id = data_feeds.project_id 
    AND up.id = auth.uid()
    AND up.role = 'admin'
  )
);