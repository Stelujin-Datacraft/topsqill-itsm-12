-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view accessible forms only" ON public.forms;

-- Create a security definer function to get user email safely
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.user_profiles WHERE id = _user_id;
$$;

-- Create the corrected policy using the security definer function
CREATE POLICY "Users can view accessible forms only" ON public.forms
FOR SELECT
USING (
  -- User created the form (check both email and UUID)
  (
    created_by = public.get_user_email(auth.uid())
    OR created_by = auth.uid()::text
  )
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