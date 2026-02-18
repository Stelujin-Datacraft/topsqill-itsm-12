
-- =============================================================
-- STEP 1: Create an efficient security definer function that checks
-- form access in ONE query instead of multiple per-row subqueries
-- =============================================================
CREATE OR REPLACE FUNCTION public.can_access_form(_form_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = _form_id
    AND (
      -- User is org admin
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = _user_id AND up.role = 'admin' AND up.organization_id = f.organization_id
      )
      -- User is in the same org
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = _user_id AND up.organization_id = f.organization_id
      )
      -- User is project member
      OR EXISTS (
        SELECT 1 FROM project_users pu
        WHERE pu.project_id = f.project_id AND pu.user_id = _user_id
      )
      -- User created the form
      OR f.created_by = (SELECT up.email FROM user_profiles up WHERE up.id = _user_id)
      OR f.created_by = _user_id::text
    )
  );
$$;

-- Efficient write-access check (admin/editor/creator only)
CREATE OR REPLACE FUNCTION public.can_modify_form(_form_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = _form_id
    AND (
      -- User is org admin
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = _user_id AND up.role = 'admin' AND up.organization_id = f.organization_id
      )
      -- User is project admin/editor
      OR EXISTS (
        SELECT 1 FROM project_users pu
        WHERE pu.project_id = f.project_id AND pu.user_id = _user_id AND pu.role IN ('admin', 'editor')
      )
      -- User created the form
      OR f.created_by = (SELECT up.email FROM user_profiles up WHERE up.id = _user_id)
      OR f.created_by = _user_id::text
    )
  );
$$;

-- =============================================================
-- STEP 2: Drop ALL existing form_fields policies
-- =============================================================
DROP POLICY IF EXISTS "Admins and project members can view form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Users can view fields of their forms" ON public.form_fields;
DROP POLICY IF EXISTS "Users can view form fields in their organization" ON public.form_fields;
DROP POLICY IF EXISTS "Users can view org form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Users can manage org form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Users can create fields for their forms" ON public.form_fields;
DROP POLICY IF EXISTS "Users can create form fields in their organization" ON public.form_fields;
DROP POLICY IF EXISTS "Users can update fields of their forms" ON public.form_fields;
DROP POLICY IF EXISTS "Users can update form fields in their organization" ON public.form_fields;
DROP POLICY IF EXISTS "Users can update form fields they can modify" ON public.form_fields;
DROP POLICY IF EXISTS "Users can delete fields of their forms" ON public.form_fields;
DROP POLICY IF EXISTS "Users can delete form fields in their organization" ON public.form_fields;
DROP POLICY IF EXISTS "Users can delete form fields they can modify" ON public.form_fields;

-- =============================================================
-- STEP 3: Create consolidated, efficient policies (4 total)
-- =============================================================
CREATE POLICY "form_fields_select" ON public.form_fields
  FOR SELECT USING (can_access_form(form_id, auth.uid()));

CREATE POLICY "form_fields_insert" ON public.form_fields
  FOR INSERT WITH CHECK (can_modify_form(form_id, auth.uid()));

CREATE POLICY "form_fields_update" ON public.form_fields
  FOR UPDATE USING (can_modify_form(form_id, auth.uid()));

CREATE POLICY "form_fields_delete" ON public.form_fields
  FOR DELETE USING (can_modify_form(form_id, auth.uid()));

-- =============================================================
-- STEP 4: Add missing indexes for RLS subquery performance
-- =============================================================
-- Index for forms.organization_id lookups (used in RLS)
CREATE INDEX IF NOT EXISTS idx_forms_organization_id ON public.forms USING btree (organization_id);

-- Index for user_profiles.organization_id + role (used heavily in admin checks)
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_role ON public.user_profiles USING btree (organization_id, role);

-- Composite index for form_submissions RLS checks
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by_text ON public.form_submissions USING btree (submitted_by);
