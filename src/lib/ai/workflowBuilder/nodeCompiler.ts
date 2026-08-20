/**
 * Compile AIWorkflowDefinition → designer-compatible workflow nodes.
 * Uses existing runtime node types (start/action/condition/wait/end).
 * Approval steps are modeled as: notify approver → wait → condition on decision field.
 * Generic action workflows: Start → Condition → Action → End.
 */
import {
  isApprovalStyleDefinition,
  type AIWorkflowDefinition,
  type WorkflowActionSpec,
} from './types';
import {
  resolveDecisionOptionValue,
  type DecisionFieldMeta,
} from './decisionOptionResolver';
import { describeActionType } from './actionTypeInferrer';

export interface CompiledWorkflowGraph {
  name: string;
  description: string;
  triggerFormId?: string;
  nodes: Array<{
    tempId: string;
    type: string;
    label: string;
    description?: string;
    config: Record<string, any>;
    connections: Array<{ to: string; conditionType?: string; sourceHandle?: string | null }>;
  }>;
}

export interface CompileWorkflowOptions {
  /** Live form fields — used to bind condition values to real option.value strings */
  formFields?: DecisionFieldMeta[];
}

function findField(
  fields: DecisionFieldMeta[] | undefined,
  fieldId?: string,
  fieldLabel?: string,
): DecisionFieldMeta | undefined {
  if (!fields?.length) return undefined;
  if (fieldId) {
    const byId = fields.find((f) => f.id === fieldId);
    if (byId) return byId;
  }
  if (fieldLabel) {
    const key = fieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return fields.find((f) =>
      f.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === key,
    );
  }
  return undefined;
}

function buildActionNodeConfig(
  action: WorkflowActionSpec,
  formId: string,
  formName: string,
  formFields?: DecisionFieldMeta[],
): Record<string, any> {
  const targetField = findField(formFields, action.targetFieldId, action.targetFieldLabel);
  const fieldId = targetField?.id || action.targetFieldId || '';
  const fieldLabel = targetField?.label || action.targetFieldLabel || '';
  const fieldType = targetField?.type || action.targetFieldType || 'text';
  const fieldOptions = Array.isArray(targetField?.options) ? targetField!.options : undefined;
  const staticValue = action.staticValue;

  const base: Record<string, any> = {
    actionType: action.actionType,
    targetFormId: action.targetFormId || formId,
    targetFormName: action.targetFormName || formName,
  };

  switch (action.actionType) {
    case 'change_field_value':
      return {
        ...base,
        targetFormId: formId,
        targetFormName: formName,
        valueType: action.valueType || 'static',
        targetFieldId: fieldId,
        targetFieldName: fieldLabel,
        targetFieldType: fieldType,
        targetFieldOptions: fieldOptions,
        staticValue,
        fieldUpdates: [{
          targetFieldId: fieldId,
          targetFieldName: fieldLabel,
          targetFieldType: fieldType,
          targetFieldOptions: fieldOptions,
          valueType: 'static',
          staticValue,
        }],
      };
    case 'create_record':
      return {
        ...base,
        recordCount: action.recordCount || 1,
        fieldValues: [],
        fieldMappings: [],
        fieldConfigMode: 'field_values',
        setSubmittedBy: 'trigger_submitter',
        initialStatus: 'pending',
      };
    case 'create_linked_record':
      return {
        ...base,
        crossReferenceFieldId: action.crossReferenceFieldId,
        crossReferenceFieldName: action.crossReferenceFieldLabel,
        recordCount: action.recordCount || 1,
        fieldValues: [],
        fieldMappings: [],
        fieldConfigMode: 'none',
        setSubmittedBy: 'trigger_submitter',
        autoLinkBack: true,
      };
    case 'update_linked_records':
      return {
        ...base,
        crossReferenceFieldId: action.crossReferenceFieldId,
        crossReferenceFieldName: action.crossReferenceFieldLabel,
        updateScope: action.updateScope || 'all',
        fieldConfigMode: 'field_values',
        fieldMappings: [],
        fieldValues: fieldId
          ? [{
              fieldId,
              fieldName: fieldLabel,
              fieldType,
              fieldOptions,
              valueType: 'static',
              staticValue,
            }]
          : [],
      };
    case 'create_combination_records':
      return {
        ...base,
        combinationMode: action.combinationMode || 'single',
        sourceCrossRefFieldId: action.sourceCrossRefFieldId || action.crossReferenceFieldId,
        sourceCrossRefFieldName: action.sourceCrossRefFieldLabel || action.crossReferenceFieldLabel,
        sourceLinkedFormId: action.sourceLinkedFormId || action.targetFormId,
        sourceLinkedFormName: action.sourceLinkedFormName || action.targetFormName,
        secondSourceCrossRefFieldId: action.secondSourceCrossRefFieldId,
        secondSourceCrossRefFieldName: action.secondSourceCrossRefFieldLabel,
        setSubmittedBy: 'trigger_submitter',
        fieldMappings: [],
      };
    case 'send_notification':
      return {
        ...base,
        notificationConfig: {
          type: 'in_app',
          subject: 'Workflow notification',
          message: 'A workflow condition was met.',
          recipientConfig: {
            type: 'form_submitter',
            emails: [],
          },
        },
      };
    default:
      return base;
  }
}

