
-- Update workflow_instance_logs table to support better node execution tracking
ALTER TABLE workflow_instance_logs 
ADD COLUMN IF NOT EXISTS node_label text,
ADD COLUMN IF NOT EXISTS execution_order integer DEFAULT 0;

-- Create index for better performance on execution queries
CREATE INDEX IF NOT EXISTS idx_workflow_instance_logs_execution_order 
ON workflow_instance_logs(execution_id, execution_order);

-- Update workflow_executions table to track current node
ALTER TABLE workflow_executions 
ADD COLUMN IF NOT EXISTS current_node_id uuid;

-- Create a function to get next execution order
CREATE OR REPLACE FUNCTION get_next_execution_order(exec_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(MAX(execution_order), 0) + 1
  FROM workflow_instance_logs
  WHERE execution_id = exec_id;
$$;
