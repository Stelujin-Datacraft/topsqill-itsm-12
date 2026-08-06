import { useState, useEffect, useCallback, useRef } from 'react';
import { useFormAI } from '@/hooks/useFormAI';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { backend as supabase } from '@/services/api';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { toast } from 'sonner';
import {
  ACTION_PERMISSIONS,
  CONTEXT_REFRESH_ACTIONS,
  FORM_CREATE_ACTIONS,
  WORKFLOW_CREATE_ACTIONS,
  mapSuggestedWorkflowNodes,
  SUPPORTED_COPILOT_ACTIONS,
  getChatStorageKey,
  getFormParamKey,
  normalizeToolCalls,
  type CopilotToolCall,
} from '@/lib/copilotUtils';

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
  /** When true, render a searchable form picker instead of chip list */
  formPicker?: boolean;
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

function serializeMessages(messages: CopilotMessage[]): string {
  return JSON.stringify(
    messages.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    })),
  );
}

function deserializeMessages(raw: string): CopilotMessage[] | null {
  try {
    const parsed = JSON.parse(raw) as Array<Omit<CopilotMessage, 'timestamp'> & { timestamp: string }>;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return null;
  }
}

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
  const { chatbotAssist, generateForm, suggestWorkflow, generateReportComponent, isLoading } = useFormAI();
  const { currentProject, projects, setCurrentProject } = useProject();
  const { user } = useAuth();
  const location = useLocation();
  const { hasPermission } = useUnifiedAccessControl();
  const [pendingAction, setPendingAction] = useState<{ action: string; params: Record<string, any>; prompt: string; messageId: string } | null>(null);
  const chatHydratedRef = useRef(false);

  const activeProject = currentProject || projects[0] || null;

  const loadContext = useCallback(async () => {
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
  }, [activeProject?.id]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  // Restore chat history per user + project
  useEffect(() => {
    chatHydratedRef.current = false;
    if (!user?.id || !activeProject?.id) {
      setMessages([welcomeMessage()]);
      return;
    }
    try {
      const stored = localStorage.getItem(getChatStorageKey(user.id, activeProject.id));
      if (stored) {
        const restored = deserializeMessages(stored);
        if (restored && restored.length > 0) {
          setMessages(restored);
          chatHydratedRef.current = true;
          return;
        }
      }
    } catch {
      /* storage unavailable */
    }
    setMessages([welcomeMessage()]);
    chatHydratedRef.current = true;
  }, [user?.id, activeProject?.id]);

  // Persist chat history
  useEffect(() => {
    if (!chatHydratedRef.current || !user?.id || !activeProject?.id) return;
    if (messages.length <= 1 && messages[0]?.id === 'welcome') return;
    try {
      localStorage.setItem(getChatStorageKey(user.id, activeProject.id), serializeMessages(messages));
    } catch {
      /* storage full or unavailable */
    }
  }, [messages, user?.id, activeProject?.id]);

  const executeCopilotAction = useCallback(async (action: string, params: Record<string, any>) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');

    if (!activeProject?.id) {
      throw new Error('No project available. Create a project first, then try again.');
    }

    if (!SUPPORTED_COPILOT_ACTIONS.has(action)) {
      throw new Error(`Unsupported action "${action}". Try rephrasing or use the builder UI.`);
    }

    const perm = ACTION_PERMISSIONS[action];
    if (perm && !hasPermission(perm.entity, perm.action)) {
      throw new Error(`You don't have permission to ${perm.action} ${perm.entity} in this project.`);
    }

    const { data, error } = await supabase.functions.invoke('ai-copilot-action', {
      body: {
        action,
        params,
        userId: authUser.id,
        projectId: activeProject.id,
        organizationId: activeProject.organization_id,
      },
    });

    if (error) throw error;
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error((data as { error?: string }).error || 'Action failed');
    }
    return data;
  }, [activeProject?.id, activeProject?.organization_id, hasPermission]);

  const enrichFormParams = useCallback(async (action: string, params: Record<string, any>, userPrompt: string) => {
    if (!FORM_CREATE_ACTIONS.has(action)) return params;

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
      const msg = e instanceof Error ? e.message : '';
      if (/rate limit|credits exhausted|429|402/i.test(msg)) {
        throw e;
      }
      console.error('Form schema enrichment failed, using original fields:', e);
    }

    return { ...params, fields: Array.isArray(fields) ? fields : [] };
  }, [generateForm]);

  const enrichWorkflowParams = useCallback(async (
    action: string,
    params: Record<string, any>,
    userPrompt: string,
    triggerFormId?: string,
  ) => {
    if (!WORKFLOW_CREATE_ACTIONS.has(action)) return params;

    const nodesKey = action === 'create_form_with_workflow' ? 'workflowNodes' : 'nodes';
    let nodes = params[nodesKey];
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes); } catch { nodes = []; }
    }
    const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
    if (nodeCount >= 2) return params;

    const resolvedFormId = triggerFormId || params.triggerFormId || params.formId;
    const triggerForm = resolvedFormId
      ? formsWithFields.find((f) => f.id === resolvedFormId)
      : undefined;

    const syntheticTrigger = action === 'create_form_with_workflow' && !triggerForm
      ? {
          id: 'pending',
          name: params.formName || params.name || 'New Form',
          fields: (Array.isArray(params.fields) ? params.fields : []).map((f: any, idx: number) => ({
            id: f.id || `field_${idx}`,
            label: f.label,
            type: f.type || 'text',
            options: f.options,
          })),
        }
      : triggerForm
        ? { id: triggerForm.id, name: triggerForm.name, fields: triggerForm.fields }
        : undefined;

    try {
      const suggested = await suggestWorkflow(userPrompt, {
        triggerForm: syntheticTrigger,
      });
      if (suggested?.nodes?.length) {
        const mappedNodes = mapSuggestedWorkflowNodes(suggested.nodes);
        return {
          ...params,
          [nodesKey]: mappedNodes,
          name: params.name || suggested.name,
          description: params.description || suggested.description,
          workflowName: params.workflowName || suggested.name,
          workflowDescription: params.workflowDescription || suggested.description,
          triggerFormId: params.triggerFormId || resolvedFormId,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/rate limit|credits exhausted|429|402/i.test(msg)) throw e;
      console.error('Workflow enrichment failed, using original nodes:', e);
    }

    return params;
  }, [formsWithFields, suggestWorkflow]);

  const enrichReportParams = useCallback(async (
    action: string,
    params: Record<string, any>,
    userPrompt: string,
    formId?: string,
  ) => {
    if (action !== 'create_report') return params;
    if (params.chartConfig) return params;

    const resolvedFormId = formId || params.formId;
    if (!resolvedFormId) return params;

    const form = formsWithFields.find((f) => f.id === resolvedFormId);
    if (!form) return params;

    try {
      const chartConfig = await generateReportComponent(userPrompt, {
        formId: form.id,
        formName: form.name,
        fields: form.fields.map((f) => ({ id: f.id, label: f.label, type: f.type })),
      });
      if (chartConfig) {
        return {
          ...params,
          formId: resolvedFormId,
          name: params.name || chartConfig.title,
          description: params.description || chartConfig.description,
          chartConfig,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/rate limit|credits exhausted|429|402/i.test(msg)) throw e;
      console.error('Report enrichment failed:', e);
    }

    return params;
  }, [formsWithFields, generateReportComponent]);

  const enrichActionParams = useCallback(async (
    action: string,
    params: Record<string, any>,
    userPrompt: string,
    formId?: string,
  ) => {
    let next = await enrichFormParams(action, params, userPrompt);
    next = await enrichWorkflowParams(action, next, userPrompt, formId || next.triggerFormId || next.formId);
    next = await enrichReportParams(action, next, userPrompt, formId || next.formId || next.triggerFormId);
    return next;
  }, [enrichFormParams, enrichReportParams, enrichWorkflowParams]);

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
    if (result.reportId) return `Would you like to [open the report](/report-editor/${result.reportId})?`;
    if (result.slaTemplateId) return `✅ **SLA tracking configured!**\n\n• [View SLA Management](/sla-management)`;
    return null;
  };

  const runToolCall = useCallback(async (
    action: string,
    rawParams: Record<string, any>,
    prompt: string,
    headline?: string,
    formIdForEnrichment?: string,
  ) => {
    const assistantMessage: CopilotMessage = {
      id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'assistant',
      content: headline || `Executing **${action.replace(/_/g, ' ')}**...`,
      timestamp: new Date(),
      action: { type: action, status: 'executing' },
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const params = await enrichActionParams(
        action,
        rawParams,
        prompt,
        formIdForEnrichment || rawParams.triggerFormId || rawParams.formId,
      );
      const actionResult = await executeCopilotAction(action, params);
      setMessages((prev) => prev.map((m) => m.id === assistantMessage.id
        ? { ...m, action: { type: action, status: 'success' as const, result: actionResult } }
        : m));

      setMessages((prev) => [...prev, {
        id: `result-${Date.now()}`,
        role: 'assistant',
        content: `✅ **Action completed!** ${actionResult?.message || 'Done'}`,
        timestamp: new Date(),
      }]);

      toast.success('Action completed', { description: actionResult?.message });

      if (CONTEXT_REFRESH_ACTIONS.has(action)) {
        await loadContext();
      }

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
        ? { ...m, action: { type: action, status: 'error' as const } }
        : m));
      const detail = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Action failed:** ${detail}`,
        timestamp: new Date(),
      }]);
      toast.error('Action failed', { description: detail });
      throw err;
    }
  }, [enrichActionParams, executeCopilotAction, loadContext]);

  const resolveFormParams = useCallback((
    action: string,
    params: Record<string, any>,
    trimmed: string,
    formIdOverride?: string,
  ): Record<string, any> | 'needs-clarification' | 'no-forms' => {
    const formKey = getFormParamKey(action);
    if (!formKey) return params;

    // AI often sends formId instead of triggerFormId for workflows
    if (formKey === 'triggerFormId' && !params.triggerFormId && params.formId) {
      params.triggerFormId = params.formId;
    }

    if (!params[formKey]) {
      if (formIdOverride) {
        params[formKey] = formIdOverride;
      } else {
        const lower = trimmed.toLowerCase();
        const match = formsWithFields.find((f) => f.name && lower.includes(f.name.toLowerCase()));
        if (match) params[formKey] = match.id;
      }
    }

    // Reject hallucinated form ids from the model
    const formId = params[formKey];
    if (formId && !formsWithFields.some((f) => f.id === formId)) {
      delete params[formKey];
    }

    if (!params[formKey] && formsWithFields.length === 0) return 'no-forms';
    if (!params[formKey]) return 'needs-clarification';
    return params;
  }, [formsWithFields]);

  const processToolCalls = useCallback(async (
    toolCalls: CopilotToolCall[],
    trimmed: string,
    messageContent: string,
    formIdOverride?: string,
  ) => {
    const normalized = normalizeToolCalls(toolCalls, trimmed);
    if (normalized.length === 0) {
      setMessages((prev) => [...prev, {
        id: `unsupported-${Date.now()}`,
        role: 'assistant',
        content: "⚠️ I understood your request but couldn't map it to a supported build action. Try being more specific, or use **AI Builder** suggestions.",
        timestamp: new Date(),
      }]);
      return;
    }

    for (let i = 0; i < normalized.length; i++) {
      const { action, params: rawParams } = normalized[i];
      const params: Record<string, any> = { ...(rawParams || {}) };
      const resolved = resolveFormParams(action, params, trimmed, formIdOverride);

      if (resolved === 'no-forms') {
        setMessages((prev) => [...prev, {
          id: `need-form-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **A form is required first.**\n\nA **${action.replace(/_/g, ' ')}** reads from form data, but **${activeProject?.name || 'this project'}** has no forms yet.\n\nAsk me to create the form first (e.g. *"Create a form for …"*), then I can build this on top of it.`,
          timestamp: new Date(),
        }]);
        return;
      }

      if (resolved === 'needs-clarification') {
        const clarifyId = `clarify-${Date.now()}`;
        setPendingAction({ action, params, prompt: trimmed, messageId: clarifyId });
        setMessages((prev) => [...prev, {
          id: clarifyId,
          role: 'assistant',
          content: `Which form should this **${action.replace(/_/g, ' ')}** use? Pick the source form to continue.`,
          timestamp: new Date(),
          formPicker: true,
          choices: formsWithFields.map((f) => ({ label: f.name, value: f.id })),
        }]);
        return;
      }

      const headline = i === 0 ? messageContent : `Continuing with **${action.replace(/_/g, ' ')}**…`;
      const formIdForEnrichment = resolved.triggerFormId || resolved.formId;
      await runToolCall(action, resolved, trimmed, headline, formIdForEnrichment);
    }
  }, [activeProject?.name, formsWithFields, resolveFormParams, runToolCall]);

  const resolveFormChoice = useCallback((messageId: string, formId: string) => {
    const pending = pendingAction;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, resolved: true } : m)));
    if (!pending || pending.messageId !== messageId) return;
    setPendingAction(null);
    const key = getFormParamKey(pending.action) || 'formId';
    void runToolCall(
      pending.action,
      { ...pending.params, [key]: formId },
      pending.prompt,
      formId,
    );
  }, [pendingAction, runToolCall]);

  const sendPrompt = useCallback(async (text: string, options?: { formId?: string }) => {
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

    const selectedForm = options?.formId ? formsWithFields.find((f) => f.id === options.formId) : undefined;
    const promptForModel = selectedForm
      ? `${trimmed}\n\n(Use the existing form "${selectedForm.name}" (id: ${selectedForm.id}) as the source/trigger form.)`
      : trimmed;

    const result = await chatbotAssist(promptForModel, chatHistory, {
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

    const { message: messageContent, toolCall, toolCalls } = result;

    if (copilotEnabled && (toolCalls?.length || toolCall)) {
      const calls: CopilotToolCall[] = toolCalls?.length
        ? toolCalls
        : toolCall
          ? [{ action: toolCall.action, params: toolCall.params }]
          : [];
      await processToolCalls(calls, trimmed, messageContent, options?.formId);
    } else {
      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: messageContent,
        timestamp: new Date(),
      }]);
    }
  }, [chatbotAssist, copilotEnabled, formsWithFields, isLoading, location.pathname, messages, processToolCalls, reports, workflows]);

  const clearChat = useCallback(() => {
    setMessages([welcomeMessage()]);
    if (user?.id && activeProject?.id) {
      try {
        localStorage.removeItem(getChatStorageKey(user.id, activeProject.id));
      } catch {
        /* ignore */
      }
    }
  }, [user?.id, activeProject?.id]);

  const appendMessage = useCallback((message: CopilotMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return {
    messages,
    isLoading,
    activeProject,
    projects,
    setCurrentProject,
    availableForms: formsWithFields,
    copilotEnabled,
    setCopilotEnabled,
    sendPrompt,
    clearChat,
    appendMessage,
    resolveFormChoice,
    reloadContext: loadContext,
    hasConversation: messages.some((m) => m.id !== 'welcome'),
  };
}
