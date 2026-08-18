/**
 * Compile AIWorkflowDefinition → designer-compatible workflow nodes.
 * Uses existing runtime node types (start/action/condition/wait/end).
 * Approval steps are modeled as: notify approver → wait → condition on decision field.
 */
import type { AIWorkflowDefinition } from './types';

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

function decisionApprovedValue(level: number, fieldLabel?: string): string {
  // Prefer leveled values when field was created for this level
  if (fieldLabel && /level\s*\d/i.test(fieldLabel)) return `Approved Level ${level}`;
  return 'Approved';
}

function decisionRejectedValue(level: number, fieldLabel?: string): string {
  if (fieldLabel && /level\s*\d/i.test(fieldLabel)) return `Rejected Level ${level}`;
  return 'Rejected';
}

/**
 * Build a complete Start → Levels → End graph from the conversational spec.
 */
export function compileWorkflowDefinition(
  definition: AIWorkflowDefinition,
): CompiledWorkflowGraph {
  const formId = definition.trigger.formId || definition.objectId || '';
  const formName = definition.trigger.formName || definition.objectName || '';
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
          message: `Please review and set ${level.approvalFieldLabel || 'approval decision'} for this submission.`,
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

    const approvedVal = decisionApprovedValue(level.level, level.approvalFieldLabel);
    nodes.push({
      tempId: conditionId,
      type: 'condition',
      label: `Level ${level.level} Decision`,
      description: `${level.approvalFieldLabel || 'Decision'} == ${approvedVal}`,
      config: {
        formId,
        fieldId: level.approvalFieldId || '',
        fieldLabel: level.approvalFieldLabel || '',
        fieldType: 'select',
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
              fieldId: level.approvalFieldId || '',
              fieldLabel: level.approvalFieldLabel || '',
              fieldType: 'select',
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
