-- Step 1: Create workflow queue table (purely additive - no impact on existing workflows)
-- This table will store workflow execution requests for reliable processing

CREATE TABLE public.workflow_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to the workflow
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  
  -- The submission/record that triggered the workflow
  submission_id UUID REFERENCES public.form_submissions(id) ON DELETE SET NULL,
  
  -- Trigger context data (form data, trigger source, etc.)
  trigger_data JSONB NOT NULL DEFAULT '{}',
  
  -- Queue management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest, 10 = lowest
  
  -- Retry handling
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  
  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Source tracking (helps prevent duplicates)
  trigger_source TEXT NOT NULL DEFAULT 'form_submission', -- form_submission, manual, api, bulk, scheduled
  trigger_ref TEXT, -- unique reference to prevent duplicate queueing
  
  -- Organization scoping
  organization_id UUID REFERENCES public.organizations(id),
  project_id UUID REFERENCES public.projects(id),
  
  -- Link to execution once started
  execution_id UUID REFERENCES public.workflow_executions(id)
);

-- Indexes for efficient queue processing
CREATE INDEX idx_workflow_queue_pending ON public.workflow_queue(status, priority, created_at) 
  WHERE status = 'pending';

CREATE INDEX idx_workflow_queue_processing ON public.workflow_queue(status, started_at) 
  WHERE status = 'processing';

CREATE INDEX idx_workflow_queue_retry ON public.workflow_queue(status, next_retry_at) 
  WHERE status = 'failed' AND retry_count < max_retries;

CREATE INDEX idx_workflow_queue_workflow ON public.workflow_queue(workflow_id);
CREATE INDEX idx_workflow_queue_submission ON public.workflow_queue(submission_id);
CREATE INDEX idx_workflow_queue_trigger_ref ON public.workflow_queue(trigger_ref) WHERE trigger_ref IS NOT NULL;

-- Enable RLS
ALTER TABLE public.workflow_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view queue items in their organization"
  ON public.workflow_queue FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all queue items"
  ON public.workflow_queue FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.workflow_queue IS 'Server-side queue for reliable workflow execution. Workflows are enqueued here and processed by background workers, independent of browser sessions.';