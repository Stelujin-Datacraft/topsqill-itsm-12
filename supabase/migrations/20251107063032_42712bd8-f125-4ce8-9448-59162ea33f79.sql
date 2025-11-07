
-- Fix form_submissions RLS to handle UUID-based submitted_by field
-- Drop the faulty SELECT policy
DROP POLICY IF EXISTS "Organization members can view submissions" ON form_submissions;

-- Create proper SELECT policy that handles UUID in submitted_by field
CREATE POLICY "Users can view form submissions"
ON form_submissions
FOR SELECT
USING (
  -- User can see their own submissions (submitted_by matches their UUID as text)
  submitted_by = auth.uid()::text
  OR
  -- User is in the same organization as the form
  form_id IN (
    SELECT f.id 
    FROM forms f
    INNER JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE up.id = auth.uid()
  )
  OR
  -- Form is public
  form_id IN (
    SELECT id FROM forms WHERE is_public = true
  )
  OR
  -- User is the form creator (by matching user profile email with form created_by)
  form_id IN (
    SELECT f.id
    FROM forms f
    INNER JOIN user_profiles up ON up.email = f.created_by
    WHERE up.id = auth.uid()
  )
);
