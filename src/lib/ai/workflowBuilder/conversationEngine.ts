/**
 * Conversational workflow builder engine — progressive discovery session.
 */
import {
  createWorkflowBuilderSession,
  type MissingRequirement,
  type PendingConfigAction,
  type WorkflowBuilderSession,
} from './types';
import { analyzeWorkflowIntent } from './intentAnalyzer';
import {
  planMissingRequirements,
  getNextMissingRequirement,
  applyAnswerToDefinition,
} from './requirementPlanner';
import {
  searchFields,
  suggestApproverFields,
  hydrateDiscoveredForm,
  findSubmissionAccessField,
  SUBMISSION_ACCESS_FIELD_LABEL,
  type DiscoveredForm,
  type DiscoveredWorkflow,
  type EmailTemplateChoice,
  type OrgUserChoice,
  findExistingWorkflowsForForm,
} from './metadataDiscovery';
import { validateWorkflowDefinition, hasBlockingValidationErrors } from './validationEngine';
import { generateWorkflowPreview, formatPreviewAsMarkdown } from './previewGenerator';
import { compileWorkflowDefinition } from './nodeCompiler';
import { isApprovalStyleDefinition } from './types';
import { describeActionType } from './actionTypeInferrer';
import { buildOptionCreatePendingActions } from './pendingOptionActions';
import {
  analyzeExistingWorkflowGraph,
  formatExistingGraphForIntro,
  type ExistingWorkflowGraphSummary,
  type WorkflowApplyMode,
} from './analyzeExistingWorkflow';

export interface BuilderTurnResult {
  session: WorkflowBuilderSession;
  assistantMessage: string;
  /** Structured controls for the UI (optional) */
  promptControls?: MissingRequirement | null;
  /** Ready to execute create_workflow */
  readyToPublish: boolean;
  compiled?: ReturnType<typeof compileWorkflowDefinition>;
  /** Designer: extend existing canvas vs replace */
  applyMode?: WorkflowApplyMode | null;
}

function touch(session: WorkflowBuilderSession): WorkflowBuilderSession {
  return { ...session, updatedAt: new Date().toISOString() };
}

/** Map canvas action config into session requirements.action for edit Q&A. */
function seedActionFromCanvasSnapshot(
  session: WorkflowBuilderSession,
  snapshot: Record<string, any> | undefined,
  opts: { forceType?: string; clearLinkedFields?: boolean },
): void {
  if (!session.requirements.action) return;
  const action = session.requirements.action;
  const snap = snapshot || {};
  const type = String(opts.forceType || action.actionType || snap.actionType || '').toLowerCase();

  if (opts.forceType) {
    action.actionType = opts.forceType as any;
  }

  if (opts.clearLinkedFields) {
    action.crossReferenceFieldId = undefined;
    action.crossReferenceFieldLabel = undefined;
    action.sourceCrossRefFieldId = undefined;
    action.sourceCrossRefFieldLabel = undefined;
    action.targetFormId = undefined;
    action.targetFormName = undefined;
    action.createFieldValues = [];
    action.createFieldMappings = [];
    action.createFieldsDone = undefined;
    action.skipCreateFieldValues = undefined;
    action.configured = false;
    return;
  }

  if (
    type === 'create_linked_record'
    || type === 'update_linked_records'
    || type === 'link_existing_record'
  ) {
    const xrId = snap.crossReferenceFieldId;
    const xrName = snap.crossReferenceFieldName;
    if (xrId && xrId !== '__keep__') {
      action.crossReferenceFieldId = xrId;
      action.crossReferenceFieldLabel = xrName || action.crossReferenceFieldLabel;
      action.sourceCrossRefFieldId = xrId;
      action.sourceCrossRefFieldLabel = xrName || action.sourceCrossRefFieldLabel;
    }
    if (snap.targetFormId && snap.targetFormId !== '__keep__') {
      action.targetFormId = snap.targetFormId;
      action.targetFormName = snap.targetFormName || action.targetFormName;
    }
    if (type === 'update_linked_records' && snap.updateScope) {
      action.updateScope = snap.updateScope;
    }
    if (type === 'link_existing_record') {
      action.matchScope = snap.matchScope === 'all' ? 'all' : 'first';
    }
    // Re-ask fields so user can change values with proper child-form options
    action.createFieldsDone = undefined;
    action.skipCreateFieldValues = undefined;
    action.createFieldValues = [];
    action.createFieldMappings = [];
    action.configured = false;
  } else if (type === 'create_record') {
    if (snap.targetFormId) {
      action.targetFormId = snap.targetFormId;
      action.targetFormName = snap.targetFormName || action.targetFormName;
    }
    action.createFieldsDone = undefined;
    action.skipCreateFieldValues = undefined;
    action.configured = false;
  } else if (type === 'change_field_value') {
    const first = Array.isArray(snap.fieldUpdates) ? snap.fieldUpdates[0] : undefined;
    action.targetFieldId = snap.targetFieldId || first?.targetFieldId || action.targetFieldId;
    action.targetFieldLabel = snap.targetFieldName || first?.targetFieldName || action.targetFieldLabel;
    action.staticValue = snap.staticValue ?? first?.staticValue ?? action.staticValue;
    action.configured = false;
  } else if (type === 'send_notification') {
    action.notificationType = snap.notificationType
      || snap.notificationConfig?.type
      || action.notificationType;
    action.emailTemplateId = snap.emailTemplateId || action.emailTemplateId;
    action.configured = false;
  }
}

function queueCurrentEditPatch(
  session: WorkflowBuilderSession,
  form?: DiscoveredForm,
): void {
  if (!session.editTargetNodeId) return;
  const formFields = (form?.fields || []).map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    options: f.options,
  }));
  const compiled = compileWorkflowDefinition(session.requirements, { formFields });
  const targetType = String(session.editTargetNodeType || '').toLowerCase();
  const match = compiled.nodes.find((n) => {
    const t = String(n.type || '').toLowerCase();
    if (targetType === 'condition') return t === 'condition';
    if (targetType === 'start') return t === 'start' || t === 'trigger';
    if (targetType === 'wait') return t === 'wait';
    if (targetType === 'end') return t === 'end';
    return t === 'action' || t === 'notification' || t === 'approval';
  }) || compiled.nodes.find((n) => {
    const t = String(n.type || '').toLowerCase();
    return t !== 'start' && t !== 'end' && t !== 'trigger';
  });
  if (!match) return;
  const patches = [...(session.editPatches || [])].filter((p) => p.nodeId !== session.editTargetNodeId);
  patches.push({
    nodeId: session.editTargetNodeId,
    nodeType: session.editTargetNodeType,
    label: match.label || session.editTargetNodeLabel || undefined,
    config: match.config || {},
  });
  session.editPatches = patches;
}

function clearAnsweredRequirement(session: WorkflowBuilderSession, id: string): void {
  session.missingInformation = (session.missingInformation || []).filter((m) => m.id !== id);
}


