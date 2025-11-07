-- Fix RLS policies for form_submissions to handle UUID-based created_by
-- Drop existing problematic SELECT policies
DROP POLICY IF EXISTS "Form creators and admins can view submissions" ON form_submissions;
DROP POLICY IF EXISTS "Form owners can view submissions" ON form_submissions;
DROP POLICY IF EXISTS "Admins and project owners can view submissions" ON form_submissions;
DROP POLICY IF EXISTS "Users can view form submissions in their organization" ON form_submissions;
DROP POLICY IF EXISTS "Users can view org form submissions" ON form_submissions;

-- Create comprehensive SELECT policy that handles UUID-based created_by
CREATE POLICY "Users can view form submissions they have access to"
ON form_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = form_submissions.form_id
    AND (
      -- Form creator (handle both UUID and email formats)
      f.created_by = auth.uid()::text 
      OR f.created_by = (SELECT email FROM user_profiles WHERE id = auth.uid())
      -- Organization member
      OR f.organization_id = get_current_user_organization_id()
      -- Organization admin
      OR is_current_user_admin_of_org(f.organization_id)
      -- Public form
      OR f.is_public = true
    )
  )
);