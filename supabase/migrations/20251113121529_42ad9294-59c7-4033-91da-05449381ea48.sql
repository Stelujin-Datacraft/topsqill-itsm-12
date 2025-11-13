-- Drop the current policy
DROP POLICY IF EXISTS "Users can view own forms or admin sees all" ON public.forms;

-- Create restrictive policy - users (including admins) only see:
-- 1. Forms they created
-- 2. Forms in projects they're members of
-- 3. Forms they have explicit access to via form_user_access
CREATE POLICY "Users can view accessible forms only" ON public.forms
FOR SELECT
USING (
  -- User created the form
  (created_by = (SELECT email FROM public.user_profiles WHERE id = auth.uid()))
  OR
  -- User is a member of the project
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