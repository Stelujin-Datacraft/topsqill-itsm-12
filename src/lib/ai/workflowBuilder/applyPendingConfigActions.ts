/**
 * Apply conversational pending CREATE_FIELD / CREATE_FIELD_VALUE actions.
 * For approval workflows: create Submission Access Control when confirmed,
 * and merge Level N approver user ids into allowedUsers so runtime writes succeed.
 */
import type {
  AIWorkflowDefinition,
  WorkflowBuilderSession,
} from './types';
import { isApprovalStyleDefinition } from './types';
import { compileWorkflowDefinition, type CompiledWorkflowGraph } from './nodeCompiler';
import {
  bindConditionNodesToDecisionValues,
  type DecisionFieldMeta,
} from './decisionOptionResolver';
import {
  addConditionFieldOption,
  createConditionFormField,
  mergeSubmissionAccessAllowedUsers,
} from '@/lib/ai/conditionFormMutations';
import { backend as supabase } from '@/services/api';
import {
  buildOptionCreatePendingActions,
  collectApproverUserIds,
} from './pendingOptionActions';
import {
  SUBMISSION_ACCESS_FIELD_LABEL,
  SUBMISSION_ACCESS_FIELD_TYPE,
} from './metadataDiscovery';

export { buildOptionCreatePendingActions };

export interface AppliedPendingCreatesResult {
  definition: AIWorkflowDefinition;
  compiled: CompiledWorkflowGraph;
  createdFields: string[];
  createdValues: string[];
  formFields: DecisionFieldMeta[];
}

/**
 * Create confirmed missing fields/options, merge SAC allowedUsers, then recompile.
 */
