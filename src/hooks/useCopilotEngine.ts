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
  inferLayoutColumnsFromPrompt,
  promptUpdatesExistingForm,
  promptWantsFieldRules,
  type CopilotToolCall,
} from '@/lib/copilotUtils';
import { createFormFromAiGeneration, type AiGeneratedFormSchema } from '@/lib/createFormFromAiGeneration';
import {
  buildUpdatePlanFromFields,
  loadFormPages,
  updateFormFromAiGeneration,
  type AiFieldOp,
  type FormUpdatePlan,
} from '@/lib/updateFormFromAiGeneration';
import type { FieldRule, FormField } from '@/types/form';

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
  /** Form created/updated in this chat — used as default target for field edits. */
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [activeFormName, setActiveFormName] = useState<string | null>(null);
  const {
    chatbotAssist,
    generateForm,
    generateFormUpdate,
    suggestWorkflow,
    generateReportComponent,
    suggestFieldRules,
    isLoading,
  } = useFormAI();
  const { currentProject, projects, setCurrentProject } = useProject();
  const { user } = useAuth();
  const location = useLocation();
  const { hasPermission } = useUnifiedAccessControl();
  const [pendingAction, setPendingAction] = useState<{ action: string; params: Record<string, any>; prompt: string; messageId: string } | null>(null);
  const chatHydratedRef = useRef(false);
  const activeFormIdRef = useRef<string | null>(null);
  activeFormIdRef.current = activeFormId;

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

  // Restore chat history per user + project, and recover the active form from that chat.
  useEffect(() => {
    chatHydratedRef.current = false;
    setActiveFormId(null);
    setActiveFormName(null);
    activeFormIdRef.current = null;
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
          for (let i = restored.length - 1; i >= 0; i -= 1) {
            const action = restored[i].action;
            if (action?.status !== 'success') continue;
            const formId = action.result?.result?.formId as string | undefined;
            const formName = action.result?.result?.formName as string | undefined;
            if (formId && (FORM_CREATE_ACTIONS.has(action.type) || action.type === 'update_form')) {
              setActiveFormId(formId);
              setActiveFormName(formName || null);
              activeFormIdRef.current = formId;
              break;
            }
          }
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

    if (error) {
      throw new Error(error.message || 'Action failed');
    }
    if (!data) {
      throw new Error('Empty response from server');
    }
    if (typeof data === 'object' && 'success' in data && (data as { success?: boolean }).success === false) {
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
    const currentFields = Array.isArray(fields) ? fields : [];
    const fieldsLookComplete = currentFields.length >= 2
      && currentFields.every((f) => f?.label && f?.type);

    try {
      if (action === 'create_form' || !fieldsLookComplete) {
        const generated = await generateForm(userPrompt);
        const genFields = Array.isArray(generated?.fields) ? generated!.fields : [];
        if (genFields.length > 0) {
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
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/rate limit|credits exhausted|429|402/i.test(msg)) {
        throw e;
      }
      console.error('Form schema enrichment failed, using original fields:', e);
    }

    return { ...params, fields: currentFields };
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

  const rememberActiveForm = useCallback((formId: string, formName?: string) => {
    setActiveFormId(formId);
    setActiveFormName(formName || null);
    activeFormIdRef.current = formId;
  }, []);

  /** Same path as Forms → Generate with AI (frontend API, not copilot edge action). */
  const createClientFormFromPrompt = useCallback(async (
    userPrompt: string,
    seed?: { name?: string; description?: string },
  ) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.id) throw new Error('Not authenticated');
    if (!activeProject?.id || !activeProject.organization_id) {
      throw new Error('No project available. Create a project first, then try again.');
    }
    if (!hasPermission('forms', 'create')) {
      throw new Error("You don't have permission to create forms in this project.");
    }

    const generated = await generateForm(userPrompt);
    if (!generated?.fields?.length) {
      throw new Error('AI could not generate form fields. Describe the fields you need and try again.');
    }

    const schema: AiGeneratedFormSchema = {
      name: seed?.name || generated.name || 'New Form',
      description: seed?.description || generated.description || '',
      fields: generated.fields,
      pages: generated.pages,
      suggestedLayout: generated.suggestedLayout,
    };

    return createFormFromAiGeneration(schema, {
      projectId: activeProject.id,
      organizationId: activeProject.organization_id,
      userId: authUser.id,
    });
  }, [activeProject?.id, activeProject?.organization_id, generateForm, hasPermission]);

  /** Update fields on an existing form instead of creating a duplicate. */
  const updateClientFormFromPrompt = useCallback(async (
    formId: string,
    userPrompt: string,
    seedFields?: Array<Record<string, any>>,
    pageHint?: {
      targetPageName?: string;
      targetPageIndex?: number;
      pagesToAdd?: Array<{ name: string }>;
      layoutColumns?: 1 | 2 | 3;
      operations?: Array<Record<string, any>>;
    },
  ) => {
    if (!hasPermission('forms', 'update', formId) && !hasPermission('forms', 'update')) {
      throw new Error("You don't have permission to update this form.");
    }

    const existing = formsWithFields.find((f) => f.id === formId);
    const pages = await loadFormPages(formId);
    const sortedPages = [...pages].sort((a, b) => a.order - b.order);
    const layoutFromPrompt = pageHint?.layoutColumns || inferLayoutColumnsFromPrompt(userPrompt);

    let plan: FormUpdatePlan = {
      fields: [],
      pagesToAdd: pageHint?.pagesToAdd,
      layoutColumns: layoutFromPrompt,
    };

    const seedOps = Array.isArray(pageHint?.operations) && pageHint!.operations!.length > 0
      ? pageHint!.operations!
      : (Array.isArray(seedFields) ? seedFields : []);

    if (seedOps.length > 0) {
      plan = buildUpdatePlanFromFields(seedOps as AiFieldOp[], {
        pagesToAdd: pageHint?.pagesToAdd,
        layoutColumns: layoutFromPrompt,
      });
    } else {
      try {
        const generated = await generateFormUpdate(userPrompt, {
          formName: existing?.name,
          formDescription: existing?.description,
          existingFields: (existing?.fields || []).map((f) => ({
            id: f.id,
            label: f.label,
            type: f.type,
            required: f.required,
            options: f.options?.map((o) => ({ value: o.value, label: o.label })),
          })),
          existingPages: sortedPages.map((p) => ({
            name: p.name,
            fieldCount: p.fields.length,
            order: p.order,
          })),
        });

        if (generated) {
          plan = {
            fields: (Array.isArray(generated.fields) ? generated.fields : []) as AiFieldOp[],
            pagesToAdd: generated.pagesToAdd || pageHint?.pagesToAdd,
            layoutColumns: generated.layoutColumns || layoutFromPrompt,
            applyFieldRules: generated.applyFieldRules,
          };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (/rate limit|credits exhausted|429|402/i.test(msg)) throw e;
        console.error('generateFormUpdate failed, falling back to generateForm:', e);
      }

      // Fallback: add-only generation when dedicated update plan is empty
      if (!plan.fields?.length && !plan.pagesToAdd?.length && !plan.layoutColumns) {
        const pageSummary = sortedPages.length
          ? sortedPages.map((p, idx) => `${idx + 1}. "${p.name}" (${p.fields.length} fields)`).join('; ')
          : '1. "Page 1"';
        const existingSummary = existing?.fields?.length
          ? existing.fields.map((f) => `${f.label} (${f.type})`).join(', ')
          : 'unknown';
        const generated = await generateForm(
          [
            `Update an EXISTING form. Do NOT invent a brand-new form.`,
            `Existing form name: ${existing?.name || 'Form'}`,
            `Existing pages (use these exact names when placing fields; create the page if missing): ${pageSummary}`,
            `Existing fields: ${existingSummary}`,
            `User change request: ${userPrompt}`,
            `Return ONLY fields involved in the change (new fields to add, or fields to change with full props).`,
            `Include pageName on each field when the user names a page.`,
            `Include defaultValue, validation, placeholder, options, isFullWidth when relevant.`,
          ].join('\n'),
        );
        plan = buildUpdatePlanFromFields(
          (Array.isArray(generated?.fields) ? generated!.fields : []) as AiFieldOp[],
          { layoutColumns: layoutFromPrompt, pagesToAdd: pageHint?.pagesToAdd },
        );
      }
    }

    if (!plan.fields?.length && !plan.pagesToAdd?.length && !plan.layoutColumns) {
      throw new Error('AI could not determine which form changes to make. Be more specific about fields, pages, or layout.');
    }

    let fieldRulesToAppend: FieldRule[] | undefined;
    const wantsRules = plan.applyFieldRules || promptWantsFieldRules(userPrompt);
    if (wantsRules && existing?.fields?.length) {
      try {
        const suggestion = await suggestFieldRules(
          existing.fields.map((f) => ({
            id: f.id,
            type: f.type as FormField['type'],
            label: f.label,
            required: f.required,
            options: f.options,
          })) as FormField[],
          userPrompt,
          { formName: existing.name, formDescription: existing.description },
        );
        if (suggestion?.rules?.length) {
          fieldRulesToAppend = suggestion.rules.map((rule, idx) => ({
            id: `ai-rule-${Date.now()}-${idx}`,
            name: rule.name,
            targetFieldId: rule.targetFieldId,
            conditions: (rule.conditions || []).map((c, cIdx) => ({
              id: `ai-cond-${Date.now()}-${idx}-${cIdx}`,
              fieldId: c.fieldId,
              operator: (c.operator || '==') as NonNullable<FieldRule['conditions']>[number]['operator'],
              value: c.value,
            })),
            logicExpression: rule.logicExpression || '1',
            action: rule.action as FieldRule['action'],
            actionValue: rule.actionValue,
            isActive: true,
          }));
        }
      } catch (e) {
        console.error('Field rule suggestion failed during form update:', e);
      }
    }

    return updateFormFromAiGeneration(
      formId,
      plan,
      {
        targetPageName: pageHint?.targetPageName,
        targetPageIndex: pageHint?.targetPageIndex,
        userPrompt,
        layoutColumns: plan.layoutColumns,
        pagesToAdd: plan.pagesToAdd,
        fieldRulesToAppend,
      },
    );
  }, [formsWithFields, generateForm, generateFormUpdate, hasPermission, suggestFieldRules]);

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
      return `🎉 **Created both!**\n\n• [View Form](/forms)\n• [Open the workflow](/workflow-designer/${result.workflowId})`;
    }
    if (result.formId && result.slaTemplateId) {
      return `🎉 **Form with SLA tracking created!**\n\n• [View Form](/forms)\n• [View SLA Management](/sla-management)`;
    }
    if (result.formId && result.emailTemplateId) {
      return `🎉 **Form with email notifications created!**\n\n• [View Form](/forms)\n• [View Email Templates](/email-templates)`;
    }
    if (result.formId && result.updated) {
      return `✅ **Form updated.** Preview refreshes beside chat, or [View Form](/forms) in your list.`;
    }
    if (result.formId) return `Would you like to [View Form](/forms)?`;
    if (result.workflowId && result.nodeId) return `✅ **Email action added!**\n\n• [Open the workflow](/workflow-designer/${result.workflowId})`;
    if (result.workflowId) return `Would you like to [open the workflow](/workflow-designer/${result.workflowId})?`;
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
      let actionResult: { message?: string; result?: Record<string, unknown> };

      if (action === 'create_form') {
        const created = await createClientFormFromPrompt(prompt, {
          name: rawParams.name,
          description: rawParams.description,
        });
        rememberActiveForm(created.formId, created.formName);
        actionResult = {
          message: `Created form "${created.formName}" with ${created.pageCount} page(s) and ${created.fieldCount} field(s)! Further field changes in this chat will update this form.`,
          result: {
            formId: created.formId,
            formName: created.formName,
            pageCount: created.pageCount,
            fieldCount: created.fieldCount,
          },
        };
      } else if (action === 'update_form') {
        const targetFormId = rawParams.formId || formIdForEnrichment || activeFormIdRef.current;
        if (!targetFormId) {
          throw new Error('Select which form to update, or create a form first in this chat.');
        }
        const targetPageIndex = typeof rawParams.targetPageIndex === 'number'
          ? rawParams.targetPageIndex
          : (typeof rawParams.pageIndex === 'number' ? rawParams.pageIndex : undefined);
        const targetPageName = typeof rawParams.targetPageName === 'string'
          ? rawParams.targetPageName
          : (typeof rawParams.pageName === 'string' ? rawParams.pageName : undefined);
        const layoutColumns = [1, 2, 3].includes(Number(rawParams.layoutColumns))
          ? Number(rawParams.layoutColumns) as 1 | 2 | 3
          : undefined;
        const pagesToAdd = Array.isArray(rawParams.pagesToAdd) ? rawParams.pagesToAdd : undefined;
        const operations = Array.isArray(rawParams.operations) ? rawParams.operations : undefined;
        const seedFields = Array.isArray(rawParams.fields) ? rawParams.fields : undefined;
        const updated = await updateClientFormFromPrompt(
          targetFormId,
          prompt,
          seedFields,
          { targetPageName, targetPageIndex, pagesToAdd, layoutColumns, operations },
        );
        rememberActiveForm(updated.formId, updated.formName);
        const pageNote = updated.targetPageName ? ` (page: "${updated.targetPageName}")` : '';
        actionResult = {
          message: `Updated form "${updated.formName}" — ${updated.summary}${pageNote}. Now ${updated.totalFieldCount} field(s) total.`,
          result: {
            formId: updated.formId,
            formName: updated.formName,
            fieldCount: updated.addedFieldCount + updated.updatedFieldCount,
            targetPageName: updated.targetPageName,
            summary: updated.summary,
            updated: true,
          },
        };
      } else if (action === 'create_form_with_workflow') {
        const created = await createClientFormFromPrompt(prompt, {
          name: rawParams.formName || rawParams.name,
          description: rawParams.formDescription || rawParams.description,
        });
        rememberActiveForm(created.formId, created.formName);
        const workflowParams = await enrichWorkflowParams(
          'create_workflow',
          {
            name: rawParams.workflowName || `${created.formName} Workflow`,
            description: rawParams.workflowDescription || `Workflow for ${created.formName}`,
            nodes: rawParams.workflowNodes,
            triggerFormId: created.formId,
          },
          prompt,
          created.formId,
        );
        const wfResult = await executeCopilotAction('create_workflow', workflowParams);
        actionResult = {
          message: `Created form "${created.formName}" and workflow! Further field changes in this chat will update this form.`,
          result: {
            formId: created.formId,
            formName: created.formName,
            workflowId: (wfResult as { result?: { workflowId?: string } })?.result?.workflowId,
          },
        };
      } else {
        const params = await enrichActionParams(
          action,
          rawParams,
          prompt,
          formIdForEnrichment || rawParams.triggerFormId || rawParams.formId,
        );
        actionResult = await executeCopilotAction(action, params);
        const resultFormId = actionResult?.result?.formId as string | undefined;
        if (resultFormId && (FORM_CREATE_ACTIONS.has(action) || action === 'update_form')) {
          rememberActiveForm(resultFormId, actionResult?.result?.formName as string | undefined);
        }
      }
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
      const detail = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Unknown error');
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Action failed:** ${detail}`,
        timestamp: new Date(),
      }]);
      toast.error('Action failed', { description: detail });
      throw err;
    }
  }, [createClientFormFromPrompt, enrichActionParams, enrichWorkflowParams, executeCopilotAction, loadContext, rememberActiveForm, updateClientFormFromPrompt]);

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
      } else if (action === 'update_form' && activeFormIdRef.current) {
        // Prefer the form created earlier in this chat session.
        params[formKey] = activeFormIdRef.current;
      } else {
        const lower = trimmed.toLowerCase();
        const match = formsWithFields.find((f) => f.name && lower.includes(f.name.toLowerCase()));
        if (match) params[formKey] = match.id;
      }
    }

    // Reject hallucinated form ids from the model (allow session active form even if context refresh lags)
    const formId = params[formKey];
    const knownIds = new Set(formsWithFields.map((f) => f.id));
    if (activeFormIdRef.current) knownIds.add(activeFormIdRef.current);
    if (formId && !knownIds.has(formId)) {
      delete params[formKey];
    }

    if (!params[formKey] && formsWithFields.length === 0 && !activeFormIdRef.current) return 'no-forms';
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
        const updateCopy = action === 'update_form'
          ? 'Which form should I update? Pick a form to apply your field changes.'
          : `Which form should this **${action.replace(/_/g, ' ')}** use? Pick the source form to continue.`;
        setMessages((prev) => [...prev, {
          id: clarifyId,
          role: 'assistant',
          content: updateCopy,
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
    const chosen = formsWithFields.find((f) => f.id === formId);
    if (pending.action === 'update_form' || FORM_CREATE_ACTIONS.has(pending.action)) {
      rememberActiveForm(formId, chosen?.name);
    }
    void runToolCall(
      pending.action,
      { ...pending.params, [key]: formId },
      pending.prompt,
      undefined,
      formId,
    );
  }, [formsWithFields, pendingAction, rememberActiveForm, runToolCall]);

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

    const isUpdate = promptUpdatesExistingForm(trimmed);
    const targetFormId = options?.formId || (isUpdate ? activeFormIdRef.current : undefined) || undefined;
    const selectedFromList = targetFormId ? formsWithFields.find((f) => f.id === targetFormId) : undefined;
    const selectedName = selectedFromList?.name
      || (targetFormId && activeFormIdRef.current === targetFormId ? activeFormName : null);

    let promptForModel = trimmed;
    if (isUpdate && targetFormId && selectedName) {
      promptForModel = `${trimmed}\n\n(IMPORTANT: Update the EXISTING form "${selectedName}" (id: ${targetFormId}). Do NOT create a new form. Use the update_form tool / modify that form only.)`;
    } else if (targetFormId && selectedName && !isUpdate) {
      promptForModel = `${trimmed}\n\n(Use the existing form "${selectedName}" (id: ${targetFormId}) as the source/trigger form.)`;
    } else if (isUpdate && !targetFormId) {
      promptForModel = `${trimmed}\n\n(IMPORTANT: This is an edit to an existing form. Prefer update_form over create_form. Ask which form if unclear.)`;
    }

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
      // If the model returned only chat text with no tools but this is clearly an update, force update_form.
      const effectiveCalls = calls.length > 0
        ? calls
        : (isUpdate ? [{ action: 'update_form', params: targetFormId ? { formId: targetFormId } : {} }] : []);
      if (effectiveCalls.length === 0) {
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: messageContent,
          timestamp: new Date(),
        }]);
        return;
      }
      await processToolCalls(effectiveCalls, trimmed, messageContent, targetFormId);
    } else if (copilotEnabled && isUpdate) {
      await processToolCalls(
        [{ action: 'update_form', params: targetFormId ? { formId: targetFormId } : {} }],
        trimmed,
        messageContent || 'Updating the form…',
        targetFormId,
      );
    } else {
      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: messageContent,
        timestamp: new Date(),
      }]);
    }
  }, [activeFormName, chatbotAssist, copilotEnabled, formsWithFields, isLoading, location.pathname, messages, processToolCalls, reports, workflows]);

  const clearChat = useCallback(() => {
    setMessages([welcomeMessage()]);
    setActiveFormId(null);
    setActiveFormName(null);
    activeFormIdRef.current = null;
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
    activeFormId,
    activeFormName,
    setActiveFormId: rememberActiveForm,
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
