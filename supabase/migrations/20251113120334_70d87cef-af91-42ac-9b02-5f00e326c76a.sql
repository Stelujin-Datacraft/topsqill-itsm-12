-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view org forms" ON public.forms;

-- Create restrictive policy - users only see their own forms
-- Org admins can see all forms in their organization
CREATE POLICY "Users can view own forms or admin sees all" ON public.forms
FOR SELECT
USING (
  -- User created the form
  (created_by = (SELECT email FROM public.user_profiles WHERE id = auth.uid()))
  OR
  -- User is org admin and form is in their organization
  (EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.role = 'admin'
    AND up.organization_id = forms.organization_id
  ))
);