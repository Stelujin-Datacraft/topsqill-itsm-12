import type { EntityType, ActionType } from '@/hooks/useUnifiedAccessControl';

export interface CopilotToolCall {
  action: string;
  params: Record<string, unknown>;
}

/** Actions the backend ai-copilot-action engine actually implements. */
export const SUPPORTED_COPILOT_ACTIONS = new Set([
  'create_form',
  'trigger_workflow',
  'create_submission',
  'create_dashboard',
  'create_report',
  'create_workflow',
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
]);

/** Actions that create or mutate workspace assets — refresh context after success. */
export const CONTEXT_REFRESH_ACTIONS = new Set([
  'create_form',
  'create_workflow',
  'create_form_with_workflow',
  'create_form_with_sla',
  'create_form_with_email_template',
  'create_dashboard',
  'create_report',
  'link_form_to_workflow',
  'link_form_to_sla',
  'add_email_action_to_workflow',
  'create_email_template',
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
  create_workflow: 'triggerFormId',
  create_report: 'formId',
  link_form_to_workflow: 'formId',
  link_form_to_sla: 'formId',
};

/** Workflow-creating actions that should be enriched with suggest-workflow when nodes are thin. */
export const WORKFLOW_CREATE_ACTIONS = new Set([
  'create_workflow',
  'create_form_with_workflow',
]);

/** Permission gate before executing a copilot action in the UI. */
export const ACTION_PERMISSIONS: Partial<Record<string, { entity: EntityType; action: ActionType }>> = {
  create_form: { entity: 'forms', action: 'create' },
  create_form_with_workflow: { entity: 'forms', action: 'create' },
  create_form_with_sla: { entity: 'forms', action: 'create' },
  create_form_with_email_template: { entity: 'forms', action: 'create' },
  create_workflow: { entity: 'workflows', action: 'create' },
  link_form_to_workflow: { entity: 'workflows', action: 'update' },
  add_email_action_to_workflow: { entity: 'workflows', action: 'update' },
  create_dashboard: { entity: 'dashboards', action: 'create' },
  create_report: { entity: 'reports', action: 'create' },
  link_form_to_sla: { entity: 'forms', action: 'update' },
  create_submission: { entity: 'forms', action: 'create' },
};

export function getFormParamKey(action: string): string | null {
  if (FORM_CREATE_ACTIONS.has(action)) return null;
  return FORM_REQUIRED_ACTIONS[action] ?? null;
}

/** User is asking to create a new form (not attach to an existing one). */
export function promptCreatesNewForm(text: string): boolean {
  const t = text.toLowerCase();
  const createVerb = /\b(create|make|build|set up|add|design|generate)\b/.test(t);
  const mentionsForm = /\bforms?\b/.test(t);
  return createVerb && mentionsForm;
}

/** User wants form + workflow in one request. */
export function promptWantsFormAndWorkflow(text: string): boolean {
  const t = text.toLowerCase();
  const mentionsForm = /\bforms?\b/.test(t);
  const mentionsWorkflow = /\b(workflows?|automation|automate|when\b.+\bhappens)\b/.test(t);
  const createIntent = /\b(create|make|build|set up|with)\b/.test(t);
  return mentionsForm && mentionsWorkflow && createIntent;
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
  if (/\b(create|make|build|set up|add|generate)\b/.test(t) && /\breports?\b/.test(t)) return true;
  if (/\breports?\b/.test(t) && /\b(chart|graph|visual|bar|pie|line|group|aggregate|count)\b/.test(t)) return true;
  return false;
}

/**
 * Whether the composer should ask the user to pick a source form before sending.
 * Avoids blocking prompts like "create a form for email requests".
 */
export function promptNeedsExistingForm(text: string): boolean {
  const t = text.toLowerCase();

  if (promptWantsFormAndWorkflow(text)) return false;
  if (promptCreatesDashboard(text)) return false;

  if (promptCreatesNewForm(text) && !/\b(workflow|automation|sla|email template)\b/.test(t)) {
    return false;
  }

  if (promptCreatesReport(text)) return true;

  if (/\b(link|attach|connect)\b/.test(t) && /\bforms?\b/.test(t)) return true;

  if (/\b(workflows?|automation|automate)\b/.test(t)) return true;

  if (/\b(sla|email template|email notification)\b/.test(t) && !promptCreatesNewForm(text)) return true;

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

/** Normalize AI output and upgrade split form/workflow intents to the combined action. */
export function normalizeToolCalls(
  toolCalls: CopilotToolCall[],
  userPrompt: string,
): CopilotToolCall[] {
  const supported = toolCalls.filter((tc) => SUPPORTED_COPILOT_ACTIONS.has(tc.action));
  if (supported.length === 0) return [];

  let normalized = supported;

  if (promptWantsFormAndWorkflow(userPrompt) && normalized.length === 1) {
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

  if (promptCreatesReport(userPrompt)) {
    normalized = normalized.map((tc) => (
      tc.action === 'create_dashboard'
        ? { action: 'create_report', params: { ...tc.params } }
        : tc
    ));
  }

  return normalized;
}

export function getChatStorageKey(userId: string, projectId: string): string {
  return `topsqill:copilot-chat:${userId}:${projectId}`;
}
