/**
 * Recompile conversational workflow definitions against existing form metadata.
 *
 * Workflow AI Suggest must not mutate forms — this intentionally ignores
 * CREATE_FIELD / CREATE_FIELD_VALUE actions. Field/option changes belong in form AI.
 */
import type {
  AIWorkflowDefinition,
  WorkflowBuilderSession,
} from './types';
import { compileWorkflowDefinition, type CompiledWorkflowGraph } from './nodeCompiler';
import type { DecisionFieldMeta } from './decisionOptionResolver';

export interface AppliedPendingCreatesResult {
  definition: AIWorkflowDefinition;
  compiled: CompiledWorkflowGraph;
  createdFields: string[];
  createdValues: string[];
  formFields: DecisionFieldMeta[];
}

/**
 * Recompile the workflow definition against existing form fields.
 * Does NOT create form fields or options.
 */
export async function applyPendingConfigActions(params: {
  session: WorkflowBuilderSession;
  formId: string;
  formFields?: DecisionFieldMeta[];
}): Promise<AppliedPendingCreatesResult> {
  const { session } = params;
  const definition: AIWorkflowDefinition = {
    ...session.requirements,
    levels: session.requirements.levels.map((l) => ({
      ...l,
      approver: { ...l.approver },
      onRejection: l.onRejection ? { ...l.onRejection } : null,
      pendingOptionValues: undefined,
      configured: true,
    })),
    status: 'READY_TO_PUBLISH',
  };

  const formFields = [...(params.formFields || [])];
  const compiled = compileWorkflowDefinition(definition, { formFields });
  return {
    definition,
    compiled,
    createdFields: [],
    createdValues: [],
    formFields,
  };
}
