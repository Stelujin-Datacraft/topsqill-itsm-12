/**
 * Pending CREATE_FIELD / CREATE_FIELD_VALUE helpers for confirmed missing assets.
 * Kept free of API imports so conversation/planner can smoke-test without Vite env.
 */
import type {
  PendingConfigAction,
  WorkflowBuilderSession,
} from './types';
import { isApprovalStyleDefinition } from './types';
import {
  fieldHasPreferredOption,
  isPollutedOptionLabel,
  sanitizeConditionValueHint,
} from './decisionOptionResolver';
import {
  SUBMISSION_ACCESS_FIELD_LABEL,
  SUBMISSION_ACCESS_FIELD_TYPE,
} from './metadataDiscovery';

type FieldMeta = {
  id: string;
  label: string;
  type?: string;
  options?: Array<{ id?: string; value: string; label: string }>;
};

/** Collect Level N approver user ids for SAC allowedUsers seeding/merge. */
export function collectApproverUserIds(session: WorkflowBuilderSession): string[] {
  return [...new Set(
    (session.requirements.levels || [])
      .filter((l) => l.approver?.type === 'user' && l.approver.entityId)
      .map((l) => String(l.approver.entityId)),
  )];
}

/** Build pending CREATE_FIELD / CREATE_FIELD_VALUE actions from confirmed missing assets. */
export function buildOptionCreatePendingActions(
  session: WorkflowBuilderSession,
  form?: { fields?: FieldMeta[] },
  formsCatalog: Array<{ id: string; fields?: FieldMeta[] }> = [],
): PendingConfigAction[] {
  const actions: PendingConfigAction[] = [];
  const def = session.requirements;

  if (
    isApprovalStyleDefinition(def)
    && def.pendingAccessFieldCreate
    && !def.accessFieldId
  ) {
    actions.push({
      id: 'create_field_submission_access',
      kind: 'CREATE_FIELD',
      description: `Create field "${SUBMISSION_ACCESS_FIELD_LABEL}" (${SUBMISSION_ACCESS_FIELD_TYPE})`,
      payload: {
        label: SUBMISSION_ACCESS_FIELD_LABEL,
        fieldType: SUBMISSION_ACCESS_FIELD_TYPE,
        scope: 'access',
        allowedUserIds: collectApproverUserIds(session),
      },
      // User already confirmed via the ensure question
      userConfirmed: true,
    });
  }

  for (const cond of def.conditions || []) {
    if (!cond.pendingOptionCreate || !cond.fieldId) continue;
    const label = sanitizeConditionValueHint(String(cond.pendingOptionLabel || cond.value || ''));
    if (!label || isPollutedOptionLabel(label)) continue;
    const field = form?.fields?.find((f) => f.id === cond.fieldId)
      || form?.fields?.find((f) =>
        cond.fieldLabel
        && f.label.toLowerCase() === String(cond.fieldLabel).toLowerCase(),
      );
    // Already present (e.g. Closed exists) → do not create again
    if (fieldHasPreferredOption(field, label)) continue;
    actions.push({
      id: `create_value_cond_${cond.fieldId}`,
      kind: 'CREATE_FIELD_VALUE',
      description: `Add option "${label}" on ${cond.fieldLabel || 'condition field'}`,
      payload: {
        fieldId: cond.fieldId,
        fieldLabel: cond.fieldLabel,
        fieldType: cond.fieldType,
        valueLabel: label,
        scope: 'condition',
      },
      userConfirmed: true,
    });
  }

  const action = def.action;
  if (action?.pendingOptionCreate && (action.targetFieldId || action.targetFieldLabel)) {
    const label = sanitizeConditionValueHint(String(action.pendingOptionLabel || action.staticValue || ''));
    if (label && !isPollutedOptionLabel(label)) {
      const linkedForm = action.targetFormId
        ? formsCatalog.find((f) => f.id === action.targetFormId)
        : undefined;
      const fieldSource = action.actionType === 'update_linked_records' && linkedForm
        ? linkedForm
        : form;
      const field = fieldSource?.fields?.find((f) =>
        f.id === action.targetFieldId
        || (action.targetFieldLabel
          && f.label.toLowerCase() === String(action.targetFieldLabel).toLowerCase()),
      );
      if (!fieldHasPreferredOption(field, label)) {
        actions.push({
          id: `create_value_action_${action.targetFieldId || action.targetFieldLabel}`,
          kind: 'CREATE_FIELD_VALUE',
          description: `Add option "${label}" on ${action.targetFieldLabel || 'action field'}`,
          payload: {
            fieldId: field?.id || action.targetFieldId,
            fieldLabel: action.targetFieldLabel,
            fieldType: action.targetFieldType || field?.type,
            valueLabel: label,
            scope: 'action',
          },
          userConfirmed: true,
        });
      }
    }
  }

  return actions;
}
