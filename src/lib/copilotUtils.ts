import type { EntityType, ActionType } from '@/hooks/useUnifiedAccessControl';

export interface CopilotToolCall {
  action: string;
  params: Record<string, unknown>;
}

/** Explicit create target selected in AI Builder / landing hero. */
export type CopilotCreateType = 'form' | 'workflow' | 'report' | 'doc';

export const COPILOT_CREATE_TYPES: Array<{
  id: CopilotCreateType;
  label: string;
  intent: string;
  placeholder: string;
}> = [
  {
    id: 'form',
    label: 'Form',
    intent: 'Create a form',
    placeholder: 'Create an employee onboarding form with name, email, department…',
  },
  {
    id: 'workflow',
    label: 'Workflow',
    intent: 'Create a workflow',
    placeholder: 'When severity is Critical, assign to L2 and email the owner…',
  },
  {
    id: 'report',
    label: 'Report',
    intent: 'Create a report',
    placeholder: 'Open vulnerabilities grouped by business unit as a bar chart…',
  },
  {
    id: 'doc',
    label: 'Knowledge Base',
    intent: 'Create a knowledge doc',
    placeholder: 'Access control policy with purpose, scope, and annual review…',
  },
];

/** True when this create type needs an existing form (not just a project). */
export function createTypeNeedsForm(type: CopilotCreateType | null | undefined): boolean {
  return type === 'workflow' || type === 'report' || type === 'doc';
}

/** Actions the backend ai-copilot-action engine actually implements. */
export const SUPPORTED_COPILOT_ACTIONS = new Set([
  'create_form',
  'update_form',
  'trigger_workflow',
  'create_submission',
  'create_dashboard',
  'create_report',
  'update_report',
  'create_workflow',
  'update_workflow',
  'create_form_with_workflow',
  'create_form_with_sla',
  'create_form_with_email_template',
  'add_email_action_to_workflow',
  'link_form_to_workflow',
  'link_form_to_sla',
  'send_notification',
  'get_sla_predictions',
  'get_form_stats',
  'update_submission_status',
  'create_email_template',
  /** Frontend-handled knowledge base / policy create */
  'create_knowledge_doc',
]);

/** Actions that create or mutate workspace assets — refresh context after success. */
export const CONTEXT_REFRESH_ACTIONS = new Set([
  'create_form',
  'update_form',
  'create_workflow',
  'update_workflow',
  'create_form_with_workflow',
  'create_form_with_sla',
  'create_form_with_email_template',
  'create_dashboard',
  'create_report',
  'update_report',
  'link_form_to_workflow',
  'link_form_to_sla',
  'add_email_action_to_workflow',
  'create_email_template',
  'create_knowledge_doc',
]);

/** Pure form-creation actions — never require picking an existing form. */
export const FORM_CREATE_ACTIONS = new Set([
  'create_form',
  'create_form_with_workflow',
  'create_form_with_sla',
  'create_form_with_email_template',
]);

/**
 * Actions that need an existing form id. Only explicit entries — no regex fallback
 * (avoids false positives like create_dashboard or invented action names).
 */
export const FORM_REQUIRED_ACTIONS: Record<string, string> = {
  update_form: 'formId',
  create_workflow: 'triggerFormId',
  update_workflow: 'triggerFormId',
  create_report: 'formId',
  update_report: 'formId',
  link_form_to_workflow: 'formId',
  link_form_to_sla: 'formId',
  create_knowledge_doc: 'formId',
};

/** Workflow-creating actions that should be enriched with suggest-workflow when nodes are thin. */
export const WORKFLOW_CREATE_ACTIONS = new Set([
  'create_workflow',
  'update_workflow',
  'create_form_with_workflow',
]);

/** Permission gate before executing a copilot action in the UI. */
export const ACTION_PERMISSIONS: Partial<Record<string, { entity: EntityType; action: ActionType }>> = {
  create_form: { entity: 'forms', action: 'create' },
  update_form: { entity: 'forms', action: 'update' },
  create_form_with_workflow: { entity: 'forms', action: 'create' },
  create_form_with_sla: { entity: 'forms', action: 'create' },
  create_form_with_email_template: { entity: 'forms', action: 'create' },
  create_workflow: { entity: 'workflows', action: 'create' },
  update_workflow: { entity: 'workflows', action: 'update' },
  link_form_to_workflow: { entity: 'workflows', action: 'update' },
  add_email_action_to_workflow: { entity: 'workflows', action: 'update' },
  create_dashboard: { entity: 'dashboards', action: 'create' },
  create_report: { entity: 'reports', action: 'create' },
  update_report: { entity: 'reports', action: 'update' },
  link_form_to_sla: { entity: 'forms', action: 'update' },
  create_submission: { entity: 'forms', action: 'create' },
  create_knowledge_doc: { entity: 'policies', action: 'create' },
};

