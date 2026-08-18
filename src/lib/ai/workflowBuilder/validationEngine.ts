/**
 * Deterministic workflow validation — never rely on the LLM alone.
 */
import type { AIWorkflowDefinition, WorkflowValidationIssue } from './types';

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

  if (!definition.levels.length) {
    issues.push({
      severity: 'error',
      code: 'NO_LEVELS',
      message: 'Workflow has no approval levels.',
    });
    return issues;
  }

  for (const level of definition.levels) {
    if (!level.approver.resolved && !level.approver.fieldId && !level.approver.entityId) {
      issues.push({
        severity: 'error',
        code: 'MISSING_APPROVER',
        message: `Level ${level.level} has no approver.`,
      });
    }
    if (!level.approvalFieldId && !level.approvalFieldLabel) {
      issues.push({
        severity: 'error',
        code: 'MISSING_APPROVAL_FIELD',
        message: `Level ${level.level} has no approval decision field.`,
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
