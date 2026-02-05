-- Add re-enrollment control columns to workflows table
ALTER TABLE public.workflows
ADD COLUMN IF NOT EXISTS enrollment_mode TEXT NOT NULL DEFAULT 'allow_always'
  CHECK (enrollment_mode IN ('allow_always', 'once_per_record', 'cooldown')),
ADD COLUMN IF NOT EXISTS enrollment_cooldown_hours INTEGER DEFAULT 24
  CHECK (enrollment_cooldown_hours IS NULL OR enrollment_cooldown_hours >= 1);

-- Add comment for documentation
COMMENT ON COLUMN public.workflows.enrollment_mode IS 'Controls re-enrollment: allow_always (default), once_per_record (never re-enroll), cooldown (time-based)';
COMMENT ON COLUMN public.workflows.enrollment_cooldown_hours IS 'Hours to wait before allowing re-enrollment (only used when enrollment_mode is cooldown)';

-- Create index for efficient lookups when checking enrollment history
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_submission 
ON public.workflow_executions(workflow_id, trigger_submission_id) 
WHERE status IN ('completed', 'running', 'waiting');