function graphPlanOpts(session: WorkflowBuilderSession): {
  existingGraph: ExistingWorkflowGraphSummary | null;
  applyMode: WorkflowApplyMode | null;
  editTargetNodeId?: string | null;
  editTargetNodeType?: string | null;
  editTargetNodeLabel?: string | null;
  editTargetActionType?: string | null;
} {
  const s = session.existingGraphSummary;
  if (!s?.hasMeaningfulNodes) {
    return {
      existingGraph: null,
      applyMode: session.applyMode ?? null,
      editTargetNodeId: session.editTargetNodeId ?? null,
      editTargetNodeType: session.editTargetNodeType ?? null,
      editTargetNodeLabel: session.editTargetNodeLabel ?? null,
      editTargetActionType: session.editTargetActionType ?? null,
    };
  }
  return {
    existingGraph: {
      nodeCount: s.nodeCount,
      connectionCount: 0,
      hasMeaningfulNodes: true,
      triggerFormId: s.triggerFormId,
      triggerFormName: s.triggerFormName,
      endNodeIds: [],
      tailNodeIds: [],
      actionTypes: s.actionTypes || [],
      hasCondition: Boolean(s.hasCondition),
      hasApprovalPattern: Boolean(s.hasApprovalPattern),
      nodes: s.nodes || [],
      editableNodes: s.editableNodes || s.nodes || [],
      lines: s.lines || [],
    },
    applyMode: session.applyMode ?? null,
    editTargetNodeId: session.editTargetNodeId ?? null,
    editTargetNodeType: session.editTargetNodeType ?? null,
    editTargetNodeLabel: session.editTargetNodeLabel ?? null,
    editTargetActionType: session.editTargetActionType ?? null,
  };
}

function replanMissing(
  session: WorkflowBuilderSession,
  form: DiscoveredForm | undefined,
  previous: MissingRequirement[],
  formsCatalog: DiscoveredForm[],
  originalRequest: string,
  orgUsers: OrgUserChoice[],
  emailTemplates: EmailTemplateChoice[],
) {
  return planMissingRequirements(
    session.requirements,
    form,
    previous,
    formsCatalog,
    originalRequest,
    orgUsers,
    emailTemplates,
    graphPlanOpts(session),
  );
}


function formatQuestion(req: MissingRequirement): string {
  const lines = [req.question];
  if (req.options?.length) {
    lines.push('');
    req.options.forEach((opt, idx) => {
      lines.push(`${idx + 1}. ${opt.label}`);
    });
    lines.push('');
    lines.push('_Reply with the option number, the field name, or a short answer._');
  }
  return lines.join('\n');
}

function resolveOptionAnswer(req: MissingRequirement, raw: string): string {
  const trimmed = raw.trim();
  const asNum = Number(trimmed);
  if (req.options?.length && Number.isFinite(asNum) && asNum >= 1 && asNum <= req.options.length) {
    return req.options[asNum - 1].value;
  }
  // Match option label
  const byLabel = req.options?.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  if (byLabel) return byLabel.value;
  const byValue = req.options?.find((o) => o.value.toLowerCase() === trimmed.toLowerCase());
  if (byValue) return byValue.value;
  // yes/no for confirm
  if (req.inputKind === 'confirm') {
    if (/^(y|yes|ok|sure|confirm|create|add|allow)\b/i.test(trimmed) && req.options?.[0]) {
      return req.options[0].value;
    }
    if (/^(n|no|skip|cancel)\b/i.test(trimmed)) {
      const skip = req.options?.find((o) => /skip|no|cancel|different|reask/i.test(o.value + o.label));
      return skip?.value || trimmed;
    }
  }
  return trimmed;
}

function mergePendingConfirmation(
  previous: PendingConfigAction[],
  next: PendingConfigAction[],
  forceConfirmIds: string[] = [],
): PendingConfigAction[] {
  const prevMap = new Map(previous.map((a) => [a.id, a]));
  return next.map((a) => {
    const prior = prevMap.get(a.id);
    const forced = forceConfirmIds.includes(a.id)
      || forceConfirmIds.some((id) => a.id.includes(id));
    return {
      ...a,
      userConfirmed: forced || prior?.userConfirmed || a.userConfirmed,
    };
  });
}

/**
 * Build pending CREATE_FIELD_VALUE actions for confirmed missing options.
 * New form fields are still not created from workflow AI Suggest.
 */
export function buildPendingActions(
  session: WorkflowBuilderSession,
  form?: DiscoveredForm,
  formsCatalog: DiscoveredForm[] = [],
): PendingConfigAction[] {
  return buildOptionCreatePendingActions(session, form, formsCatalog);
}

function permissionConfirmRequirement(
  actions: PendingConfigAction[],
): MissingRequirement {
  const lines = actions.map((a) => `• ${a.description}`).join('\n');
  return {
    id: 'pending.creates.permission',
    scope: 'metadata',
    key: 'pending_creates_permission',
    question: [
      'I need your permission before creating these form assets:',
      '',
      lines,
      '',
      'May I create them?',
    ].join('\n'),
    inputKind: 'confirm',
    options: [
      { value: '__allow_creates__', label: 'Yes, create these assets' },
      { value: '__deny_creates__', label: 'No — I will use existing fields only' },
    ],
    answered: false,
  };
}

/**
 * Start a new conversational builder session from the user's first message.
 */
