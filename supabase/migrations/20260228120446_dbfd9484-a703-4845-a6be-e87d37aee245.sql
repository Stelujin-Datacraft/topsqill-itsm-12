
-- Drop and recreate the UPDATE policy with both USING and WITH CHECK
DROP POLICY "Approvers can update their approvals" ON public.policy_approvals;

CREATE POLICY "Approvers can update their approvals"
ON public.policy_approvals
FOR UPDATE
USING (approver_id = auth.uid())
WITH CHECK (approver_id = auth.uid());

-- Also ensure SELECT policy covers the approver directly
DROP POLICY "Users can view approvals" ON public.policy_approvals;

CREATE POLICY "Users can view approvals"
ON public.policy_approvals
FOR SELECT
USING (
  approver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM policies p
    WHERE p.id = policy_approvals.policy_id
    AND can_view_project(p.project_id, auth.uid())
  )
);
