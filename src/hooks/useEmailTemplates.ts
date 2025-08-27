import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  html_content: string;
  text_content?: string;
  template_variables: string[];
  custom_params: Record<string, any>;
  is_active: boolean;
  project_id: string;
  created_at: string;
}

export interface EmailTriggerOptions {
  templateId: string;
  recipients: string[];
  templateData: Record<string, any>;
  smtpConfigId?: string;
  triggerContext?: Record<string, any>;
}

export function useEmailTemplates(projectId?: string) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const sendTemplateEmail = async (options: EmailTriggerOptions) => {
    if (!userProfile?.organization_id) {
      throw new Error('User organization not found');
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('send-template-email', {
        body: options
      });

      if (error) {
        throw error;
      }

      console.log('✅ Email sent successfully:', data);
      
      toast({
        title: "Success",
        description: `Email sent to ${data.sentCount} recipient(s)${data.failedCount > 0 ? `, ${data.failedCount} failed` : ''}`,
      });

      return data;
    } catch (error: any) {
      console.error('❌ Error sending email:', error);
      toast({
        title: "Error",
        description: `Failed to send email: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getTemplatesForProject = async (projectId: string): Promise<EmailTemplate[]> => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return (data || []).map(template => ({
        ...template,
        template_variables: Array.isArray(template.template_variables) 
          ? template.template_variables.map(v => String(v))
          : [],
        custom_params: typeof template.custom_params === 'object' && template.custom_params !== null
          ? template.custom_params as Record<string, any>
          : {}
      }));
    } catch (error) {
      console.error('Error loading email templates:', error);
      throw error;
    }
  };

  const getSMTPConfigs = async () => {
    if (!userProfile?.organization_id) return [];

    try {
      const { data, error } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading SMTP configs:', error);
      return [];
    }
  };

  const triggerEmailFromForm = async (
    templateId: string,
    formData: Record<string, any>,
    userEmails: string[],
    customParams?: Record<string, any>
  ) => {
    const templateData = {
      ...formData,
      ...customParams,
      timestamp: new Date().toISOString(),
      form_submitted_at: new Date().toLocaleString(),
    };

    return sendTemplateEmail({
      templateId,
      recipients: userEmails,
      templateData,
      triggerContext: {
        trigger_type: 'form_submission',
        form_data: formData,
      }
    });
  };

  const triggerEmailFromWorkflow = async (
    templateId: string,
    workflowData: Record<string, any>,
    userEmails: string[],
    customParams?: Record<string, any>
  ) => {
    const templateData = {
      ...workflowData,
      ...customParams,
      timestamp: new Date().toISOString(),
      workflow_executed_at: new Date().toLocaleString(),
    };

    return sendTemplateEmail({
      templateId,
      recipients: userEmails,
      templateData,
      triggerContext: {
        trigger_type: 'workflow_execution',
        workflow_data: workflowData,
      }
    });
  };

  return {
    loading,
    sendTemplateEmail,
    getTemplatesForProject,
    getSMTPConfigs,
    triggerEmailFromForm,
    triggerEmailFromWorkflow,
  };
}