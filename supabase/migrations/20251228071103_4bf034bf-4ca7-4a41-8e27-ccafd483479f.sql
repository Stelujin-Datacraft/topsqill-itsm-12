-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create lifecycle history" ON lifecycle_stage_history;

-- Create a more permissive INSERT policy that allows:
-- 1. Users who can update the submission (form creator, org admin)
-- 2. Project members with admin/editor role
-- 3. Users who submitted the record
CREATE POLICY "Users can create lifecycle history" 
ON lifecycle_stage_history 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM form_submissions fs
    JOIN forms f ON fs.form_id = f.id
    LEFT JOIN project_users pu ON f.project_id = pu.project_id
    LEFT JOIN user_profiles up ON up.id = auth.uid()
    WHERE fs.id = lifecycle_stage_history.submission_id
    AND (
      -- Form creator
      f.created_by = (SELECT email FROM user_profiles WHERE id = auth.uid())
      -- OR org admin
      OR (up.role = 'admin' AND up.organization_id = f.organization_id)
      -- OR project member with edit access
      OR (pu.user_id = auth.uid() AND pu.role IN ('admin', 'editor'))
      -- OR the submitter themselves
      OR fs.submitted_by = auth.uid()::text
    )
  )
);