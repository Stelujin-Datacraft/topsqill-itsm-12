-- Drop existing insert policy and recreate with proper check
DROP POLICY IF EXISTS "Users can insert their own lifecycle history" ON public.lifecycle_stage_history;

-- Create a more permissive insert policy that allows authenticated users to insert
CREATE POLICY "Users can insert lifecycle history"
ON public.lifecycle_stage_history
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM form_submissions fs
    JOIN forms f ON fs.form_id = f.id
    JOIN project_users pu ON f.project_id = pu.project_id
    WHERE fs.id = submission_id AND pu.user_id = auth.uid()
  )
);