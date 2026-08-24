/**
 * Dynamic requirement planner — ask only what's missing for this workflow type.
 * Action type is never asked — inferred from the prompt.
 * Condition field and action field are asked separately.
 */
import {
  createEmptyLevel,
  isApprovalStyleDefinition,
  type AIWorkflowDefinition,
  type MissingRequirement,
  type WorkflowActionSpec,
  type WorkflowLevelSpec,
} from './types';
import {
  fieldHasOption,
  fieldHasSelectableOptions,
  fieldNeedsOptionCreateCheck,
  fieldOptionChoices,
  findSubmissionAccessField,
  getCrossRefTargetForm,
  hydrateDiscoveredForm,
  isApproverCompatibleFieldType,
  isDecisionCompatibleFieldType,
  resolveFieldOptionValue,
  searchFields,
  suggestApproverFields,
  suggestCrossReferenceFields,
  suggestDecisionFields,
  SUBMISSION_ACCESS_FIELD_LABEL,
  type DiscoveredForm,
  type OrgUserChoice,
} from './metadataDiscovery';
import { describeActionType } from './actionTypeInferrer';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';
import { extractGenericPromptHints, fieldMatchesHint } from './promptHints';
import { sanitizeConditionValueHint } from './decisionOptionResolver';

function req(
  partial: Omit<MissingRequirement, 'answered'> & { answered?: boolean },
): MissingRequirement {
  return { ...partial, answered: partial.answered ?? false };
}

function levelConfigured(level: WorkflowLevelSpec): boolean {
  const hasApprover = Boolean(
    level.approver.resolved
    && (
      level.approver.fieldId
      || level.approver.entityId
      || level.approver.type === 'submitter'
      // Pending create: label known, id filled after permission + publish
      || level.approver.fieldLabel
    ),
  );
  const hasApprovalField = Boolean(level.approvalFieldId || level.approvalFieldLabel);
  // Explicit rejection field (including "same as approval") — never implied
  const hasRejectionField = Boolean(level.rejectionFieldId || level.rejectionFieldLabel);
  return hasApprover && hasApprovalField && hasRejectionField && Boolean(level.onRejection);
}

function mergeUnansweredFirst(items: MissingRequirement[]): MissingRequirement[] {
  const unanswered = items.filter((i) => !i.answered);
  const answered = items.filter((i) => i.answered);
  return [...unanswered, ...answered];
}

function fieldChoices(form: DiscoveredForm | undefined): Array<{ value: string; label: string }> {
  return (form?.fields || []).map((f) => ({
    value: f.id,
    label: `${f.label} (${f.type})`,
  }));
}

function actionConfigured(action: WorkflowActionSpec | null | undefined): boolean {
  if (!action) return false;
  switch (action.actionType) {
    case 'change_field_value':
      return Boolean(action.targetFieldId || action.targetFieldLabel)
        && action.staticValue !== undefined
        && action.staticValue !== null
        && String(action.staticValue) !== '';
    case 'create_record':
      return Boolean(action.targetFormId || action.targetFormName);
    case 'create_linked_record':
      return Boolean(action.crossReferenceFieldId || action.crossReferenceFieldLabel)
        && Boolean(action.targetFormId || action.targetFormName);
    case 'update_linked_records':
      return Boolean(action.crossReferenceFieldId || action.crossReferenceFieldLabel)
        && Boolean(action.targetFormId || action.targetFormName)
        && Boolean(action.targetFieldId || action.targetFieldLabel)
        && action.staticValue !== undefined
        && action.staticValue !== null
        && String(action.staticValue) !== '';
    case 'create_combination_records':
      return Boolean(action.sourceCrossRefFieldId || action.sourceCrossRefFieldLabel)
        && Boolean(action.targetFormId || action.targetFormName);
    case 'send_notification':
      return true;
    default:
      return false;
  }
}