export function startWorkflowBuilderSession(params: {
  prompt: string;
  form?: DiscoveredForm;
  formsCatalog?: DiscoveredForm[];
  workflows?: DiscoveredWorkflow[];
  userId?: string;
  projectId?: string;
  orgUsers?: OrgUserChoice[];
  emailTemplates?: EmailTemplateChoice[];
  /** Open designer canvas — when present, AI can EXTEND instead of REPLACE */
  existingNodes?: Array<{ id: string; type: string; label: string; position?: { x: number; y: number }; data?: any }>;
  existingConnections?: Array<{ id?: string; source: string; target: string; sourceHandle?: string | null; label?: string }>;
}): BuilderTurnResult {
  const { prompt, workflows = [], userId, projectId } = params;
  const form = hydrateDiscoveredForm(params.form);
  const formsCatalog = (params.formsCatalog || []).map((f) => hydrateDiscoveredForm(f)!).filter(Boolean);
  const orgUsers = params.orgUsers || [];
  const emailTemplates = params.emailTemplates || [];
  const existingGraph = analyzeExistingWorkflowGraph(
    params.existingNodes || [],
    params.existingConnections || [],
  );
  const analysis = analyzeWorkflowIntent(prompt, {
    formId: form?.id,
    formName: form?.name,
  });

  let session = createWorkflowBuilderSession({
    originalRequest: prompt,
    userId,
    projectId,
    formId: form?.id,
    formName: form?.name,
  });
  session.requirements = analysis.definition;
  session.status = 'collecting';
  session.existingGraphSummary = existingGraph.hasMeaningfulNodes
    ? {
      nodeCount: existingGraph.nodeCount,
      hasMeaningfulNodes: true,
      triggerFormId: existingGraph.triggerFormId,
      triggerFormName: existingGraph.triggerFormName,
      lines: existingGraph.lines,
      actionTypes: existingGraph.actionTypes,
      hasCondition: existingGraph.hasCondition,
      hasApprovalPattern: existingGraph.hasApprovalPattern,
      nodes: existingGraph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        actionType: n.actionType,
        configSnapshot: n.configSnapshot,
      })),
      editableNodes: existingGraph.editableNodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        actionType: n.actionType,
        configSnapshot: n.configSnapshot,
      })),
    }
    : null;
  session.applyMode = existingGraph.hasMeaningfulNodes ? null : 'replace';
  session.editTargetNodeId = null;
  session.editTargetNodeType = null;
  session.editTargetNodeLabel = null;
  session.editTargetActionType = null;
  session.editLoopDone = false;
  session.editPatches = [];

  // Prefer trigger form already configured on the open canvas Start node
  if (existingGraph.triggerFormId && !session.requirements.trigger.formId) {
    session.requirements.trigger = {
      ...session.requirements.trigger,
      formId: existingGraph.triggerFormId,
      formName: existingGraph.triggerFormName || form?.name,
    };
    session.requirements.objectId = session.requirements.objectId || existingGraph.triggerFormId;
    session.requirements.objectName = session.requirements.objectName || existingGraph.triggerFormName || form?.name;
  }

  // Existing workflow detection
  const existing = findExistingWorkflowsForForm(workflows, form?.name);
  const intro: string[] = [];
  const isApproval = isApprovalStyleDefinition(analysis.definition);

  const graphIntro = formatExistingGraphForIntro(existingGraph);
  if (graphIntro) {
    intro.push(graphIntro);
    intro.push('');
  }

  if (isApproval) {
    intro.push(
      `Got it — from your short goal I'll build a **${analysis.definition.levels.length || 2}-level ${analysis.definition.workflowType.replace(/_/g, ' ')}** workflow`
      + (form?.name ? ` for **${form.name}**` : '')
      + '.',
    );
    intro.push(
      'You do not need to list every node; I will ask only for missing details '
      + `(${SUBMISSION_ACCESS_FIELD_LABEL}, Level N approver users, Status field, etc.).`,
    );
  } else {
    const actionType = analysis.definition.action?.actionType || 'change_field_value';
    intro.push(
      `Got it — I'll create a workflow`
      + (form?.name ? ` for **${form.name}**` : '')
      + ` with a **${describeActionType(actionType)}** action (inferred from your short prompt).`,
    );
    if (actionType === 'create_combination_records') {
      intro.push(
        '**Single combination flow:** pick **one cross-ref** → '
        + '**Mapping 1** parent→parent (Skip/Done) → '
        + '**Mapping 2** cross-ref→parent (Skip/Done; already-mapped TO fields hidden) → '
        + 'confirm or change **target form** → then (separate step) **Auto-Link Back** '
        + 'only if target is the cross-ref child. '
        + 'Set the **Condition** node later in the designer.',
      );
    } else if (actionType === 'send_notification') {
      intro.push(
        'I will ask for the **condition**, then whether to send an **In-App** or **Email** notification '
        + '(and which email template, if Email).',
      );
    } else if (
      actionType === 'create_record'
      || actionType === 'create_linked_record'
      || actionType === 'link_existing_record'
      || actionType === 'update_linked_records'
    ) {
      intro.push(
        actionType === 'link_existing_record'
          ? 'I will ask for the **condition**, the **cross-reference field**, and Parent → Child **match field mappings** — then link an existing child (no create).'
          : 'I will ask for the **condition**, then the target form/fields. '
            + 'You can set **multiple fields** (static values or maps from the trigger form) — '
            + 'I will keep asking until you choose **Done** or **Skip**.',
      );
    } else {
      intro.push('I will ask for the **condition field** and **action field** separately — I will not ask you to pick an action type.');
    }
  }

  if (existing.length) {
    intro.push('');
    intro.push(
      `I found ${existing.length} existing workflow${existing.length > 1 ? 's' : ''} that may overlap `
      + `(${existing.slice(0, 3).map((w) => w.name).join(', ')}). `
      + 'I will create a **new** workflow unless you say **replace** or **modify**.',
    );
  }

  // Smart defaults: mention existing Submission Access Control when present
  if (isApproval) {
    const sac = findSubmissionAccessField(form);
    if (sac) {
      intro.push('');
      intro.push(
        `This form already has **${sac.label || SUBMISSION_ACCESS_FIELD_LABEL}** — `
        + 'I will reuse it to assign each level\'s approver before notifying them.',
      );
    } else {
      const suggestions = suggestApproverFields(form);
      if (suggestions.length) {
        intro.push('');
        intro.push(
          `Detected access/user fields on this form: ${suggestions.slice(0, 4).map((f) => `**${f.label}**`).join(', ')}. `
          + 'I will ask before using them.',
        );
      }
    }
  }

  session.missingInformation = replanMissing(
      session,
      form,
      [],
      formsCatalog,
      prompt,
      orgUsers,
      emailTemplates,
    );
  const nextQ = getNextMissingRequirement(session.missingInformation);

  if (!nextQ) {
    return finalizeOrPreview(session, form, undefined, formsCatalog, orgUsers, emailTemplates);
  }

  session.lastAssistantMessage = `${intro.join('\n')}\n\n${formatQuestion(nextQ)}`;
  session = touch(session);

  return {
    session,
    assistantMessage: session.lastAssistantMessage,
    promptControls: nextQ,
    readyToPublish: false,
  };
}

/**
 * Continue the session with the user's answer.
 */
