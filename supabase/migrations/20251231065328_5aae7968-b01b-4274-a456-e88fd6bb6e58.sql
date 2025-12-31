-- Add policy to allow form submission updates when triggered by workflow actions
-- This allows project members to update submissions in forms they have access to

-- First, create a helper function to check if user is a project member for a form
CREATE OR REPLACE FUNCTION public.can_update_form_submission_via_workflow(_form_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User is in the same project as the form
    SELECT 1 
    FROM forms f
    JOIN project_users pu ON pu.project_id = f.project_id
    WHERE f.id = _form_id 
    AND pu.user_id = _user_id
    AND pu.role IN ('admin', 'editor')
  ) OR EXISTS (
    -- User is org admin
    SELECT 1 
    FROM forms f
    JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = _form_id 
    AND up.id = _user_id 
    AND up.role = 'admin'
  ) OR EXISTS (
    -- User has explicit form edit permissions via asset_permissions
    SELECT 1 
    FROM asset_permissions ap
    JOIN forms f ON f.id = ap.asset_id
    WHERE f.id = _form_id 
    AND ap.user_id = _user_id 
    AND ap.asset_type = 'form'
    AND ap.permission_type IN ('edit', 'view_records')
  );
$$;

-- Update the form_submissions UPDATE policy to include project members
DROP POLICY IF EXISTS "Allow updates for authorized users" ON form_submissions;

CREATE POLICY "Allow updates for authorized users" ON form_submissions
FOR UPDATE
USING (
  -- Original conditions: org admin or form creator
  (EXISTS (
    SELECT 1
    FROM forms f
    JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id 
    AND up.id = auth.uid() 
    AND up.role = 'admin'
  )) 
  OR (EXISTS (
    SELECT 1
    FROM forms f
    WHERE f.id = form_submissions.form_id 
    AND (f.created_by = auth.uid()::text OR f.created_by::uuid = auth.uid())
  ))
  -- New: Allow project editors to update submissions (for workflow actions)
  OR (EXISTS (
    SELECT 1
    FROM forms f
    JOIN project_users pu ON pu.project_id = f.project_id
    WHERE f.id = form_submissions.form_id 
    AND pu.user_id = auth.uid()
    AND pu.role IN ('admin', 'editor')
  ))
  -- New: Allow users with explicit form edit permissions
  OR (EXISTS (
    SELECT 1
    FROM asset_permissions ap
    WHERE ap.asset_id = form_submissions.form_id 
    AND ap.user_id = auth.uid() 
    AND ap.asset_type = 'form'
    AND ap.permission_type IN ('edit', 'view_records')
  ))
  -- Allow submitter to update their own submissions
  OR (submitted_by = auth.uid()::text OR submitted_by::uuid = auth.uid())
);