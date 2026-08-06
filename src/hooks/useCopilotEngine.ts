import { useState, useEffect, useCallback } from 'react';
import { useFormAI } from '@/hooks/useFormAI';
import { useProject } from '@/contexts/ProjectContext';
import { useLocation } from 'react-router-dom';
import { backend as supabase } from '@/services/api';
import { toast } from 'sonner';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: {
    type: string;
    status: 'pending' | 'executing' | 'success' | 'error';
    result?: any;
  };
  /** Clarification chips the user can click (e.g. "which form?") */
  choices?: Array<{ label: string; value: string }>;
  resolved?: boolean;
}

interface WorkflowInfo { id: string; name: string; description?: string }
interface ReportInfo { id: string; name: string; description?: string }
interface FormWithFields {
  id: string;
  name: string;
  description?: string;
  fields: Array<{ id: string; label: string; type: string; options?: Array<{ id: string; value: string; label: string }>; required: boolean }>;
}

export const COPILOT_WELCOME = `Hi! 👋 I'm your **AI Copilot** for TopSqill BPM.

 🚀 **Execute Actions**
 Create forms, trigger workflows, check SLA risks

 🧭 **Navigate**
 Take you anywhere in the system

 💡 **Assist**
 Explain features and guide you through tasks

 **Try saying:**
 • "Create a feedback form with name and email"
 • "What are my SLA risks right now?"
 • "Take me to workflows"`;

const welcomeMessage = (): CopilotMessage => ({
  id: 'welcome',
  role: 'assistant',
  content: COPILOT_WELCOME,
  timestamp: new Date(),
});

/**
 * Shared brain for the AI Copilot. Used by both the floating chatbot and the
 * full-page AI Studio so both surfaces create assets in exactly the same way.
 */
