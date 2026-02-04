-- =====================================================
-- PERFORMANCE OPTIMIZATION: Database Indexes (Verified)
-- =====================================================

-- 1. WORKFLOW EXECUTIONS
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_status 
ON workflow_executions(workflow_id, status);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at 
ON workflow_executions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_trigger_submission 
ON workflow_executions(trigger_submission_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_form_submission 
ON workflow_executions(form_submission_id);

-- 2. WORKFLOW INSTANCE LOGS
CREATE INDEX IF NOT EXISTS idx_workflow_logs_execution_order 
ON workflow_instance_logs(execution_id, execution_order);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_created 
ON workflow_instance_logs(created_at DESC);

-- 3. WORKFLOW NODE EXECUTIONS (using started_at instead of executed_at)
CREATE INDEX IF NOT EXISTS idx_workflow_node_executions_exec 
ON workflow_node_executions(execution_id, started_at DESC);

-- 4. LIFECYCLE STAGE HISTORY
CREATE INDEX IF NOT EXISTS idx_lifecycle_history_submission 
ON lifecycle_stage_history(submission_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_history_field 
ON lifecycle_stage_history(field_id);

-- 5. PROJECT USERS (RLS performance)
CREATE INDEX IF NOT EXISTS idx_project_users_user_project 
ON project_users(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_users_project_role 
ON project_users(project_id, role);

-- 6. ASSET PERMISSIONS (RLS performance)
CREATE INDEX IF NOT EXISTS idx_asset_permissions_lookup 
ON asset_permissions(project_id, user_id, asset_type, asset_id);

-- 7. GROUP MEMBERSHIPS
CREATE INDEX IF NOT EXISTS idx_group_memberships_group 
ON group_memberships(group_id);

CREATE INDEX IF NOT EXISTS idx_group_memberships_member 
ON group_memberships(member_id, member_type);

-- 8. NOTIFICATIONS
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, read) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- 9. AUDIT LOGS
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date 
ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_category_type 
ON audit_logs(event_category, event_type);

-- 10. FORM AUDIT LOGS
CREATE INDEX IF NOT EXISTS idx_form_audit_logs_form_date 
ON form_audit_logs(form_id, created_at DESC);

-- 11. API REQUEST LOGS
CREATE INDEX IF NOT EXISTS idx_api_logs_org_date 
ON api_request_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_logs_key_date 
ON api_request_logs(api_key_id, created_at DESC);

-- 12. DATA FEEDS
CREATE INDEX IF NOT EXISTS idx_data_feeds_project 
ON data_feeds(project_id, is_active);

CREATE INDEX IF NOT EXISTS idx_data_feeds_source_target 
ON data_feeds(source_form_id, target_form_id);

-- 13. DATA FEED RUNS
CREATE INDEX IF NOT EXISTS idx_data_feed_runs_feed_date 
ON data_feed_runs(data_feed_id, started_at DESC);

-- 14. REPORTS
CREATE INDEX IF NOT EXISTS idx_reports_project_date 
ON reports(project_id, created_at DESC);

-- 15. DASHBOARDS
CREATE INDEX IF NOT EXISTS idx_dashboards_project_date 
ON dashboards(project_id, created_at DESC);

-- 16. FORMS
CREATE INDEX IF NOT EXISTS idx_forms_project_status 
ON forms(project_id, status);

CREATE INDEX IF NOT EXISTS idx_forms_org_date 
ON forms(organization_id, created_at DESC);

-- 17. FORM FIELDS
CREATE INDEX IF NOT EXISTS idx_form_fields_form_order 
ON form_fields(form_id, field_order);

-- 18. USER PROFILES (common lookups)
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_status 
ON user_profiles(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email 
ON user_profiles(email);

-- 19. EMAIL LOGS
CREATE INDEX IF NOT EXISTS idx_email_logs_org_date 
ON email_logs(organization_id, created_at DESC);

-- 20. WORKFLOWS
CREATE INDEX IF NOT EXISTS idx_workflows_project_status 
ON workflows(project_id, status);