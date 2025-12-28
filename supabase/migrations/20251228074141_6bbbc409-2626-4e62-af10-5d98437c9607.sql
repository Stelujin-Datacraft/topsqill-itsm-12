-- Drop ALL existing INSERT policies to start fresh
DROP POLICY IF EXISTS "Users can create lifecycle history" ON lifecycle_stage_history;
DROP POLICY IF EXISTS "Authenticated users can create lifecycle history" ON lifecycle_stage_history;
DROP POLICY IF EXISTS "Allow authenticated users to create history" ON lifecycle_stage_history;

-- Create a simple policy that just checks the user is authenticated
-- The changed_by field MUST match the authenticated user
CREATE POLICY "Users can insert their own lifecycle history" 
ON lifecycle_stage_history 
FOR INSERT 
TO authenticated
WITH CHECK (changed_by = auth.uid());