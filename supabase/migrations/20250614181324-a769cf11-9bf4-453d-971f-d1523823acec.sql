
-- Step 1: Create a security definer function to check if user can create projects
CREATE OR REPLACE FUNCTION public.can_user_create_project(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND organization_id = org_id
  );
$$;

-- Step 2: Drop existing problematic policies for projects
DROP POLICY IF EXISTS "Only admins can create projects" ON public.projects;
DROP POLICY IF EXISTS "Project creators and admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they belong to" ON public.projects;

-- Step 3: Create new non-recursive policies for projects
CREATE POLICY "Users can view projects in their organization" 
  ON public.projects 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can create projects in their organization" 
  ON public.projects 
  FOR INSERT 
  WITH CHECK (
    public.can_user_create_project(organization_id)
  );

CREATE POLICY "Admins and project creators can update projects" 
  ON public.projects 
  FOR UPDATE 
  USING (
    created_by = auth.uid() 
    OR public.can_user_create_project(organization_id)
  );

-- Step 4: Create a function to get current user's organization safely
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$;