function compileGenericActionGraph(
  definition: AIWorkflowDefinition,
  options?: CompileWorkflowOptions,
): CompiledWorkflowGraph {
  const formId = definition.trigger.formId || definition.objectId || '';
  const formName = definition.trigger.formName || definition.objectName || '';
  const formFields = options?.formFields || [];
  const nodes: CompiledWorkflowGraph['nodes'] = [];

  const startId = 'node_start';
  const conditionId = 'node_condition';
  const actionId = 'node_action';
  const endTrueId = 'node_end';
  const endFalseId = 'node_end_skip';

  nodes.push({
    tempId: startId,
    type: 'start',
    label: 'Start',
    description: formName ? `${formName} submission` : 'Form submission',
    config: {
      triggerType: definition.trigger.kind || 'form_submission',
      triggerFormId: formId,
      triggerFormName: formName,
    },
    connections: [{ to: conditionId }],
  });

  const cond = definition.conditions[0];
  const condField = findField(formFields, cond?.fieldId, cond?.fieldLabel);
  const fieldId = condField?.id || cond?.fieldId || '';
  const fieldLabel = condField?.label || cond?.fieldLabel || '';
  const fieldType = condField?.type || cond?.fieldType || 'text';
  const operator = cond?.operator || '==';
  const value = cond?.value ?? '';

  nodes.push({
    tempId: conditionId,
    type: 'condition',
    label: fieldLabel ? `${fieldLabel} ${operator} ${value}` : 'Condition',
    description: `${fieldLabel} ${operator} ${value}`,
    config: {
      formId,
      fieldId,
      fieldLabel,
      fieldType,
      operator,
      value,
      enhancedCondition: {
        systemType: 'field_level',
        logicalOperator: 'AND',
        conditions: [{
          id: 'cond_main',
          systemType: 'field_level',
          fieldLevelCondition: {
            formId,
            fieldId,
            fieldLabel,
            fieldType,
            operator,
            value,
          },
        }],
      },
    },
    connections: [
      { to: actionId, conditionType: 'true', sourceHandle: 'true' },
      { to: endFalseId, conditionType: 'false', sourceHandle: 'false' },
    ],
  });

  const action = definition.action!;
  nodes.push({
    tempId: actionId,
    type: 'action',
    label: describeActionType(action.actionType).split(' (')[0],
    description: describeActionType(action.actionType),
    config: buildActionNodeConfig(action, formId, formName, formFields),
    connections: [{ to: endTrueId }],
  });

  nodes.push({
    tempId: endTrueId,
    type: 'end',
    label: 'Complete',
    description: 'Action completed',
    config: {},
    connections: [],
  });

  nodes.push({
    tempId: endFalseId,
    type: 'end',
    label: 'Skipped',
    description: 'Condition not met',
    config: {},
    connections: [],
  });

  return {
    name: definition.name,
    description: definition.description || definition.name,
    triggerFormId: formId || undefined,
    nodes,
  };
}

/**
 * Build a complete Start → Levels → End graph from the conversational spec.
 */
