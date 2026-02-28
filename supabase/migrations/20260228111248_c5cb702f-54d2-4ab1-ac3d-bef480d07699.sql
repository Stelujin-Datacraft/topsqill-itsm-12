
-- Drop the restrictive INSERT policy
DROP POLICY "Users can create approvals" ON public.policy_approvals;

-- Create a new INSERT policy that allows any authenticated user who can view the project to submit approval requests
CREATE POLICY "Users can create approvals for their project policies"
ON public.policy_approvals
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM policies p
    WHERE p.id = policy_approvals.policy_id
    AND can_view_project(p.project_id, auth.uid())
  )
);