export function getFormParamKey(action: string): string | null {
  if (FORM_CREATE_ACTIONS.has(action)) return null;
  return FORM_REQUIRED_ACTIONS[action] ?? null;
}

/** Prompt refers to an already-chosen / existing form (dropdown, "this form", etc.). */
export function promptTargetsExistingForm(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    /\b(selected|select|existing|current|chosen|picked)\s+forms?\b/.test(t)
    || /\b(this|that|the)\s+forms?\b/.test(t)
    || /\bfor\s+(the\s+)?(selected|select|existing|current|this|that)\s+forms?\b/.test(t)
    || /\b(on|from|using|with)\s+(the\s+)?(selected|select|existing|current|this|that)\s+forms?\b/.test(t)
    || /\bforms?\s+(from\s+)?(the\s+)?(dropdown|list|picker|selector)\b/.test(t)
  );
}

/** User wants a workflow attached to an existing form (not a brand-new form). */
export function promptWantsWorkflowOnExistingForm(text: string): boolean {
  const t = text.toLowerCase().trim();
  const mentionsWorkflow = /\b(workflows?|automation|automate)\b/.test(t);
  if (!mentionsWorkflow) return false;
  if (promptWantsFormAndWorkflow(text)) return false;
  if (promptTargetsExistingForm(t)) return true;
  // "create a workflow for … form" / "workflow for leave request form"
  if (/\b(workflows?|automation)\b.+\bfor\b.+\bforms?\b/.test(t)) return true;
  if (/\bfor\b.+\bforms?\b.+\b(workflows?|automation)\b/.test(t)) return true;
  if (/\b(create|make|build|set up|add|generate)\b.+\b(workflows?|automation)\b/.test(t)
    && /\bforms?\b/.test(t)
    && !/\b(create|make|build|set up|generate|design)\s+(a\s+|an\s+|the\s+)?(new\s+)?forms?\b/.test(t)) {
    return true;
  }
  return false;
}

/** User wants to change an already-created form (add/change fields), not create a new one. */
export function promptUpdatesExistingForm(text: string): boolean {
  const t = text.toLowerCase().trim();

  // Explicit brand-new form request wins over update heuristics.
  if (/\b(new|another|different|separate|second|fresh)\s+forms?\b/.test(t)) {
    return false;
  }
  if (/\b(create|make|build|generate|design|set up)\s+(a\s+|an\s+|the\s+)?(new\s+)?forms?\b/.test(t)
    && !/\b(add|update|change|modify|edit|remove|delete|rename)\b/.test(t)) {
    return false;
  }

  if (/\b(add|update|change|modify|edit|remove|delete|rename|include|insert|append|move|make\s+required|optional)\b/.test(t)
    && /\b(field|fields|column|columns|section|question|questions|input|inputs|page|pages)\b/.test(t)) {
    return true;
  }

  if (/\b(update|modify|edit|change|improve|extend|enhance)\b.+\bforms?\b/.test(t)) return true;
  if (/\b(add|include|append)\b.+\b(to|on|in)\b.+\b(the\s+)?(forms?|it|this|that)\b/.test(t)) return true;
  if (/\b(add|include)\b.+\b(to|on|in)\b.+\b(preview|current form)\b/.test(t)) return true;
  if (/\b(show|hide)\b.+\b(when|if)\b/.test(t)) return true;
  if (/\b(1|2|3|one|two|three)[-\s]?columns?\b/.test(t) && /\b(layout|form|page)\b/.test(t)) return true;

  return false;
}

/** Prompt asks for conditional field visibility / rules. */
export function promptWantsFieldRules(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(show|hide|enable|disable|require)\b.+\b(when|if)\b/.test(t)
    || /\b(field\s+rules?|conditional\s+(logic|fields?)|visibility\s+rules?)\b/.test(t)
    || /\bonly\s+show\b/.test(t)
  );
}

