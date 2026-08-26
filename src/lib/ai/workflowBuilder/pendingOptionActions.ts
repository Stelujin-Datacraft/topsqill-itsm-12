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
  buildLevelStatusFieldOptions,
  levelStatusFieldLabel,
} from './metadataDiscovery';

function slugOptionId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

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

  // Per-level Status dropdowns (copy options from main Status)
  if (isApprovalStyleDefinition(def)) {
    const statusOptions = buildLevelStatusFieldOptions(form as any);
    for (const level of def.levels || []) {
      if (!level.pendingDecisionFieldCreate || level.approvalFieldId) continue;
      const label = level.approvalFieldLabel || levelStatusFieldLabel(level.level);
      actions.push({
        id: `create_field_level_status_l${level.level}`,
        kind: 'CREATE_FIELD',
        description: `Create dropdown "${label}" (Pending / Approved / Rejected + Status options)`,
        payload: {
          label,
          fieldType: 'select',
          scope: 'level_status',
          level: level.level,
          options: statusOptions,
        },
        userConfirmed: true,
      });
    }

    // Main Status sync labels (user already confirmed via main_status_sync)
    if (
      def.syncMainStatus
      && def.mainStatusFieldId
      && (def.pendingMainStatusOptions || []).length
    ) {
      const mainField = form?.fields?.find((f) => f.id === def.mainStatusFieldId);
      for (const label of def.pendingMainStatusOptions || []) {
        const clean = sanitizeConditionValueHint(String(label || ''));
        if (!clean || isPollutedOptionLabel(clean)) continue;
        if (fieldHasPreferredOption(mainField, clean)) continue;
        actions.push({
          id: `create_value_main_status_${slugOptionId(clean)}`,
          kind: 'CREATE_FIELD_VALUE',
          description: `Add option "${clean}" on ${def.mainStatusFieldLabel || 'Status'}`,
          payload: {
            fieldId: def.mainStatusFieldId,
            fieldLabel: def.mainStatusFieldLabel || 'Status',
            fieldType: mainField?.type || 'status',
            valueLabel: clean,
            scope: 'main_status_sync',
            allowOnStatus: true,
          },
          // Dedicated sync question already confirmed these creates
          userConfirmed: true,
        });
      }
    }
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
      const fieldSource = (
        action.actionType === 'update_linked_records'
        || action.actionType === 'create_record'
        || action.actionType === 'create_linked_record'
      ) && linkedForm
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

  for (const fv of action?.createFieldValues || []) {
    if (!fv.pendingOptionCreate || !(fv.fieldId || fv.fieldLabel)) continue;
    const label = sanitizeConditionValueHint(String(fv.pendingOptionLabel || fv.staticValue || ''));
    if (!label || isPollutedOptionLabel(label)) continue;
    const linkedForm = action?.targetFormId
      ? formsCatalog.find((f) => f.id === action.targetFormId)
      : undefined;
    const fieldSource = linkedForm || form;
    const field = fieldSource?.fields?.find((f) =>
      f.id === fv.fieldId
      || (fv.fieldLabel && f.label.toLowerCase() === String(fv.fieldLabel).toLowerCase()),
    );
    if (fieldHasPreferredOption(field, label)) continue;
    actions.push({
      id: `create_value_create_field_${fv.fieldId || fv.fieldLabel}`,
      kind: 'CREATE_FIELD_VALUE',
      description: `Add option "${label}" on ${fv.fieldLabel || 'create field'}`,
      payload: {
        fieldId: field?.id || fv.fieldId,
        fieldLabel: fv.fieldLabel,
        fieldType: fv.fieldType || field?.type,
        valueLabel: label,
        scope: 'create_record',
      },
      userConfirmed: true,
    });
  }

  return actions;
}
