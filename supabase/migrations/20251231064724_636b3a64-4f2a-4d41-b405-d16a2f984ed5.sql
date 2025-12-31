-- Clean up stuck workflow executions (running for more than 30 minutes)
UPDATE workflow_executions 
SET status = 'failed', 
    completed_at = NOW(), 
    error_message = 'Execution interrupted - browser session ended'
WHERE status = 'running' 
AND started_at < NOW() - INTERVAL '30 minutes';

-- Clean up stuck workflow instance logs (running for more than 30 minutes)
UPDATE workflow_instance_logs 
SET status = 'failed', 
    completed_at = NOW(), 
    error_message = 'Execution interrupted - browser session ended'
WHERE status = 'running' 
AND started_at < NOW() - INTERVAL '30 minutes';