export async function applyPendingConfigActions(params: {
  session: WorkflowBuilderSession;
  formId: string;
  formFields?: DecisionFieldMeta[];
}): Promise<AppliedPendingCreatesResult> {
  const { session } = params;
  const formFields: DecisionFieldMeta[] = [...(params.formFields || [])];
  const createdValues: string[] = [];
  const createdFields: string[] = [];

  let definition: AIWorkflowDefinition = {
    ...session.requirements,
    levels: session.requirements.levels.map((l) => ({
      ...l,
      approver: { ...l.approver },
      onRejection: l.onRejection ? { ...l.onRejection } : null,
      pendingOptionValues: undefined,
      configured: true,
    })),
    conditions: (session.requirements.conditions || []).map((c) => ({
      ...c,
      value: c.pendingOptionLabel || c.value,
      pendingOptionCreate: false,
    })),
    action: session.requirements.action
      ? {
          ...session.requirements.action,
          staticValue: session.requirements.action.pendingOptionLabel
            || session.requirements.action.staticValue,
          pendingOptionCreate: false,
        }
      : null,
    status: 'READY_TO_PUBLISH',
  };

  const approverUserIds = collectApproverUserIds(session);

  // Create Submission Access Control when user confirmed
  const fieldCreates = (session.pendingActions || []).filter(
    (a) => a.kind === 'CREATE_FIELD' && a.userConfirmed,
  );

  for (const action of fieldCreates) {
    const label = String(action.payload.label || SUBMISSION_ACCESS_FIELD_LABEL).trim();
    const fieldType = String(action.payload.fieldType || SUBMISSION_ACCESS_FIELD_TYPE);
    const allowedFromPayload = Array.isArray(action.payload.allowedUserIds)
      ? (action.payload.allowedUserIds as unknown[]).map(String).filter(Boolean)
      : [];
    const allowedUserIds = [...new Set([...allowedFromPayload, ...approverUserIds])];

    if (!params.formId || !label) continue;

    try {
      const payloadOptions = Array.isArray(action.payload.options)
        ? (action.payload.options as Array<{ value: string; label: string }>)
        : undefined;
      const created = await createConditionFormField({
        formId: params.formId,
        label,
        type: fieldType,
        options: payloadOptions,
        customConfig: fieldType === SUBMISSION_ACCESS_FIELD_TYPE || fieldType === 'submission-access'
          ? {
              allowedUsers: allowedUserIds,
              allowedGroups: [],
              accessLevel: 'edit',
              allowMultiple: true,
            }
          : null,
      });

      formFields.push({
        id: created.id,
        label: created.label,
        type: created.type,
        options: created.options,
        custom_config: created.custom_config || undefined,
      });
      createdFields.push(created.label);

      if (action.id === 'create_field_submission_access' || fieldType.includes('submission')) {
        definition = {
          ...definition,
          accessFieldId: created.id,
          accessFieldLabel: created.label,
          pendingAccessFieldCreate: false,
        };
        // Point each level's notify field at the new SAC id
        definition.levels = definition.levels.map((l) => ({
          ...l,
          approver: {
            ...l.approver,
            fieldId: created.id,
            fieldLabel: created.label,
          },
        }));
      }

      const levelNum = Number(action.payload.level);
      if (
        action.payload.scope === 'level_status'
        && Number.isFinite(levelNum)
        && levelNum > 0
      ) {
        definition.levels = definition.levels.map((l) => {
          if (l.level !== levelNum) return l;
          return {
            ...l,
            approvalFieldId: created.id,
            approvalFieldLabel: created.label,
            rejectionFieldId: created.id,
            rejectionFieldLabel: created.label,
            pendingDecisionFieldCreate: false,
          };
        });
      }
    } catch (e) {
      console.error('applyPendingConfigActions: failed to create field', e);
    }
  }

  const optionCreates = (session.pendingActions || []).filter(
    (a) => a.kind === 'CREATE_FIELD_VALUE' && a.userConfirmed,
  );

  for (const action of optionCreates) {
    const fieldId = String(action.payload.fieldId || '');
    const valueLabel = String(action.payload.valueLabel || '').trim();
    if (!fieldId || !valueLabel) continue;

    const field = formFields.find((f) => f.id === fieldId);
    const exists = (field?.options || []).some((o) =>
      String(o.value).toLowerCase() === valueLabel.toLowerCase()
      || String(o.label).toLowerCase() === valueLabel.toLowerCase(),
    );
    if (exists) continue;

    try {
      const created = await addConditionFieldOption({ fieldId, valueLabel });
      if (field) {
        field.options = created.options;
      } else {
        formFields.push({
          id: fieldId,
          label: String(action.payload.fieldLabel || valueLabel),
          type: String(action.payload.fieldType || 'select'),
          options: created.options,
        });
      }
      createdValues.push(`${action.payload.fieldLabel || fieldId}: ${created.label}`);
    } catch (e) {
      console.error('applyPendingConfigActions: failed to create option', e);
    }
  }

  if (definition.pendingMainStatusOptions?.length) {
    definition = {
      ...definition,
      pendingMainStatusOptions: [],
    };
  }

  // Merge Level N approver users into SAC allowedUsers (create or reuse)
  if (isApprovalStyleDefinition(definition) && definition.accessFieldId && approverUserIds.length) {
    try {
      const nextConfig = await mergeSubmissionAccessAllowedUsers({
        fieldId: definition.accessFieldId,
        userIds: approverUserIds,
      });
      const field = formFields.find((f) => f.id === definition.accessFieldId);
      if (field) {
        field.custom_config = nextConfig;
      }
    } catch (e) {
      console.error('applyPendingConfigActions: failed to merge SAC allowedUsers', e);
    }
  }

  const compiledBase = compileWorkflowDefinition(definition, {
    formFields,
    targetFormFields: await loadTargetFormFields(definition, formFields),
  });

  // Force-bind condition values to live option.value (same as Copilot publish path)
  const compiled: CompiledWorkflowGraph = {
    ...compiledBase,
    nodes: bindConditionNodesToDecisionValues(compiledBase.nodes, formFields),
  };

  return {
    definition,
    compiled,
    createdFields,
    createdValues,
    formFields,
  };
}

/** Load target-form fields when create_record / linked actions point at another form. */
async function loadTargetFormFields(
  definition: AIWorkflowDefinition,
  triggerFields: DecisionFieldMeta[],
): Promise<DecisionFieldMeta[] | undefined> {
  const action = definition.action;
  if (!action?.targetFormId) return undefined;
  const triggerFormId = definition.trigger.formId || definition.objectId || '';
  if (action.targetFormId === triggerFormId) return triggerFields;

  try {
    const { data, error } = await supabase
      .from('form_fields')
      .select('id, label, field_type, options, custom_config')
      .eq('form_id', action.targetFormId);
    if (error || !data?.length) return undefined;
    return data.map((row: any) => {
      let options = row.options;
      if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch { options = []; }
      }
      return {
        id: row.id,
        label: row.label,
        type: row.field_type || 'text',
        options: Array.isArray(options) ? options : [],
        custom_config: row.custom_config ?? null,
      } as DecisionFieldMeta;
    });
  } catch (e) {
    console.error('applyPendingConfigActions: failed to load target form fields', e);
    return undefined;
  }
}
