/**
 * Compile AIWorkflowDefinition → designer-compatible workflow nodes.
 * Uses existing runtime node types (start/action/condition/wait/end).
 * Approval steps are modeled as: notify approver → wait → condition on decision field.
 */
import type { AIWorkflowDefinition } from './types';
import {
  resolveDecisionOptionValue,
  type DecisionFieldMeta,
} from './decisionOptionResolver';

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

/**
 * Build a complete Start → Levels → End graph from the conversational spec.
 */
export function compileWorkflowDefinition(
  definition: AIWorkflowDefinition,
  options?: CompileWorkflowOptions,
): CompiledWorkflowGraph {
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