function planGenericActionRequirements(
  definition: AIWorkflowDefinition,
  form: DiscoveredForm | undefined,
  previous: MissingRequirement[],
  formsCatalog: DiscoveredForm[] = [],
  originalRequest = '',
): MissingRequirement[] {
  const answered = new Map(
    previous.filter((m) => m.answered).map((m) => [m.id, m]),
  );
  const out: MissingRequirement[] = [];
  const hints = extractGenericPromptHints(originalRequest || definition.description || '');
  const hydratedForm = hydrateDiscoveredForm(form);
  const hydratedCatalog = formsCatalog.map((f) => hydrateDiscoveredForm(f)!).filter(Boolean);

  const push = (item: MissingRequirement) => {
    const prev = answered.get(item.id);
    if (prev) {
      out.push({ ...item, answered: true, answer: prev.answer });
      return;
    }
    out.push(item);
  };

  if (!definition.trigger.formId) {
    push(req({
      id: 'trigger.form',
      scope: 'workflow',
      key: 'trigger_form',
      question: 'Which form should trigger this workflow?',
      inputKind: 'choice',
      options: hydratedCatalog.map((f) => ({ value: f.id, label: f.name })),
    }));
  }

  // Ensure action exists (should be set by intent analyzer)
  const action = definition.action;
  if (!action) {
    return mergeUnansweredFirst(out);
  }

  const condition = definition.conditions[0];
  const allFields = fieldChoices(hydratedForm);
  const xrFields = suggestCrossReferenceFields(hydratedForm);

  // ── Condition field (always ask separately) ─────────────────────────────
  if (!condition?.fieldId && !condition?.fieldLabel) {
    push(req({
      id: 'condition.field',
      scope: 'condition',
      key: 'condition_field',
      question: [
        `I'll set up a **${describeActionType(action.actionType)}** action (inferred from your prompt).`,
        '',
        'Which **condition** field should gate this action?',
      ].join('\n'),
      inputKind: 'field_select',
      options: allFields,
    }));
    return mergeUnansweredFirst(out);
  }

  const condField = hydratedForm?.fields.find((f) =>
    f.id === condition?.fieldId
    || (condition?.fieldLabel
      && f.label.toLowerCase() === String(condition.fieldLabel).toLowerCase()),
  );

  // Auto-fill condition value from prompt when still empty
  if (
    condition
    && (condition.value === undefined || condition.value === null || condition.value === '')
    && hints.conditionValueHint
    && (
      !hints.conditionFieldHint
      || fieldMatchesHint(condField, hints.conditionFieldHint)
      || fieldMatchesHint({ label: condition.fieldLabel }, hints.conditionFieldHint)
    )
  ) {
    condition.value = sanitizeConditionValueHint(hints.conditionValueHint);
    condition.pendingOptionLabel = sanitizeConditionValueHint(hints.conditionValueHint);
    condition.pendingOptionCreate = false;
  }

  // ── Condition value ─────────────────────────────────────────────────────
  if (condition && (condition.value === undefined || condition.value === null || condition.value === '')) {
    const opts = fieldOptionChoices(condField);
    if (opts.length) {
      push(req({
        id: 'condition.value',
        scope: 'condition',
        key: 'condition_value',
        question: `What **value** of **${condField?.label || condition.fieldLabel}** should trigger the action?`,
        inputKind: 'choice',
        options: opts,
      }));
    } else {
      push(req({
        id: 'condition.value',
        scope: 'condition',
        key: 'condition_value',
        question: `What **value** should **${condField?.label || condition.fieldLabel}** equal to run the action?`,
        inputKind: 'text',
      }));
    }
    return mergeUnansweredFirst(out);
  }

  // Option already on field (e.g. created earlier) → never re-ask
  if (
    condition
    && condField
    && fieldHasOption(condField, condition.value)
  ) {
    condition.pendingOptionCreate = false;
    condition.pendingOptionLabel = undefined;
    condition.value = resolveFieldOptionValue(condField, condition.value);
  }

  // Missing option on condition field → ask permission to create it
  if (
    condition
    && condField
    && fieldNeedsOptionCreateCheck(condField)
    && !fieldHasOption(condField, condition.value)
    && !condition.pendingOptionCreate
  ) {
    const wanted = sanitizeConditionValueHint(String(condition.pendingOptionLabel || condition.value || ''));
    push(req({
      id: 'condition.value_create',
      scope: 'condition',
      key: 'condition_value_create',
      question: [
        `**${condField.label}** does not have an option **${wanted}**.`,
        '',
        `May I add **${wanted}** as an option on **${condField.label}**?`,
      ].join('\n'),
      inputKind: 'confirm',
      options: [
        { value: '__create_option__', label: `Yes, add "${wanted}"` },
        { value: '__pick_existing__', label: 'No — pick an existing option' },
      ],
    }));
    return mergeUnansweredFirst(out);
  }

  // ── Action-type-specific questions (never ask for action type) ──────────
  const needsXr = action.actionType === 'create_linked_record'
    || action.actionType === 'update_linked_records'
    || action.actionType === 'create_combination_records';

  if (needsXr && !action.crossReferenceFieldId && !action.crossReferenceFieldLabel
    && !action.sourceCrossRefFieldId && !action.sourceCrossRefFieldLabel) {
    push(req({
      id: 'action.cross_ref',
      scope: 'workflow',
      key: 'action_cross_ref',
      question: 'Which **cross-reference** field links to the related form?',
      inputKind: 'field_select',
      options: xrFields.length
        ? xrFields.map((f) => ({ value: f.id, label: `${f.label} (${f.type})` }))
        : allFields,
    }));
    return mergeUnansweredFirst(out);
  }

  // Target form for linked / combo / create_record — ask if not auto-detected
  const needsTargetForm = action.actionType === 'create_record'
    || action.actionType === 'create_linked_record'
    || action.actionType === 'update_linked_records'
    || action.actionType === 'create_combination_records';

  if (needsTargetForm && !action.targetFormId && !action.targetFormName) {
    const formOpts = formsCatalog.length
      ? formsCatalog.map((f) => ({ value: f.id, label: f.name }))
      : undefined;
    push(req({
      id: 'action.target_form',
      scope: 'workflow',
      key: 'action_target_form',
      question: action.actionType === 'create_record'
        ? 'Which **form** should the new record be created on?'
        : 'I could not auto-detect the linked form. Which **target form** should this action use?',
      inputKind: formOpts?.length ? 'choice' : 'text',
      options: formOpts,
    }));
    return mergeUnansweredFirst(out);
  }

  // Action field (change_field_value on trigger form, or update_linked on linked form)
  if (
    (action.actionType === 'change_field_value' || action.actionType === 'update_linked_records')
    && !action.targetFieldId
    && !action.targetFieldLabel
  ) {
    const linkedForm = action.targetFormId
      ? hydratedCatalog.find((f) => f.id === action.targetFormId)
      : undefined;
    const fieldSource = action.actionType === 'update_linked_records' && linkedForm
      ? linkedForm
      : hydratedForm;
    const labelScope = action.actionType === 'update_linked_records'
      ? 'on the **linked form**'
      : 'on this form';
    push(req({
      id: 'action.field',
      scope: 'workflow',
      key: 'action_field',
      question: `Which **field** should the action update ${labelScope}?`,
      inputKind: 'field_select',
      options: fieldChoices(fieldSource).length
        ? fieldChoices(fieldSource)
        : allFields,
    }));
    return mergeUnansweredFirst(out);
  }

  // Auto-fill action value from prompt when field known but value empty
  if (
    (action.actionType === 'change_field_value' || action.actionType === 'update_linked_records')
    && (action.targetFieldId || action.targetFieldLabel)
    && (action.staticValue === undefined || action.staticValue === null || String(action.staticValue) === '')
    && hints.actionValueHint
    && (
      !hints.actionFieldHint
      || fieldMatchesHint({ label: action.targetFieldLabel }, hints.actionFieldHint)
    )
  ) {
    action.staticValue = sanitizeConditionValueHint(hints.actionValueHint);
    action.pendingOptionLabel = sanitizeConditionValueHint(hints.actionValueHint);
    action.pendingOptionCreate = false;
  }

  // Action value
  if (
    (action.actionType === 'change_field_value' || action.actionType === 'update_linked_records')
    && (action.staticValue === undefined || action.staticValue === null || String(action.staticValue) === '')
  ) {
    const linkedForm = action.targetFormId
      ? hydratedCatalog.find((f) => f.id === action.targetFormId)
      : undefined;
    const fieldSource = action.actionType === 'update_linked_records' && linkedForm
      ? linkedForm
      : hydratedForm;
    const actionField = fieldSource?.fields.find((f) =>
      f.id === action.targetFieldId
      || (action.targetFieldLabel
        && f.label.toLowerCase() === String(action.targetFieldLabel).toLowerCase()),
    );
    const opts = fieldOptionChoices(actionField);
    if (opts.length) {
      push(req({
        id: 'action.value',
        scope: 'workflow',
        key: 'action_value',
        question: `What **value** should **${actionField?.label || action.targetFieldLabel}** be set to?`,
        inputKind: 'choice',
        options: opts,
      }));
    } else {
      push(req({
        id: 'action.value',
        scope: 'workflow',
        key: 'action_value',
        question: `What **value** should **${actionField?.label || action.targetFieldLabel || 'the field'}** be set to?`,
        inputKind: 'text',
      }));
    }
    return mergeUnansweredFirst(out);
  }

  // Missing option on action field → ask permission to create it
  if (
    (action.actionType === 'change_field_value' || action.actionType === 'update_linked_records')
    && action.staticValue !== undefined
    && action.staticValue !== null
    && String(action.staticValue) !== ''
    && !action.pendingOptionCreate
  ) {
    const linkedForm = action.targetFormId
      ? hydratedCatalog.find((f) => f.id === action.targetFormId)
      : undefined;
    const fieldSource = action.actionType === 'update_linked_records' && linkedForm
      ? linkedForm
      : hydratedForm;
    const actionField = fieldSource?.fields.find((f) =>
      f.id === action.targetFieldId
      || (action.targetFieldLabel
        && f.label.toLowerCase() === String(action.targetFieldLabel).toLowerCase()),
    );
    if (actionField && fieldHasOption(actionField, action.staticValue)) {
      action.pendingOptionCreate = false;
      action.pendingOptionLabel = undefined;
      action.staticValue = resolveFieldOptionValue(actionField, action.staticValue);
    } else if (actionField && fieldNeedsOptionCreateCheck(actionField) && !fieldHasOption(actionField, action.staticValue)) {
      const wanted = sanitizeConditionValueHint(String(action.pendingOptionLabel || action.staticValue || ''));
      push(req({
        id: 'action.value_create',
        scope: 'workflow',
        key: 'action_value_create',
        question: [
          `**${actionField.label}** does not have an option **${wanted}**.`,
          '',
          `May I add **${wanted}** as an option on **${actionField.label}**?`,
        ].join('\n'),
        inputKind: 'confirm',
        options: [
          { value: '__create_option__', label: `Yes, add "${wanted}"` },
          { value: '__pick_existing__', label: 'No — pick an existing option' },
        ],
      }));
      return mergeUnansweredFirst(out);
    }
  }

  // Combination: optional second XR for dual mode is skipped unless prompt hinted dual
  // Mapping note — for combination we ask a confirm that XR→target mapping is OK
  if (
    action.actionType === 'create_combination_records'
    && action.sourceCrossRefFieldId
    && action.targetFormId
    && !answered.has('action.combo_confirm')
  ) {
    // Mark configured via a soft confirm only if nothing else missing
    // (no extra question — target form + XR is enough)
  }

  if (action) {
    action.configured = actionConfigured(action);
  }

  return mergeUnansweredFirst(out);
}

