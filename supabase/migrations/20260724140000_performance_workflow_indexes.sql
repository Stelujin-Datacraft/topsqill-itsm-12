-- Additional performance indexes for workflow resume, triggers, and relationship map

CREATE INDEX IF NOT EXISTS idx_workflow_executions_waiting_resume
  ON public.workflow_executions (scheduled_resume_at)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_workflow_executions_waiting_event
  ON public.workflow_executions (status)
  WHERE status = 'waiting' AND wait_config IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_fields_field_type
  ON public.form_fields (field_type);

CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow_node_type
  ON public.workflow_nodes (workflow_id, node_type);

CREATE INDEX IF NOT EXISTS idx_workflows_project_status
  ON public.workflows (project_id, status);