export function continueWorkflowBuilderSession(params: {
  session: WorkflowBuilderSession;
  userMessage: string;
  form?: DiscoveredForm;
  formsCatalog?: DiscoveredForm[];
  orgUsers?: OrgUserChoice[];
  emailTemplates?: EmailTemplateChoice[];
}): BuilderTurnResult {
  let { session } = params;
  const form = hydrateDiscoveredForm(params.form);
  const formsCatalog = (params.formsCatalog || []).map((f) => hydrateDiscoveredForm(f)!).filter(Boolean);
  const orgUsers = params.orgUsers || [];
  const emailTemplates = params.emailTemplates || [];
  const raw = String(params.userMessage || '').trim();
  const lower = raw.toLowerCase();

  // Global commands
  if (/^(cancel|abort|stop)\b/i.test(lower)) {
    session = touch({
      ...session,
      status: 'cancelled',
      lastAssistantMessage: 'Cancelled. No workflow or fields were created.',
    });
    return {
      session,
      assistantMessage: session.lastAssistantMessage!,
      readyToPublish: false,
    };
  }

  // Batch permission for pending creates
  if (session.status === 'awaiting_confirmation') {
    const permQ = session.missingInformation.find((m) => m.key === 'pending_creates_permission' && !m.answered);
    if (permQ) {
      const answer = resolveOptionAnswer(permQ, raw);
      session.missingInformation = session.missingInformation.map((m) =>
        m.id === permQ.id ? { ...m, answered: true, answer } : m,
      );

      if (answer === '__allow_creates__' || /^(y|yes|ok|allow|confirm|create)\b/i.test(raw)) {
        session.pendingActions = session.pendingActions.map((a) => ({ ...a, userConfirmed: true }));
        session.confirmations.push({
          id: 'conf_pending_creates',
          prompt: permQ.question,
          confirmed: true,
          at: new Date().toISOString(),
        });
        return finalizeOrPreview(session, form, { createsAllowed: true }, formsCatalog, orgUsers, emailTemplates);
      }

      // Deny creates — clear pending create labels so planner re-asks for existing fields
      session.pendingActions = [];
      session.requirements = {
        ...session.requirements,
        pendingAccessFieldCreate: false,
        accessFieldId: session.requirements.accessFieldId,
        accessFieldLabel: session.requirements.accessFieldId
          ? session.requirements.accessFieldLabel
          : undefined,
        levels: session.requirements.levels.map((level) => {
          const next = {
            ...level,
            approver: { ...level.approver },
            pendingOptionValues: undefined,
            pendingDecisionFieldCreate: false,
          };
          if (!next.approver.fieldId && next.approver.fieldLabel && next.approver.type !== 'user') {
            next.approver = {
              type: 'unresolved',
              resolved: false,
              rawHint: next.approver.rawHint,
            };
          }
          if (!next.approvalFieldId && next.approvalFieldLabel) {
            next.approvalFieldId = undefined;
            next.approvalFieldLabel = undefined;
          }
          if (
            !next.rejectionFieldId
            && next.rejectionFieldLabel
            && !/^same as approval/i.test(next.rejectionFieldLabel)
          ) {
            next.rejectionFieldId = undefined;
            next.rejectionFieldLabel = undefined;
          }
          return next;
        }),
      };
      session.missingInformation = replanMissing(
      session,
      form,
      [],
      formsCatalog,
      session.originalRequest,
      orgUsers,
      emailTemplates,
    );
      const nextQ = getNextMissingRequirement(session.missingInformation);
      const msg = nextQ
        ? `Okay — I will not create new fields. Let's pick from existing ones.\n\n${formatQuestion(nextQ)}`
        : 'Okay — I will not create new fields. What would you like to change?';
      session = touch({
        ...session,
        status: 'collecting',
        lastAssistantMessage: msg,
      });
      return {
        session,
        assistantMessage: msg,
        promptControls: nextQ,
        readyToPublish: false,
      };
    }
  }

  if (session.status === 'preview' || session.status === 'ready_to_publish') {
    if (/^(publish|activate|confirm|yes|create|go ahead)\b/i.test(lower)) {
      // Block publish if unconfirmed creates remain
      const unconfirmed = (session.pendingActions || []).filter((a) => !a.userConfirmed);
      if (unconfirmed.length) {
        session.pendingActions = buildPendingActions(session, form, formsCatalog);
        const perm = permissionConfirmRequirement(session.pendingActions.filter((a) => !a.userConfirmed));
        session.missingInformation = [perm, ...session.missingInformation];
        const msg = formatQuestion(perm);
        session = touch({
          ...session,
          status: 'awaiting_confirmation',
          lastAssistantMessage: msg,
        });
        return {
          session,
          assistantMessage: msg,
          promptControls: perm,
          readyToPublish: false,
        };
      }

      const compiled = compileWorkflowDefinition(session.requirements, {
        formFields: form?.fields,
      });
      session = touch({
        ...session,
        status: 'ready_to_publish',
        compiledNodes: compiled.nodes,
        lastAssistantMessage: 'Creating this workflow…',
      });
      return {
        session,
        assistantMessage: session.lastAssistantMessage!,
        readyToPublish: true,
        compiled,
      };
    }
    if (/^(modify|change|edit)\b/i.test(lower)) {
      session = touch({
        ...session,
        status: 'collecting',
        missingInformation: replanMissing(
      session,
      form,
      [],
      formsCatalog,
      session.originalRequest,
      orgUsers,
      emailTemplates,
    ),
      });
      const nextQ = getNextMissingRequirement(session.missingInformation);
      const msg = nextQ
        ? `Okay — let's adjust.\n\n${formatQuestion(nextQ)}`
        : 'What would you like to change?';
      session.lastAssistantMessage = msg;
      return {
        session: touch(session),
        assistantMessage: msg,
        promptControls: nextQ,
        readyToPublish: false,
      };
    }
  }

  const unanswered = getNextMissingRequirement(session.missingInformation);
  if (!unanswered) {
    return finalizeOrPreview(session, form, undefined, formsCatalog, orgUsers, emailTemplates);
  }

  // Free-text field name → try metadata match for field_select questions
  let answer = resolveOptionAnswer(unanswered, raw);
  const isFieldPick = unanswered.inputKind === 'field_select'
    || unanswered.key === 'approver'
    || unanswered.key === 'approval_field'
    || unanswered.key === 'rejection_field'
    || unanswered.key === 'condition_field'
    || unanswered.key === 'action_field'
    || unanswered.key === 'action_cross_ref'
    || unanswered.key === 'action_second_cross_ref'
    || unanswered.key === 'access_field_pick';

  // Free-text user email / name for Level N approver
  if (
    (unanswered.inputKind === 'user_select' || unanswered.key === 'approver_user')
    && unanswered.options?.length
    && !unanswered.options.some((o) => o.value === answer)
  ) {
    const key = raw.toLowerCase().trim();
    const byEmail = unanswered.options.find((o) =>
      o.label.toLowerCase().includes(key) || o.value.toLowerCase() === key,
    );
    if (byEmail) answer = byEmail.value;
  }

  if (
    isFieldPick
    && form
    && answer !== '__create__'
    && answer !== '__create_level_status__'
    && answer !== '__same_as_approval__'
    && answer !== '__choose__'
    && answer !== '__reask__'
    && answer !== '__skip_create_field_values__'
    && answer !== '__done_create_fields__'
    && answer !== '__map_from_trigger__'
    && answer !== '__map_combo__'
    && answer !== '__skip_combo_maps__'
    && answer !== '__done_combo_maps__'
    && answer !== '__skip_combo_link_back__'
    && answer !== '__cancel_map__'
    && !answer.startsWith('__create_named__:')
    && !unanswered.options?.some((o) => o.value === answer)
  ) {
    // Prefer linked/target form when picking create/update target fields
    let lookupForm = form;
    const action = session.requirements.action;
    if (
      (unanswered.key === 'action_field' || unanswered.key === 'action_map_target_field')
      && action
      && (
        action.actionType === 'update_linked_records'
        || action.actionType === 'create_record'
        || action.actionType === 'create_linked_record'
        || action.actionType === 'create_combination_records'
      )
      && action.targetFormId
    ) {
      lookupForm = formsCatalog.find((f) => f.id === action.targetFormId) || form;
    }
    // Combo map menu: FROM field is on trigger / linked / second linked
    if (unanswered.key === 'action_combo_map_menu' && action?.actionType === 'create_combination_records') {
      const phase = action.comboMapPhase || 'trigger';
      if (phase === 'linked' && action.sourceLinkedFormId) {
        lookupForm = formsCatalog.find((f) => f.id === action.sourceLinkedFormId) || form;
      } else if (phase === 'second' && action.secondSourceLinkedFormId) {
        lookupForm = formsCatalog.find((f) => f.id === action.secondSourceLinkedFormId) || form;
      } else {
        lookupForm = form;
      }
    }
    // Map source: trigger by default; combo may use linked / second linked form
    if (unanswered.key === 'action_map_source_field') {
      lookupForm = form;
      if (action?.actionType === 'create_combination_records') {
        const phase = action.comboMapPhase || 'trigger';
        if (phase === 'linked' && action.sourceLinkedFormId) {
          lookupForm = formsCatalog.find((f) => f.id === action.sourceLinkedFormId) || form;
        } else if (phase === 'second' && action.secondSourceLinkedFormId) {
          lookupForm = formsCatalog.find((f) => f.id === action.secondSourceLinkedFormId) || form;
        }
      }
    }
    const match = searchFields(lookupForm, raw);
    if (match.matched) {
      answer = match.matched.id;
    } else {
      // Workflow AI Suggest never creates form fields — ask user to pick an existing one
      const existingOpts = unanswered.options?.filter((o) =>
        !String(o.value).startsWith('__create'),
      ) || [];
      const reask: MissingRequirement = {
        id: unanswered.id,
        scope: unanswered.scope,
        level: unanswered.level,
        key: unanswered.key,
        question: `I couldn't find **${raw.trim()}** on this form. Please choose an existing field (add fields/options in the form builder if needed).`,
        inputKind: 'field_select',
        options: existingOpts.length
          ? existingOpts
          : undefined,
        answered: false,
      };
      session.missingInformation = [
        reask,
        ...session.missingInformation.filter((m) => m.id !== unanswered.id),
      ];
      const msg = formatQuestion(reask);
      session = touch({
        ...session,
        status: 'collecting',
        lastAssistantMessage: msg,
      });
      return {
        session,
        assistantMessage: msg,
        promptControls: reask,
        readyToPublish: false,
      };
    }
  }

  // Mark answered
  session.missingInformation = session.missingInformation.map((m) =>
    m.id === unanswered.id ? { ...m, answered: true, answer } : m,
  );

  // Track create intents as pending actions needing later confirmation
  if (
    answer === '__create__'
    || answer.startsWith('__create_named__:')
    || answer === 'add_generic'
    || answer === 'add_leveled'
  ) {
    session.confirmations.push({
      id: `conf_${unanswered.id}`,
      prompt: unanswered.question,
      confirmed: true,
      at: new Date().toISOString(),
    });
  }

  // __reask__ — clear and re-plan without applying a bogus field id
  if (answer === '__reask__') {
    session.requirements = applyAnswerToDefinition(
      session.requirements,
      unanswered,
      answer,
      form,
      formsCatalog,
      emailTemplates,
    );
    session.missingInformation = replanMissing(
      session,
      form,
      session.missingInformation.filter((m) => m.id !== unanswered.id && !m.id.endsWith('.create_permission')),
      formsCatalog,
      session.originalRequest,
      orgUsers,
      emailTemplates,
    );
    const nextQ = getNextMissingRequirement(session.missingInformation);
    const msg = nextQ
      ? `Okay — pick from existing fields.\n\n${formatQuestion(nextQ)}`
      : 'Okay — what should we use instead?';
    session = touch({
      ...session,
      status: 'collecting',
      lastAssistantMessage: msg,
    });
    return {
      session,
      assistantMessage: msg,
      promptControls: nextQ,
      readyToPublish: false,
    };
  }

  // Apply mode is session-level (edit / append / replace open designer canvas)
  if (unanswered.key === 'apply_mode') {
    let mode: WorkflowApplyMode = 'append';
    if (answer === 'replace' || /^replace$/i.test(answer)) mode = 'replace';
    else if (answer === 'edit' || /^edit$/i.test(answer)) mode = 'edit';
    else if (answer === 'extend' || answer === 'append' || /append|extend|continue|add/i.test(answer)) {
      mode = 'append';
    }
    session.applyMode = mode;
    if (mode !== 'edit') {
      session.editTargetNodeId = null;
      session.editTargetNodeType = null;
      session.editTargetNodeLabel = null;
      session.editTargetActionType = null;
    }
    session.missingInformation = replanMissing(
      session,
      form,
      session.missingInformation,
      formsCatalog,
      session.originalRequest,
      orgUsers,
      emailTemplates,
    );
    const nextQ = getNextMissingRequirement(session.missingInformation);
    const ack = mode === 'edit'
      ? "Got it — I'll **edit an existing node** in place."
      : mode === 'append' || mode === 'extend'
        ? "Got it — I'll **add / append new node(s)** and keep the rest of the workflow."
        : "Got it — I'll **replace** the current canvas with a new plan.";
    const msg = nextQ ? `${ack}\n\n${formatQuestion(nextQ)}` : ack;
    session = touch({
      ...session,
      status: 'collecting',
      lastAssistantMessage: msg,
    });
    return {
      session,
      assistantMessage: msg,
      promptControls: nextQ,
      readyToPublish: false,
    };
  }

  if (unanswered.key === 'apply_edit_node') {
    const nodes = session.existingGraphSummary?.editableNodes
      || session.existingGraphSummary?.nodes
      || [];
    const picked = nodes.find((n) => n.id === answer)
      || nodes.find((n) => n.label.toLowerCase() === answer.toLowerCase());
    session.editTargetNodeId = picked?.id || answer;
    session.editTargetNodeType = picked?.type || null;
    session.editTargetNodeLabel = picked?.label || answer;
    session.editTargetActionType = picked?.actionType || null;
    session.applyMode = 'edit';
    session.editLoopDone = false;

    // Align inferred action with the node being edited when it's an action node.
    // Do NOT overwrite a prompt-inferred create/linked/update/combo/notification
    // type with the existing node's type (e.g. keep create_linked_record when
    // the canvas node was still create_record).
    const t = String(picked?.type || '').toLowerCase();
    const existingAt = String(picked?.actionType || '').toLowerCase();
    const inferredAt = String(session.requirements.action?.actionType || '').toLowerCase();
    // First edit may upgrade create_record → linked from the prompt.
    // Later "edit another" passes should keep each node's own action type.
    const subsequentEdit = (session.editPatches?.length || 0) > 0;
    const promptHasSpecificAction = !subsequentEdit && [
      'create_record',
      'create_linked_record',
      'link_existing_record',
      'update_linked_records',
      'create_combination_records',
      'send_notification',
    ].includes(inferredAt);
    if (
      session.requirements.action
      && (t === 'action' || t === 'notification' || t === 'approval')
    ) {
      if (
        existingAt
        && existingAt !== 'action'
        && (!promptHasSpecificAction || subsequentEdit)
      ) {
        session.requirements = {
          ...session.requirements,
          action: {
            ...session.requirements.action,
            actionType: picked!.actionType as any,
            configured: false,
          },
        };
      }

      // For linked create/update/link-existing, always re-run XR + field Q&A with proper options
      const effectiveType = String(session.requirements.action?.actionType || '').toLowerCase();
      const isLinkedEdit = effectiveType === 'create_linked_record'
        || effectiveType === 'update_linked_records'
        || effectiveType === 'link_existing_record';
      const upgradingToLinked = promptHasSpecificAction
        && isLinkedEdit
        && existingAt !== effectiveType;
      seedActionFromCanvasSnapshot(
        session,
        picked?.configSnapshot,
        {
          forceType: promptHasSpecificAction ? inferredAt : (existingAt && existingAt !== 'action' ? existingAt : undefined),
          // Always clear linked fields so XR/target/field options are asked fresh
          clearLinkedFields: Boolean(isLinkedEdit || upgradingToLinked),
        },
      );
      if (session.requirements.action && isLinkedEdit) {
        session.requirements.action.createFieldsDone = undefined;
        session.requirements.action.skipCreateFieldValues = undefined;
        session.requirements.action.configured = false;
      }
    }

    // Clear prior node-config answers so this edit gets fresh questions
    session.missingInformation = (session.missingInformation || []).filter((m) => (
      m.key === 'apply_mode'
      || m.key === 'apply_edit_node'
      || m.key === 'apply_after_edit'
      || m.answered === false
    )).map((m) => (
      m.key === 'apply_edit_node'
        ? { ...m, answered: true, answer }
        : m
    ));
    clearAnsweredRequirement(session, 'apply.after_edit');
    clearAnsweredRequirement(session, 'trigger.form.edit_start');
    clearAnsweredRequirement(session, 'action.cross_ref');
    clearAnsweredRequirement(session, 'action.target_form');
    clearAnsweredRequirement(session, 'action.create_field');
    clearAnsweredRequirement(session, 'action.create_field_value');
    clearAnsweredRequirement(session, 'action.create_map_target');
    clearAnsweredRequirement(session, 'action.create_map_source');

    session.missingInformation = replanMissing(
      session,
      form,
      session.missingInformation,
      formsCatalog,
      session.originalRequest,
      orgUsers,
      emailTemplates,
    );
    const nextQ = getNextMissingRequirement(session.missingInformation);
    const label = picked?.label || answer;
    const actionType = session.requirements.action?.actionType;
    const linkedHint = actionType === 'create_linked_record'
      ? ' I will ask for the **cross-reference field**, linked form, and field values.'
      : actionType === 'link_existing_record'
        ? ' I will ask for the **cross-reference field** and Parent → Child match mappings (no create).'
      : actionType === 'update_linked_records'
        ? ' I will ask for the **cross-reference field** and which linked fields to update.'
        : '';
    const ack = t === 'start'
      ? `Editing **${label}** — pick which form this workflow should start from.`
      : `Editing **${label}** — I'll update that node only.${linkedHint}`;
    const msg = nextQ ? `${ack}\n\n${formatQuestion(nextQ)}` : ack;
    session = touch({
      ...session,
      status: 'collecting',
      lastAssistantMessage: msg,
    });
    return {
      session,
      assistantMessage: msg,
      promptControls: nextQ,
      readyToPublish: false,
    };
  }

  if (unanswered.key === 'apply_after_edit') {
    queueCurrentEditPatch(session, form);
    const wantsAnother = answer === '__edit_another__'
      || /another|more|continue|edit\s+again/i.test(answer);
    if (wantsAnother) {
      session.editTargetNodeId = null;
      session.editTargetNodeType = null;
      session.editTargetNodeLabel = null;
      session.editTargetActionType = null;
      session.editLoopDone = false;
      session.applyMode = 'edit';
      // Soft-reset action so next node can reconfigure; keep prompt-inferred type
      if (session.requirements.action) {
        session.requirements.action = {
          ...session.requirements.action,
          configured: false,
          createFieldsDone: undefined,
          skipCreateFieldValues: undefined,
          crossReferenceFieldId: undefined,
          crossReferenceFieldLabel: undefined,
          sourceCrossRefFieldId: undefined,
          sourceCrossRefFieldLabel: undefined,
          targetFormId: undefined,
          targetFormName: undefined,
          createFieldValues: [],
          createFieldMappings: [],
          targetFieldId: undefined,
          targetFieldLabel: undefined,
          staticValue: undefined,
        };
      }
      clearAnsweredRequirement(session, 'apply.edit_node');
      clearAnsweredRequirement(session, 'apply.after_edit');
      clearAnsweredRequirement(session, 'trigger.form.edit_start');
      clearAnsweredRequirement(session, 'action.cross_ref');
      clearAnsweredRequirement(session, 'action.target_form');
      clearAnsweredRequirement(session, 'action.create_field');
      clearAnsweredRequirement(session, 'action.create_field_value');
      session.missingInformation = replanMissing(
        session,
        form,
        session.missingInformation.filter((m) => m.key === 'apply_mode' || !m.answered),
        formsCatalog,
        session.originalRequest,
        orgUsers,
        emailTemplates,
      );
      const nextQ = getNextMissingRequirement(session.missingInformation);
      const ack = 'Okay — pick **another node** to edit (or choose Done when you finish).';
      const msg = nextQ ? `${ack}\n\n${formatQuestion(nextQ)}` : ack;
      session = touch({
        ...session,
        status: 'collecting',
        lastAssistantMessage: msg,
      });
      return {
        session,
        assistantMessage: msg,
        promptControls: nextQ,
        readyToPublish: false,
      };
    }

    // Done editing
    session.editLoopDone = true;
    clearAnsweredRequirement(session, 'apply.after_edit');
    return finalizeOrPreview(session, form, undefined, formsCatalog, orgUsers, emailTemplates);
  }

  session.requirements = applyAnswerToDefinition(
    session.requirements,
    unanswered,
    answer,
    form,
    formsCatalog,
    emailTemplates,
  );

  // Re-plan with updated definition
  session.missingInformation = replanMissing(
      session,
      form,
      session.missingInformation,
      formsCatalog,
      session.originalRequest,
      orgUsers,
      emailTemplates,
    );

  const forceConfirm: string[] = [];
  if (answer === '__create__' || answer.startsWith('__create_named__:')) {
    if (unanswered.level) forceConfirm.push(`l${unanswered.level}`);
  }
  if (answer === '__create_level_status__') {
    if (unanswered.level) forceConfirm.push(`create_field_level_status_l${unanswered.level}`);
  }
  if (answer === 'add_generic' || answer === 'add_leveled') {
    if (unanswered.level) forceConfirm.push(`create_value_l${unanswered.level}`);
  }
  if (answer === '__create_sac__') {
    forceConfirm.push('create_field_submission_access');
  }

  session.pendingActions = mergePendingConfirmation(
    session.pendingActions,
    buildPendingActions(session, form, formsCatalog),
    forceConfirm,
  );

  // Choosing create marks the matching pending field action as user-intent-confirmed
  // (batch permission still required before preview if any remain unconfirmed — see finalize)
  if (answer === '__create__' || answer.startsWith('__create_named__:') || answer === '__create_sac__' || answer === '__create_level_status__') {
    session.pendingActions = session.pendingActions.map((a) => {
      if (a.id === 'create_field_submission_access' && answer === '__create_sac__') {
        return { ...a, userConfirmed: true };
      }
      if (
        answer === '__create_level_status__'
        && unanswered.level
        && a.id === `create_field_level_status_l${unanswered.level}`
      ) {
        return { ...a, userConfirmed: true };
      }
      if (unanswered.level && a.id.includes(`l${unanswered.level}`) && a.kind === 'CREATE_FIELD') {
        return { ...a, userConfirmed: true };
      }
      return a;
    });
  }

  const nextQ = getNextMissingRequirement(session.missingInformation);
  if (nextQ) {
    const ack = buildAck(unanswered, answer, form, orgUsers);
    const msg = `${ack}\n\n${formatQuestion(nextQ)}`;
    session = touch({
      ...session,
      status: 'collecting',
      lastAssistantMessage: msg,
    });
    return {
      session,
      assistantMessage: msg,
      promptControls: nextQ,
      readyToPublish: false,
    };
  }

  return finalizeOrPreview(session, form, undefined, formsCatalog, orgUsers, emailTemplates);
}

