-- Drop all existing INSERT policies on lifecycle_stage_history
DROP POLICY IF EXISTS "Users can create lifecycle history" ON lifecycle_stage_history;
DROP POLICY IF EXISTS "Authenticated users can create lifecycle history" ON lifecycle_stage_history;

-- Create a very simple INSERT policy - any authenticated user can insert
-- The validation happens at the application level (user must be logged in and have access to the form)
CREATE POLICY "Allow authenticated users to create history" 
ON lifecycle_stage_history 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- User must be authenticated and the changed_by must match their id
  auth.uid() = changed_by
);