function approverLoopLabel(level: WorkflowLevelSpec): string {
  const who = level.approver.entityLabel || level.approver.rawHint || level.label;
  const whoPart = who && !/^level\s*\d+$/i.test(String(who).trim())
    ? ` (${who.replace(/^Level\s*\d+:\s*/i, '')})`
    : '';
  return `Loop back to Approver ${level.level}${whoPart}`;
}

function planApprovalRequirements(
  definition: AIWorkflowDefinition,
  form: DiscoveredForm | undefined,
  previous: MissingRequirement[],
  orgUsers: OrgUserChoice[] = [],
): MissingRequirement[] {
  const answered = new Map(
    previous.filter((m) => m.answered).map((m) => [m.id, m]),
  );
  const out: MissingRequirement[] = [];

  const push = (item: MissingRequirement) => {
    const prev = answered.get(item.id);
    if (prev) {
      out.push({ ...item, answered: true, answer: prev.answer });
      return;
    }
    out.push(item);
  };

  if (!definition.trigger.formId) {
    push(req({
      id: 'trigger.form',
      scope: 'workflow',
      key: 'trigger_form',
      question: 'Which form should trigger this workflow?',
      inputKind: 'choice',
    }));
    return mergeUnansweredFirst(out);
  }

  // Auto-bind existing Submission Access Control when present
  const sacField = findSubmissionAccessField(form);
  if (sacField && !definition.accessFieldId) {
    definition.accessFieldId = sacField.id;
    definition.accessFieldLabel = sacField.label || SUBMISSION_ACCESS_FIELD_LABEL;
    definition.pendingAccessFieldCreate = false;
  }

  // Ensure Submission Access Control exists (create if missing, or pick existing)
  if (!definition.accessFieldId && definition.pendingAccessFieldCreate !== true) {
    if (definition.pendingAccessFieldCreate === false) {
      // User declined create — must pick an existing compatible field
      const accessChoices = (form?.fields || [])
        .filter((f) => isApproverCompatibleFieldType(f.type))
        .map((f) => ({ value: f.id, label: `${f.label} (${f.type})` }));
      push(req({
        id: 'access.field.pick',
        scope: 'workflow',
        key: 'access_field_pick',
        question: `Which existing field should store the current approver (preferably ${SUBMISSION_ACCESS_FIELD_LABEL})?`,
        inputKind: 'field_select',
        options: accessChoices,
      }));
      return mergeUnansweredFirst(out);
    }

    push(req({
      id: 'access.field.ensure',
      scope: 'workflow',
      key: 'access_field_ensure',
      question: [
        `Approval workflows assign each level's approver on **${SUBMISSION_ACCESS_FIELD_LABEL}**.`,
        '',
        `This form does not have that field yet. May I create **${SUBMISSION_ACCESS_FIELD_LABEL}**?`,
      ].join('\n'),
      inputKind: 'confirm',
      options: [
        { value: '__create_sac__', label: `Yes, create ${SUBMISSION_ACCESS_FIELD_LABEL}` },
        { value: '__pick_existing_access__', label: 'No — pick an existing access/user field' },
      ],
    }));
    return mergeUnansweredFirst(out);
  }

  if (!definition.levels.length) {
    push(req({
      id: 'workflow.levels',
      scope: 'workflow',
      key: 'level_count',
      question: 'How many approval levels do you need?',
      inputKind: 'choice',
      options: [
        { value: '1', label: '1 level' },
        { value: '2', label: '2 levels' },
        { value: '3', label: '3 levels' },
      ],
    }));
    return mergeUnansweredFirst(out);
  }

  const hydratedForm = hydrateDiscoveredForm(form);
  const decisionSuggestions = suggestDecisionFields(hydratedForm);
  const userOptions = orgUsers.map((u) => ({
    value: u.id,
    label: u.label || u.email,
  }));

  for (const level of definition.levels) {
    const hasUser = level.approver.type === 'user' && Boolean(level.approver.entityId) && level.approver.resolved;
    if (!hasUser) {
      const hint = level.approver.rawHint ? ` (${level.approver.rawHint})` : '';
      if (userOptions.length) {
        push(req({
          id: `level.${level.level}.approver.user`,
          scope: 'level',
          level: level.level,
          key: 'approver_user',
          question: [
            `Who should be **Level ${level.level} approver**${hint}?`,
            '',
            `I will set this user on **${definition.accessFieldLabel || SUBMISSION_ACCESS_FIELD_LABEL}** before notifying them.`,
          ].join('\n'),
          inputKind: 'user_select',
          options: userOptions,
        }));
      } else {
        push(req({
          id: `level.${level.level}.approver.user`,
          scope: 'level',
          level: level.level,
          key: 'approver_user',
          question: [
            `Who should be **Level ${level.level} approver**${hint}?`,
            '',
            'Reply with the user **email** (organization users could not be loaded as a list).',
          ].join('\n'),
          inputKind: 'text',
        }));
      }
      return mergeUnansweredFirst(out);
    }

    if (!level.approvalFieldId && !level.approvalFieldLabel) {
      push(req({
        id: `level.${level.level}.approval_field`,
        scope: 'level',
        level: level.level,
        key: 'approval_field',
        question: [
          `*Level ${level.level}* — Which field stores the **decision** (Approved / Rejected)?`,
          '',
          'Usually this is **Status**. Approve and reject are values on this same field.',
        ].join('\n'),
        inputKind: 'field_select',
        options: decisionSuggestions.map((f) => ({ value: f.id, label: `${f.label} (${f.type})` })),
      }));
      return mergeUnansweredFirst(out);
    }

    // Rejection uses the same decision field (Status) — no separate reject field
    if (!level.rejectionFieldId && !level.rejectionFieldLabel) {
      level.rejectionFieldId = level.approvalFieldId;
      level.rejectionFieldLabel = level.approvalFieldLabel || 'Same as approval field';
    }

    if (!level.onRejection) {
      const loopBackLevels = definition.levels.map((l) => {
        const base = approverLoopLabel(l);
        if (l.level === level.level) {
          return {
            value: `level:${l.level}`,
            label: base.replace(/^Loop back to/, 'Retry'),
          };
        }
        return { value: `level:${l.level}`, label: base };
      });
      const hint = definition.defaultRejection?.action
        ? `\n_(Your prompt suggested: ${definition.defaultRejection.action.replace(/_/g, ' ').toLowerCase()} — pick below to confirm or change.)_`
        : '';
      push(req({
        id: `level.${level.level}.rejection`,
        scope: 'routing',
        level: level.level,
        key: 'rejection_route',
        question: [
          `*Level ${level.level}* — If **Approver ${level.level} rejects** (decision field is not Approved), where should the workflow go?`,
          '',
          'You can loop back to Approver 1, Approver 2, retry this level, return to the requester, or end.',
          hint,
        ].filter(Boolean).join('\n'),
        inputKind: 'rejection_route',
        options: [
          ...loopBackLevels,
          {
            value: 'RETURN_TO_REQUESTER',
            label: 'Return to requester (notify submitter, then stop approval)',
          },
          { value: 'END_WORKFLOW', label: 'End workflow (rejected)' },
        ],
      }));
      return mergeUnansweredFirst(out);
    }
  }

  for (const level of definition.levels) {
    level.configured = levelConfigured(level);
  }

  return mergeUnansweredFirst(out);
}

