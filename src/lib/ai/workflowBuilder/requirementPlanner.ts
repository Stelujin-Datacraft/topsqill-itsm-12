/**
 * Dynamic requirement planner — ask only what's missing for this workflow type.
 */
import {
  createEmptyLevel,
  type AIWorkflowDefinition,
  type MissingRequirement,
  type WorkflowLevelSpec,
} from './types';
import {
  findMissingOptionValues,
  isApproverCompatibleFieldType,
  isDecisionCompatibleFieldType,
  searchFields,
  suggestApproverFields,
  suggestDecisionFields,
  type DiscoveredForm,
} from './metadataDiscovery';

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

/**
 * Compute missing information from current definition + form metadata.
 * Skips questions already answered in missingInformation.
 */
export function planMissingRequirements(
  definition: AIWorkflowDefinition,
  form: DiscoveredForm | undefined,
  previous: MissingRequirement[] = [],
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

  const approverSuggestions = suggestApproverFields(form);
  const decisionSuggestions = suggestDecisionFields(form);

  for (const level of definition.levels) {
    // Approver
    if (!level.approver.resolved) {
      // Try metadata match from raw hint
      if (level.approver.rawHint && form) {
        const match = searchFields(form, level.approver.rawHint);
        if (match.matched && isApproverCompatibleFieldType(match.matched.type)) {
          // Suggest confirm instead of free text
          push(req({
            id: `level.${level.level}.approver.confirm`,
            scope: 'level',
            level: level.level,
            key: 'approver_confirm',
            question: `I found **${match.matched.label}** (${match.matched.type}) on this form. Use it as Level ${level.level} approver?`,
            inputKind: 'confirm',
            options: [
              { value: match.matched.id, label: `Yes, use ${match.matched.label}` },
              { value: '__choose__', label: 'Choose a different field' },
              { value: '__create__', label: 'Create a new User field' },
            ],
          }));
        } else if (match.candidates.length > 1) {
          push(req({
            id: `level.${level.level}.approver.disambiguate`,
            scope: 'level',
            level: level.level,
            key: 'approver_disambiguate',
            question: `I found multiple possible fields for "${level.approver.rawHint}" at Level ${level.level}. Which should I use?`,
            inputKind: 'field_select',
            options: match.candidates.map((c) => ({
              value: c.id,
              label: `${c.label} (${c.type})`,
            })),
          }));
        } else {
          push(req({
            id: `level.${level.level}.approver`,
            scope: 'level',
            level: level.level,
            key: 'approver',
            question: `I couldn't find "${level.approver.rawHint}" as an approver field. Which field identifies the Level ${level.level} approver?`,
            inputKind: 'field_select',
            options: [
              ...approverSuggestions.map((f) => ({ value: f.id, label: `${f.label} (${f.type})` })),
              { value: '__create__', label: `Create "${level.approver.rawHint}" as User field` },
            ],
          }));
        }
      } else {
        push(req({
          id: `level.${level.level}.approver`,
          scope: 'level',
          level: level.level,
          key: 'approver',
          question: `Which field identifies the Level ${level.level} approver?`,
          inputKind: 'field_select',
          options: [
            ...approverSuggestions.map((f) => ({ value: f.id, label: `${f.label} (${f.type})` })),
            { value: '__create__', label: 'Create a new User field' },
          ],
        }));
      }
    } else if (level.approver.fieldId && form) {
      const field = form.fields.find((f) => f.id === level.approver.fieldId);
      if (field && !isApproverCompatibleFieldType(field.type)) {
        push(req({
          id: `level.${level.level}.approver.invalid_type`,
          scope: 'level',
          level: level.level,
          key: 'approver_invalid',
          question: `**${field.label}** is a ${field.type} field and cannot be used as an approver. Please select a User, Group, Role, or Assignee field.`,
          inputKind: 'field_select',
          options: approverSuggestions.map((f) => ({ value: f.id, label: `${f.label} (${f.type})` })),
        }));
      }
    }

    // Approval decision field
    if (!level.approvalFieldId && !level.approvalFieldLabel) {
      push(req({
        id: `level.${level.level}.approval_field`,
        scope: 'level',
        level: level.level,
        key: 'approval_field',
        question: `*Level ${level.level}* — Which field stores the **approval** decision?`,
        inputKind: 'field_select',
        options: [
          ...decisionSuggestions.map((f) => ({ value: f.id, label: `${f.label} (${f.type})` })),
          { value: '__create__', label: `Create "Level ${level.level} Decision" (Choice) — requires permission` },
        ],
      }));
    }

    // Rejection field (may reuse approval decision field)
    if (
      (level.approvalFieldId || level.approvalFieldLabel)
      && !level.rejectionFieldId
      && !level.rejectionFieldLabel
    ) {
      push(req({
        id: `level.${level.level}.rejection_field`,
        scope: 'level',
        level: level.level,
        key: 'rejection_field',
        question: `*Level ${level.level}* — Which field stores **rejection**?`,
        inputKind: 'field_select',
        options: [
          ...(level.approvalFieldId
            ? [{ value: '__same_as_approval__', label: `Same as approval field (${level.approvalFieldLabel})` }]
            : [{ value: '__same_as_approval__', label: 'Same as approval decision field' }]),
          ...decisionSuggestions
            .filter((f) => f.id !== level.approvalFieldId)
            .map((f) => ({ value: f.id, label: `${f.label} (${f.type})` })),
          { value: '__create__', label: `Create "Level ${level.level} Rejection" (Choice) — requires permission` },
        ],
      }));
    }

    // Rejection routing
    if (!level.onRejection) {
      const priorLevels = definition.levels
        .filter((l) => l.level < level.level)
        .map((l) => ({ value: `level:${l.level}`, label: `Return to Level ${l.level}` }));
      const otherLevels = definition.levels
        .filter((l) => l.level !== level.level && l.level > level.level)
        .map((l) => ({ value: `level:${l.level}`, label: `Return to Level ${l.level}` }));
      push(req({
        id: `level.${level.level}.rejection`,
        scope: 'routing',
        level: level.level,
        key: 'rejection_route',
        question: `*Level ${level.level}* — What should happen if Level ${level.level} **rejects**?`,
        inputKind: 'rejection_route',
        options: [
          { value: 'RETURN_TO_REQUESTER', label: 'Return to requester' },
          ...priorLevels,
          ...otherLevels,
          { value: 'END_WORKFLOW', label: 'End workflow' },
          { value: 'START_OVER', label: 'Start over' },
        ],
      }));
    }
  }

  // Option values for decision fields
  if (form) {
    for (const level of definition.levels) {
      if (!level.approvalFieldId) continue;
      const field = form.fields.find((f) => f.id === level.approvalFieldId);
      if (!field || !isDecisionCompatibleFieldType(field.type)) continue;
      const needed = [
        `Pending Level ${level.level}`,
        `Approved Level ${level.level}`,
        `Rejected Level ${level.level}`,
      ];
      // Also accept generic Pending/Approved/Rejected for single shared field
      const missingLeveled = findMissingOptionValues(field, needed);
      const missingGeneric = findMissingOptionValues(field, ['Pending', 'Approved', 'Rejected']);
      if (missingLeveled.length === 3 && missingGeneric.length > 0) {
        push(req({
          id: `level.${level.level}.decision_values`,
          scope: 'metadata',
          level: level.level,
          key: 'decision_values',
          question: `**${field.label}** is missing values needed for Level ${level.level}. May I add: ${missingGeneric.join(', ')}?`,
          inputKind: 'confirm',
          options: [
            { value: 'add_generic', label: 'Yes, add Pending / Approved / Rejected' },
            { value: 'add_leveled', label: `Yes, add Level ${level.level} specific values` },
            { value: 'skip', label: 'No, use existing values' },
          ],
        }));
      } else if (missingLeveled.length && missingLeveled.length < 3) {
        push(req({
          id: `level.${level.level}.decision_values`,
          scope: 'metadata',
          level: level.level,
          key: 'decision_values',
          question: `**${field.label}** is missing: ${missingLeveled.join(', ')}. May I add them?`,
          inputKind: 'confirm',
          options: [
            { value: 'add_leveled', label: 'Yes, add missing values' },
            { value: 'skip', label: 'No, continue without them' },
          ],
        }));
      }
    }
  }

  // Mark configured flags
  for (const level of definition.levels) {
    level.configured = levelConfigured(level);
  }

  return mergeUnansweredFirst(out);
}

function mergeUnansweredFirst(items: MissingRequirement[]): MissingRequirement[] {
  const unanswered = items.filter((i) => !i.answered);
  const answered = items.filter((i) => i.answered);
  return [...unanswered, ...answered];
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
): AIWorkflowDefinition {
  const next: AIWorkflowDefinition = {
    ...definition,
    levels: definition.levels.map((l) => ({
      ...l,
      approver: { ...l.approver },
      onRejection: l.onRejection ? { ...l.onRejection } : null,
    })),
    conditions: [...definition.conditions],
  };

  const value = String(answer ?? '').trim();

  if (requirement.key === 'level_count') {
    const count = Math.max(1, Math.min(5, Number(value) || 2));
    next.levels = Array.from({ length: count }, (_, i) => createEmptyLevel(i + 1));
    next.levels[next.levels.length - 1].onApprovalNext = 'complete';
    return next;
  }

  if (requirement.level) {
    const level = next.levels.find((l) => l.level === requirement.level);
    if (!level) return next;

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

  return next;
}
