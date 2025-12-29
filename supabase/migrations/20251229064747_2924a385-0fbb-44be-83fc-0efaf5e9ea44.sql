-- Clean up stuck waiting executions that have no wait_node_id and no current_node_id
-- These cannot be resumed and should be marked as failed
UPDATE public.workflow_executions
SET 
  status = 'failed',
  error_message = 'Cannot resume: wait_node_id is missing (cleaned up by migration)',
  completed_at = NOW()
WHERE 
  status = 'waiting' 
  AND wait_node_id IS NULL 
  AND current_node_id IS NULL;