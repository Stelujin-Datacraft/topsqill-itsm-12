/**
 * Apply conversational pending CREATE_FIELD_VALUE actions (confirmed missing options).
 * Does not create new form fields — only appends options the user confirmed.
 */
import type {
  AIWorkflowDefinition,
  WorkflowBuilderSession,
} from './types';
import { compileWorkflowDefinition, type CompiledWorkflowGraph } from './nodeCompiler';
import type { DecisionFieldMeta } from './decisionOptionResolver';
import { addConditionFieldOption } from '@/lib/ai/conditionFormMutations';
import { buildOptionCreatePendingActions } from './pendingOptionActions';

export { buildOptionCreatePendingActions };

export interface AppliedPendingCreatesResult {
  definition: AIWorkflowDefinition;
  compiled: CompiledWorkflowGraph;
  createdFields: string[];
  createdValues: string[];
  formFields: DecisionFieldMeta[];
}

/**
 * Create confirmed missing options, then recompile against updated metadata.
 */
export async function applyPendingConfigActions(params: {
  session: WorkflowBuilderSession;
  formId: string;
  formFields?: DecisionFieldMeta[];
}): Promise<AppliedPendingCreatesResult> {
  const { session } = params;
  const formFields: DecisionFieldMeta[] = [...(params.formFields || [])];
  const createdValues: string[] = [];

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

  const definition: AIWorkflowDefinition = {
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

  const compiled = compileWorkflowDefinition(definition, { formFields });
  return {
    definition,
    compiled,
    createdFields: [],
    createdValues,
    formFields,
  };
}
