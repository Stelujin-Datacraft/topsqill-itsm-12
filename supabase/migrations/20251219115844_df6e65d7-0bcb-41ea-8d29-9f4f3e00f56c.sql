-- Drop the existing check constraint and add a new one that includes 'waiting'
ALTER TABLE workflow_executions DROP CONSTRAINT workflow_executions_status_check;

ALTER TABLE workflow_executions ADD CONSTRAINT workflow_executions_status_check 
CHECK (status = ANY (ARRAY['running', 'completed', 'failed', 'paused', 'waiting']));