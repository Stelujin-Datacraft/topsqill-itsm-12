/**
 * Deterministic workflow validation — never rely on the LLM alone.
 */
import {
  isApprovalStyleDefinition,
  type AIWorkflowDefinition,
  type WorkflowValidationIssue,
} from './types';

export function validateWorkflowDefinition(
  definition: AIWorkflowDefinition,
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];

  if (!definition.trigger.formId) {
    issues.push({
      severity: 'error',
      code: 'MISSING_TRIGGER_FORM',
      message: 'Workflow has no trigger form.',
    });
  }

  // Generic action workflow (Start → Condition → Action → End)
  if (!isApprovalStyleDefinition(definition)) {
    if (!definition.action) {
      issues.push({
        severity: 'error',
        code: 'MISSING_ACTION',
        message: 'Workflow has no action configured.',
      });
      return issues;
    }

    const cond = definition.conditions[0];
    if (!cond?.fieldId && !cond?.fieldLabel) {
      issues.push({
        severity: 'error',
        code: 'MISSING_CONDITION_FIELD',
        message: 'Condition field is not set.',
      });
    }
    if (cond && (cond.value === undefined || cond.value === null || cond.value === '')) {
      issues.push({
        severity: 'error',
        code: 'MISSING_CONDITION_VALUE',
        message: 'Condition value is not set.',
      });
    }

    const action = definition.action;
    switch (action.actionType) {
      case 'change_field_value':
        if (!action.targetFieldId && !action.targetFieldLabel) {
          issues.push({
            severity: 'error',
            code: 'MISSING_ACTION_FIELD',
            message: 'Action field is not set.',
          });
        }
        if (action.staticValue === undefined || action.staticValue === null || String(action.staticValue) === '') {
          issues.push({
            severity: 'error',
            code: 'MISSING_ACTION_VALUE',
            message: 'Action field value is not set.',
          });
        }
        break;
      case 'create_record':
        if (!action.targetFormId && !action.targetFormName) {
          issues.push({
            severity: 'error',
            code: 'MISSING_TARGET_FORM',
            message: 'Create Record needs a target form.',
          });
        }
        if (
          !action.skipCreateFieldValues
          && !action.createFieldsDone
        ) {
          issues.push({
            severity: 'error',
            code: 'MISSING_CREATE_FIELDS',
            message: 'Add static values and/or map fields from the trigger form, or choose Done/Skip.',
          });
        }
        break;
      case 'create_linked_record':
      case 'update_linked_records':
      case 'create_combination_records': {
        const hasXr = Boolean(
          action.crossReferenceFieldId
          || action.crossReferenceFieldLabel
          || action.sourceCrossRefFieldId
          || action.sourceCrossRefFieldLabel,
        );
        if (!hasXr) {
          issues.push({
            severity: 'error',
            code: 'MISSING_CROSS_REF',
            message: 'A cross-reference field is required for this action.',
          });
        }
        if (!action.targetFormId && !action.targetFormName) {
          issues.push({
            severity: 'error',
            code: 'MISSING_TARGET_FORM',
            message: 'Target / linked form is not set.',
          });
        }
        if (
          action.actionType === 'create_linked_record'
          && !action.skipCreateFieldValues
          && !action.createFieldsDone
        ) {
          issues.push({
            severity: 'error',
            code: 'MISSING_CREATE_FIELDS',
            message: 'Add static values and/or map fields from the trigger form, or choose Done/Skip.',
          });
        }
        if (action.actionType === 'update_linked_records') {
          const hasUpdates = (action.createFieldValues || []).length > 0
            || (action.createFieldMappings || []).length > 0;
          if (!action.createFieldsDone || !hasUpdates) {
            issues.push({
              severity: 'error',
              code: 'MISSING_UPDATE_FIELDS',
              message: 'Add at least one static value or trigger-form mapping for the linked update, then choose Done.',
            });
          }
        }
        break;
      }
      default:
        break;
    }

    return issues;
  }

  if (!definition.levels.length) {
    issues.push({
      severity: 'error',
      code: 'NO_LEVELS',
      message: 'Workflow has no approval levels.',
    });
    return issues;
  }

  if (!definition.accessFieldId && !definition.pendingAccessFieldCreate) {
    issues.push({
      severity: 'error',
      code: 'MISSING_ACCESS_FIELD',
      message: 'Submission Access Control field is not set for approver assignment.',
    });
  }

  for (const level of definition.levels) {
    const hasApprover = Boolean(
      level.approver.fieldId
      || level.approver.entityId
      || level.approver.type === 'submitter'
      || (level.approver.resolved && level.approver.fieldLabel),
    );
    if (!hasApprover) {
      issues.push({
        severity: 'error',
        code: 'MISSING_APPROVER',
        message: `Level ${level.level} has no approver.`,
      });
    }
    if (!level.approvalFieldId && !level.approvalFieldLabel && !level.pendingDecisionFieldCreate) {
      issues.push({
        severity: 'error',
        code: 'MISSING_APPROVAL_FIELD',
        message: `Level ${level.level} has no approval decision field.`,
      });
    }
    if (!level.rejectionFieldId && !level.rejectionFieldLabel) {
      issues.push({
        severity: 'error',
        code: 'MISSING_REJECTION_FIELD',
        message: `Level ${level.level} has no rejection field.`,
      });
    }
    if (!level.onRejection) {
      issues.push({
        severity: 'error',
        code: 'MISSING_REJECTION_ROUTE',
        message: `Level ${level.level} has no rejection routing.`,
      });
    }
    if (level.onRejection?.action === 'RETURN_TO_LEVEL') {
      const target = level.onRejection.targetLevel;
      if (!target || !definition.levels.some((l) => l.level === target)) {
        issues.push({
          severity: 'error',
          code: 'INVALID_REJECTION_TARGET',
          message: `Level ${level.level} rejection targets missing Level ${target}.`,
        });
      }
      if (target === level.level) {
        issues.push({
          severity: 'warning',
          code: 'SELF_REJECTION_LOOP',
          message: `Level ${level.level} rejects back to itself.`,
        });
      }
    }
  }

  // Mutual rejection loops: L1→L2 and L2→L1
  for (const a of definition.levels) {
    if (a.onRejection?.action !== 'RETURN_TO_LEVEL') continue;
    const b = definition.levels.find((l) => l.level === a.onRejection?.targetLevel);
    if (!b || b.onRejection?.action !== 'RETURN_TO_LEVEL') continue;
    if (b.onRejection.targetLevel === a.level) {
      issues.push({
        severity: 'warning',
        code: 'APPROVAL_LOOP',
        message: `Possible approval loop between Level ${a.level} and Level ${b.level}. Confirm this is intentional.`,
      });
    }
  }

  // Last level should complete
  const last = definition.levels[definition.levels.length - 1];
  if (last && last.onApprovalNext !== 'complete' && !definition.parallel) {
    issues.push({
      severity: 'warning',
      code: 'NO_COMPLETION',
      message: `Level ${last.level} does not mark workflow complete on approval.`,
    });
  }

  return issues;
}

export function hasBlockingValidationErrors(issues: WorkflowValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
