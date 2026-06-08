
-- ============ 1. ORGANIZATIONS: enable RLS ============
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow organization creation" ON public.organizations;

-- ============ 2. USER_PROFILES: drop password column ============
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS password;

-- ============ 3. ORGANIZATION_REQUESTS: drop password_hash ============
ALTER TABLE public.organization_requests DROP COLUMN IF EXISTS password_hash;

-- ============ 4. REPORT_MEDIA: scope to project members ============
DROP POLICY IF EXISTS "Users can view report media" ON public.report_media;
DROP POLICY IF EXISTS "Users can create report media" ON public.report_media;
DROP POLICY IF EXISTS "Users can update report media" ON public.report_media;
DROP POLICY IF EXISTS "Users can delete report media" ON public.report_media;

CREATE POLICY "Project members can view report media"
ON public.report_media FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.reports r
  WHERE r.id = report_media.report_id
    AND (
      r.project_id IS NULL
      OR public.is_project_member(r.project_id, auth.uid())
      OR r.organization_id = public.get_current_user_organization_id()
    )
));

CREATE POLICY "Project members can insert report media"
ON public.report_media FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.reports r
  WHERE r.id = report_media.report_id
    AND (
      public.is_project_member(r.project_id, auth.uid())
      OR r.organization_id = public.get_current_user_organization_id()
    )
));

CREATE POLICY "Project members can update report media"
ON public.report_media FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.reports r
  WHERE r.id = report_media.report_id
    AND (
      public.is_project_member(r.project_id, auth.uid())
      OR r.organization_id = public.get_current_user_organization_id()
    )
));

CREATE POLICY "Project members can delete report media"
ON public.report_media FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.reports r
  WHERE r.id = report_media.report_id
    AND (
      created_by = auth.uid()
      OR public.is_project_member(r.project_id, auth.uid())
      OR r.organization_id = public.get_current_user_organization_id()
    )
));

-- ============ 5. SLA_INSTANCES: drop USING(true) ============
DROP POLICY IF EXISTS "Manage SLA instances" ON public.sla_instances;

CREATE POLICY "Project members can manage SLA instances"
ON public.sla_instances FOR ALL TO authenticated
USING (form_id IN (
  SELECT f.id FROM public.forms f
  JOIN public.project_users pu ON pu.project_id = f.project_id
  WHERE pu.user_id = auth.uid()
))
WITH CHECK (form_id IN (
  SELECT f.id FROM public.forms f
  JOIN public.project_users pu ON pu.project_id = f.project_id
  WHERE pu.user_id = auth.uid()
));

-- ============ 6. POLICY_CONTROL_MAPPINGS: drop USING(true) ============
DROP POLICY IF EXISTS "Users can view policy_control_mappings" ON public.policy_control_mappings;
DROP POLICY IF EXISTS "Users can delete policy_control_mappings" ON public.policy_control_mappings;
DROP POLICY IF EXISTS "Users can create policy_control_mappings" ON public.policy_control_mappings;

CREATE POLICY "Project members can view policy_control_mappings"
ON public.policy_control_mappings FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.policies p
  WHERE p.id = policy_control_mappings.policy_id
    AND public.is_project_member(p.project_id, auth.uid())
));

CREATE POLICY "Project members can delete policy_control_mappings"
ON public.policy_control_mappings FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.policies p
  WHERE p.id = policy_control_mappings.policy_id
    AND public.is_project_member(p.project_id, auth.uid())
));

-- ============ 7. FORM_SUBMISSIONS: remove public-form leak ============
DROP POLICY IF EXISTS "Comprehensive view policy for form submissions" ON public.form_submissions;

CREATE POLICY "Comprehensive view policy for form submissions"
ON public.form_submissions FOR SELECT TO authenticated
USING (
  (submitted_by = (auth.uid())::text)
  OR ((submitted_by)::uuid = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id AND up.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id
      AND ((f.created_by = (auth.uid())::text) OR ((f.created_by)::uuid = auth.uid()))
  )
);

-- ============ 8. DATA_SOURCE_CONNECTIONS: restrict view to admins/editors ============
DROP POLICY IF EXISTS "Project users can view connections" ON public.data_source_connections;

CREATE POLICY "Project admins/editors can view connections"
ON public.data_source_connections FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = data_source_connections.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = ANY (ARRAY['admin'::text, 'editor'::text])
  )
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = data_source_connections.organization_id
  )
);
