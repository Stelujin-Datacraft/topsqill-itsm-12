/**
 * Apply confirmed pending CREATE_FIELD / CREATE_FIELD_VALUE actions, then rebind definition.
 */
import {
  addConditionFieldOption,
  createConditionFormField,
} from '@/lib/ai/conditionFormMutations';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';
import type {
  AIWorkflowDefinition,
  PendingConfigAction,
  WorkflowBuilderSession,
} from './types';
import { compileWorkflowDefinition, type CompiledWorkflowGraph } from './nodeCompiler';

export interface AppliedPendingCreatesResult {
  definition: AIWorkflowDefinition;
  compiled: CompiledWorkflowGraph;
  createdFields: string[];
  createdValues: string[];
}

/**
 * Execute user-confirmed pending creates, update definition field IDs, and recompile.
 */
export async function applyPendingConfigActions(params: {
  session: WorkflowBuilderSession;
  formId: string;
}): Promise<AppliedPendingCreatesResult> {
  const { session, formId } = params;
  let definition: AIWorkflowDefinition = {
    ...session.requirements,
    levels: session.requirements.levels.map((l) => ({
      ...l,
      approver: { ...l.approver },
      onRejection: l.onRejection ? { ...l.onRejection } : null,
      pendingOptionValues: l.pendingOptionValues ? [...l.pendingOptionValues] : undefined,
    })),
  };

  const createdFields: string[] = [];
  const createdValues: string[] = [];
  const confirmed = (session.pendingActions || []).filter((a) => a.userConfirmed);

  // 1) Create fields first
  for (const action of confirmed.filter((a) => a.kind === 'CREATE_FIELD')) {
    const label = String(action.payload.label || '').trim();
    const type = String(action.payload.type || 'text');
    const options = Array.isArray(action.payload.options)
      ? (action.payload.options as string[]).map((o) => String(o).trim()).filter(Boolean)
      : [];
    const role = String(action.payload.role || '');
    const levelNum = Number(action.payload.level);

    if (!label) continue;

    const created = await createConditionFormField({
      formId,
      label,
      type,
      initialValue: isOptionBasedFieldType(type) && options[0] ? options[0] : undefined,
    });
    createdFields.push(created.label);

    if (isOptionBasedFieldType(created.type)) {
      for (const value of options) {
        try {
          const opt = await addConditionFieldOption({
            fieldId: created.id,
            valueLabel: value,
          });
          if (!createdValues.includes(`${created.label}:${opt.label}`)) {
            createdValues.push(`${created.label}:${opt.label}`);
          }
        } catch {
          /* non-fatal — duplicate or transient */
        }
      }
    }

    definition = rebindCreatedField(definition, {
      role,
      level: levelNum,
      label: created.label,
      fieldId: created.id,
      action,
    });
  }

  // 2) Create option values on existing fields
  for (const action of confirmed.filter((a) => a.kind === 'CREATE_FIELD_VALUE')) {
    const fieldId = String(action.payload.fieldId || '');
    const valueLabel = String(action.payload.valueLabel || '').trim();
    if (!fieldId || !valueLabel) continue;
    try {
      const opt = await addConditionFieldOption({ fieldId, valueLabel });
      const fieldLabel = String(action.payload.fieldLabel || fieldId);
      createdValues.push(`${fieldLabel}:${opt.label}`);
    } catch {
      /* non-fatal */
    }
  }

  // Clear pending option markers once applied
  definition = {
    ...definition,
    levels: definition.levels.map((l) => ({
      ...l,
      pendingOptionValues: undefined,
      configured: true,
    })),
    status: 'READY_TO_PUBLISH',
  };

  const compiled = compileWorkflowDefinition(definition);
  return { definition, compiled, createdFields, createdValues };
}

function rebindCreatedField(
  definition: AIWorkflowDefinition,
  params: {
    role: string;
    level: number;
    label: string;
    fieldId: string;
    action: PendingConfigAction;
  },
): AIWorkflowDefinition {
  const { role, level, label, fieldId } = params;
  return {
    ...definition,
    levels: definition.levels.map((l) => {
      if (level && l.level !== level) return l;
      const next = {
        ...l,
        approver: { ...l.approver },
      };

      if (role === 'approver' || (!role && params.action.id.includes('approver'))) {
        if (
          !next.approver.fieldId
          && (
            next.approver.fieldLabel === label
            || next.approver.rawHint === label
            || String(params.action.payload.label) === next.approver.fieldLabel
          )
        ) {
          next.approver = {
            ...next.approver,
            type: 'field',
            fieldId,
            fieldLabel: label,
            resolved: true,
          };
        }
      }

      if (role === 'approval_field' || params.action.id.includes('decision')) {
        if (!next.approvalFieldId && next.approvalFieldLabel === label) {
          next.approvalFieldId = fieldId;
          next.approvalFieldLabel = label;
          // If rejection was "same as approval", bind it too
          if (
            !next.rejectionFieldId
            && (
              next.rejectionFieldLabel === next.approvalFieldLabel
              || /^same as approval/i.test(next.rejectionFieldLabel || '')
            )
          ) {
            next.rejectionFieldId = fieldId;
            next.rejectionFieldLabel = label;
          }
        }
      }

      if (role === 'rejection_field' || params.action.id.includes('rejection')) {
        if (!next.rejectionFieldId && next.rejectionFieldLabel === label) {
          next.rejectionFieldId = fieldId;
          next.rejectionFieldLabel = label;
        }
      }

      return next;
    }),
  };
}