/**
 * Compute missing information from current definition + form metadata.
 * Skips questions already answered in missingInformation.
 */
export function planMissingRequirements(
  definition: AIWorkflowDefinition,
  form: DiscoveredForm | undefined,
  previous: MissingRequirement[] = [],
  formsCatalog: DiscoveredForm[] = [],
  originalRequest = '',
  orgUsers: OrgUserChoice[] = [],
): MissingRequirement[] {
  if (isApprovalStyleDefinition(definition)) {
    return planApprovalRequirements(definition, form, previous, orgUsers);
  }
  return planGenericActionRequirements(definition, form, previous, formsCatalog, originalRequest);
}

/** Next unanswered question (progressive discovery — one logical question). */
export function getNextMissingRequirement(
  missing: MissingRequirement[],
): MissingRequirement | null {
  return missing.find((m) => !m.answered) || null;
}

export function applyAnswerToDefinition(
  definition: AIWorkflowDefinition,
  requirement: MissingRequirement,
  answer: unknown,
  form?: DiscoveredForm,
  formsCatalog: DiscoveredForm[] = [],
): AIWorkflowDefinition {
  const next: AIWorkflowDefinition = {
    ...definition,
    levels: definition.levels.map((l) => ({
      ...l,
      approver: { ...l.approver },
      onRejection: l.onRejection ? { ...l.onRejection } : null,
    })),
    conditions: definition.conditions.map((c) => ({ ...c })),
    action: definition.action ? { ...definition.action } : null,
  };

  const value = String(answer ?? '').trim();

  if (requirement.key === 'access_field_ensure') {
    if (value === '__create_sac__' || /^(y|yes|ok|allow|confirm|create|add)\b/i.test(value)) {
      next.pendingAccessFieldCreate = true;
      next.accessFieldLabel = SUBMISSION_ACCESS_FIELD_LABEL;
      next.accessFieldId = undefined;
    } else {
      next.pendingAccessFieldCreate = false;
      next.accessFieldId = undefined;
      next.accessFieldLabel = undefined;
    }
    return next;
  }

  if (requirement.key === 'access_field_pick') {
    const field = form?.fields.find((f) => f.id === value)
      || searchFields(form, value).matched;
    next.accessFieldId = field?.id;
    next.accessFieldLabel = field?.label || value;
    next.pendingAccessFieldCreate = false;
    return next;
  }

  if (requirement.key === 'level_count') {
    const count = Math.max(1, Math.min(5, Number(value) || 2));
    next.levels = Array.from({ length: count }, (_, i) => createEmptyLevel(i + 1));
    next.levels[next.levels.length - 1].onApprovalNext = 'complete';
    return next;
  }

  if (requirement.key === 'trigger_form') {
    const matched = formsCatalog.find((f) => f.id === value)
      || formsCatalog.find((f) => f.name.toLowerCase() === value.toLowerCase());
    next.trigger = {
      ...next.trigger,
      formId: matched?.id || value,
      formName: matched?.name || value,
    };
    next.objectId = next.trigger.formId;
    next.objectName = next.trigger.formName;
    return next;
  }

  // ── Generic condition / action answers ──────────────────────────────────
  if (requirement.key === 'condition_field') {
    const field = form?.fields.find((f) => f.id === value)
      || searchFields(form, value).matched;
    next.conditions = [{
      fieldId: field?.id,
      fieldLabel: field?.label || value,
      fieldType: field?.type,
      operator: '==',
      value: '',
      resolved: Boolean(field),
    }];
    return next;
  }

  if (requirement.key === 'condition_value') {
    const cond = next.conditions[0];
    if (cond) {
      const field = hydrateDiscoveredForm(form)?.fields.find((f) => f.id === cond.fieldId);
      cond.resolved = Boolean(cond.fieldId);
      cond.pendingOptionCreate = false;
      cond.pendingOptionLabel = undefined;
      if (field && isOptionBasedFieldType(field.type)) {
        cond.fieldType = field.type;
      }
      // Exact existence check on the raw answer — never fuzzy-map a missing value away
      if (field && fieldHasOption(field, value)) {
        cond.value = resolveFieldOptionValue(field, value);
      } else if (field && fieldNeedsOptionCreateCheck(field)) {
        cond.pendingOptionLabel = value;
        cond.value = value;
      } else {
        cond.value = value;
      }
    }
    return next;
  }

  if (requirement.key === 'condition_value_create') {
    const cond = next.conditions[0];
    if (cond) {
      if (value === '__create_option__' || /^(y|yes|ok|allow|confirm|create|add)\b/i.test(value)) {
        cond.pendingOptionCreate = true;
        cond.pendingOptionLabel = cond.pendingOptionLabel || String(cond.value || '');
        cond.value = cond.pendingOptionLabel;
        cond.resolved = Boolean(cond.fieldId);
      } else {
        // Pick existing — clear value so planner re-asks with option list
        cond.value = '';
        cond.pendingOptionCreate = false;
        cond.pendingOptionLabel = undefined;
        cond.resolved = false;
      }
    }
    return next;
  }

  if (requirement.key === 'action_cross_ref' && next.action) {
    const field = form?.fields.find((f) => f.id === value)
      || searchFields(form, value).matched;
    const target = getCrossRefTargetForm(field || undefined);
    next.action.crossReferenceFieldId = field?.id;
    next.action.crossReferenceFieldLabel = field?.label || value;
    next.action.sourceCrossRefFieldId = field?.id;
    next.action.sourceCrossRefFieldLabel = field?.label || value;
    if (target.targetFormId) {
      next.action.targetFormId = target.targetFormId;
      next.action.targetFormName = target.targetFormName;
      next.action.sourceLinkedFormId = target.targetFormId;
      next.action.sourceLinkedFormName = target.targetFormName;
    }
    return next;
  }

  if (requirement.key === 'action_target_form' && next.action) {
    const matched = formsCatalog.find((f) => f.id === value)
      || formsCatalog.find((f) => f.name.toLowerCase() === value.toLowerCase())
      || (form?.id === value ? form : undefined);
    next.action.targetFormId = matched?.id || value;
    next.action.targetFormName = matched?.name || value;
    next.action.sourceLinkedFormId = next.action.sourceLinkedFormId || next.action.targetFormId;
    next.action.sourceLinkedFormName = next.action.sourceLinkedFormName || next.action.targetFormName;
    return next;
  }

  if (requirement.key === 'action_field' && next.action) {
    const linkedForm = next.action.targetFormId
      ? formsCatalog.find((f) => f.id === next.action!.targetFormId)
      : undefined;
    const fieldSource = next.action.actionType === 'update_linked_records' && linkedForm
      ? linkedForm
      : form;
    const field = fieldSource?.fields.find((f) => f.id === value)
      || searchFields(fieldSource, value).matched;
    next.action.targetFieldId = field?.id;
    next.action.targetFieldLabel = field?.label || value;
    next.action.targetFieldType = field?.type;
    next.action.valueType = 'static';
    return next;
  }

  if (requirement.key === 'action_value' && next.action) {
    const linkedForm = next.action.targetFormId
      ? hydrateDiscoveredForm(formsCatalog.find((f) => f.id === next.action!.targetFormId))
      : undefined;
    const fieldSource = next.action.actionType === 'update_linked_records' && linkedForm
      ? linkedForm
      : hydrateDiscoveredForm(form);
    const field = fieldSource?.fields.find((f) => f.id === next.action!.targetFieldId);
    next.action.valueType = 'static';
    next.action.pendingOptionCreate = false;
    next.action.pendingOptionLabel = undefined;
    if (field && fieldHasOption(field, value)) {
      next.action.staticValue = resolveFieldOptionValue(field, value);
    } else if (field && fieldNeedsOptionCreateCheck(field)) {
      next.action.pendingOptionLabel = value;
      next.action.staticValue = value;
    } else {
      next.action.staticValue = value;
    }
    next.action.configured = actionConfigured(next.action);
    return next;
  }

  if (requirement.key === 'action_value_create' && next.action) {
    if (value === '__create_option__' || /^(y|yes|ok|allow|confirm|create|add)\b/i.test(value)) {
      next.action.pendingOptionCreate = true;
      next.action.pendingOptionLabel = next.action.pendingOptionLabel || String(next.action.staticValue || '');
      next.action.staticValue = next.action.pendingOptionLabel;
    } else {
      next.action.staticValue = '';
      next.action.pendingOptionCreate = false;
      next.action.pendingOptionLabel = undefined;
    }
    next.action.configured = actionConfigured(next.action);
    return next;
  }

  if (requirement.level) {
    const level = next.levels.find((l) => l.level === requirement.level);
    if (!level) return next;

    if (requirement.key === 'approver_user') {
      const fromOpt = requirement.options?.find((o) =>
        o.value === value
        || o.label.toLowerCase() === value.toLowerCase()
        || o.label.toLowerCase().includes(value.toLowerCase()),
      );
      const entityId = fromOpt?.value || value;
      const entityLabel = fromOpt?.label || value;
      level.approver = {
        type: 'user',
        entityId,
        entityLabel,
        rawHint: level.approver.rawHint || entityLabel,
        // Notify reads Submission Access Control after we set the user there
        fieldId: next.accessFieldId,
        fieldLabel: next.accessFieldLabel || SUBMISSION_ACCESS_FIELD_LABEL,
        resolved: Boolean(entityId),
      };
    }

    if (requirement.key === 'approver' || requirement.key === 'approver_disambiguate' || requirement.key === 'approver_invalid') {
      if (value === '__create__' || value.startsWith('__create_named__:')) {
        const named = value.startsWith('__create_named__:')
          ? value.slice('__create_named__:'.length).trim()
          : '';
        const label = named || level.approver.rawHint || `Level ${level.level} Approver`;
        level.approver = {
          type: 'field',
          rawHint: label,
          fieldLabel: label,
          resolved: true, // pending create — id assigned on publish after permission
        };
      } else {
        const field = form?.fields.find((f) => f.id === value);
        level.approver = {
          type: 'field',
          fieldId: field ? value : undefined,
          fieldLabel: field?.label || value,
          rawHint: level.approver.rawHint,
          resolved: Boolean(field),
        };
      }
    }

    if (requirement.key === 'approver_confirm') {
      if (value === '__choose__' || value === '__reask__') {
        level.approver = { ...level.approver, resolved: false, fieldId: undefined };
      } else if (value === '__create__' || value.startsWith('__create_named__:')) {
        const named = value.startsWith('__create_named__:')
          ? value.slice('__create_named__:'.length).trim()
          : '';
        const label = named || level.approver.rawHint || `Level ${level.level} Approver`;
        level.approver = {
          type: 'field',
          rawHint: label,
          fieldLabel: label,
          resolved: true,
        };
      } else {
        const field = form?.fields.find((f) => f.id === value);
        level.approver = {
          type: 'field',
          fieldId: field ? value : undefined,
          fieldLabel: field?.label || level.approver.rawHint,
          rawHint: level.approver.rawHint,
          resolved: Boolean(field),
        };
      }
    }

    if (requirement.key === 'approval_field' || requirement.key === 'approval_field_create') {
      if (value === '__reask__') {
        level.approvalFieldId = undefined;
        level.approvalFieldLabel = undefined;
      } else if (value === '__create__' || value.startsWith('__create_named__:')) {
        const named = value.startsWith('__create_named__:')
          ? value.slice('__create_named__:'.length).trim()
          : '';
        level.approvalFieldLabel = named || `Level ${level.level} Decision`;
        level.approvalFieldId = undefined;
      } else {
        const field = form?.fields.find((f) => f.id === value);
        if (field && !isDecisionCompatibleFieldType(field.type)) {
          level.approvalFieldId = undefined;
          level.approvalFieldLabel = undefined;
        } else if (field) {
          level.approvalFieldId = value;
          level.approvalFieldLabel = field.label;
          // Reject uses the same decision field (Approved / Rejected values)
          level.rejectionFieldId = value;
          level.rejectionFieldLabel = field.label;
        }
      }
    }

    if (requirement.key === 'rejection_field' || requirement.key === 'rejection_field_create') {
      if (value === '__reask__') {
        level.rejectionFieldId = undefined;
        level.rejectionFieldLabel = undefined;
      } else if (value === '__same_as_approval__') {
        level.rejectionFieldId = level.approvalFieldId;
        level.rejectionFieldLabel = level.approvalFieldLabel || 'Same as approval field';
      } else if (value === '__create__' || value.startsWith('__create_named__:')) {
        const named = value.startsWith('__create_named__:')
          ? value.slice('__create_named__:'.length).trim()
          : '';
        level.rejectionFieldLabel = named || `Level ${level.level} Rejection`;
        level.rejectionFieldId = undefined;
      } else {
        const field = form?.fields.find((f) => f.id === value);
        if (field) {
          level.rejectionFieldId = value;
          level.rejectionFieldLabel = field.label;
        }
      }
    }

    if (requirement.key === 'rejection_route') {
      if (value.startsWith('level:')) {
        level.onRejection = {
          action: 'RETURN_TO_LEVEL',
          targetLevel: Number(value.split(':')[1]),
        };
      } else {
        level.onRejection = {
          action: value as any,
        };
      }
    }

    if (requirement.key === 'decision_values') {
      if (value === 'add_generic') {
        level.pendingOptionValues = ['Pending', 'Approved', 'Rejected'];
      } else if (value === 'add_leveled') {
        level.pendingOptionValues = [
          `Pending Level ${level.level}`,
          `Approved Level ${level.level}`,
          `Rejected Level ${level.level}`,
        ];
      }
    }
  }

  if (next.action) {
    next.action.configured = actionConfigured(next.action);
  }

  return next;
}
