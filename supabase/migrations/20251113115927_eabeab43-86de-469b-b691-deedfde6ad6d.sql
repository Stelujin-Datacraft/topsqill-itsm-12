-- Drop overly permissive policy
DROP POLICY IF EXISTS "Users can view org forms" ON public.forms;

-- Create more restrictive policy for viewing forms
-- Users can only see forms they:
-- 1. Created themselves
-- 2. Are explicitly assigned to (via form_user_access)
-- 3. Are project members of
-- 4. Are org admins
CREATE POLICY "Users can view accessible forms" ON public.forms
FOR SELECT
USING (
  -- User created the form
  (created_by = (SELECT email FROM public.user_profiles WHERE id = auth.uid()))
  OR
  -- User is org admin
  (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND organization_id = forms.organization_id
  ))
  OR
  -- User is a project member
  (EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = forms.project_id
    AND pu.user_id = auth.uid()
  ))
  OR
  -- User has explicit form access
  (EXISTS (
    SELECT 1 FROM public.form_user_access fua
    WHERE fua.form_id = forms.id
    AND fua.user_id = auth.uid()
    AND fua.status = 'active'
  ))
  OR
  -- Form is public
  forms.is_public = true
);