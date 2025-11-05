-- Enable RLS on tables (will fail silently if already enabled)
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create admin bypass policy for form_submissions
-- Users with admin role or project owners can view all submissions
CREATE POLICY "Admins and project owners can view submissions"
ON form_submissions FOR SELECT
USING (
  -- Check if user is an organization admin
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
  OR
  -- Check if user is a project member
  EXISTS (
    SELECT 1 FROM forms f
    JOIN project_users pu ON pu.project_id = f.project_id
    WHERE f.id = form_submissions.form_id
    AND pu.user_id = auth.uid()
  )
  OR
  -- Check if user created the form
  EXISTS (
    SELECT 1 FROM forms f
    JOIN user_profiles up ON up.email = f.created_by
    WHERE f.id = form_submissions.form_id
    AND up.id = auth.uid()
  )
);

-- Create admin bypass policy for forms
CREATE POLICY "Admins and project members can view forms"
ON forms FOR SELECT
USING (
  -- Organization admins can see all forms
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
  OR
  -- Project members can see forms in their projects
  EXISTS (
    SELECT 1 FROM project_users pu
    WHERE pu.project_id = forms.project_id
    AND pu.user_id = auth.uid()
  )
  OR
  -- Form creators can see their forms
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.email = forms.created_by
    AND up.id = auth.uid()
  )
);

-- Create admin bypass policy for form_fields
CREATE POLICY "Admins and project members can view form fields"
ON form_fields FOR SELECT
USING (
  -- Organization admins can see all form fields
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
  OR
  -- Users who can see the form can see its fields
  EXISTS (
    SELECT 1 FROM forms f
    LEFT JOIN project_users pu ON pu.project_id = f.project_id
    LEFT JOIN user_profiles up ON up.email = f.created_by
    WHERE f.id = form_fields.form_id
    AND (pu.user_id = auth.uid() OR up.id = auth.uid())
  )
);