/** Extract 1–3 column layout intent from natural language. */
export function inferLayoutColumnsFromPrompt(text: string): 1 | 2 | 3 | undefined {
  const t = text.toLowerCase();
  if (/\b(three|3)[-\s]?columns?\b/.test(t) || /\b3\s*col(?:umn)?\b/.test(t)) return 3;
  if (/\b(two|2)[-\s]?columns?\b/.test(t) || /\b2\s*col(?:umn)?\b/.test(t) || /\bdouble\s+column\b/.test(t)) return 2;
  if (/\b(one|1|single)[-\s]?columns?\b/.test(t) || /\bsingle\s+column\b/.test(t)) return 1;
  return undefined;
}

/** User is asking to create a new form (not attach to or edit an existing one). */
export function promptCreatesNewForm(text: string): boolean {
  if (promptUpdatesExistingForm(text)) return false;
  if (promptWantsWorkflowOnExistingForm(text)) return false;
  if (promptTargetsExistingForm(text) && !/\b(create|make|build|generate|design)\s+(a\s+|an\s+|the\s+)?(new\s+)?forms?\b/.test(text.toLowerCase())) {
    return false;
  }
  const t = text.toLowerCase();
  const createVerb = /\b(create|make|build|set up|design|generate)\b/.test(t);
  const mentionsForm = /\bforms?\b/.test(t);
  // "create a workflow for the form" is not creating a form
  if (/\b(create|make|build|set up|generate)\b.+\b(workflows?|automation|reports?|charts?)\b/.test(t)
    && !/\b(create|make|build|set up|generate|design)\s+(a\s+|an\s+|the\s+)?(new\s+)?forms?\b/.test(t)) {
    return false;
  }
  return createVerb && mentionsForm;
}

/**
 * User wants a brand-new form AND a workflow together.
 * Must NOT match "create a workflow for the selected/existing form".
 */
export function promptWantsFormAndWorkflow(text: string): boolean {
  const t = text.toLowerCase().trim();
  const mentionsWorkflow = /\b(workflows?|automation|automate|when\b.+\bhappens)\b/.test(t);
  if (!mentionsWorkflow) return false;

  // Explicitly targeting an existing/selected form → workflow-only.
  if (promptTargetsExistingForm(t)) return false;
  if (/\b(workflows?|automation)\b.+\bfor\b.+\b(the\s+)?(selected|existing|current|this|that)\s+forms?\b/.test(t)) {
    return false;
  }

  // Require an actual form-create intent, not merely the word "form".
  const createsForm = (
    /\b(create|make|build|set up|design|generate)\s+(a\s+|an\s+|the\s+)?(new\s+)?forms?\b/.test(t)
    || /\bforms?\s+with\s+(an?\s+)?(approval\s+)?(workflows?|automation)\b/.test(t)
    || /\b(with|and)\s+(an?\s+)?(approval\s+)?(workflows?|automation)\b/.test(t)
      && /\b(create|make|build|set up|design|generate)\b.+\bforms?\b/.test(t)
  );

  return createsForm && mentionsWorkflow;
}

/** User is asking for a dashboard shell only (not a data report/chart). */
export function promptCreatesDashboard(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(create|make|build|set up|add)\b/.test(t) && /\bdashboards?\b/.test(t) && !/\breports?\b/.test(t);
}

/** User is asking to create a chart/report from form data. */
export function promptCreatesReport(text: string): boolean {
  const t = text.toLowerCase();
  if (promptCreatesDashboard(text)) return false;
  if (promptUpdatesExistingReport(t)) return false;
  if (/\b(create|make|build|set up|add|generate)\b/.test(t) && /\breports?\b/.test(t)) return true;
  if (/\breports?\b/.test(t) && /\b(chart|graph|visual|bar|pie|line|group|aggregate|count)\b/.test(t)) return true;
  return false;
}

