
-- ============ form_submissions: tighten SELECT ============
DROP POLICY IF EXISTS "Comprehensive view policy for form submissions" ON public.form_submissions;

CREATE POLICY "Scoped view policy for form submissions"
ON public.form_submissions
FOR SELECT
TO authenticated
USING (
  -- submitter
  submitted_by = (auth.uid())::text
  OR (submitted_by IS NOT NULL AND (submitted_by)::uuid = auth.uid())
  -- form creator
  OR EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id
      AND (f.created_by = (auth.uid())::text OR (f.created_by)::uuid = auth.uid())
  )
  -- org admin
  OR EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_submissions.form_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
  -- project member
  OR EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.project_users pu ON pu.project_id = f.project_id
    WHERE f.id = form_submissions.form_id
      AND pu.user_id = auth.uid()
  )
  -- explicit form asset permission
  OR EXISTS (
    SELECT 1 FROM public.asset_permissions ap
    WHERE ap.asset_id = form_submissions.form_id
      AND ap.asset_type = 'form'
      AND ap.user_id = auth.uid()
      AND ap.permission_type IN ('view_records','edit','view_form')
  )
  -- explicit form_user_access
  OR EXISTS (
    SELECT 1 FROM public.form_user_access fua
    WHERE fua.form_id = form_submissions.form_id
      AND fua.user_id = auth.uid()
  )
  -- public form
  OR EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id AND f.is_public = true
  )
);

-- ============ notifications INSERT: service_role only ============
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============ email_logs INSERT: service_role only ============
DROP POLICY IF EXISTS "System can insert email logs" ON public.email_logs;

CREATE POLICY "Service role can insert email logs"
ON public.email_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============ permission_audit_log INSERT: service_role only ============
DROP POLICY IF EXISTS "System can insert audit logs" ON public.permission_audit_log;

CREATE POLICY "Service role can insert permission audit logs"
ON public.permission_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============ workflow_executions INSERT: scope to workflow's org/project ============
DROP POLICY IF EXISTS "System can create workflow executions" ON public.workflow_executions;

CREATE POLICY "Authorized users can create workflow executions"
ON public.workflow_executions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workflows w
    LEFT JOIN public.user_profiles up
      ON up.organization_id = w.organization_id AND up.id = auth.uid()
    LEFT JOIN public.project_users pu
      ON pu.project_id = w.project_id AND pu.user_id = auth.uid()
    WHERE w.id = workflow_executions.workflow_id
      AND (up.id IS NOT NULL OR pu.user_id IS NOT NULL)
  )
);

-- ============ record_field_history INSERT: must own submission ============
DROP POLICY IF EXISTS "Authenticated users can insert record history" ON public.record_field_history;

CREATE POLICY "Users can insert record history for accessible submissions"
ON public.record_field_history
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_submission(submission_id, auth.uid()));

-- ============ user_profiles: remove permissive INSERT ============
DROP POLICY IF EXISTS "Allow profile creation" ON public.user_profiles;
-- Keep "Users can insert their own profile" which already enforces auth.uid() = id

-- ============ Storage: generated-documents — scope to user's org ============
DROP POLICY IF EXISTS "Users can view documents in their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

CREATE POLICY "Org members can view generated documents in their org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-documents'
  AND EXISTS (
    SELECT 1 FROM public.document_history dh
    WHERE dh.file_path = storage.objects.name
      AND dh.organization_id = public.get_current_user_organization_id()
  )
);

CREATE POLICY "Org admins can delete generated documents in their org"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-documents'
  AND EXISTS (
    SELECT 1 FROM public.document_history dh
    JOIN public.user_profiles up ON up.organization_id = dh.organization_id
    WHERE dh.file_path = storage.objects.name
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
);

-- ============ Storage: form-attachments — owner-only DELETE/UPDATE ============
DROP POLICY IF EXISTS "Authenticated users can delete form attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update form attachments" ON storage.objects;

CREATE POLICY "Owners can delete their form attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'form-attachments' AND owner = auth.uid());

CREATE POLICY "Owners can update their form attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'form-attachments' AND owner = auth.uid())
WITH CHECK (bucket_id = 'form-attachments' AND owner = auth.uid());

-- ============ Storage: policy-attachments — owner-only DELETE ============
DROP POLICY IF EXISTS "Authenticated users can delete policy attachments" ON storage.objects;

CREATE POLICY "Owners can delete their policy attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'policy-attachments' AND owner = auth.uid());
