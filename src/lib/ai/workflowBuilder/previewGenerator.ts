/**
 * Human-readable workflow preview before activation.
 */
import type {
  AIWorkflowDefinition,
  PendingConfigAction,
  WorkflowBuilderPreview,
  WorkflowValidationIssue,
} from './types';
import { isApprovalStyleDefinition } from './types';
import { describeActionType } from './actionTypeInferrer';

function rejectionLabel(level: AIWorkflowDefinition['levels'][number]): string {
  const r = level.onRejection;
  if (!r) return '(not set)';
  if (r.action === 'RETURN_TO_REQUESTER') return 'Return to requester';
  if (r.action === 'END_WORKFLOW') return 'End workflow';
  if (r.action === 'START_OVER') return 'Start over from Approver 1';
  if (r.action === 'RETURN_TO_LEVEL') return `Loop back to Approver ${r.targetLevel}`;
  if (r.action === 'RETURN_TO_STAGE') return r.targetStage || 'Custom stage';
  return r.action;
}

export function generateWorkflowPreview(
  definition: AIWorkflowDefinition,
  pendingActions: PendingConfigAction[] = [],
  validationIssues: WorkflowValidationIssue[] = [],
): WorkflowBuilderPreview {
  const sections: WorkflowBuilderPreview['sections'] = [];

  sections.push({
    title: 'Trigger',
    lines: [
      definition.trigger.formName
        ? `When **${definition.trigger.formName}** is submitted`
        : 'Form submission (form not selected)',
    ],
  });

  if (!isApprovalStyleDefinition(definition) && definition.action) {
    const cond = definition.conditions[0];
    sections.push({
      title: 'Condition',
      lines: [
        cond
          ? `If **${cond.fieldLabel || '(field)'}** ${cond.operator || '=='} **${String(cond.value ?? '(value)')}**`
          : '(not set)',
      ],
    });
    const a = definition.action;
    const actionLines = [
      `Type: ${describeActionType(a.actionType)}`,
    ];
    if (a.crossReferenceFieldLabel || a.sourceCrossRefFieldLabel) {
      actionLines.push(`Cross-reference: ${a.crossReferenceFieldLabel || a.sourceCrossRefFieldLabel}`);
    }
    if (a.targetFormName) {
      actionLines.push(`Target form: ${a.targetFormName}`);
    }
    if (a.targetFieldLabel) {
      actionLines.push(`Field: ${a.targetFieldLabel}`);
    }
    if (a.staticValue !== undefined && a.staticValue !== null && String(a.staticValue) !== '') {
      actionLines.push(`Value: ${String(a.staticValue)}`);
    }
    sections.push({ title: 'Action', lines: actionLines });
  } else {
    sections.push({
      title: 'Approver assignment',
      lines: [
        definition.accessFieldLabel || definition.accessFieldId
          ? `Field: **${definition.accessFieldLabel || definition.accessFieldId}**`
          : definition.pendingAccessFieldCreate
            ? `Field: **Submission Access Control** (will be created)`
            : 'Field: (not set)',
      ],
    });
    for (const level of definition.levels) {
      const lines = [
        `Approver: ${level.approver.entityLabel || level.approver.fieldLabel || level.approver.rawHint || '(not set)'}`,
        `Decision field: ${level.approvalFieldLabel || '(not set)'} (Approved / Rejected)`,
        `On Approval: ${level.onApprovalNext === 'complete' ? 'Workflow Complete' : level.onApprovalNext === 'next_level' ? `Level ${level.level + 1}` : String(level.onApprovalNext || 'Next')}`,
        `On Rejection: ${rejectionLabel(level)}`,
      ];
      sections.push({
        title: level.label || `LEVEL ${level.level}`,
        lines,
      });
    }
  }

  const fieldsToCreate = pendingActions
    .filter((a) => a.kind === 'CREATE_FIELD' && a.userConfirmed)
    .map((a) => a.description);
  const valuesToCreate = pendingActions
    .filter((a) => a.kind === 'CREATE_FIELD_VALUE' && a.userConfirmed)
    .map((a) => a.description);

  const pendingUnconfirmed = pendingActions.filter((a) => !a.userConfirmed);
  if (pendingUnconfirmed.length) {
    sections.push({
      title: 'Pending configuration (needs permission)',
      lines: pendingUnconfirmed.map((a) => a.description),
    });
  }

  const warnings = validationIssues
    .filter((i) => i.severity === 'warning')
    .map((i) => i.message);

  const errors = validationIssues
    .filter((i) => i.severity === 'error')
    .map((i) => i.message);

  if (errors.length) {
    sections.push({ title: 'Errors to resolve', lines: errors });
  }
  if (warnings.length) {
    sections.push({ title: 'Warnings', lines: warnings });
  }

  const summaryLines: string[] = [
    `WORKFLOW: ${definition.name}`,
    '',
    ...sections.flatMap((s) => [`${s.title}`, ...s.lines.map((l) => `  ${l}`), '']),
    'Fields to Create:',
    fieldsToCreate.length ? fieldsToCreate.map((f) => `  • ${f}`).join('\n') : '  ✓ None',
    '',
    'Values to Create:',
    valuesToCreate.length ? valuesToCreate.map((v) => `  • ${v}`).join('\n') : '  ✓ None',
  ];

  return {
    title: definition.name,
    sections,
    fieldsToCreate,
    valuesToCreate,
    warnings: [...errors, ...warnings],
    summaryText: summaryLines.join('\n'),
  };
}

/** Markdown message for chat UI */
export function formatPreviewAsMarkdown(preview: WorkflowBuilderPreview): string {
  const parts: string[] = [
    `### ${preview.title}`,
    '',
    'Here is the workflow I will create. Please review before I proceed.',
    '',
  ];
  for (const section of preview.sections) {
    parts.push(`**${section.title}**`);
    for (const line of section.lines) {
      parts.push(`- ${line}`);
    }
    parts.push('');
  }
  parts.push('**Fields to create**');
  parts.push(preview.fieldsToCreate.length
    ? preview.fieldsToCreate.map((f) => `- ${f}`).join('\n')
    : '- None');
  parts.push('');
  parts.push('**Values to create**');
  parts.push(preview.valuesToCreate.length
    ? preview.valuesToCreate.map((v) => `- ${v}`).join('\n')
    : '- None');
  if (preview.warnings.length) {
    parts.push('');
    parts.push('**Warnings**');
    parts.push(...preview.warnings.map((w) => `- ${w}`));
  }
  parts.push('');
  parts.push('**Create this workflow?**');
  parts.push('Reply **yes** / **create** to proceed, **modify** to change something, or **cancel** to abort.');
  return parts.join('\n');
}