/** User wants to change an existing report/chart rather than create a new one. */
export function promptUpdatesExistingReport(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/\b(new|another|different|separate|fresh)\s+reports?\b/.test(t)) return false;
  if (/\b(update|modify|edit|change|improve|tweak|adjust)\b.+\b(reports?|charts?|graphs?)\b/.test(t)) return true;
  if (/\b(reports?|charts?|graphs?)\b.+\b(update|modify|edit|change|to\s+a\s+(bar|pie|line|table))\b/.test(t)) return true;
  if (/\b(change|switch)\b.+\b(chart\s+type|to\s+(bar|pie|line|table))\b/.test(t)) return true;
  return false;
}

/** User wants to change an existing workflow. */
export function promptUpdatesExistingWorkflow(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/\b(new|another|different|separate|fresh)\s+workflows?\b/.test(t)) return false;
  if (/\b(update|modify|edit|change|improve|extend|enhance)\b.+\b(workflows?|automation)\b/.test(t)) return true;
  if (/\b(add|include)\b.+\b(to|on|in)\b.+\b(the\s+)?(workflows?|automation)\b/.test(t)) return true;
  return false;
}

/**
 * Whether the composer should ask the user to pick a source form before sending.
 * Avoids blocking prompts like "create a form for email requests".
 */
export function promptNeedsExistingForm(text: string, createType?: CopilotCreateType | null): boolean {
  if (createType === 'form') return false;
  if (createType && createTypeNeedsForm(createType)) return true;

  const t = text.toLowerCase();

  if (promptWantsFormAndWorkflow(text)) return false;
  if (promptCreatesDashboard(text)) return false;

  // Field edits need a target form unless the chat session already has an active one
  // (caller may auto-supply that). Still treat as needing a form for picker UX.
  if (promptUpdatesExistingForm(text)) return true;

  if (promptWantsWorkflowOnExistingForm(text)) return true;
  if (promptUpdatesExistingWorkflow(text)) return true;
  if (promptUpdatesExistingReport(text)) return true;

  if (promptCreatesNewForm(text) && !/\b(workflow|automation|sla|email template)\b/.test(t)) {
    return false;
  }

  if (promptCreatesReport(text)) return true;

  if (/\b(link|attach|connect)\b/.test(t) && /\bforms?\b/.test(t)) return true;

  if (/\b(workflows?|automation|automate)\b/.test(t)) return true;

  if (/\b(sla|email template|email notification)\b/.test(t) && !promptCreatesNewForm(text)) return true;

  if (/\b(knowledge|policy|policies|kb\b|doc|document)\b/.test(t)
    && /\b(create|make|build|draft|write|generate)\b/.test(t)) {
    return true;
  }

  return false;
}

/** Map suggest-workflow output into ai-copilot-action node definitions. */
export function mapSuggestedWorkflowNodes(
  nodes: Array<{
    type: string;
    label: string;
    config?: Record<string, unknown>;
    connections?: Array<{ to: string; condition?: string }>;
  }>,
) {
  const labelToTempId = new Map<string, string>();
  const withIds = nodes.map((node, index) => {
    const tempId = `node_${index}`;
    labelToTempId.set(node.label.toLowerCase(), tempId);
    const nodeType = node.type.toLowerCase() === 'trigger' ? 'start' : node.type;
    return {
      tempId,
      type: nodeType,
      label: node.label,
      config: node.config || {},
      positionX: nodeType === 'condition' ? 350 : 250,
      positionY: 100 + index * 150,
      connections: node.connections || [],
    };
  });

  return withIds.map((node) => ({
    tempId: node.tempId,
    type: node.type,
    label: node.label,
    config: node.config,
    positionX: node.positionX,
    positionY: node.positionY,
    connections: node.connections.map((conn) => ({
      to: labelToTempId.get(conn.to.toLowerCase()) || conn.to,
      conditionType: conn.condition || undefined,
    })),
  }));
}

export interface NormalizeToolCallsOptions {
  /** Form id from the dropdown / active chat form — must win over hallucinated create_form. */
  selectedFormId?: string | null;
  activeWorkflowId?: string | null;
  activeReportId?: string | null;
  /** Explicit AI Builder create type — constrains which actions may run. */
  createType?: CopilotCreateType | null;
}

