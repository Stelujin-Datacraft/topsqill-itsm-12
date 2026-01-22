-- Additional performance indexes for common query patterns

-- Index for form_submissions - user-specific queries (My Submissions page)
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by 
ON form_submissions(submitted_by, submitted_at DESC) 
WHERE submitted_by IS NOT NULL;

-- Index for project_users - fast project membership lookups
CREATE INDEX IF NOT EXISTS idx_project_users_user_project 
ON project_users(user_id, project_id);

-- Index for form_user_access - fast form permission checks
CREATE INDEX IF NOT EXISTS idx_form_user_access_user_form 
ON form_user_access(user_id, form_id, status) 
WHERE status = 'active';

-- Index for workflow_executions - faster execution history queries
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_started 
ON workflow_executions(workflow_id, started_at DESC);

-- Index for notifications - user-specific unread queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, read, created_at DESC) 
WHERE read = false;

-- Index for email_logs - project-based email history
CREATE INDEX IF NOT EXISTS idx_email_logs_project_created 
ON email_logs(project_id, created_at DESC) 
WHERE project_id IS NOT NULL;