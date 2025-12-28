-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create lifecycle history" ON lifecycle_stage_history;

-- Create a simpler INSERT policy that allows any authenticated user 
-- who is a member of the organization that owns the form
CREATE POLICY "Users can create lifecycle history" 
ON lifecycle_stage_history 
FOR INSERT 
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  AND
  -- User must be in the same organization as the form
  EXISTS (
    SELECT 1 
    FROM form_submissions fs
    JOIN forms f ON fs.form_id = f.id
    JOIN user_profiles up ON up.id = auth.uid()
    WHERE fs.id = lifecycle_stage_history.submission_id
    AND up.organization_id = f.organization_id
  )
);