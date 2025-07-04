
-- Create triggers table to store workflow triggers
CREATE TABLE public.workflow_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  trigger_id TEXT NOT NULL,
  target_workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('onFormSubmit', 'onFormCompletion', 'onFormApproval', 'onFormRejection')),
  source_form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  permissions JSONB DEFAULT '{"canExecute": ["admin", "moderator"]}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.user_profiles(id)
);

-- Add RLS policies for workflow_triggers
ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view triggers in their organization" 
  ON public.workflow_triggers 
  FOR SELECT 
  USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Admins can manage triggers in their organization" 
  ON public.workflow_triggers 
  FOR ALL 
  USING (organization_id = get_current_user_organization_id() AND is_current_user_admin_of_org(organization_id));

-- Create workflow_node_executions table to track node execution status
CREATE TABLE public.workflow_node_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  output_data JSONB DEFAULT '{}',
  execution_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS for workflow_node_executions
ALTER TABLE public.workflow_node_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view node executions in their organization" 
  ON public.workflow_node_executions 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.workflow_executions we 
    JOIN public.workflows w ON we.workflow_id = w.id 
    WHERE we.id = execution_id AND w.organization_id = get_current_user_organization_id()
  ));

-- Add indexes for better performance
CREATE INDEX idx_workflow_triggers_org_form ON public.workflow_triggers(organization_id, source_form_id, trigger_type);
CREATE INDEX idx_workflow_triggers_target_workflow ON public.workflow_triggers(target_workflow_id);
CREATE INDEX idx_workflow_node_executions_execution ON public.workflow_node_executions(execution_id, status);

-- Add trigger for updated_at timestamp
CREATE TRIGGER update_workflow_triggers_updated_at
  BEFORE UPDATE ON public.workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_node_executions_updated_at
  BEFORE UPDATE ON public.workflow_node_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
