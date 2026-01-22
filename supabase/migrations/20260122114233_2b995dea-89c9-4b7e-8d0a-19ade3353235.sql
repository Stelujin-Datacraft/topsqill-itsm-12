-- Performance indexes for frequently queried tables
-- These are purely additive and cannot break existing functionality

-- Index for form_submissions - frequently filtered by form_id and ordered by submitted_at
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_submitted 
ON form_submissions(form_id, submitted_at DESC);

-- Index for form_submissions - approval status queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_approval_status 
ON form_submissions(form_id, approval_status) 
WHERE approval_status IS NOT NULL;

-- Index for workflows - project-based queries with time ordering
CREATE INDEX IF NOT EXISTS idx_workflows_project_created 
ON workflows(project_id, created_at DESC);

-- Index for audit_logs - user activity queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created 
ON audit_logs(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;

-- Index for form_fields - form-based lookups with ordering
CREATE INDEX IF NOT EXISTS idx_form_fields_form_order 
ON form_fields(form_id, field_order);

-- Index for workflow_executions - status-based queries
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
ON workflow_executions(workflow_id, status, started_at DESC);

-- Index for reports - project-based queries
CREATE INDEX IF NOT EXISTS idx_reports_project_created 
ON reports(project_id, created_at DESC);

-- GIN index for JSONB submission_data - enables fast filtering on dynamic fields
CREATE INDEX IF NOT EXISTS idx_form_submissions_data_gin 
ON form_submissions USING GIN (submission_data);

-- Index for user_profiles - organization lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_status 
ON user_profiles(organization_id, status) 
WHERE status = 'Active';