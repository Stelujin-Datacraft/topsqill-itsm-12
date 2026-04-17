-- Performance indexes for high-traffic queries
-- Using IF NOT EXISTS to be safe and idempotent

-- Form submissions: most queried table
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_submitted_at 
  ON public.form_submissions(form_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by 
  ON public.form_submissions(submitted_by);

CREATE INDEX IF NOT EXISTS idx_form_submissions_approval_status 
  ON public.form_submissions(approval_status) 
  WHERE approval_status IS NOT NULL;

-- GIN index on submission_data JSONB for fast filtering/search
CREATE INDEX IF NOT EXISTS idx_form_submissions_submission_data_gin 
  ON public.form_submissions USING GIN (submission_data);

-- Project users: hit on every permission check
CREATE INDEX IF NOT EXISTS idx_project_users_user_project 
  ON public.project_users(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_users_project_user 
  ON public.project_users(project_id, user_id);

-- Form fields: loaded on every form render
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id 
  ON public.form_fields(form_id);

-- Audit logs: large table, sorted by date
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created 
  ON public.audit_logs(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

-- Form audit logs
CREATE INDEX IF NOT EXISTS idx_form_audit_logs_form_created 
  ON public.form_audit_logs(form_id, created_at DESC) 
  WHERE form_id IS NOT NULL;

-- User profiles: org membership lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_role 
  ON public.user_profiles(organization_id, role);

-- Forms: project listing
CREATE INDEX IF NOT EXISTS idx_forms_project_created 
  ON public.forms(project_id, created_at DESC);

-- Notifications: per-user inbox
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON public.notifications(user_id, created_at DESC);
