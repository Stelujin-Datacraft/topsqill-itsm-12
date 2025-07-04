
-- Add RLS policies for workflow_executions table
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- Create policy for workflow_executions (users can view executions for workflows in their organization)
CREATE POLICY "Users can view workflow executions in their organization" 
  ON public.workflow_executions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      JOIN public.user_profiles up ON up.organization_id = w.organization_id
      WHERE w.id = workflow_executions.workflow_id
      AND up.id = auth.uid()
    )
  );

-- Create policy for inserting workflow executions (system can create executions)
CREATE POLICY "System can create workflow executions" 
  ON public.workflow_executions 
  FOR INSERT 
  WITH CHECK (true);

-- Create policy for updating workflow executions (system can update executions)
CREATE POLICY "System can update workflow executions" 
  ON public.workflow_executions 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      JOIN public.user_profiles up ON up.organization_id = w.organization_id
      WHERE w.id = workflow_executions.workflow_id
      AND up.id = auth.uid()
    )
  );

-- Add foreign key constraints that were missing
ALTER TABLE public.workflow_executions 
ADD CONSTRAINT fk_workflow_executions_submitter_id 
FOREIGN KEY (submitter_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.workflow_executions 
ADD CONSTRAINT fk_workflow_executions_form_owner_id 
FOREIGN KEY (form_owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update the workflow_instance_logs policy to be more permissive for system operations
DROP POLICY IF EXISTS "Users can view workflow logs in their organization" ON public.workflow_instance_logs;

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

-- Allow system to insert and update workflow logs
CREATE POLICY "System can manage workflow logs" 
  ON public.workflow_instance_logs 
  FOR ALL 
  USING (true);
