-- =============================================================================
-- DEV REPAIR 02 — Replace deny-all / broken RLS on core form tables
-- Intended policy set = last-writer definitions from repo migrations (22 policies).
-- Drops ALL existing policies on the four tables first so Dev deny-all cannot
-- block the replacement set (same transaction — mid-failure rolls back).
-- Comparison vs Prod / intentional differences:
--   docs/dev-schema-repair/POLICY_COMPARISON.md
-- No USING (true) / WITH CHECK (true). RLS stays enabled.
-- Depends on: 20261019120000_dev_repair_01_form_access_helpers.sql
-- =============================================================================

BEGIN;

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy on these tables (names unknown / deny-all on Dev).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT pol.polname AS policy_name, n.nspname AS schema_name, c.relname AS table_name
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('forms', 'form_fields', 'form_submissions', 'form_audit_logs')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policy_name, r.schema_name, r.table_name
    );
  END LOOP;
END $$;

-- =============================================================================
-- public.forms
-- Sources: 20260218044247 (insert/update/delete), 20260520071315 (select),
--          20260725120000 (project admin update/delete)
-- =============================================================================
CREATE POLICY forms_select ON public.forms
FOR SELECT
USING (
  public.can_access_forms_row(organization_id, project_id, created_by, is_public, auth.uid())
  OR public.user_has_form_role_permission(id, auth.uid(), 'read')
);

CREATE POLICY forms_insert ON public.forms
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND organization_id = forms.organization_id)
  OR EXISTS (SELECT 1 FROM project_users WHERE project_id = forms.project_id AND user_id = auth.uid())
);

CREATE POLICY forms_update ON public.forms
FOR UPDATE
USING (can_modify_forms_row(organization_id, created_by, auth.uid()));

CREATE POLICY forms_delete ON public.forms
FOR DELETE
USING (can_modify_forms_row(organization_id, created_by, auth.uid()));

CREATE POLICY "Project admins can update forms"
ON public.forms
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = forms.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = forms.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
);

CREATE POLICY "Project admins can delete forms"
ON public.forms
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = forms.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
);

-- =============================================================================
-- public.form_fields — final: 20260218042224
-- =============================================================================
CREATE POLICY "form_fields_select" ON public.form_fields
  FOR SELECT USING (can_access_form(form_id, auth.uid()));

CREATE POLICY "form_fields_insert" ON public.form_fields
  FOR INSERT WITH CHECK (can_modify_form(form_id, auth.uid()));

CREATE POLICY "form_fields_update" ON public.form_fields
  FOR UPDATE USING (can_modify_form(form_id, auth.uid()));

CREATE POLICY "form_fields_delete" ON public.form_fields
  FOR DELETE USING (can_modify_form(form_id, auth.uid()));

-- =============================================================================
-- public.form_submissions — last-writer set from multiple migrations
-- =============================================================================

-- SELECT: 20260610021212
CREATE POLICY "Scoped view policy for form submissions"
ON public.form_submissions
FOR SELECT
TO authenticated
USING (
  submitted_by = (auth.uid())::text
  OR (submitted_by IS NOT NULL AND (submitted_by)::uuid = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id
      AND (f.created_by = (auth.uid())::text OR (f.created_by)::uuid = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.project_users pu ON pu.project_id = f.project_id
    WHERE f.id = form_submissions.form_id
      AND pu.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.asset_permissions ap
    WHERE ap.asset_id = form_submissions.form_id
      AND ap.asset_type = 'form'
      AND ap.user_id = auth.uid()
      AND ap.permission_type IN ('view_records','edit','view_form')
  )
  OR EXISTS (
    SELECT 1 FROM public.form_user_access fua
    WHERE fua.form_id = form_submissions.form_id
      AND fua.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id AND f.is_public = true
  )
);

-- SELECT/UPDATE delegates: 20260604115652 (uses final can_act_for*)
CREATE POLICY "Delegates can view delegator submissions"
ON public.form_submissions FOR SELECT
USING (
  submitted_by IS NOT NULL AND (
    public.can_act_for(submitted_by::uuid, form_id, NULL::uuid)
    OR public.can_act_for(submitted_by::uuid, NULL::uuid, (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id))
    OR public.can_act_for_submission(submitted_by::uuid, id)
  )
);

-- INSERT: 20251107063639
CREATE POLICY "Allow form submissions with user tracking"
ON form_submissions
FOR INSERT
WITH CHECK (
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

-- INSERT delegates: 20260604113932
CREATE POLICY "Delegates can insert delegator submissions"
ON public.form_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by IS NOT NULL
  AND (
    can_act_for((submitted_by)::uuid, form_id, NULL::uuid)
    OR can_act_for((submitted_by)::uuid, NULL::uuid, (
      SELECT f.project_id FROM forms f WHERE f.id = form_submissions.form_id
    ))
  )
);

-- UPDATE: 20251231065328
CREATE POLICY "Allow updates for authorized users" ON form_submissions
FOR UPDATE
USING (
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
  OR (EXISTS (
    SELECT 1
    FROM forms f
    JOIN project_users pu ON pu.project_id = f.project_id
    WHERE f.id = form_submissions.form_id
    AND pu.user_id = auth.uid()
    AND pu.role IN ('admin', 'editor')
  ))
  OR (EXISTS (
    SELECT 1
    FROM asset_permissions ap
    WHERE ap.asset_id = form_submissions.form_id
    AND ap.user_id = auth.uid()
    AND ap.asset_type = 'form'
    AND ap.permission_type IN ('edit', 'view_records')
  ))
  OR (submitted_by = auth.uid()::text OR submitted_by::uuid = auth.uid())
);

CREATE POLICY "Delegates can update delegator submissions"
ON public.form_submissions FOR UPDATE
USING (
  submitted_by IS NOT NULL AND (
    public.can_act_for(submitted_by::uuid, form_id, NULL::uuid)
    OR public.can_act_for(submitted_by::uuid, NULL::uuid, (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id))
    OR public.can_act_for_submission(submitted_by::uuid, id)
  )
)
WITH CHECK (
  submitted_by IS NOT NULL AND (
    public.can_act_for(submitted_by::uuid, form_id, NULL::uuid)
    OR public.can_act_for(submitted_by::uuid, NULL::uuid, (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id))
    OR public.can_act_for_submission(submitted_by::uuid, id)
  )
);

-- DELETE: 20251107063639 + 20260725120000
CREATE POLICY "Comprehensive delete policy for submissions"
ON form_submissions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = form_submissions.form_id
      AND (f.created_by = auth.uid()::text OR f.created_by::uuid = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM forms f
    INNER JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
  OR (submitted_by = auth.uid()::text OR submitted_by::uuid = auth.uid())
);

CREATE POLICY "Form editors can delete submissions"
ON public.form_submissions
FOR DELETE
TO authenticated
USING (public.can_modify_form(form_id, auth.uid()));

-- =============================================================================
-- public.form_audit_logs — 20260117071733 + DELETE 20260121081237
-- INSERT remains scoped: auth.uid() = user_id (no permissive insert).
-- =============================================================================
CREATE POLICY "Admins can view all form audit logs"
ON public.form_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

CREATE POLICY "Users can view their own form audit logs"
ON public.form_audit_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own form audit logs"
ON public.form_audit_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete form audit logs"
ON public.form_audit_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

NOTIFY pgrst, 'reload schema';

COMMIT;
