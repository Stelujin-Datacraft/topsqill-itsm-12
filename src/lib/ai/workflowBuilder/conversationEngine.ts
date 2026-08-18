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
  type DiscoveredForm,
  type DiscoveredWorkflow,
  findExistingWorkflowsForForm,
} from './metadataDiscovery';
import { validateWorkflowDefinition, hasBlockingValidationErrors } from './validationEngine';
import { generateWorkflowPreview, formatPreviewAsMarkdown } from './previewGenerator';
import { compileWorkflowDefinition } from './nodeCompiler';

export interface BuilderTurnResult {
  session: WorkflowBuilderSession;
  assistantMessage: string;
  /** Structured controls for the UI (optional) */
  promptControls?: MissingRequirement | null;
  /** Ready to execute create_workflow */
  readyToPublish: boolean;
  compiled?: ReturnType<typeof compileWorkflowDefinition>;
}

function touch(session: WorkflowBuilderSession): WorkflowBuilderSession {
  return { ...session, updatedAt: new Date().toISOString() };
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

export function buildPendingActions(
  session: WorkflowBuilderSession,
  form?: DiscoveredForm,
): PendingConfigAction[] {
  const actions: PendingConfigAction[] = [];
  const formId = form?.id || session.requirements.trigger.formId;

  for (const level of session.requirements.levels) {
    if (!level.approvalFieldId && level.approvalFieldLabel) {
      actions.push({
        id: `create_field_decision_l${level.level}`,
        kind: 'CREATE_FIELD',
        description: `${level.approvalFieldLabel} — Choice (Level ${level.level} approval decision)`,
        payload: {
          label: level.approvalFieldLabel,
          type: 'select',
          formId,
          role: 'approval_field',
          level: level.level,
          options: [
            `Pending Level ${level.level}`,
            `Approved Level ${level.level}`,
            `Rejected Level ${level.level}`,
          ],
        },
        userConfirmed: false,
      });
    }

    if (
      !level.rejectionFieldId
      && level.rejectionFieldLabel
      && level.rejectionFieldLabel !== level.approvalFieldLabel
      && !/^same as approval/i.test(level.rejectionFieldLabel)
    ) {
      actions.push({
        id: `create_field_rejection_l${level.level}`,
        kind: 'CREATE_FIELD',
        description: `${level.rejectionFieldLabel} — Choice (Level ${level.level} rejection)`,
        payload: {
          label: level.rejectionFieldLabel,
          type: 'select',
          formId,
          role: 'rejection_field',
          level: level.level,
          options: [
            `Pending Level ${level.level}`,
            `Rejected Level ${level.level}`,
          ],
        },
        userConfirmed: false,
      });
    }

    if (
      level.approver.rawHint
      && !level.approver.fieldId
      && level.approver.resolved
      && level.approver.fieldLabel
    ) {
      actions.push({
        id: `create_field_approver_l${level.level}`,
        kind: 'CREATE_FIELD',
        description: `${level.approver.fieldLabel} — User (Level ${level.level} approver)`,
        payload: {
          label: level.approver.fieldLabel,
          type: 'user-picker',
          formId,
          role: 'approver',
          level: level.level,
        },
        userConfirmed: false,
      });
    }

    if (level.pendingOptionValues?.length && level.approvalFieldId) {
      for (const valueLabel of level.pendingOptionValues) {
        actions.push({
          id: `create_value_l${level.level}_${valueLabel.replace(/\s+/g, '_').toLowerCase()}`,
          kind: 'CREATE_FIELD_VALUE',
          description: `${valueLabel} on ${level.approvalFieldLabel || 'decision field'}`,
          payload: {
            fieldId: level.approvalFieldId,
            fieldLabel: level.approvalFieldLabel,
            valueLabel,
            formId,
            level: level.level,
          },
          userConfirmed: true, // user already answered the decision_values confirm
        });
      }
    }
  }

  return actions;
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
  workflows?: DiscoveredWorkflow[];
  userId?: string;
  projectId?: string;
}): BuilderTurnResult {
  const { prompt, form, workflows = [], userId, projectId } = params;
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

  // Existing workflow detection
  const existing = findExistingWorkflowsForForm(workflows, form?.name);
  const intro: string[] = [];
  intro.push(
    `I can create a **${analysis.definition.levels.length || 2}-level ${analysis.definition.workflowType.replace(/_/g, ' ')}** workflow`
    + (form?.name ? ` for **${form.name}**` : '')
    + '.',
  );

  if (existing.length) {
    intro.push('');
    intro.push(
      `I found ${existing.length} existing workflow${existing.length > 1 ? 's' : ''} that may overlap `
      + `(${existing.slice(0, 3).map((w) => w.name).join(', ')}). `
      + 'I will create a **new** workflow unless you say **replace** or **modify**.',
    );
  }

  // Smart defaults: suggest approver fields if none hinted
  const suggestions = suggestApproverFields(form);
  if (suggestions.length && analysis.definition.levels.some((l) => !l.approver.rawHint)) {
    intro.push('');
    intro.push(
      `Detected user/assignee fields on this form: ${suggestions.slice(0, 4).map((f) => `**${f.label}**`).join(', ')}. `
      + 'I will ask before using them.',
    );
  }

  session.missingInformation = planMissingRequirements(
    session.requirements,
    form,
    [],
  );
  const nextQ = getNextMissingRequirement(session.missingInformation);

  if (!nextQ) {
    return finalizeOrPreview(session, form);
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
}): BuilderTurnResult {
  let { session, form } = params;
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
        return finalizeOrPreview(session, form, { createsAllowed: true });
      }

      // Deny creates — clear pending create labels so planner re-asks for existing fields
      session.pendingActions = [];
      session.requirements = {
        ...session.requirements,
        levels: session.requirements.levels.map((level) => {
          const next = {
            ...level,
            approver: { ...level.approver },
            pendingOptionValues: undefined,
          };
          if (!next.approver.fieldId && next.approver.fieldLabel) {
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
      session.missingInformation = planMissingRequirements(session.requirements, form, []);
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
        session.pendingActions = buildPendingActions(session, form);
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
        missingInformation: planMissingRequirements(session.requirements, form, []),
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
    return finalizeOrPreview(session, form);
  }

  // Free-text field name → try metadata match for field_select questions
  let answer = resolveOptionAnswer(unanswered, raw);
  const isFieldPick = unanswered.inputKind === 'field_select'
    || unanswered.key === 'approver'
    || unanswered.key === 'approval_field'
    || unanswered.key === 'rejection_field';

  if (
    isFieldPick
    && form
    && answer !== '__create__'
    && answer !== '__same_as_approval__'
    && answer !== '__choose__'
    && answer !== '__reask__'
    && !answer.startsWith('__create_named__:')
    && !unanswered.options?.some((o) => o.value === answer)
  ) {
    const match = searchFields(form, raw);
    if (match.matched) {
      answer = match.matched.id;
    } else {
      // Ask permission to create the named field — do not invent silently
      const createTypeHint = unanswered.key.includes('approver')
        ? 'User'
        : 'Choice';
      const createPerm: MissingRequirement = {
        id: `${unanswered.id}.create_permission`,
        scope: unanswered.scope,
        level: unanswered.level,
        key: unanswered.key.includes('approver')
          ? 'approver_confirm'
          : unanswered.key === 'rejection_field'
            ? 'rejection_field_create'
            : 'approval_field_create',
        question: `I couldn't find **${raw.trim()}** on this form. Create it as a new ${createTypeHint} field? (requires your permission)`,
        inputKind: 'confirm',
        options: [
          { value: `__create_named__:${raw.trim()}`, label: `Yes, create "${raw.trim()}"` },
          { value: '__reask__', label: 'No, choose from existing fields' },
        ],
        answered: false,
      };
      // Keep original unanswered so __reask__ can fall through to planner
      session.missingInformation = [
        createPerm,
        ...session.missingInformation.filter((m) => m.id !== unanswered.id),
        { ...unanswered, answered: false },
      ];
      const msg = formatQuestion(createPerm);
      session = touch({
        ...session,
        status: 'collecting',
        lastAssistantMessage: msg,
      });
      return {
        session,
        assistantMessage: msg,
        promptControls: createPerm,
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
    );
    session.missingInformation = planMissingRequirements(
      session.requirements,
      form,
      session.missingInformation.filter((m) => m.id !== unanswered.id && !m.id.endsWith('.create_permission')),
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

  session.requirements = applyAnswerToDefinition(
    session.requirements,
    unanswered,
    answer,
    form,
  );

  // Re-plan with updated definition
  session.missingInformation = planMissingRequirements(
    session.requirements,
    form,
    session.missingInformation,
  );

  const forceConfirm: string[] = [];
  if (answer === '__create__' || answer.startsWith('__create_named__:')) {
    if (unanswered.level) forceConfirm.push(`l${unanswered.level}`);
  }
  if (answer === 'add_generic' || answer === 'add_leveled') {
    if (unanswered.level) forceConfirm.push(`create_value_l${unanswered.level}`);
  }

  session.pendingActions = mergePendingConfirmation(
    session.pendingActions,
    buildPendingActions(session, form),
    forceConfirm,
  );

  // Choosing create marks the matching pending field action as user-intent-confirmed
  // (batch permission still required before preview if any remain unconfirmed — see finalize)
  if (answer === '__create__' || answer.startsWith('__create_named__:')) {
    session.pendingActions = session.pendingActions.map((a) => {
      if (unanswered.level && a.id.includes(`l${unanswered.level}`) && a.kind === 'CREATE_FIELD') {
        // Still require explicit batch permission unless we treat per-question as enough.
        // Per-question "Create … — requires permission" already asked; mark confirmed.
        return { ...a, userConfirmed: true };
      }
      return a;
    });
  }

  const nextQ = getNextMissingRequirement(session.missingInformation);
  if (nextQ) {
    const ack = buildAck(unanswered, answer, form);
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

  return finalizeOrPreview(session, form);
}

function buildAck(
  req: MissingRequirement,
  answer: string,
  form?: DiscoveredForm,
): string {
  const field = form?.fields.find((f) => f.id === answer);
  const named = answer.startsWith('__create_named__:')
    ? answer.slice('__create_named__:'.length).trim()
    : '';

  if (req.key.includes('approver')) {
    if (field) return `Got it. I'll use **${field.label}** for Level ${req.level} approval.`;
    if (answer === '__create__' || named) {
      return `Okay — I'll create **${named || 'a User field'}** for Level ${req.level} after you confirm the final plan.`;
    }
    return `Got it for Level ${req.level}.`;
  }
  if (req.key === 'approval_field' || req.key === 'approval_field_create') {
    if (field) return `I'll use **${field.label}** to store Level ${req.level} approvals.`;
    if (answer === '__create__' || named) {
      return `Okay — I'll create **${named || `Level ${req.level} Decision`}** after you confirm.`;
    }
    return `Noted for Level ${req.level} approval field.`;
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
    return `Rejection routing for Level ${req.level} saved.`;
  }
  if (req.key === 'decision_values') {
    return answer === 'skip'
      ? 'Continuing with existing values.'
      : "I'll add those values after you confirm the final plan.";
  }
  return 'Thanks.';
}

function finalizeOrPreview(
  session: WorkflowBuilderSession,
  form?: DiscoveredForm,
  opts?: { createsAllowed?: boolean },
): BuilderTurnResult {
  session.pendingActions = mergePendingConfirmation(
    session.pendingActions,
    buildPendingActions(session, form),
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
    session.missingInformation = planMissingRequirements(
      session.requirements,
      form,
      session.missingInformation,
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

  const preview = generateWorkflowPreview(
    session.requirements,
    session.pendingActions,
    issues,
  );
  session.preview = preview;
  session.requirements = { ...session.requirements, status: 'VALIDATED' };
  const markdown = formatPreviewAsMarkdown(preview);
  session = touch({
    ...session,
    status: 'preview',
    lastAssistantMessage: markdown,
  });

  return {
    session,
    assistantMessage: markdown,
    promptControls: null,
    readyToPublish: false,
  };
}
