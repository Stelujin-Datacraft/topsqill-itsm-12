
-- Update workflow_executions table to include form submission reference and better tracking
ALTER TABLE public.workflow_executions 
ADD COLUMN IF NOT EXISTS trigger_data jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS form_submission_id uuid,
ADD COLUMN IF NOT EXISTS submitter_id uuid,
ADD COLUMN IF NOT EXISTS form_owner_id uuid;

-- Create workflow_instance_logs table for detailed execution tracking
CREATE TABLE IF NOT EXISTS public.workflow_instance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  node_id uuid NOT NULL,
  node_type text NOT NULL,
  node_label text,
  status text NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, skipped
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  input_data jsonb DEFAULT '{}',
  output_data jsonb DEFAULT '{}',
  error_message text,
  execution_order integer DEFAULT 0,
  duration_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on workflow_instance_logs
ALTER TABLE public.workflow_instance_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for workflow_instance_logs (users can view logs for workflows in their organization)
CREATE POLICY "Users can view workflow logs in their organization" 
  ON public.workflow_instance_logs 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_executions we
      JOIN public.workflows w ON w.id = we.workflow_id
      JOIN public.user_profiles up ON up.organization_id = w.organization_id
      WHERE we.id = workflow_instance_logs.execution_id
      AND up.id = auth.uid()
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_form_submission_id ON public.workflow_executions(form_submission_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instance_logs_execution_id ON public.workflow_instance_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instance_logs_node_id ON public.workflow_instance_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instance_logs_status ON public.workflow_instance_logs(status);

-- Add foreign key constraints
ALTER TABLE public.workflow_executions 
ADD CONSTRAINT fk_workflow_executions_form_submission 
FOREIGN KEY (form_submission_id) REFERENCES public.form_submissions(id) ON DELETE SET NULL;

-- Add trigger for updating updated_at on workflow_instance_logs
CREATE OR REPLACE TRIGGER update_workflow_instance_logs_updated_at
    BEFORE UPDATE ON public.workflow_instance_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