function buildAck(
  req: MissingRequirement,
  answer: string,
  form?: DiscoveredForm,
  orgUsers: OrgUserChoice[] = [],
): string {
  const field = form?.fields.find((f) => f.id === answer);
  const optionLabel = req.options?.find((o) => o.value === answer)?.label;
  const named = answer.startsWith('__create_named__:')
    ? answer.slice('__create_named__:'.length).trim()
    : '';
  const user = orgUsers.find((u) => u.id === answer)
    || orgUsers.find((u) => u.email.toLowerCase() === answer.toLowerCase());

  if (req.key === 'access_field_ensure') {
    if (answer === '__create_sac__' || /^(y|yes)/i.test(answer)) {
      return `Okay — I'll create **${SUBMISSION_ACCESS_FIELD_LABEL}** when we publish.`;
    }
    return 'Okay — pick an existing access/user field instead.';
  }
  if (req.key === 'access_field_pick') {
    if (field) return `I'll assign approvers on **${field.label}**.`;
    return `Access field noted.`;
  }
  if (req.key === 'approver_user') {
    const label = user?.label || user?.email || answer;
    return `Level ${req.level} approver set to **${label}** (via ${SUBMISSION_ACCESS_FIELD_LABEL}).`;
  }

  if (req.key === 'action_notification_channel') {
    if (answer === 'email' || /^email$/i.test(answer)) {
      return "Got it — I'll send an **Email** notification.";
    }
    return "Got it — I'll send an **In-App** notification.";
  }
  if (req.key === 'action_email_template') {
    if (answer === 'in_app' || /^in[-\s]?app$/i.test(answer)) {
      return 'Okay — switching to an **In-App** notification instead.';
    }
    const label = optionLabel || answer;
    return `I'll use the **${label}** email template.`;
  }
  if (req.key === 'apply_mode') {
    if (answer === 'replace' || /^replace$/i.test(answer)) {
      return "Okay — I'll replace the current canvas with a new plan.";
    }
    if (answer === 'edit' || /^edit$/i.test(answer)) {
      return "Okay — I'll edit an existing node in place.";
    }
    return "Okay — I'll add / append new node(s) and keep the rest of the workflow.";
  }
  if (req.key === 'apply_edit_node') {
    const label = optionLabel || answer;
    return `Okay — editing **${label}**.`;
  }
  if (req.key === 'apply_after_edit') {
    if (answer === '__edit_another__' || /another|more|continue/i.test(answer)) {
      return 'Okay — pick another node to edit.';
    }
    return 'Okay — finishing edits and preparing the preview.';
  }

  if (req.key.includes('approver')) {
    if (field) return `Got it. I'll use **${field.label}** for Level ${req.level} approval.`;
    if (answer === '__create__' || named) {
      return `Okay — I'll create **${named || 'a User field'}** for Level ${req.level} after you confirm the final plan.`;
    }
    return `Got it for Level ${req.level}.`;
  }
  if (req.key === 'approval_field' || req.key === 'approval_field_create') {
    if (answer === '__create_level_status__' || answer === '__create__' || named) {
      return `Okay — I'll create **${named || `Level ${req.level} Status`}** (Pending / Approved / Rejected) when we publish.`;
    }
    if (field) return `I'll use **${field.label}** for Level ${req.level} decisions (Approved / Rejected).`;
    return `Noted for Level ${req.level} decision field.`;
  }
  if (req.key === 'rejection_field' || req.key === 'rejection_field_create') {
    if (answer === '__same_as_approval__') {
      return `Level ${req.level} rejection will use the same field as approval.`;
    }
    if (field) return `I'll use **${field.label}** for Level ${req.level} rejection.`;
    if (answer === '__create__' || named) {
      return `Okay — I'll create **${named || `Level ${req.level} Rejection`}** after you confirm.`;
    }
    return `Noted for Level ${req.level} rejection field.`;
  }
  if (req.key === 'rejection_route') {
    if (answer.startsWith('level:') || /^level:\d+$/i.test(answer)) {
      const n = answer.split(':')[1];
      return `If Level ${req.level} rejects, I'll **loop back to Approver ${n}**.`;
    }
    if (answer === 'START_OVER') {
      return `If Level ${req.level} rejects, I'll **start over from Approver 1**.`;
    }
    if (answer === 'RETURN_TO_REQUESTER') {
      return `If Level ${req.level} rejects, I'll **notify the requester and stop the approval**.`;
    }
    if (answer === 'END_WORKFLOW') {
      return `If Level ${req.level} rejects, I'll **end the workflow**.`;
    }
    return `Rejection routing for Level ${req.level} saved.`;
  }
  if (req.key === 'main_status_sync') {
    if (answer === '__sync_main_status__' || /^(y|yes|ok|allow|confirm|add|sync)\b/i.test(answer)) {
      return 'Got it — I\'ll sync the main **Status** from each Level N Status and add any missing options when we publish.';
    }
    return 'Okay — I\'ll leave the main Status field unchanged by the approval workflow.';
  }
  if (req.key === 'decision_values') {
    return answer === 'skip'
      ? 'Continuing with existing values.'
      : "I'll add those values after you confirm the final plan.";
  }
  if (req.key === 'condition_field') {
    if (field) return `Condition will use **${field.label}**.`;
    return 'Condition field noted.';
  }
  if (req.key === 'condition_value') {
    return `Condition value set to **${answer}**.`;
  }
  if (req.key === 'condition_value_create') {
    if (answer === '__create_option__' || /^(y|yes)/i.test(answer)) {
      return "I'll add that option when we publish the workflow.";
    }
    return 'Okay — pick an existing option instead.';
  }
  if (req.key === 'action_cross_ref') {
    if (field) return `I'll use cross-reference **${field.label}**.`;
    return 'Cross-reference field noted.';
  }
  if (req.key === 'action_second_cross_ref') {
    if (field) return `Second cross-reference set to **${field.label}**.`;
    return 'Second cross-reference field noted.';
  }
  if (req.key === 'action_combo_mode') {
    return answer === 'dual'
      ? 'Dual — exactly **two** cross-reference fields on the parent form (XR₁ × XR₂).'
      : 'Single — **parent form** × **one cross-ref (child) form**.';
  }
  if (req.key === 'action_combo_link_back') {
    if (answer === '__skip_combo_link_back__' || /^skip\b/i.test(answer)) {
      return 'Okay — no auto-link back to a parent cross-ref field.';
    }
    if (field) {
      return `New records will be linked back into **${field.label}** on the parent form.`;
    }
    return 'Auto-link back field noted.';
  }
  if (req.key === 'action_combo_confirm') {
    if (answer === '__redo_combo_xr__') {
      return 'Okay — pick a different cross-ref field.';
    }
    if (answer === '__redo_combo_dest__') {
      return 'Okay — choose the target form again.';
    }
    if (answer === '__redo_combo_target__' || /^pick\s+a\s+different\s+destination\b/i.test(answer)) {
      return 'Okay — pick a different destination form.';
    }
    if (answer === '__redo_combo_maps__' || /^change\b/i.test(answer)) {
      return 'Okay — we\'ll go back and set field mappings again.';
    }
    return 'Combination action confirmed — including any field mappings you set.';
  }
  if (req.key === 'action_combo_dest') {
    return `Target form set to **${optionLabel || answer}**.`;
  }
  if (req.key === 'action_combo_map_menu') {
    if (answer === '__skip_combo_maps__' || /^skip\b/i.test(answer)) {
      return 'Okay — skipped. Continuing to the next mapping step.';
    }
    if (answer === '__done_combo_maps__' || /^done\b/i.test(answer)) {
      return 'Got it — continuing to the next mapping step.';
    }
    const fromName = field?.label
      || (optionLabel ? optionLabel.replace(/^FROM\s+[^:]+:\s*/i, '').replace(/\s*\([^)]+\)\s*$/, '') : '')
      || answer;
    if (fromName && !String(fromName).startsWith('__')) {
      return `FROM **${fromName}** selected. Now pick the **TO** field on the new record.`;
    }
    return 'FROM field noted — next pick the TO field.';
  }
  if (req.key === 'action_target_form') {
    return `Destination form set to **${answer}**.`;
  }
  if (req.key === 'action_field') {
    if (answer === '__skip_create_field_values__' || /^skip\b/i.test(answer)) {
      return 'Okay — I\'ll create the record with empty/default field values.';
    }
    if (answer === '__done_create_fields__' || /^done\b/i.test(answer)) {
      return 'Got it — I\'ll stop adding fields for the new record.';
    }
    if (answer === '__map_from_trigger__' || /^map\b/i.test(answer)) {
      return 'Okay — we\'ll map a field from the trigger form. Pick the field on the new record first.';
    }
    if (field) return `Action will update **${field.label}**.`;
    return 'Action field noted.';
  }
  if (req.key === 'action_map_target_field') {
    if (answer === '__cancel_map__' || /^cancel\b/i.test(answer)) {
      return 'Mapping cancelled.';
    }
    const toName = field?.label
      || (optionLabel ? optionLabel.replace(/^TO\s+[^:]+:\s*/i, '').replace(/\s*\([^)]+\)\s*$/, '') : '')
      || answer;
    if (toName && !String(toName).startsWith('__')) {
      return `Mapped TO **${toName}** on the new record.`;
    }
    return 'TO field for mapping noted.';
  }
  if (req.key === 'action_map_source_field') {
    if (answer === '__cancel_map__' || /^cancel\b/i.test(answer)) {
      return 'Mapping cancelled.';
    }
    if (field) return `I'll copy FROM **${field.label}** into the new combination record.`;
    return 'FROM field for mapping noted.';
  }
  if (req.key === 'action_value') {
    return `Action value set to **${answer}**.`;
  }
  if (req.key === 'action_value_create') {
    if (answer === '__create_option__' || /^(y|yes)/i.test(answer)) {
      return "I'll add that option when we publish the workflow.";
    }
    return 'Okay — pick an existing option instead.';
  }
  return 'Thanks.';
}

