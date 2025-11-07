
-- COMPREHENSIVE FIX FOR ALL FORM_SUBMISSIONS RLS ISSUES
-- This migration fixes all permission checks in one go

-- Step 1: Drop the broken SELECT policy
DROP POLICY IF EXISTS "Users can view form submissions" ON form_submissions;

-- Step 2: Create ONE comprehensive SELECT policy that handles ALL scenarios correctly
CREATE POLICY "Comprehensive view policy for form submissions"
ON form_submissions
FOR SELECT
USING (
  -- Scenario 1: User submitted this record (match UUID in submitted_by field)
  (submitted_by = auth.uid()::text OR submitted_by::uuid = auth.uid())
  
  OR
  
  -- Scenario 2: User is in the same organization as the form
  EXISTS (
    SELECT 1 
    FROM forms f
    INNER JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id 
      AND up.id = auth.uid()
  )
  
  OR
  
  -- Scenario 3: User created this form (match by UUID in created_by field)
  EXISTS (
    SELECT 1
    FROM forms f
    WHERE f.id = form_submissions.form_id
      AND (f.created_by = auth.uid()::text OR f.created_by::uuid = auth.uid())
  )
  
  OR
  
  -- Scenario 4: Form is public
  EXISTS (
    SELECT 1
    FROM forms f
    WHERE f.id = form_submissions.form_id
      AND f.is_public = true
  )
  
  OR
  
  -- Scenario 5: User is an admin in the form's organization
  EXISTS (
    SELECT 1
    FROM forms f
    INNER JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
);

-- Step 3: Ensure INSERT policy allows submissions with proper user tracking
DROP POLICY IF EXISTS "Anyone can submit form submissions" ON form_submissions;

CREATE POLICY "Allow form submissions with user tracking"
ON form_submissions
FOR INSERT
WITH CHECK (
  -- Allow insert if form exists and is either public or user has access
  EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = form_submissions.form_id
      AND (
        f.is_public = true
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
            AND up.organization_id = f.organization_id
        )
      )
  )
);

-- Step 4: Fix DELETE policy to handle UUID properly
DROP POLICY IF EXISTS "Form creators and org admins can delete submissions" ON form_submissions;

CREATE POLICY "Comprehensive delete policy for submissions"
ON form_submissions
FOR DELETE
USING (
  -- User created the form (UUID match)
  EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = form_submissions.form_id
      AND (f.created_by = auth.uid()::text OR f.created_by::uuid = auth.uid())
  )
  
  OR
  
  -- User is admin in form's organization
  EXISTS (
    SELECT 1 FROM forms f
    INNER JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
  
  OR
  
  -- User submitted this record
  (submitted_by = auth.uid()::text OR submitted_by::uuid = auth.uid())
);

-- Step 5: Add UPDATE policy for approvals and edits
DROP POLICY IF EXISTS "Users can update form submissions" ON form_submissions;

CREATE POLICY "Allow updates for authorized users"
ON form_submissions
FOR UPDATE
USING (
  -- User is admin in form's organization (can approve/edit)
  EXISTS (
    SELECT 1 FROM forms f
    INNER JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
  
  OR
  
  -- User created the form
  EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = form_submissions.form_id
      AND (f.created_by = auth.uid()::text OR f.created_by::uuid = auth.uid())
  )
);
