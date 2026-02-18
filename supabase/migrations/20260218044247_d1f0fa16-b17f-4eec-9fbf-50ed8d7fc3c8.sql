
-- ============================================================
-- PART 1: Consolidate forms table RLS policies
-- Currently 6 overlapping policies with expensive subqueries
-- ============================================================

-- Helper function for forms access (SELECT)
CREATE OR REPLACE FUNCTION public.can_access_forms_row(_org_id uuid, _project_id uuid, _created_by text, _is_public boolean, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    -- Admin check
    EXISTS (SELECT 1 FROM user_profiles WHERE id = _user_id AND role = 'admin' AND organization_id = _org_id)
    -- Project member check
    OR EXISTS (SELECT 1 FROM project_users WHERE project_id = _project_id AND user_id = _user_id)
    -- Creator check
    OR _created_by = _user_id::text
    -- Public form check
    OR _is_public = true;
$$;

-- Helper function for forms modify (UPDATE/DELETE)
CREATE OR REPLACE FUNCTION public.can_modify_forms_row(_org_id uuid, _created_by text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    -- Admin check
    EXISTS (SELECT 1 FROM user_profiles WHERE id = _user_id AND role = 'admin' AND organization_id = _org_id)
    -- Creator check
    OR _created_by = _user_id::text;
$$;

-- Drop all existing forms policies
DROP POLICY IF EXISTS "Admins and project members can view forms" ON public.forms;
DROP POLICY IF EXISTS "Admins can manage org forms" ON public.forms;
DROP POLICY IF EXISTS "Project members can view forms" ON public.forms;
DROP POLICY IF EXISTS "Users can create forms in org" ON public.forms;
DROP POLICY IF EXISTS "Users can delete their own forms or admins can delete org forms" ON public.forms;
DROP POLICY IF EXISTS "Users can update their own forms or admins can update org forms" ON public.forms;

-- Create consolidated policies
CREATE POLICY "forms_select" ON public.forms
  FOR SELECT USING (can_access_forms_row(organization_id, project_id, created_by, is_public, auth.uid()));

CREATE POLICY "forms_insert" ON public.forms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND organization_id = forms.organization_id)
    OR EXISTS (SELECT 1 FROM project_users WHERE project_id = forms.project_id AND user_id = auth.uid())
  );

CREATE POLICY "forms_update" ON public.forms
  FOR UPDATE USING (can_modify_forms_row(organization_id, created_by, auth.uid()));

CREATE POLICY "forms_delete" ON public.forms
  FOR DELETE USING (can_modify_forms_row(organization_id, created_by, auth.uid()));

-- ============================================================
-- PART 2: Add missing index on form_fields(form_id)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON public.form_fields(form_id);

-- ============================================================
-- PART 3: Add index for project_users lookups (used in all RLS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_project_users_project_user ON public.project_users(project_id, user_id);

-- ============================================================
-- PART 4: Add index on forms(project_id) for faster lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_forms_project_id ON public.forms(project_id);
