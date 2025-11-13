-- Fix infinite recursion in forms and form_user_access tables

-- Drop ALL existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view accessible forms only" ON public.forms;
DROP POLICY IF EXISTS "Users can view forms they created" ON public.forms;
DROP POLICY IF EXISTS "Users can view forms in their projects" ON public.forms;
DROP POLICY IF EXISTS "Public forms are viewable by everyone" ON public.forms;
DROP POLICY IF EXISTS "Enable read access for users with permissions" ON public.form_user_access;

-- Create security definer functions to break recursion
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_users
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = _user_id;
$$;

-- Simple policy for forms: project members can see all forms in their projects
CREATE POLICY "Project members can view forms" ON public.forms
FOR SELECT
USING (
  -- User is member of the project
  public.is_project_member(project_id, auth.uid())
  OR
  -- Form is public
  is_public = true
);

-- Simple policy for form_user_access
CREATE POLICY "Users can view their own access records" ON public.form_user_access
FOR SELECT
USING (user_id = auth.uid());

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_project_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_id TO authenticated;