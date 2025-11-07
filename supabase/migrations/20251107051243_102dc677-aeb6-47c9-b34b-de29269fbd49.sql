-- Comprehensive fix for form_submissions RLS policies
-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Allow public form submissions" ON form_submissions;
DROP POLICY IF EXISTS "Anyone can submit to public forms" ON form_submissions;
DROP POLICY IF EXISTS "Anyone can submit to published forms" ON form_submissions;
DROP POLICY IF EXISTS "Users can submit to accessible forms" ON form_submissions;
DROP POLICY IF EXISTS "Form creators and admins can view submissions" ON form_submissions;
DROP POLICY IF EXISTS "Form owners can view submissions" ON form_submissions;
DROP POLICY IF EXISTS "Admins and project owners can view submissions" ON form_submissions;
DROP POLICY IF EXISTS "Users can view form submissions in their organization" ON form_submissions;
DROP POLICY IF EXISTS "Users can view org form submissions" ON form_submissions;
DROP POLICY IF EXISTS "Users can view form submissions they have access to" ON form_submissions;
DROP POLICY IF EXISTS "Form owners and admins can delete submissions" ON form_submissions;

-- Create simplified INSERT policy - allow anyone to submit to forms
CREATE POLICY "Anyone can submit form submissions"
ON form_submissions
FOR INSERT
WITH CHECK (true);

-- Create comprehensive SELECT policy
CREATE POLICY "Organization members can view submissions"
ON form_submissions
FOR SELECT
USING (
  -- Allow if user is in the same organization as the form
  form_id IN (
    SELECT f.id FROM forms f
    INNER JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE up.id = auth.uid()
  )
  OR
  -- Allow if form is public
  form_id IN (
    SELECT id FROM forms WHERE is_public = true
  )
);

-- Create DELETE policy for form creators and admins
CREATE POLICY "Form creators and org admins can delete submissions"
ON form_submissions
FOR DELETE
USING (
  form_id IN (
    SELECT f.id FROM forms f
    INNER JOIN user_profiles up ON (
      (up.id = auth.uid() AND up.id::text = f.created_by)
      OR (up.id = auth.uid() AND up.role = 'admin' AND up.organization_id = f.organization_id)
    )
  )
);