function finalizeOrPreview(
  session: WorkflowBuilderSession,
  form?: DiscoveredForm,
  opts?: { createsAllowed?: boolean },
  formsCatalog: DiscoveredForm[] = [],
  orgUsers: OrgUserChoice[] = [],
  emailTemplates: EmailTemplateChoice[] = [],
): BuilderTurnResult {
  session.pendingActions = mergePendingConfirmation(
    session.pendingActions,
    buildPendingActions(session, form, formsCatalog),
  );

  if (opts?.createsAllowed) {
    session.pendingActions = session.pendingActions.map((a) => ({ ...a, userConfirmed: true }));
  }

  const issues = validateWorkflowDefinition(session.requirements);
  session.validationIssues = issues;

  if (hasBlockingValidationErrors(issues)) {
    const msg = [
      'I still need to resolve these issues before building the workflow:',
      ...issues.filter((i) => i.severity === 'error').map((i) => `- ${i.message}`),
      '',
      'Please provide the missing details.',
    ].join('\n');
    session.missingInformation = replanMissing(
      session,
      form,
      session.missingInformation,
      formsCatalog,
      session.originalRequest,
      orgUsers,
      emailTemplates,
    );
    const nextQ = getNextMissingRequirement(session.missingInformation);
    session = touch({
      ...session,
      status: 'collecting',
      lastAssistantMessage: nextQ ? `${msg}\n\n${formatQuestion(nextQ)}` : msg,
    });
    return {
      session,
      assistantMessage: session.lastAssistantMessage!,
      promptControls: nextQ,
      readyToPublish: false,
    };
  }

  // Batch permission gate for any still-unconfirmed creates
  const unconfirmed = session.pendingActions.filter((a) => !a.userConfirmed);
  if (unconfirmed.length) {
    const perm = permissionConfirmRequirement(unconfirmed);
    session.missingInformation = [perm, ...session.missingInformation.filter((m) => m.key !== 'pending_creates_permission')];
    const msg = formatQuestion(perm);
    session = touch({
      ...session,
      status: 'awaiting_confirmation',
      lastAssistantMessage: msg,
    });
    return {
      session,
      assistantMessage: msg,
      promptControls: perm,
      readyToPublish: false,
    };
  }

  // Edit mode: after one node is configured, offer Edit another / Done until user stops
  if (
    session.applyMode === 'edit'
    && session.editTargetNodeId
    && !session.editLoopDone
  ) {
    queueCurrentEditPatch(session, form);
    const editedLabel = session.editTargetNodeLabel || session.editTargetNodeId;
    const patchCount = session.editPatches?.length || 1;
    const afterEdit: MissingRequirement = {
      id: 'apply.after_edit',
      scope: 'workflow',
      key: 'apply_after_edit',
      question: [
        `Updated **${editedLabel}** (${patchCount} node${patchCount === 1 ? '' : 's'} queued).`,
        '',
        'What do you want to do next?',
      ].join('\n'),
      inputKind: 'choice',
      options: [
        { value: '__edit_another__', label: 'Edit another existing node' },
        { value: '__done_editing__', label: 'Done — preview & apply' },
      ],
      answered: false,
    };
    session.missingInformation = [
      afterEdit,
      ...session.missingInformation.filter((m) => m.key !== 'apply_after_edit'),
    ];
    const msg = formatQuestion(afterEdit);
    session = touch({
      ...session,
      status: 'collecting',
      lastAssistantMessage: msg,
    });
    return {
      session,
      assistantMessage: msg,
      promptControls: afterEdit,
      readyToPublish: false,
    };
  }

  // Ensure the last edit is queued before preview
  if (session.applyMode === 'edit' && session.editTargetNodeId) {
    queueCurrentEditPatch(session, form);
  }

  const preview = generateWorkflowPreview(
    session.requirements,
    session.pendingActions,
    issues,
  );
  session.preview = preview;
  session.requirements = { ...session.requirements, status: 'VALIDATED' };
  const markdown = formatPreviewAsMarkdown(preview);
  const patchNote = session.applyMode === 'edit' && (session.editPatches?.length || 0) > 0
    ? `\n\n**Apply mode:** Edit ${session.editPatches!.length} existing node(s) in place:`
      + session.editPatches!.map((p) => `\n- ${p.label || p.nodeId}`).join('')
    : session.applyMode === 'edit'
      ? `\n\n**Apply mode:** Edit existing node **${session.editTargetNodeLabel || session.editTargetNodeId || ''}** in place.`
      : session.applyMode === 'append' || session.applyMode === 'extend'
        ? '\n\n**Apply mode:** Add / append new node(s) (existing nodes kept).'
        : session.applyMode === 'replace' && session.existingGraphSummary?.hasMeaningfulNodes
          ? '\n\n**Apply mode:** Replace the open workflow canvas.'
          : '';
  session = touch({
    ...session,
    status: 'preview',
    lastAssistantMessage: markdown + patchNote,
  });

  return {
    session,
    assistantMessage: markdown + patchNote,
    promptControls: null,
    readyToPublish: false,
    applyMode: session.applyMode ?? null,
  };
}
