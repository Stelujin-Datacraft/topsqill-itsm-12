-- Revert the restrictive policy
DROP POLICY IF EXISTS "Users can view accessible forms" ON public.forms;

-- Restore the original policy that allows viewing all org forms
CREATE POLICY "Users can view org forms" ON public.forms
FOR SELECT
USING (organization_id = get_current_user_organization_id());