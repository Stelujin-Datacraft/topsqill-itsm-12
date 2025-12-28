-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create lifecycle history" ON lifecycle_stage_history;

-- Create a simpler, more permissive INSERT policy
-- Allow any authenticated user who belongs to the same organization as the form
CREATE POLICY "Authenticated users can create lifecycle history" 
ON lifecycle_stage_history 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM form_submissions fs
    JOIN forms f ON fs.form_id = f.id
    WHERE fs.id = submission_id
    AND (
      -- User is in the same organization
      f.organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
      -- OR user is the form creator
      OR f.created_by = (SELECT email FROM user_profiles WHERE id = auth.uid())
      -- OR user is the submitter
      OR fs.submitted_by = auth.uid()::text
    )
  )
);