/** Normalize AI output and upgrade/downgrade tool calls based on user intent. */
export function normalizeToolCalls(
  toolCalls: CopilotToolCall[],
  userPrompt: string,
  options?: NormalizeToolCallsOptions,
): CopilotToolCall[] {
  const supported = toolCalls.filter((tc) => SUPPORTED_COPILOT_ACTIONS.has(tc.action));
  if (supported.length === 0) return [];

  let normalized = supported;
  const selectedFormId = options?.selectedFormId || undefined;
  const createType = options?.createType || null;
  const wantsGreenfieldFormWorkflow = createType
    ? createType === 'form' && promptWantsFormAndWorkflow(userPrompt)
    : promptWantsFormAndWorkflow(userPrompt);
  const mentionsWorkflow = /\b(workflows?|automation)\b/.test(userPrompt.toLowerCase());
  const wantsWorkflowOnExisting = !wantsGreenfieldFormWorkflow && (
    createType === 'workflow'
    || (mentionsWorkflow && (
      promptWantsWorkflowOnExistingForm(userPrompt)
      || promptTargetsExistingForm(userPrompt)
      || (Boolean(selectedFormId)
        && !/\b(create|make|build|set up|design|generate)\s+(a\s+|an\s+|the\s+)?(new\s+)?forms?\b/.test(userPrompt.toLowerCase()))
    ))
  );

  // Explicit create-type lock: never invent the wrong asset kind.
  if (createType === 'form') {
    normalized = normalized
      .map((tc) => {
        if (tc.action === 'create_form_with_workflow' && !wantsGreenfieldFormWorkflow) {
          return {
            action: 'create_form',
            params: {
              ...tc.params,
              name: tc.params.formName ?? tc.params.name,
              description: tc.params.formDescription ?? tc.params.description,
              fields: tc.params.fields,
            },
          };
        }
        if (
          tc.action === 'create_workflow'
          || tc.action === 'update_workflow'
          || tc.action === 'create_report'
          || tc.action === 'update_report'
          || tc.action === 'create_knowledge_doc'
        ) {
          return {
            action: 'create_form',
            params: {
              ...tc.params,
              name: tc.params.formName ?? tc.params.name,
              description: tc.params.formDescription ?? tc.params.description,
              fields: tc.params.fields,
            },
          };
        }
        return tc;
      })
      .filter((tc, index, arr) => {
        // Keep a single create_form / update_form when the model emitted duplicates.
        if (tc.action !== 'create_form' && tc.action !== 'update_form') return true;
        return arr.findIndex((x) => x.action === tc.action) === index;
      });
  } else if (createType === 'workflow') {
    normalized = normalized.map((tc) => {
      if (
        tc.action === 'create_form'
        || tc.action === 'create_form_with_workflow'
        || tc.action === 'create_report'
        || tc.action === 'update_report'
        || tc.action === 'create_knowledge_doc'
      ) {
        return {
          action: promptUpdatesExistingWorkflow(userPrompt) ? 'update_workflow' : 'create_workflow',
          params: {
            ...tc.params,
            name: tc.params.workflowName ?? tc.params.name,
            description: tc.params.workflowDescription ?? tc.params.description,
            nodes: tc.params.workflowNodes ?? tc.params.nodes,
            triggerFormId: selectedFormId || tc.params.triggerFormId || tc.params.formId,
            workflowId: options?.activeWorkflowId || tc.params.workflowId,
          },
        };
      }
      return tc;
    });
  } else if (createType === 'report') {
    const reportAction = promptUpdatesExistingReport(userPrompt) ? 'update_report' : 'create_report';
    normalized = normalized.map((tc) => ({
      action: reportAction,
      params: {
        ...tc.params,
        formId: selectedFormId || tc.params.formId,
        name: tc.params.name || tc.params.formName,
        reportId: options?.activeReportId || tc.params.reportId,
      },
    }));
  } else if (createType === 'doc') {
    normalized = normalized.map((tc) => ({
      action: 'create_knowledge_doc',
      params: {
        ...tc.params,
        formId: selectedFormId || tc.params.formId,
        name: tc.params.name || tc.params.formName || tc.params.title,
        description: tc.params.description || tc.params.content,
      },
    }));
  }

  // Form-only prompts must never silently create a workflow (e.g. "manager approval" fields).
  if (!createType || createType === 'form') {
    const formOnly = promptCreatesNewForm(userPrompt) && !wantsGreenfieldFormWorkflow;
    if (formOnly) {
      normalized = normalized.map((tc) => {
        if (tc.action === 'create_form_with_workflow') {
          return {
            action: 'create_form',
            params: {
              ...tc.params,
              name: tc.params.formName ?? tc.params.name,
              description: tc.params.formDescription ?? tc.params.description,
              fields: tc.params.fields,
            },
          };
        }
        if (tc.action === 'create_workflow' && !mentionsWorkflow) {
          return {
            action: 'create_form',
            params: {
              ...tc.params,
              name: tc.params.formName ?? tc.params.name,
              description: tc.params.formDescription ?? tc.params.description,
              fields: tc.params.fields,
            },
          };
        }
        return tc;
      });
    }
  }

  // Existing/selected form + workflow request → never create a new form.
  if (wantsWorkflowOnExisting && createType !== 'form' && createType !== 'report' && createType !== 'doc') {
    normalized = normalized.map((tc) => {
      if (tc.action === 'create_form_with_workflow' || tc.action === 'create_form') {
        return {
          action: promptUpdatesExistingWorkflow(userPrompt) ? 'update_workflow' : 'create_workflow',
          params: {
            ...tc.params,
            name: tc.params.workflowName ?? tc.params.name,
            description: tc.params.workflowDescription ?? tc.params.description,
            nodes: tc.params.workflowNodes ?? tc.params.nodes,
            triggerFormId: selectedFormId || tc.params.triggerFormId || tc.params.formId,
            workflowId: options?.activeWorkflowId || tc.params.workflowId,
          },
        };
      }
      return tc;
    });
  } else if (wantsGreenfieldFormWorkflow && normalized.length === 1 && (!createType || createType === 'form')) {
    const only = normalized[0];
    if (only.action === 'create_form' || only.action === 'create_workflow') {
      normalized = [{
        action: 'create_form_with_workflow',
        params: {
          ...only.params,
          formName: only.params.formName ?? only.params.name,
          workflowName: only.params.workflowName ?? only.params.name,
        },
      }];
    }
  }

  // Report on selected/existing form: strip accidental form creates; prefer update when asked.
  if ((!createType || createType === 'report') && (promptCreatesReport(userPrompt) || promptUpdatesExistingReport(userPrompt))) {
    const reportAction = promptUpdatesExistingReport(userPrompt) ? 'update_report' : 'create_report';
    normalized = normalized.map((tc) => {
      if (
        tc.action === 'create_form'
        || tc.action === 'create_form_with_workflow'
        || tc.action === 'create_dashboard'
        || tc.action === 'create_report'
        || tc.action === 'update_report'
      ) {
        return {
          action: reportAction,
          params: {
            ...tc.params,
            formId: selectedFormId || tc.params.formId,
            name: tc.params.name || tc.params.formName,
            reportId: options?.activeReportId || tc.params.reportId,
          },
        };
      }
      return tc;
    });
  }

  if (promptUpdatesExistingWorkflow(userPrompt) && createType !== 'form' && createType !== 'report' && createType !== 'doc') {
    normalized = normalized.map((tc) => (
      tc.action === 'create_workflow' || tc.action === 'create_form_with_workflow'
        ? {
            action: 'update_workflow',
            params: {
              ...tc.params,
              workflowId: options?.activeWorkflowId || tc.params.workflowId,
              triggerFormId: selectedFormId || tc.params.triggerFormId || tc.params.formId,
              nodes: tc.params.workflowNodes ?? tc.params.nodes,
            },
          }
        : tc
    ));
  }

  // Follow-up edits must update the existing form — never spawn a duplicate create_form.
  if (promptUpdatesExistingForm(userPrompt) && (!createType || createType === 'form')) {
    normalized = normalized.map((tc) => (
      tc.action === 'create_form'
        ? { action: 'update_form', params: { ...tc.params } }
        : tc
    ));
    if (!normalized.some((tc) => tc.action === 'update_form')) {
      normalized = [{ action: 'update_form', params: {} }, ...normalized];
    }
  }

  // Stamp selected form id onto form-required actions.
  if (selectedFormId) {
    normalized = normalized.map((tc) => {
      const key = getFormParamKey(tc.action);
      if (!key) return tc;
      return { ...tc, params: { ...tc.params, [key]: selectedFormId } };
    });
  }

  return normalized;
}

export function getChatStorageKey(userId: string, projectId: string): string {
  return `topsqill:copilot-chat:${userId}:${projectId}`;
}
