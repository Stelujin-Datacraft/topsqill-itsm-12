-- Create SMTP configurations table for organizations
CREATE TABLE public.smtp_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  use_tls BOOLEAN NOT NULL DEFAULT true,
  from_email TEXT NOT NULL,
  from_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email templates table for projects
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  template_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email logs table for tracking sent emails
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  project_id UUID,
  template_id UUID,
  smtp_config_id UUID,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  triggered_by UUID,
  trigger_context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.smtp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for smtp_configs
CREATE POLICY "Organization admins can manage SMTP configs" 
ON public.smtp_configs 
FOR ALL 
USING (is_current_user_admin_of_org(organization_id));

CREATE POLICY "Organization users can view SMTP configs" 
ON public.smtp_configs 
FOR SELECT 
USING (organization_id = get_current_user_organization_id());

-- RLS Policies for email_templates
CREATE POLICY "Project users can view email templates" 
ON public.email_templates 
FOR SELECT 
USING (can_view_project(project_id, auth.uid()));

CREATE POLICY "Project editors can manage email templates" 
ON public.email_templates 
FOR ALL 
USING (can_create_asset_in_project(project_id, auth.uid()));

-- RLS Policies for email_logs
CREATE POLICY "Organization users can view email logs" 
ON public.email_logs 
FOR SELECT 
USING (organization_id = get_current_user_organization_id());

CREATE POLICY "System can insert email logs" 
ON public.email_logs 
FOR INSERT 
WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_smtp_configs_updated_at
BEFORE UPDATE ON public.smtp_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();