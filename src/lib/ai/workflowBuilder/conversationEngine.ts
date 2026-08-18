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
    if (/^(y|yes|ok|sure|confirm|create|add)\b/i.test(trimmed) && req.options?.[0]) {
      return req.options[0].value;
    }
    if (/^(n|no|skip|cancel)\b/i.test(trimmed)) {
      const skip = req.options?.find((o) => /skip|no|cancel|different/i.test(o.value + o.label));
      return skip?.value || trimmed;
    }
  }
  return trimmed;
}

function buildPendingActions(
  session: WorkflowBuilderSession,
  form?: DiscoveredForm,
): PendingConfigAction[] {
  const actions: PendingConfigAction[] = [];
  for (const level of session.requirements.levels) {
    if (!level.approvalFieldId && level.approvalFieldLabel) {
      actions.push({
        id: `create_field_decision_l${level.level}`,
        kind: 'CREATE_FIELD',
        description: `${level.approvalFieldLabel} — Choice (Level ${level.level} decision)`,
        payload: {
          label: level.approvalFieldLabel,
          type: 'select',
          formId: form?.id || session.requirements.trigger.formId,
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
      level.approver.rawHint
      && !level.approver.fieldId
      && !level.approver.resolved
    ) {
      actions.push({
        id: `create_field_approver_l${level.level}`,
        kind: 'CREATE_FIELD',
        description: `${level.approver.rawHint} — User (Level ${level.level} approver)`,
        payload: {
          label: level.approver.rawHint,
          type: 'user-picker',
          formId: form?.id || session.requirements.trigger.formId,
        },
        userConfirmed: false,
      });
    }
  }
  return actions;
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

  if (session.status === 'preview' || session.status === 'ready_to_publish') {
    if (/^(publish|activate|confirm|yes|create|go ahead)\b/i.test(lower)) {
      const compiled = compileWorkflowDefinition(session.requirements);
      session = touch({
        ...session,
        status: 'ready_to_publish',
        compiledNodes: compiled.nodes,
        lastAssistantMessage: 'Publishing workflow…',
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
  if (
    (unanswered.inputKind === 'field_select' || unanswered.key === 'approver')
    && form
    && !unanswered.options?.some((o) => o.value === answer)
  ) {
    const match = searchFields(form, raw);
    if (match.matched) answer = match.matched.id;
  }

  // Mark answered
  session.missingInformation = session.missingInformation.map((m) =>
    m.id === unanswered.id ? { ...m, answered: true, answer } : m,
  );

  // Track create intents as pending actions needing later confirmation
  if (answer === '__create__' || answer === 'add_generic' || answer === 'add_leveled') {
    session.confirmations.push({
      id: `conf_${unanswered.id}`,
      prompt: unanswered.question,
      confirmed: true,
      at: new Date().toISOString(),
    });
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
  session.pendingActions = buildPendingActions(session, form).map((a) => ({
    ...a,
    // Auto-confirm create when user chose __create__ / add_*
    userConfirmed: session.confirmations.some((c) => c.confirmed && c.id.includes(a.id.split('_').pop() || ''))
      || answer === '__create__'
      || answer === 'add_generic'
      || answer === 'add_leveled'
      || a.userConfirmed,
  }));

  // If user chose create for this requirement, mark matching pending action confirmed
  if (answer === '__create__') {
    session.pendingActions = session.pendingActions.map((a) => {
      if (unanswered.level && a.id.includes(`l${unanswered.level}`)) {
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
  if (req.key.includes('approver')) {
    return field
      ? `Got it. I'll use **${field.label}** for Level ${req.level} approval.`
      : answer === '__create__'
        ? `Okay — I'll create an approver field for Level ${req.level} after you confirm the final plan.`
        : `Got it for Level ${req.level}.`;
  }
  if (req.key === 'approval_field') {
    return field
      ? `I'll use **${field.label}** to store Level ${req.level} decisions.`
      : `Noted for Level ${req.level} decision field.`;
  }
  if (req.key === 'rejection_route') {
    return `Rejection routing for Level ${req.level} saved.`;
  }
  return 'Thanks.';
}

function finalizeOrPreview(
  session: WorkflowBuilderSession,
  form?: DiscoveredForm,
): BuilderTurnResult {
  session.pendingActions = buildPendingActions(session, form);
  const issues = validateWorkflowDefinition(session.requirements);
  session.validationIssues = issues;

  if (hasBlockingValidationErrors(issues)) {
    const msg = [
      'I still need to resolve these issues before building the workflow:',
      ...issues.filter((i) => i.severity === 'error').map((i) => `- ${i.message}`),
      '',
      'Please provide the missing details.',
    ].join('\n');
    // Re-open unanswered by converting errors back to questions is handled by planner;
    // force re-plan
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
