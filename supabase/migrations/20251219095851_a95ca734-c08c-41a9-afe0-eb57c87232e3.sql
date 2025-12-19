-- Add scheduled resume time for wait nodes
ALTER TABLE public.workflow_executions 
ADD COLUMN IF NOT EXISTS scheduled_resume_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS wait_node_id UUID REFERENCES workflow_nodes(id),
ADD COLUMN IF NOT EXISTS wait_config JSONB;

-- Create index for efficient querying of pending wait executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_scheduled_resume 
ON public.workflow_executions (scheduled_resume_at) 
WHERE status = 'waiting' AND scheduled_resume_at IS NOT NULL;

-- Add 'waiting' as a valid status for workflows that are paused at wait nodes
COMMENT ON COLUMN public.workflow_executions.scheduled_resume_at IS 'Timestamp when a waiting workflow should be resumed';
COMMENT ON COLUMN public.workflow_executions.wait_node_id IS 'The wait node that paused this execution';
COMMENT ON COLUMN public.workflow_executions.wait_config IS 'Configuration of the wait node for resumption';