export function compileWorkflowDefinition(
  definition: AIWorkflowDefinition,
  options?: CompileWorkflowOptions,
): CompiledWorkflowGraph {
  if (!isApprovalStyleDefinition(definition) && definition.action) {
    return compileGenericActionGraph(definition, options);
  }

  const formId = definition.trigger.formId || definition.objectId || '';
  const formName = definition.trigger.formName || definition.objectName || '';
  const formFields = options?.formFields || [];
  const nodes: CompiledWorkflowGraph['nodes'] = [];

  const startId = 'node_start';
  const approvedEndId = 'node_end_approved';
  const rejectedEndId = 'node_end_rejected';

  nodes.push({
    tempId: startId,
    type: 'start',
    label: 'Start',
    description: formName ? `${formName} submission` : 'Form submission',
    config: {
      triggerType: definition.trigger.kind || 'form_submission',
      triggerFormId: formId,
      triggerFormName: formName,
    },
    connections: [],
  });

  const levelNodeIds: Record<number, { notify: string; wait: string; condition: string }> = {};

  for (const level of definition.levels) {
    const notifyId = `node_l${level.level}_notify`;
    const waitId = `node_l${level.level}_wait`;
    const conditionId = `node_l${level.level}_decision`;
    levelNodeIds[level.level] = { notify: notifyId, wait: waitId, condition: conditionId };

    const decisionField = findField(
      formFields,
      level.approvalFieldId,
      level.approvalFieldLabel,
    );
    const approvedVal = resolveDecisionOptionValue(
      decisionField || (level.approvalFieldLabel
        ? { id: level.approvalFieldId || '', label: level.approvalFieldLabel, type: 'select' }
        : undefined),
      'approved',
      level.level,
    );
    const fieldType = decisionField?.type || 'select';
    const fieldId = decisionField?.id || level.approvalFieldId || '';
    const fieldLabel = decisionField?.label || level.approvalFieldLabel || '';

    const approverLabel = level.approver.fieldLabel || level.approver.rawHint || `Level ${level.level} Approver`;
    nodes.push({
      tempId: notifyId,
      type: 'action',
      label: `Notify Level ${level.level}: ${approverLabel}`,
      description: `Send approval request to ${approverLabel}`,
      config: {
        actionType: 'send_notification',
        notificationConfig: {
          type: 'in_app',
          subject: `Level ${level.level} approval required`,
          message: `Please review and set ${fieldLabel || 'approval decision'} for this submission.`,
          recipientConfig: level.approver.fieldId
            ? {
                type: 'field_value',
                dynamicFieldPath: level.approver.fieldId,
                emails: [],
              }
            : {
                type: 'form_submitter',
                emails: [],
              },
        },
        targetFormId: formId,
        targetFormName: formName,
      },
      connections: [{ to: waitId }],
    });

    nodes.push({
      tempId: waitId,
      type: 'wait',
      label: `Wait for Level ${level.level} Decision`,
      description: 'Wait for approver action',
      config: {
        waitType: 'duration',
        duration: 24,
        durationUnit: 'hours',
      },
      connections: [{ to: conditionId }],
    });

    nodes.push({
      tempId: conditionId,
      type: 'condition',
      label: `Level ${level.level} Decision`,
      description: `${fieldLabel || 'Decision'} == ${approvedVal}`,
      config: {
        formId,
        fieldId,
        fieldLabel,
        fieldType,
        operator: '==',
        value: approvedVal,
        enhancedCondition: {
          systemType: 'field_level',
          logicalOperator: 'AND',
          conditions: [{
            id: `cond_l${level.level}`,
            systemType: 'field_level',
            fieldLevelCondition: {
              formId,
              fieldId,
              fieldLabel,
              fieldType,
              operator: '==',
              value: approvedVal,
            },
          }],
        },
      },
      connections: [], // filled below
    });
  }

  nodes.push({
    tempId: approvedEndId,
    type: 'end',
    label: 'Approved',
    description: 'Workflow complete — approved',
    config: {},
    connections: [],
  });

  nodes.push({
    tempId: rejectedEndId,
    type: 'end',
    label: 'Rejected / Returned',
    description: 'Rejected or returned to requester',
    config: {},
    connections: [],
  });

  // Wire start → first level
  const first = definition.levels[0];
  if (first) {
    const start = nodes.find((n) => n.tempId === startId)!;
    start.connections = [{ to: levelNodeIds[first.level].notify }];
  } else {
    const start = nodes.find((n) => n.tempId === startId)!;
    start.connections = [{ to: approvedEndId }];
  }

  // Wire each level condition true/false
  for (let i = 0; i < definition.levels.length; i++) {
    const level = definition.levels[i];
    const ids = levelNodeIds[level.level];
    const conditionNode = nodes.find((n) => n.tempId === ids.condition)!;
    const nextLevel = definition.levels[i + 1];

    let trueTarget = approvedEndId;
    if (level.onApprovalNext === 'complete' || !nextLevel) {
      trueTarget = approvedEndId;
    } else if (nextLevel) {
      trueTarget = levelNodeIds[nextLevel.level].notify;
    }

    let falseTarget = rejectedEndId;
    const rej = level.onRejection;
    if (rej?.action === 'RETURN_TO_LEVEL' && rej.targetLevel && levelNodeIds[rej.targetLevel]) {
      falseTarget = levelNodeIds[rej.targetLevel].notify;
    } else if (rej?.action === 'END_WORKFLOW' || rej?.action === 'RETURN_TO_REQUESTER') {
      falseTarget = rejectedEndId;
    } else if (rej?.action === 'START_OVER' && first) {
      falseTarget = levelNodeIds[first.level].notify;
    }

    conditionNode.connections = [
      { to: trueTarget, conditionType: 'true', sourceHandle: 'true' },
      { to: falseTarget, conditionType: 'false', sourceHandle: 'false' },
    ];
  }

  return {
    name: definition.name,
    description: definition.description || definition.name,
    triggerFormId: formId || undefined,
    nodes,
  };
}