export function useCopilotEngine() {
  const [messages, setMessages] = useState<CopilotMessage[]>([welcomeMessage()]);
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [reports, setReports] = useState<ReportInfo[]>([]);
  const [formsWithFields, setFormsWithFields] = useState<FormWithFields[]>([]);
  const [copilotEnabled, setCopilotEnabled] = useState(true);
  const { chatbotAssist, generateForm, isLoading } = useFormAI();
  const { currentProject, projects, setCurrentProject } = useProject();
  const location = useLocation();
  const [pendingAction, setPendingAction] = useState<{ action: string; params: Record<string, any>; prompt: string; messageId: string } | null>(null);

  // Fall back to the user's first (default) project so building works even when
  // no project has been explicitly selected yet (e.g. straight after login).
  const activeProject = currentProject || projects[0] || null;

  const executeCopilotAction = useCallback(async (action: string, params: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (!activeProject?.id) {
      throw new Error('No project available. Create a project first, then try again.');
    }

    const { data, error } = await supabase.functions.invoke('ai-copilot-action', {
      body: {
        action,
        params,
        userId: user.id,
        projectId: activeProject.id,
        organizationId: activeProject.organization_id,
      },
    });

    if (error) throw error;
    return data;
  }, [activeProject?.id, activeProject?.organization_id]);

  useEffect(() => {
    const loadData = async () => {
      const projectId = activeProject?.id;
      if (!projectId) return;
      try {
        const [workflowResult, reportResult, formsResult] = await Promise.all([
          supabase.from('workflows').select('id, name, description').eq('project_id', projectId).eq('status', 'active').order('name'),
          supabase.from('reports').select('id, name, description').eq('project_id', projectId).order('name'),
          supabase.from('forms').select('id, name, description, form_fields(id, label, field_type, options, required)').eq('project_id', projectId).order('name'),
        ]);

        if (!workflowResult.error && workflowResult.data) {
          const workflowData = workflowResult.data as Array<{ id: string; name: string; description?: string }>;
          setWorkflows(workflowData.map((w) => ({ id: w.id, name: w.name, description: w.description || undefined })));
        }

        if (!reportResult.error && reportResult.data) {
          const reportData = reportResult.data as Array<{ id: string; name: string; description?: string }>;
          setReports(reportData.map((r) => ({ id: r.id, name: r.name, description: r.description || undefined })));
        }

        if (!formsResult.error && formsResult.data) {
          const formsData = formsResult.data as Array<{
            id: string; name: string; description?: string;
            form_fields?: Array<{ id: string; label: string; field_type: string; options?: unknown; required?: boolean }>;
          }>;
          setFormsWithFields(formsData.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description || undefined,
            fields: (f.form_fields || []).map((field: any) => {
              let parsedOptions: any[] = [];
              if (field.options) {
                try { parsedOptions = typeof field.options === 'string' ? JSON.parse(field.options) : field.options; } catch { parsedOptions = []; }
              }
              return {
                id: field.id,
                label: field.label,
                type: field.field_type,
                options: Array.isArray(parsedOptions) ? parsedOptions.map((o: any, idx: number) => ({
                  id: o.id || `opt-${idx}`,
                  value: o.value || o.label || '',
                  label: o.label || o.value || '',
                })) : [],
                required: field.required || false,
              };
            }),
          })));
        }
      } catch (error) {
        console.error('Error loading AI context data:', error);
      }
    };

    loadData();
  }, [activeProject?.id]);

  const FORM_ACTIONS = ['create_form', 'create_form_with_workflow', 'create_form_with_sla', 'create_form_with_email_template'];

  /**
   * The chat model often returns a thin field list. For any form-creating action we
   * regenerate a complete schema with the dedicated form-generation model (same one
   * used by the Form Builder's "Generate Form with AI") so the created form is fully
   * built out: field types, options, placeholders, tooltips and pages.
   */
  const enrichFormParams = useCallback(async (action: string, params: Record<string, any>, userPrompt: string) => {
    if (!FORM_ACTIONS.includes(action)) return params;

    let fields = params.fields;
    if (typeof fields === 'string') {
      try { fields = JSON.parse(fields); } catch { fields = []; }
    }
    const currentCount = Array.isArray(fields) ? fields.length : 0;

    try {
      const generated = await generateForm(userPrompt);
      const genFields = Array.isArray(generated?.fields) ? generated!.fields : [];
      if (genFields.length > currentCount) {
        const next: Record<string, any> = { ...params, fields: genFields };
        if (action === 'create_form') {
          if (Array.isArray(generated?.pages) && generated!.pages.length > 0) next.pages = generated!.pages;
          if (!next.name && generated?.name) next.name = generated.name;
          if (!next.description && generated?.description) next.description = generated.description;
        } else {
          if (!next.formName && generated?.name) next.formName = generated.name;
          if (!next.formDescription && generated?.description) next.formDescription = generated.description;
        }
        return next;
      }
    } catch (e) {
      console.error('Form schema enrichment failed, using original fields:', e);
    }

    return { ...params, fields: Array.isArray(fields) ? fields : [] };
  }, [generateForm]);

  const buildNavMessage = (result: any): string | null => {
    if (!result) return null;
    if (result.formId && result.workflowId) {
      return `🎉 **Created both!**\n\n• [Open the form](/form-edit/${result.formId})\n• [Open the workflow](/workflow-builder/${result.workflowId})`;
    }
    if (result.formId && result.slaTemplateId) {
      return `🎉 **Form with SLA tracking created!**\n\n• [Open the form](/form-edit/${result.formId})\n• [View SLA Management](/sla-management)`;
    }
    if (result.formId && result.emailTemplateId) {
      return `🎉 **Form with email notifications created!**\n\n• [Open the form](/form-edit/${result.formId})\n• [View Email Templates](/email-templates)`;
    }
    if (result.formId) return `Would you like to [open the form](/form-edit/${result.formId})?`;
    if (result.workflowId && result.nodeId) return `✅ **Email action added!**\n\n• [Open the workflow](/workflow-builder/${result.workflowId})`;
    if (result.workflowId) return `Would you like to [open the workflow](/workflow-builder/${result.workflowId})?`;
    if (result.dashboardId) return `Would you like to [open the dashboard](/dashboard-view/${result.dashboardId})?`;
    if (result.slaTemplateId) return `✅ **SLA tracking configured!**\n\n• [View SLA Management](/sla-management)`;
    return null;
  };

  const sendPrompt = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const chatHistory = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    const result = await chatbotAssist(trimmed, chatHistory, {
      availableForms: formsWithFields,
      availableWorkflows: workflows,
      availableReports: reports,
      currentRoute: location.pathname,
    });

    if (!result) {
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "⚠️ I couldn't reach the AI service just now. Please check your connection and try again.",
        timestamp: new Date(),
      }]);
      return;
    }

    const { message: messageContent, toolCall } = result;

    if (toolCall && copilotEnabled) {
      const assistantMessage: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: messageContent || `Executing **${toolCall.action.replace(/_/g, ' ')}**...`,
        timestamp: new Date(),
        action: { type: toolCall.action, status: 'executing' },
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const params = await enrichFormParams(toolCall.action, toolCall.params || {}, trimmed);
        const actionResult = await executeCopilotAction(toolCall.action, params);
        setMessages((prev) => prev.map((m) => m.id === assistantMessage.id
          ? { ...m, action: { type: toolCall.action, status: 'success' as const, result: actionResult } }
          : m));

        setMessages((prev) => [...prev, {
          id: `result-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Action completed!** ${actionResult?.message || 'Done'}`,
          timestamp: new Date(),
        }]);

        toast.success('Action completed', { description: actionResult?.message });

        const nav = buildNavMessage(actionResult?.result);
        if (nav) {
          setMessages((prev) => [...prev, {
            id: `nav-offer-${Date.now()}`,
            role: 'assistant',
            content: nav,
            timestamp: new Date(),
          }]);
        }
      } catch (err) {
        setMessages((prev) => prev.map((m) => m.id === assistantMessage.id
          ? { ...m, action: { type: toolCall.action, status: 'error' as const } }
          : m));
        const detail = err instanceof Error ? err.message : 'Unknown error';
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `❌ **Action failed:** ${detail}`,
          timestamp: new Date(),
        }]);
        toast.error('Action failed', { description: detail });
      }
    } else {
      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: messageContent,
        timestamp: new Date(),
      }]);
    }
  }, [chatbotAssist, copilotEnabled, enrichFormParams, executeCopilotAction, formsWithFields, isLoading, location.pathname, messages, reports, workflows]);

  const clearChat = useCallback(() => setMessages([welcomeMessage()]), []);

  const appendMessage = useCallback((message: CopilotMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return {
    messages,
    isLoading,
    activeProject,
    copilotEnabled,
    setCopilotEnabled,
    sendPrompt,
    clearChat,
    appendMessage,
    hasConversation: messages.some((m) => m.id !== 'welcome'),
  };
}
