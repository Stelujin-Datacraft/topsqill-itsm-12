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
  levelStatusFieldLabel,
  findMainStatusField,
  missingMainStatusSyncOptions,
  SUBMISSION_ACCESS_FIELD_LABEL,
  type DiscoveredForm,
  type OrgUserChoice,
} from './metadataDiscovery';
import { describeActionType } from './actionTypeInferrer';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';
import { extractGenericPromptHints, extractCreateTargetFormHint, fieldMatchesHint } from './promptHints';
import { matchFormFieldByHint } from '@/lib/ai/inferWorkflowIntent';
import { sanitizeConditionValueHint } from './decisionOptionResolver';
import {
  areTypesCompatible,
  filterCompatibleFields,
  isWorkflowValueField,
} from '@/utils/workflowFieldFiltering';

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
  const hasApprovalField = Boolean(
    level.approvalFieldId
    || level.approvalFieldLabel
    || level.pendingDecisionFieldCreate,
  );
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
    case 'create_record': {
      const hasStaticDraft = Boolean(action.targetFieldId || action.targetFieldLabel);
      const hasMapDraft = action.createDraftKind === 'map'
        || Boolean(action.createMapTargetFieldId || action.createMapTargetFieldLabel);
      return Boolean(action.targetFormId || action.targetFormName)
        && !hasStaticDraft
        && !hasMapDraft
        && (
          action.skipCreateFieldValues === true
          || action.createFieldsDone === true
        );
    }
    case 'create_linked_record': {
      const hasStaticDraft = Boolean(action.targetFieldId || action.targetFieldLabel);
      const hasMapDraft = action.createDraftKind === 'map'
        || Boolean(action.createMapTargetFieldId || action.createMapTargetFieldLabel);
      return Boolean(action.crossReferenceFieldId || action.crossReferenceFieldLabel)
        && Boolean(action.targetFormId || action.targetFormName)
        && !hasStaticDraft
        && !hasMapDraft
        && (
          action.skipCreateFieldValues === true
          || action.createFieldsDone === true
        );
    }
    case 'update_linked_records': {
      const hasStaticDraft = Boolean(action.targetFieldId || action.targetFieldLabel);
      const hasMapDraft = action.createDraftKind === 'map'
        || Boolean(action.createMapTargetFieldId || action.createMapTargetFieldLabel);
      const hasUpdates = (action.createFieldValues || []).length > 0
        || (action.createFieldMappings || []).length > 0;
      return Boolean(action.crossReferenceFieldId || action.crossReferenceFieldLabel)
        && Boolean(action.targetFormId || action.targetFormName)
        && !hasStaticDraft
        && !hasMapDraft
        && action.createFieldsDone === true
        && hasUpdates;
    }    case 'create_combination_records':
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

  // Prefer named create target form from prompt ("create a new Incident record")
  if (
    (action.actionType === 'create_record' || action.actionType === 'create_linked_record')
    && !action.targetFormId
  ) {
    const formHint = extractCreateTargetFormHint(originalRequest || definition.description || '');
    if (formHint) {
      const key = formHint.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const matchedForm = hydratedCatalog.find((f) => {
        const name = String(f.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return name === key || name.includes(key) || key.includes(name);
      });
      if (matchedForm) {
        action.targetFormId = matchedForm.id;
        action.targetFormName = matchedForm.name;
      } else if (!action.targetFormName) {
        action.targetFormName = formHint;
      }
    }
  }

  let condition = definition.conditions[0];
  const allFields = fieldChoices(hydratedForm);
  const xrFields = suggestCrossReferenceFields(hydratedForm);

  // Auto-bind condition field (+ value) from prompt hints before asking
  if (!condition?.fieldId && !condition?.fieldLabel && hints.conditionFieldHint && hydratedForm) {
    const matched = searchFields(hydratedForm, hints.conditionFieldHint).matched
      || matchFormFieldByHint(
        (hydratedForm.fields || []).map((f) => ({ id: f.id, label: f.label, type: f.type, options: f.options })),
        hints.conditionFieldHint,
      );
    const matchedFull = matched
      ? hydratedForm.fields.find((f) => f.id === matched.id) || null
      : null;
    if (matchedFull) {
      definition.conditions = [{
        fieldId: matchedFull.id,
        fieldLabel: matchedFull.label,
        fieldType: matchedFull.type,
        operator: '==',
        value: hints.conditionValueHint
          ? sanitizeConditionValueHint(hints.conditionValueHint)
          : '',
        resolved: true,
        pendingOptionLabel: hints.conditionValueHint
          ? sanitizeConditionValueHint(hints.conditionValueHint)
          : undefined,
        pendingOptionCreate: false,
      }];
      condition = definition.conditions[0];
    }
  }

  // ── Condition field (always ask separately) ─────────────────────────────
  if (!condition?.fieldId && !condition?.fieldLabel) {
    push(req({
      id: 'condition.field',
      scope: 'condition',
      key: 'condition_field',
      question: [
        `I'll set up a **${describeActionType(action.actionType)}** action (inferred from your prompt).`,
        '',
        hints.conditionFieldHint
          ? `I couldn't confidently match **${hints.conditionFieldHint}** — which **condition** field should gate this action?`
          : 'Which **condition** field should gate this action?',
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
    const xrQuestion = action.actionType === 'update_linked_records'
      ? 'Which **cross-reference** field points to the linked records to update?'
      : action.actionType === 'create_linked_record'
        ? 'Which **cross-reference** field links to the form where the new record should be created?'
        : 'Which **cross-reference** field links to the related form?';
    push(req({
      id: 'action.cross_ref',
      scope: 'workflow',
      key: 'action_cross_ref',
      question: xrQuestion,
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

  // If create_record only has a name hint, resolve id from catalog when possible
  if (
    needsTargetForm
    && !action.targetFormId
    && action.targetFormName
    && hydratedCatalog.length
  ) {
    const key = action.targetFormName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const matchedForm = hydratedCatalog.find((f) => {
      const name = String(f.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return name === key || name.includes(key) || key.includes(name);
    });
    if (matchedForm) {
      action.targetFormId = matchedForm.id;
      action.targetFormName = matchedForm.name;
    } else {
      push(req({
        id: 'action.target_form',
        scope: 'workflow',
        key: 'action_target_form',
        question: `Which form is **${action.targetFormName}**? Pick the target form for the new record.`,
        inputKind: 'choice',
        options: hydratedCatalog.map((f) => ({ value: f.id, label: f.name })),
      }));
      return mergeUnansweredFirst(out);
    }
  }

  // ── Create / linked-create / linked-update field values + mappings ─────
  const isUpdateLinked = action.actionType === 'update_linked_records';
  const isCreateAction = action.actionType === 'create_record'
    || action.actionType === 'create_linked_record'
    || isUpdateLinked;

  if (isCreateAction && !action.skipCreateFieldValues && !action.createFieldsDone) {
    if (!action.createFieldValues) action.createFieldValues = [];
    if (!action.createFieldMappings) action.createFieldMappings = [];

    const linkedForm = action.targetFormId
      ? hydratedCatalog.find((f) => f.id === action.targetFormId)
      : undefined;
    const fieldSource = linkedForm || hydratedForm;
    const triggerFields = (hydratedForm?.fields || []).filter((f) => isWorkflowValueField(f.type));
    const usedTargetIds = new Set([
      ...(action.createFieldValues || []).map((f) => f.fieldId).filter(Boolean) as string[],
      ...(action.createFieldMappings || []).map((f) => f.targetFieldId).filter(Boolean) as string[],
    ]);
    const availableTargetFields = (fieldChoices(fieldSource).length ? fieldChoices(fieldSource) : allFields)
      .filter((f) => !usedTargetIds.has(f.value));

    const recordNoun = isUpdateLinked
      ? (action.targetFormName || 'linked record')
      : (action.targetFormName || 'record');
    const actionVerb = isUpdateLinked ? 'update' : 'create';
    const targetFieldPrompt = isUpdateLinked
      ? `Which **field on the linked ${recordNoun}** should receive a value from the trigger form?`
      : `Which **field on the new ${recordNoun}** should receive a value from the trigger form?`;
    const staticValuePrompt = (label: string) => isUpdateLinked
      ? `What **static value** should **${label}** be set to on the linked record?`
      : `What **static value** should **${label}** be set to on the new record?`;

    const clearStaticDraft = () => {
      action.targetFieldId = undefined;
      action.targetFieldLabel = undefined;
      action.targetFieldType = undefined;
      action.staticValue = undefined;
      action.pendingOptionCreate = false;
      action.pendingOptionLabel = undefined;
      if (action.createDraftKind === 'static') action.createDraftKind = undefined;
    };

    const clearMapDraft = () => {
      action.createMapTargetFieldId = undefined;
      action.createMapTargetFieldLabel = undefined;
      action.createMapTargetFieldType = undefined;
      action.createMapSourceFieldId = undefined;
      action.createMapSourceFieldLabel = undefined;
      action.createMapSourceFieldType = undefined;
      if (action.createDraftKind === 'map') action.createDraftKind = undefined;
    };

    const commitDraftCreateField = () => {
      if (!action.targetFieldId && !action.targetFieldLabel) return;
      action.createFieldValues = action.createFieldValues || [];
      action.createFieldValues.push({
        fieldId: action.targetFieldId,
        fieldLabel: action.targetFieldLabel,
        fieldType: action.targetFieldType,
        staticValue: action.pendingOptionLabel || action.staticValue,
        pendingOptionCreate: action.pendingOptionCreate || false,
        pendingOptionLabel: action.pendingOptionLabel,
      });
      clearStaticDraft();
    };

    const commitDraftCreateMapping = () => {
      if (
        !(action.createMapTargetFieldId || action.createMapTargetFieldLabel)
        || !(action.createMapSourceFieldId || action.createMapSourceFieldLabel)
      ) return;
      action.createFieldMappings = action.createFieldMappings || [];
      action.createFieldMappings.push({
        targetFieldId: action.createMapTargetFieldId,
        targetFieldLabel: action.createMapTargetFieldLabel,
        targetFieldType: action.createMapTargetFieldType,
        sourceFieldId: action.createMapSourceFieldId,
        sourceFieldLabel: action.createMapSourceFieldLabel,
        sourceFieldType: action.createMapSourceFieldType,
      });
      clearMapDraft();
    };

    // ── Map draft: need target field on new record ────────────────────────
    if (
      action.createDraftKind === 'map'
      && !action.createMapTargetFieldId
      && !action.createMapTargetFieldLabel
    ) {
      push(req({
        id: `action.create_map_target_${action.createFieldMappings.length}`,
        scope: 'workflow',
        key: 'action_map_target_field',
        question: [
          targetFieldPrompt,
          '',
          'Only data fields are listed. Next you will pick a compatible trigger-form field to map from.',
        ].join('\n'),
        inputKind: 'field_select',
        options: [
          { value: '__cancel_map__', label: 'Cancel mapping — go back' },
          ...availableTargetFields,
        ],
      }));
      return mergeUnansweredFirst(out);
    }

    // ── Map draft: need compatible source field on trigger form ───────────
    if (
      action.createDraftKind === 'map'
      && (action.createMapTargetFieldId || action.createMapTargetFieldLabel)
      && !action.createMapSourceFieldId
      && !action.createMapSourceFieldLabel
    ) {
      const targetType = action.createMapTargetFieldType || 'text';
      const compatible = filterCompatibleFields(triggerFields, targetType)
        .filter((f) => f.id !== action.createMapTargetFieldId);
      const sourceOpts = compatible.map((f) => ({
        value: f.id,
        label: `${f.label} (${f.type})`,
      }));
      if (!sourceOpts.length) {
        push(req({
          id: `action.create_map_source_none_${action.createFieldMappings.length}`,
          scope: 'workflow',
          key: 'action_map_source_field',
          question: [
            `No **compatible** fields on the trigger form can map to **${action.createMapTargetFieldLabel || 'that field'}** (${targetType}).`,
            '',
            'Cancel this mapping and pick a different target field, or set a static value instead.',
          ].join('\n'),
          inputKind: 'choice',
          options: [
            { value: '__cancel_map__', label: 'Cancel mapping' },
          ],
        }));
        return mergeUnansweredFirst(out);
      }
      push(req({
        id: `action.create_map_source_${action.createFieldMappings.length}`,
        scope: 'workflow',
        key: 'action_map_source_field',
        question: [
          `Map **which trigger-form field** → **${action.createMapTargetFieldLabel}** on the ${isUpdateLinked ? 'linked' : 'new'} record?`,
          '',
          `Only fields compatible with type **${targetType}** are shown.`,
        ].join('\n'),
        inputKind: 'field_select',
        options: [
          { value: '__cancel_map__', label: 'Cancel mapping' },
          ...sourceOpts,
        ],
      }));
      return mergeUnansweredFirst(out);
    }

    // ── Map draft complete → commit ───────────────────────────────────────
    if (
      action.createDraftKind === 'map'
      && (action.createMapTargetFieldId || action.createMapTargetFieldLabel)
      && (action.createMapSourceFieldId || action.createMapSourceFieldLabel)
    ) {
      // Soft-check compatibility (should already be filtered)
      if (
        action.createMapSourceFieldType
        && action.createMapTargetFieldType
        && !areTypesCompatible(action.createMapSourceFieldType, action.createMapTargetFieldType)
      ) {
        action.createMapSourceFieldId = undefined;
        action.createMapSourceFieldLabel = undefined;
        action.createMapSourceFieldType = undefined;
        // re-ask source on next plan pass
      } else {
        commitDraftCreateMapping();
      }
    }

    // Draft static value missing → ask value
    if (
      action.createDraftKind !== 'map'
      && (action.targetFieldId || action.targetFieldLabel)
      && (action.staticValue === undefined || action.staticValue === null || String(action.staticValue) === '')
    ) {
      const draftField = fieldSource?.fields.find((f) =>
        f.id === action.targetFieldId
        || (action.targetFieldLabel
          && f.label.toLowerCase() === String(action.targetFieldLabel).toLowerCase()),
      );
      const opts = fieldOptionChoices(draftField);
      if (opts.length) {
        push(req({
          id: `action.create_value_${action.createFieldValues.length}`,
          scope: 'workflow',
          key: 'action_value',
          question: staticValuePrompt(String(draftField?.label || action.targetFieldLabel)),
          inputKind: 'choice',
          options: opts,
        }));
      } else {
        push(req({
          id: `action.create_value_${action.createFieldValues.length}`,
          scope: 'workflow',
          key: 'action_value',
          question: staticValuePrompt(String(draftField?.label || action.targetFieldLabel || 'the field')),
          inputKind: 'text',
        }));
      }
      return mergeUnansweredFirst(out);
    }

    // Draft static value present → resolve option / ask create / commit
    if (
      action.createDraftKind !== 'map'
      && (action.targetFieldId || action.targetFieldLabel)
      && action.staticValue !== undefined
      && action.staticValue !== null
      && String(action.staticValue) !== ''
    ) {
      const draftField = fieldSource?.fields.find((f) =>
        f.id === action.targetFieldId
        || (action.targetFieldLabel
          && f.label.toLowerCase() === String(action.targetFieldLabel).toLowerCase()),
      );
      if (action.pendingOptionCreate) {
        commitDraftCreateField();
      } else if (draftField && fieldHasOption(draftField, action.staticValue)) {
        action.staticValue = resolveFieldOptionValue(draftField, action.staticValue);
        commitDraftCreateField();
      } else if (draftField && fieldNeedsOptionCreateCheck(draftField) && !fieldHasOption(draftField, action.staticValue)) {
        const wanted = sanitizeConditionValueHint(String(action.pendingOptionLabel || action.staticValue || ''));
        push(req({
          id: `action.create_value_create_${action.createFieldValues.length}`,
          scope: 'workflow',
          key: 'action_value_create',
          question: [
            `**${draftField.label}** does not have an option **${wanted}**.`,
            '',
            `May I add **${wanted}** as an option on **${draftField.label}**?`,
          ].join('\n'),
          inputKind: 'confirm',
          options: [
            { value: '__create_option__', label: `Yes, add "${wanted}"` },
            { value: '__pick_existing__', label: 'No — pick an existing option' },
          ],
        }));
        return mergeUnansweredFirst(out);
      } else {
        commitDraftCreateField();
      }
    }

    // Ask for next static field, mapping, or done/skip
    if (
      !action.targetFieldId
      && !action.targetFieldLabel
      && action.createDraftKind !== 'map'
      && !action.createMapTargetFieldId
      && !action.createMapTargetFieldLabel
    ) {
      const staticCount = action.createFieldValues.length;
      const mapCount = action.createFieldMappings.length;
      const added = staticCount + mapCount;
      const staticSummary = staticCount
        ? action.createFieldValues.map((f) => `**${f.fieldLabel}**=${String(f.staticValue)}`).join(', ')
        : '';
      const mapSummary = mapCount
        ? action.createFieldMappings
          .map((m) => `**${m.targetFieldLabel}**←${m.sourceFieldLabel}`)
          .join(', ')
        : '';
      const summaryParts = [
        staticSummary ? `Static: ${staticSummary}` : '',
        mapSummary ? `Mapped: ${mapSummary}` : '',
      ].filter(Boolean);
      push(req({
        id: `action.create_field_${added}`,
        scope: 'workflow',
        key: 'action_field',
        question: [
          added
            ? `Add another field to ${actionVerb} on **${recordNoun}**?`
            : isUpdateLinked
              ? `How should fields be set while updating the linked **${recordNoun}**?`
              : `How should fields be set while creating the new **${recordNoun}**?`,
          summaryParts.length ? summaryParts.join(' · ') : '',
          '',
          isUpdateLinked
            ? (added
              ? 'Pick another field for a **static value**, **Map Field from trigger form**, or **Done**.'
              : 'Pick a field for a **static value** or **Map Field from trigger form** (at least one update is required).')
            : 'Pick a field for a **static value**, choose **Map Field from trigger form**, or finish.',
        ].filter(Boolean).join('\n'),
        inputKind: 'field_select',
        options: [
          ...(added
            ? [{ value: '__done_create_fields__', label: 'Done — stop adding fields' }]
            : (isUpdateLinked
              ? []
              : [{ value: '__skip_create_field_values__', label: 'Skip — create with empty/default values' }])),
          { value: '__map_from_trigger__', label: 'Map Field from trigger form' },
          ...availableTargetFields,
        ],
      }));
      return mergeUnansweredFirst(out);
    }
  }

  // Action field (change_field_value on trigger form only)
  const needsActionField = action.actionType === 'change_field_value';

  if (
    needsActionField
    && !action.targetFieldId
    && !action.targetFieldLabel
  ) {
    push(req({
      id: 'action.field',
      scope: 'workflow',
      key: 'action_field',
      question: 'Which **field** should the action update on this form?',
      inputKind: 'field_select',
      options: fieldChoices(hydratedForm).length
        ? fieldChoices(hydratedForm)
        : allFields,
    }));
    return mergeUnansweredFirst(out);
  }

  // Auto-fill action value from prompt when field known but value empty
  if (
    needsActionField
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
    needsActionField
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
    needsActionField
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
      question: 'How many approval levels do you need? (1–8)',
      inputKind: 'choice',
      options: [
        { value: '1', label: '1 level' },
        { value: '2', label: '2 levels' },
        { value: '3', label: '3 levels' },
        { value: '4', label: '4 levels' },
        { value: '5', label: '5 levels' },
        { value: '6', label: '6 levels' },
        { value: '7', label: '7 levels' },
        { value: '8', label: '8 levels' },
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

    if (!level.approvalFieldId && !level.approvalFieldLabel && !level.pendingDecisionFieldCreate) {
      const statusLabel = levelStatusFieldLabel(level.level);
      push(req({
        id: `level.${level.level}.approval_field`,
        scope: 'level',
        level: level.level,
        key: 'approval_field',
        question: [
          `*Level ${level.level}* — Approver ${level.level} needs a **Status** dropdown for their decision.`,
          '',
          `Create **${statusLabel}** (same options as the main Status field, including Pending / Approved / Rejected), or pick an existing field?`,
        ].join('\n'),
        inputKind: 'field_select',
        options: [
          {
            value: '__create_level_status__',
            label: `Create "${statusLabel}" dropdown`,
          },
          ...decisionSuggestions.map((f) => ({ value: f.id, label: `Use existing: ${f.label} (${f.type})` })),
        ],
      }));
      return mergeUnansweredFirst(out);
    }

    // Rejection uses the same decision field — no separate reject field
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

  // Main Status sync: Pending with Level N / Level N Approved / Level N Rejected
  const mainStatus = findMainStatusField(form);
  if (mainStatus) {
    if (!definition.mainStatusFieldId) {
      definition.mainStatusFieldId = mainStatus.id;
      definition.mainStatusFieldLabel = mainStatus.label || 'Status';
    }
    if (definition.syncMainStatus == null) {
      const missing = missingMainStatusSyncOptions(form, definition.levels.length);
      if (missing.length) {
        push(req({
          id: 'workflow.main_status_sync',
          scope: 'workflow',
          key: 'main_status_sync',
          question: [
            'As each level decides, I can update the main **Status** field from that level\'s Status:',
            '',
            '• Waiting on Level N → **Pending with Level N**',
            '• Level N Approved → **Level N Approved**',
            '• Level N Rejected → **Level N Rejected**',
            '',
            'These Status options are not on the form yet:',
            ...missing.map((label) => `• ${label}`),
            '',
            'Add them and sync Status this way?',
          ].join('\n'),
          inputKind: 'confirm',
          options: [
            {
              value: '__sync_main_status__',
              label: 'Yes — add missing options and sync Status',
            },
            {
              value: '__skip_main_status_sync__',
              label: 'No — leave main Status unchanged',
            },
          ],
        }));
        return mergeUnansweredFirst(out);
      }
      // Options already exist — enable sync without asking
      definition.syncMainStatus = true;
      definition.pendingMainStatusOptions = [];
    }
  } else if (definition.syncMainStatus == null) {
    definition.syncMainStatus = false;
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

  if (requirement.key === 'main_status_sync') {
    const yes = value === '__sync_main_status__'
      || /^(y|yes|ok|allow|confirm|add|sync)\b/i.test(value);
    const main = findMainStatusField(form);
    if (yes) {
      next.syncMainStatus = true;
      next.mainStatusFieldId = main?.id || next.mainStatusFieldId;
      next.mainStatusFieldLabel = main?.label || next.mainStatusFieldLabel || 'Status';
      next.pendingMainStatusOptions = missingMainStatusSyncOptions(
        form,
        next.levels.length,
      );
    } else {
      next.syncMainStatus = false;
      next.pendingMainStatusOptions = [];
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
    const count = Math.max(1, Math.min(8, Number(value) || 2));
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
    const isCreate = next.action.actionType === 'create_record'
      || next.action.actionType === 'create_linked_record'
      || next.action.actionType === 'update_linked_records';
    const isUpdateLinked = next.action.actionType === 'update_linked_records';
    if (value === '__skip_create_field_values__' || (isCreate && !isUpdateLinked && /^skip\b/i.test(value))) {
      if (isUpdateLinked) {
        // Update Linked requires at least one field change — ignore skip
        return next;
      }
      next.action.skipCreateFieldValues = true;
      next.action.createFieldsDone = true;
      next.action.createFieldValues = next.action.createFieldValues || [];
      next.action.createFieldMappings = next.action.createFieldMappings || [];
      next.action.createDraftKind = undefined;
      next.action.targetFieldId = undefined;
      next.action.targetFieldLabel = undefined;
      next.action.targetFieldType = undefined;
      next.action.staticValue = undefined;
      next.action.pendingOptionCreate = false;
      next.action.pendingOptionLabel = undefined;
      next.action.createMapTargetFieldId = undefined;
      next.action.createMapTargetFieldLabel = undefined;
      next.action.createMapTargetFieldType = undefined;
      next.action.createMapSourceFieldId = undefined;
      next.action.createMapSourceFieldLabel = undefined;
      next.action.createMapSourceFieldType = undefined;
      next.action.configured = actionConfigured(next.action);
      return next;
    }
    if (value === '__done_create_fields__' || (isCreate && /^done\b/i.test(value))) {
      const hasStatic = (next.action.createFieldValues || []).length > 0;
      const hasMaps = (next.action.createFieldMappings || []).length > 0;
      if (isUpdateLinked && !hasStatic && !hasMaps) {
        // Must add at least one update — leave createFieldsDone false
        return next;
      }
      next.action.createFieldsDone = true;
      if (!hasStatic && !hasMaps) {
        next.action.skipCreateFieldValues = true;
      }
      next.action.createDraftKind = undefined;
      next.action.targetFieldId = undefined;
      next.action.targetFieldLabel = undefined;
      next.action.targetFieldType = undefined;
      next.action.staticValue = undefined;
      next.action.pendingOptionCreate = false;
      next.action.pendingOptionLabel = undefined;
      next.action.createMapTargetFieldId = undefined;
      next.action.createMapTargetFieldLabel = undefined;
      next.action.createMapTargetFieldType = undefined;
      next.action.createMapSourceFieldId = undefined;
      next.action.createMapSourceFieldLabel = undefined;
      next.action.createMapSourceFieldType = undefined;
      next.action.configured = actionConfigured(next.action);
      return next;
    }
    if (value === '__map_from_trigger__' || (isCreate && /^map\b/i.test(value))) {
      next.action.skipCreateFieldValues = false;
      next.action.createFieldsDone = false;
      next.action.createDraftKind = 'map';
      next.action.createFieldMappings = next.action.createFieldMappings || [];
      next.action.targetFieldId = undefined;
      next.action.targetFieldLabel = undefined;
      next.action.targetFieldType = undefined;
      next.action.staticValue = undefined;
      next.action.pendingOptionCreate = false;
      next.action.pendingOptionLabel = undefined;
      next.action.createMapTargetFieldId = undefined;
      next.action.createMapTargetFieldLabel = undefined;
      next.action.createMapTargetFieldType = undefined;
      next.action.createMapSourceFieldId = undefined;
      next.action.createMapSourceFieldLabel = undefined;
      next.action.createMapSourceFieldType = undefined;
      return next;
    }
    const linkedForm = next.action.targetFormId
      ? formsCatalog.find((f) => f.id === next.action!.targetFormId)
      : undefined;
    const useTargetForm = next.action.actionType === 'update_linked_records'
      || next.action.actionType === 'create_record'
      || next.action.actionType === 'create_linked_record';
    const fieldSource = useTargetForm && linkedForm ? linkedForm : form;
    const field = fieldSource?.fields.find((f) => f.id === value)
      || searchFields(fieldSource, value).matched;
    next.action.skipCreateFieldValues = false;
    next.action.createFieldsDone = false;
    next.action.createDraftKind = isCreate ? 'static' : undefined;
    next.action.createFieldValues = next.action.createFieldValues || [];
    next.action.createFieldMappings = next.action.createFieldMappings || [];
    next.action.targetFieldId = field?.id;
    next.action.targetFieldLabel = field?.label || value;
    next.action.targetFieldType = field?.type;
    next.action.valueType = 'static';
    next.action.staticValue = undefined;
    next.action.pendingOptionCreate = false;
    next.action.pendingOptionLabel = undefined;
    return next;
  }

  if (requirement.key === 'action_map_target_field' && next.action) {
    if (value === '__cancel_map__' || /^cancel\b/i.test(value)) {
      next.action.createDraftKind = undefined;
      next.action.createMapTargetFieldId = undefined;
      next.action.createMapTargetFieldLabel = undefined;
      next.action.createMapTargetFieldType = undefined;
      next.action.createMapSourceFieldId = undefined;
      next.action.createMapSourceFieldLabel = undefined;
      next.action.createMapSourceFieldType = undefined;
      return next;
    }
    const linkedForm = next.action.targetFormId
      ? formsCatalog.find((f) => f.id === next.action!.targetFormId)
      : undefined;
    const fieldSource = linkedForm || form;
    const field = fieldSource?.fields.find((f) => f.id === value)
      || searchFields(fieldSource, value).matched;
    next.action.createDraftKind = 'map';
    next.action.createMapTargetFieldId = field?.id;
    next.action.createMapTargetFieldLabel = field?.label || value;
    next.action.createMapTargetFieldType = field?.type;
    next.action.createMapSourceFieldId = undefined;
    next.action.createMapSourceFieldLabel = undefined;
    next.action.createMapSourceFieldType = undefined;
    return next;
  }

  if (requirement.key === 'action_map_source_field' && next.action) {
    if (value === '__cancel_map__' || /^cancel\b/i.test(value)) {
      next.action.createDraftKind = undefined;
      next.action.createMapTargetFieldId = undefined;
      next.action.createMapTargetFieldLabel = undefined;
      next.action.createMapTargetFieldType = undefined;
      next.action.createMapSourceFieldId = undefined;
      next.action.createMapSourceFieldLabel = undefined;
      next.action.createMapSourceFieldType = undefined;
      return next;
    }
    const field = form?.fields.find((f) => f.id === value)
      || searchFields(form, value).matched;
    const sourceType = field?.type || '';
    const targetType = next.action.createMapTargetFieldType || '';
    if (sourceType && targetType && !areTypesCompatible(sourceType, targetType)) {
      // Reject incompatible pick — leave source empty so planner re-asks
      next.action.createMapSourceFieldId = undefined;
      next.action.createMapSourceFieldLabel = undefined;
      next.action.createMapSourceFieldType = undefined;
      return next;
    }
    next.action.createDraftKind = 'map';
    next.action.createMapSourceFieldId = field?.id;
    next.action.createMapSourceFieldLabel = field?.label || value;
    next.action.createMapSourceFieldType = field?.type;
    // Commit immediately so configured() sees a clean action
    if (
      (next.action.createMapTargetFieldId || next.action.createMapTargetFieldLabel)
      && (next.action.createMapSourceFieldId || next.action.createMapSourceFieldLabel)
    ) {
      next.action.createFieldMappings = next.action.createFieldMappings || [];
      next.action.createFieldMappings.push({
        targetFieldId: next.action.createMapTargetFieldId,
        targetFieldLabel: next.action.createMapTargetFieldLabel,
        targetFieldType: next.action.createMapTargetFieldType,
        sourceFieldId: next.action.createMapSourceFieldId,
        sourceFieldLabel: next.action.createMapSourceFieldLabel,
        sourceFieldType: next.action.createMapSourceFieldType,
      });
      next.action.createDraftKind = undefined;
      next.action.createMapTargetFieldId = undefined;
      next.action.createMapTargetFieldLabel = undefined;
      next.action.createMapTargetFieldType = undefined;
      next.action.createMapSourceFieldId = undefined;
      next.action.createMapSourceFieldLabel = undefined;
      next.action.createMapSourceFieldType = undefined;
    }
    next.action.configured = actionConfigured(next.action);
    return next;
  }

  if (requirement.key === 'action_value' && next.action) {
    const linkedForm = next.action.targetFormId
      ? hydrateDiscoveredForm(formsCatalog.find((f) => f.id === next.action!.targetFormId))
      : undefined;
    const useTargetForm = next.action.actionType === 'update_linked_records'
      || next.action.actionType === 'create_record'
      || next.action.actionType === 'create_linked_record';
    const fieldSource = useTargetForm && linkedForm
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
        level.pendingDecisionFieldCreate = false;
      } else if (
        value === '__create_level_status__'
        || value === '__create__'
        || value.startsWith('__create_named__:')
      ) {
        const named = value.startsWith('__create_named__:')
          ? value.slice('__create_named__:'.length).trim()
          : '';
        level.approvalFieldLabel = named || levelStatusFieldLabel(level.level);
        level.approvalFieldId = undefined;
        level.pendingDecisionFieldCreate = true;
        level.rejectionFieldId = undefined;
        level.rejectionFieldLabel = level.approvalFieldLabel;
      } else {
        const field = form?.fields.find((f) => f.id === value);
        if (field && !isDecisionCompatibleFieldType(field.type)) {
          level.approvalFieldId = undefined;
          level.approvalFieldLabel = undefined;
          level.pendingDecisionFieldCreate = false;
        } else if (field) {
          level.approvalFieldId = value;
          level.approvalFieldLabel = field.label;
          level.pendingDecisionFieldCreate = false;
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
