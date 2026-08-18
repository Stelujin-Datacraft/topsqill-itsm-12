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
  promptCreatesNewForm,
  promptCreatesReport,
  promptUpdatesExistingForm,
  promptUpdatesExistingReport,
  promptUpdatesExistingWorkflow,
  promptWantsFieldRules,
  promptWantsWorkflowOnExistingForm,
  promptWantsFormAndWorkflow,
  type CopilotToolCall,
  type CopilotCreateType,
} from '@/lib/copilotUtils';
import { enrichWorkflowNodesFromPrompt } from '@/lib/ai/inferWorkflowIntent';
import { createFormFromAiGeneration, type AiGeneratedFormSchema } from '@/lib/createFormFromAiGeneration';
import {
  buildUpdatePlanFromFields,
  loadFormPages,
  updateFormFromAiGeneration,
  type AiFieldOp,
  type FormUpdatePlan,
} from '@/lib/updateFormFromAiGeneration';
import { useConditionResolution } from '@/hooks/useConditionResolution';
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
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const {
    chatbotAssist,
    generateForm,
    generateFormUpdate,
    suggestWorkflow,
    generateReportComponent,
    suggestFieldRules,
    generateContent,
    isLoading,
  } = useFormAI();
  const {
    resolveWorkflowConditionsInteractive,
    conditionResolutionDialogs,
  } = useConditionResolution();
  const { currentProject, projects, setCurrentProject } = useProject();
  const { user } = useAuth();
  const location = useLocation();
  const { hasPermission } = useUnifiedAccessControl();
  const [pendingAction, setPendingAction] = useState<{ action: string; params: Record<string, any>; prompt: string; messageId: string } | null>(null);
  const chatHydratedRef = useRef(false);
  const activeFormIdRef = useRef<string | null>(null);
  const activeWorkflowIdRef = useRef<string | null>(null);
  const activeReportIdRef = useRef<string | null>(null);
  activeFormIdRef.current = activeFormId;
  activeWorkflowIdRef.current = activeWorkflowId;
  activeReportIdRef.current = activeReportId;

  const activeProject = currentProject || projects[0] || null;

  const loadContext = useCallback(async () => {
    const projectId = activeProject?.id;
    if (!projectId) return;
    try {
      const [workflowResult, reportResult, formsResult] = await Promise.all([
        supabase.from('workflows').select('id, name, description').eq('project_id', projectId).order('name'),
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

    const resolvedFormId = triggerFormId || params.triggerFormId || params.formId;
    const triggerForm = resolvedFormId
      ? formsWithFields.find((f) => f.id === resolvedFormId)
      : undefined;

    const normalizeOpts = {
      triggerFormId: resolvedFormId || undefined,
      triggerFormName: triggerForm?.name || params.triggerFormName || params.formName || params.name,
    };

    const applyPromptIntent = (mapped: any[], fields?: Array<{ id: string; label: string; type: string; options?: any[] }>) => {
      if (!fields?.length || !userPrompt) return mapped;
      return enrichWorkflowNodesFromPrompt(mapped, userPrompt, fields, {
        formId: resolvedFormId || undefined,
        formName: normalizeOpts.triggerFormName,
      });
    };

    // Always normalize existing AI nodes (start form, connections, action/condition values)
    if (nodeCount >= 2) {
      const mapped = mapSuggestedWorkflowNodes(nodes, normalizeOpts);
      return {
        ...params,
        [nodesKey]: applyPromptIntent(mapped, triggerForm?.fields),
        triggerFormId: params.triggerFormId || resolvedFormId,
        triggerFormName: params.triggerFormName || normalizeOpts.triggerFormName,
      };
    }

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
        const mappedNodes = mapSuggestedWorkflowNodes(suggested.nodes, {
          triggerFormId: resolvedFormId || (syntheticTrigger?.id !== 'pending' ? syntheticTrigger?.id : undefined),
          triggerFormName: normalizeOpts.triggerFormName || syntheticTrigger?.name,
        });
        return {
          ...params,
          [nodesKey]: applyPromptIntent(mappedNodes, syntheticTrigger?.fields || triggerForm?.fields),
          name: params.name || suggested.name,
          description: params.description || suggested.description,
          workflowName: params.workflowName || suggested.name,
          workflowDescription: params.workflowDescription || suggested.description,
          triggerFormId: params.triggerFormId || resolvedFormId,
          triggerFormName: params.triggerFormName || normalizeOpts.triggerFormName,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/rate limit|credits exhausted|429|402/i.test(msg)) throw e;
      console.error('Workflow enrichment failed, using original nodes:', e);
    }

    if (Array.isArray(nodes) && nodes.length > 0) {
      const mapped = mapSuggestedWorkflowNodes(nodes, normalizeOpts);
      return {
        ...params,
        [nodesKey]: applyPromptIntent(mapped, triggerForm?.fields || syntheticTrigger?.fields),
        triggerFormId: params.triggerFormId || resolvedFormId,
        triggerFormName: params.triggerFormName || normalizeOpts.triggerFormName,
      };
    }

    return params;
  }, [formsWithFields, suggestWorkflow]);

  /**
   * Resolve AI condition/action field refs against live form metadata.
   * Auto-creates missing fields/options from the prompt so the workflow can complete.
   */
  const confirmWorkflowConditionParams = useCallback(async (
    params: Record<string, any>,
    nodesKey: 'nodes' | 'workflowNodes' = 'nodes',
    userPrompt?: string,
  ) => {
    let nodes = params[nodesKey];
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes); } catch { nodes = []; }
    }
    if (!Array.isArray(nodes) || nodes.length === 0) return params;

    const defaultFormId = params.triggerFormId || params.formId || activeFormIdRef.current || undefined;

    // Prefer live DB metadata so post-create flows see newly inserted fields
    let formsForResolve: FormWithFields[] = formsWithFields;
    if (defaultFormId) {
      try {
        const { data: formRow } = await supabase
          .from('forms')
          .select('id, name, description, form_fields(id, label, field_type, options, required)')
          .eq('id', defaultFormId)
          .maybeSingle();
        if (formRow) {
          const fields = ((formRow as any).form_fields || []).map((field: any) => {
            let parsedOptions: any[] = [];
            if (field.options) {
              try {
                parsedOptions = typeof field.options === 'string' ? JSON.parse(field.options) : field.options;
              } catch {
                parsedOptions = [];
              }
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
          });
          formsForResolve = [{
            id: formRow.id,
            name: formRow.name,
            description: formRow.description || undefined,
            fields,
          }];
        }
      } catch (e) {
        console.error('Failed to refresh form fields for condition resolution:', e);
      }
    }

    if (formsForResolve.length === 0) {
      formsForResolve = defaultFormId
        ? [{
            id: defaultFormId,
            name: 'Form',
            fields: (Array.isArray(params.fields) ? params.fields : []).map((f: any, idx: number) => ({
              id: f.id || `field_${idx}`,
              label: f.label,
              type: f.type || 'text',
              options: f.options,
              required: Boolean(f.required),
            })),
          }]
        : [];
    }

    if (formsForResolve.length === 0) return params;

    try {
      const resolved = await resolveWorkflowConditionsInteractive({
        nodes,
        forms: formsForResolve,
        defaultFormId: defaultFormId || formsForResolve[0]?.id,
        mode: 'auto',
        userPrompt: userPrompt || params.description || params.name || '',
        onMetadataChanged: async () => {
          await loadContext();
        },
      });
      return {
        ...params,
        [nodesKey]: resolved.nodes,
        triggerFormId: params.triggerFormId || defaultFormId,
      };
    } catch (e) {
      console.error('Condition resolution failed, continuing with original nodes:', e);
      return params;
    }
  }, [formsWithFields, loadContext, resolveWorkflowConditionsInteractive]);

  const enrichReportParams = useCallback(async (
    action: string,
    params: Record<string, any>,
    userPrompt: string,
    formId?: string,
  ) => {
    if (action !== 'create_report' && action !== 'update_report') return params;
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
          reportId: params.reportId || activeReportIdRef.current || undefined,
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

    return {
      ...params,
      formId: resolvedFormId,
      reportId: params.reportId || activeReportIdRef.current || undefined,
    };
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
          message: `Created and published form "${created.formName}" with ${created.pageCount} page(s) and ${created.fieldCount} field(s)! Further field changes in this chat will update this form.`,
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
        // If this is NOT a greenfield "new form + workflow" request, reuse the selected form.
        const existingFormId = formIdForEnrichment || rawParams.triggerFormId || rawParams.formId;
        const existingForm = existingFormId
          ? formsWithFields.find((f) => f.id === existingFormId)
          : undefined;
        const reuseExisting = Boolean(existingForm)
          && (
            promptWantsWorkflowOnExistingForm(prompt)
            || !promptCreatesNewForm(prompt)
          )
          && !/\b(create|make|build|set up|design|generate)\s+(a\s+|an\s+|the\s+)?(new\s+)?forms?\b/.test(prompt.toLowerCase());

        if (reuseExisting && existingForm) {
          rememberActiveForm(existingForm.id, existingForm.name);
          let workflowParams = await enrichWorkflowParams(
            'create_workflow',
            {
              name: rawParams.workflowName || rawParams.name || `${existingForm.name} Workflow`,
              description: rawParams.workflowDescription || rawParams.description || `Workflow for ${existingForm.name}`,
              nodes: rawParams.workflowNodes || rawParams.nodes,
              triggerFormId: existingForm.id,
            },
            prompt,
            existingForm.id,
          );
          workflowParams = await confirmWorkflowConditionParams(workflowParams, 'nodes', prompt);
          const wfResult = await executeCopilotAction('create_workflow', workflowParams);
          const workflowId = (wfResult as { result?: { workflowId?: string } })?.result?.workflowId;
          if (workflowId) {
            setActiveWorkflowId(workflowId);
            activeWorkflowIdRef.current = workflowId;
          }
          actionResult = {
            message: `Created workflow for existing form "${existingForm.name}" (did not create a new form).`,
            result: {
              formId: existingForm.id,
              formName: existingForm.name,
              workflowId,
            },
          };
        } else {
          const created = await createClientFormFromPrompt(prompt, {
            name: rawParams.formName || rawParams.name,
            description: rawParams.formDescription || rawParams.description,
          });
          rememberActiveForm(created.formId, created.formName);
          let workflowParams = await enrichWorkflowParams(
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
          workflowParams = await confirmWorkflowConditionParams(workflowParams, 'nodes', prompt);
          const wfResult = await executeCopilotAction('create_workflow', workflowParams);
          const workflowId = (wfResult as { result?: { workflowId?: string } })?.result?.workflowId;
          if (workflowId) {
            setActiveWorkflowId(workflowId);
            activeWorkflowIdRef.current = workflowId;
          }
          actionResult = {
            message: `Created and published form "${created.formName}" with an active workflow! Further field changes in this chat will update this form.`,
            result: {
              formId: created.formId,
              formName: created.formName,
              workflowId,
            },
          };
        }
      } else if (action === 'create_knowledge_doc') {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error('Not authenticated');
        if (!activeProject?.id) throw new Error('No project available. Create a project first, then try again.');

        const formId = rawParams.formId || formIdForEnrichment;
        if (!formId) throw new Error('Select a source form for this knowledge doc.');

        const linkedForm = formsWithFields.find((f) => f.id === formId);
        const docName = String(rawParams.name || rawParams.title || '').trim()
          || prompt.replace(/^(create|make|build|draft|write|generate)\s+(a\s+|an\s+|the\s+)?/i, '').slice(0, 80)
          || 'Knowledge Document';

        let contentHtml = '';
        try {
          const generated = await generateContent('response', prompt, {
            tone: 'professional',
            formName: linkedForm?.name,
            outputFormat: 'html',
          });
          contentHtml = generated?.text || generated?.recommended || '';
        } catch {
          contentHtml = '';
        }
        if (!contentHtml) {
          contentHtml = `<h1>${docName}</h1><p>${rawParams.description || prompt}</p>`;
        } else if (!contentHtml.includes('<')) {
          contentHtml = `<h1>${docName}</h1><p>${contentHtml}</p>`;
        }

        const { data: policy, error: policyError } = await supabase
          .from('policies')
          .insert([{
            name: docName,
            description: rawParams.description || `Knowledge doc linked to ${linkedForm?.name || 'form'}`,
            category: rawParams.category || 'General',
            status: 'draft',
            owner_type: 'user',
            owner_id: authUser.id,
            created_by: authUser.id,
            project_id: activeProject.id,
            organization_id: activeProject.organization_id,
            form_id: formId,
            content: { html: contentHtml },
            item_type: 'policy',
            priority: 'medium',
            review_cycle_days: 365,
            acknowledgment_required: false,
            exception_allowed: true,
          } as any])
          .select('id, name')
          .single();

        if (policyError || !policy) {
          throw new Error(policyError?.message || 'Failed to create knowledge document');
        }

        actionResult = {
          message: `Created knowledge doc "${policy.name}"${linkedForm ? ` linked to form "${linkedForm.name}"` : ''}.`,
          result: {
            policyId: policy.id,
            formId,
            formName: linkedForm?.name,
            name: policy.name,
          },
        };
      } else {
        let params = await enrichActionParams(
          action,
          {
            ...rawParams,
            ...(action === 'update_workflow' && !rawParams.workflowId && activeWorkflowIdRef.current
              ? { workflowId: activeWorkflowIdRef.current }
              : {}),
            ...(action === 'update_report' && !rawParams.reportId && activeReportIdRef.current
              ? { reportId: activeReportIdRef.current }
              : {}),
          },
          prompt,
          formIdForEnrichment || rawParams.triggerFormId || rawParams.formId,
        );
        if (action === 'create_workflow' || action === 'update_workflow') {
          params = await confirmWorkflowConditionParams(params, 'nodes', prompt);
        }
        actionResult = await executeCopilotAction(action, params);
        const resultFormId = actionResult?.result?.formId as string | undefined;
        if (resultFormId && (FORM_CREATE_ACTIONS.has(action) || action === 'update_form')) {
          rememberActiveForm(resultFormId, actionResult?.result?.formName as string | undefined);
        }
        const workflowId = actionResult?.result?.workflowId as string | undefined;
        if (workflowId && (action === 'create_workflow' || action === 'update_workflow')) {
          setActiveWorkflowId(workflowId);
          activeWorkflowIdRef.current = workflowId;
        }
        const reportId = actionResult?.result?.reportId as string | undefined;
        if (reportId && (action === 'create_report' || action === 'update_report')) {
          setActiveReportId(reportId);
          activeReportIdRef.current = reportId;
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
  }, [activeProject, confirmWorkflowConditionParams, createClientFormFromPrompt, enrichActionParams, enrichWorkflowParams, executeCopilotAction, formsWithFields, generateContent, loadContext, rememberActiveForm, updateClientFormFromPrompt]);

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

    // Dropdown / explicit selection always wins over model-hallucinated ids.
    if (formIdOverride) {
      params[formKey] = formIdOverride;
    } else if (!params[formKey]) {
      if ((action === 'update_form' || action === 'create_workflow' || action === 'update_workflow'
        || action === 'create_report' || action === 'update_report') && activeFormIdRef.current) {
        params[formKey] = activeFormIdRef.current;
      } else {
        const lower = trimmed.toLowerCase();
        const match = formsWithFields.find((f) => f.name && lower.includes(f.name.toLowerCase()));
        if (match) params[formKey] = match.id;
      }
    }

    if (action === 'update_workflow' && !params.workflowId && activeWorkflowIdRef.current) {
      params.workflowId = activeWorkflowIdRef.current;
    }
    if (action === 'update_report' && !params.reportId && activeReportIdRef.current) {
      params.reportId = activeReportIdRef.current;
    }

    // Reject hallucinated form ids from the model (allow session active form even if context refresh lags)
    const formId = params[formKey];
    const knownIds = new Set(formsWithFields.map((f) => f.id));
    if (activeFormIdRef.current) knownIds.add(activeFormIdRef.current);
    if (formIdOverride) knownIds.add(formIdOverride);
    if (formId && !knownIds.has(formId)) {
      delete params[formKey];
      if (formIdOverride) params[formKey] = formIdOverride;
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
    createType?: CopilotCreateType | null,
  ) => {
    const normalized = normalizeToolCalls(toolCalls, trimmed, {
      selectedFormId: formIdOverride || activeFormIdRef.current,
      activeWorkflowId: activeWorkflowIdRef.current,
      activeReportId: activeReportIdRef.current,
      createType,
    });
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
      let { action, params: rawParams } = normalized[i];
      // No prior workflow/report in this chat → create instead of failing update.
      if (action === 'update_workflow' && !(rawParams?.workflowId || activeWorkflowIdRef.current)) {
        action = 'create_workflow';
      }
      if (action === 'update_report' && !(rawParams?.reportId || activeReportIdRef.current)) {
        action = 'create_report';
      }
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
          : action === 'create_workflow' || action === 'update_workflow'
            ? 'Which form should this workflow use? Pick the source form from the list.'
            : action === 'create_report' || action === 'update_report'
              ? 'Which form should this report use? Pick the source form from the list.'
              : action === 'create_knowledge_doc'
                ? 'Which form should this knowledge doc link to? Pick the source form from the list.'
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

  const sendPrompt = useCallback(async (text: string, options?: { formId?: string; createType?: CopilotCreateType }) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const createType = options?.createType || null;

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

    const isUpdate = createType === 'form' ? promptUpdatesExistingForm(trimmed) : false;
    const wantsWorkflowOnForm = createType === 'workflow' || (!createType && promptWantsWorkflowOnExistingForm(trimmed));
    const wantsReport = createType === 'report' || (!createType && (promptCreatesReport(trimmed) || promptUpdatesExistingReport(trimmed)));
    const wantsDoc = createType === 'doc';
    const wantsWorkflowUpdate = createType === 'workflow'
      ? promptUpdatesExistingWorkflow(trimmed)
      : (!createType && promptUpdatesExistingWorkflow(trimmed));
    const wantsFormOnly = createType === 'form' || (!createType && promptCreatesNewForm(trimmed) && !promptWantsFormAndWorkflow(trimmed));
    const targetFormId = options?.formId
      || ((isUpdate || wantsWorkflowOnForm || wantsReport || wantsWorkflowUpdate || wantsDoc) ? activeFormIdRef.current : undefined)
      || undefined;
    const selectedFromList = targetFormId ? formsWithFields.find((f) => f.id === targetFormId) : undefined;
    const selectedName = selectedFromList?.name
      || (targetFormId && activeFormIdRef.current === targetFormId ? activeFormName : null);

    let promptForModel = trimmed;
    if (createType === 'form' || wantsFormOnly) {
      promptForModel = `${trimmed}\n\n(IMPORTANT: Create or update a FORM only. Use create_form or update_form. Do NOT create a workflow. Do NOT use create_form_with_workflow unless the user explicitly asked for both a form and a workflow.)`;
    }
    if (isUpdate && targetFormId && selectedName) {
      promptForModel = `${trimmed}\n\n(IMPORTANT: Update the EXISTING form "${selectedName}" (id: ${targetFormId}). Do NOT create a new form. Use the update_form tool / modify that form only.)`;
    } else if ((wantsWorkflowOnForm || wantsWorkflowUpdate) && targetFormId && selectedName) {
      promptForModel = `${trimmed}\n\n(IMPORTANT: Use the EXISTING form "${selectedName}" (id: ${targetFormId}) as triggerFormId. Call ${wantsWorkflowUpdate && activeWorkflowIdRef.current ? 'update_workflow' : 'create_workflow'} only. Do NOT create a new form. Do NOT use create_form_with_workflow.)`;
    } else if (wantsReport && targetFormId && selectedName) {
      promptForModel = `${trimmed}\n\n(IMPORTANT: Use the EXISTING form "${selectedName}" (id: ${targetFormId}) as formId for ${promptUpdatesExistingReport(trimmed) && activeReportIdRef.current ? 'update_report' : 'create_report'}. Do NOT create a new form.)`;
    } else if (wantsDoc && targetFormId && selectedName) {
      promptForModel = `${trimmed}\n\n(IMPORTANT: Create a knowledge base / policy document linked to the EXISTING form "${selectedName}" (id: ${targetFormId}). Do NOT create a form or workflow.)`;
    } else if (targetFormId && selectedName && !isUpdate && !wantsFormOnly) {
      promptForModel = `${trimmed}\n\n(Use the existing form "${selectedName}" (id: ${targetFormId}) as the source/trigger form. Do NOT create a new form unless explicitly asked.)`;
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
      // If the model returned only chat text with no tools, force the obvious action.
      const forcedCalls: CopilotToolCall[] = [];
      if (createType === 'form' || isUpdate) {
        if (isUpdate) {
          forcedCalls.push({ action: 'update_form', params: targetFormId ? { formId: targetFormId } : {} });
        } else if (wantsFormOnly || createType === 'form') {
          forcedCalls.push({ action: 'create_form', params: {} });
        }
      } else if (createType === 'workflow' || wantsWorkflowUpdate || wantsWorkflowOnForm) {
        forcedCalls.push({
          action: wantsWorkflowUpdate && activeWorkflowIdRef.current ? 'update_workflow' : 'create_workflow',
          params: {
            ...(targetFormId ? { triggerFormId: targetFormId } : {}),
            ...(activeWorkflowIdRef.current && wantsWorkflowUpdate ? { workflowId: activeWorkflowIdRef.current } : {}),
          },
        });
      } else if (createType === 'report' || wantsReport) {
        forcedCalls.push({
          action: promptUpdatesExistingReport(trimmed) && activeReportIdRef.current ? 'update_report' : 'create_report',
          params: {
            ...(targetFormId ? { formId: targetFormId } : {}),
            ...(activeReportIdRef.current && promptUpdatesExistingReport(trimmed) ? { reportId: activeReportIdRef.current } : {}),
          },
        });
      } else if (createType === 'doc' || wantsDoc) {
        forcedCalls.push({
          action: 'create_knowledge_doc',
          params: targetFormId ? { formId: targetFormId } : {},
        });
      }
      const effectiveCalls = calls.length > 0 ? calls : forcedCalls;
      if (effectiveCalls.length === 0) {
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: messageContent,
          timestamp: new Date(),
        }]);
        return;
      }
      await processToolCalls(effectiveCalls, trimmed, messageContent, targetFormId, createType);
    } else if (copilotEnabled && (isUpdate || wantsWorkflowOnForm || wantsReport || wantsWorkflowUpdate || wantsDoc || createType === 'form')) {
      const fallbackAction = createType === 'form' || wantsFormOnly
        ? (isUpdate ? 'update_form' : 'create_form')
        : createType === 'doc' || wantsDoc
          ? 'create_knowledge_doc'
        : isUpdate
        ? 'update_form'
        : wantsWorkflowUpdate && activeWorkflowIdRef.current
          ? 'update_workflow'
          : wantsWorkflowOnForm || wantsWorkflowUpdate || createType === 'workflow'
            ? 'create_workflow'
            : promptUpdatesExistingReport(trimmed) && activeReportIdRef.current
              ? 'update_report'
              : 'create_report';
      const fallbackParams: Record<string, unknown> = {};
      if (fallbackAction === 'update_form' || fallbackAction === 'create_report' || fallbackAction === 'update_report' || fallbackAction === 'create_knowledge_doc') {
        if (targetFormId) fallbackParams.formId = targetFormId;
      }
      if (fallbackAction === 'create_workflow' || fallbackAction === 'update_workflow') {
        if (targetFormId) fallbackParams.triggerFormId = targetFormId;
      }
      if (fallbackAction === 'update_workflow' && activeWorkflowIdRef.current) {
        fallbackParams.workflowId = activeWorkflowIdRef.current;
      }
      if (fallbackAction === 'update_report' && activeReportIdRef.current) {
        fallbackParams.reportId = activeReportIdRef.current;
      }
      await processToolCalls(
        [{ action: fallbackAction, params: fallbackParams }],
        trimmed,
        messageContent || 'Working on your request…',
        targetFormId,
        createType,
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
    setActiveWorkflowId(null);
    setActiveReportId(null);
    activeFormIdRef.current = null;
    activeWorkflowIdRef.current = null;
    activeReportIdRef.current = null;
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
    conditionResolutionDialogs,
    hasConversation: messages.some((m) => m.id !== 'welcome'),
  };
}
