/**
 * AI Conversational Workflow Builder — intermediate representation & session types.
 * Deterministic backend validates; LLM only fills this structure via conversation.
 */

export type WorkflowBuilderStatus =
  | 'discovering'
  | 'collecting'
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'validated'
  | 'preview'
  | 'ready_to_publish'
  | 'published'
  | 'cancelled'
  | 'error';

export type AIWorkflowType =
  | 'approval'
  | 'sequential_approval'
  | 'parallel_approval'
  | 'conditional_approval'
  | 'escalation'
  | 'review'
  | 'notification'
  | 'assignment'
  | 'rework'
  | 'sla'
  | 'multi_stage'
  | 'generic';

export type ApproverSourceType = 'field' | 'user' | 'group' | 'role' | 'submitter' | 'unresolved';

export type RejectionAction =
  | 'RETURN_TO_REQUESTER'
  | 'RETURN_TO_LEVEL'
  | 'RETURN_TO_STAGE'
  | 'END_WORKFLOW'
  | 'START_OVER';

export type WorkflowTriggerKind =
  | 'form_submission'
  | 'form_completion'
  | 'manual'
  | 'rule_success'
  | 'rule_failure';

export interface ApproverRef {
  type: ApproverSourceType;
  /** Form field UUID when type=field */
  fieldId?: string;
  fieldLabel?: string;
  /** User/group/role id when resolved */
  entityId?: string;
  entityLabel?: string;
  /** Raw user text before resolution */
  rawHint?: string;
  resolved: boolean;
}

export interface RejectionRoute {
  action: RejectionAction;
  targetLevel?: number;
  targetStage?: string;
}

export interface WorkflowConditionSpec {
  fieldId?: string;
  fieldLabel: string;
  fieldType?: string;
  operator: string;
  value: unknown;
  resolved: boolean;
}

export interface WorkflowLevelSpec {
  level: number;
  label: string;
  approver: ApproverRef;
  /** Choice/status field that records approval decision */
  approvalFieldId?: string;
  approvalFieldLabel?: string;
  /** Optional dedicated rejection field */
  rejectionFieldId?: string;
  rejectionFieldLabel?: string;
  commentsFieldId?: string;
  commentsFieldLabel?: string;
  onApprovalNext?: 'next_level' | 'complete' | string;
  onRejection: RejectionRoute | null;
  /** Option labels to add on publish after user permission */
  pendingOptionValues?: string[];
  /** Optional gate before this level runs */
  entryCondition?: WorkflowConditionSpec | null;
  configured: boolean;
}

export interface PendingConfigAction {
  id: string;
  kind:
    | 'CREATE_FIELD'
    | 'CREATE_FIELD_VALUE'
    | 'CREATE_ROLE'
    | 'CREATE_GROUP'
    | 'UPDATE_WORKFLOW'
    | 'CREATE_WORKFLOW';
  description: string;
  payload: Record<string, unknown>;
  userConfirmed: boolean;
}

export interface MissingRequirement {
  id: string;
  scope: 'workflow' | 'level' | 'routing' | 'condition' | 'metadata';
  level?: number;
  key: string;
  question: string;
  /** Structured UI hint */
  inputKind:
    | 'text'
    | 'field_select'
    | 'approver_source'
    | 'rejection_route'
    | 'choice'
    | 'confirm'
    | 'multi_choice';
  options?: Array<{ value: string; label: string }>;
  answered: boolean;
  answer?: unknown;
}

export interface AIWorkflowDefinition {
  name: string;
  description?: string;
  objectId?: string;
  objectName?: string;
  workflowType: AIWorkflowType;
  trigger: {
    kind: WorkflowTriggerKind;
    formId?: string;
    formName?: string;
  };
  levels: WorkflowLevelSpec[];
  /** Global rejection default when level-specific missing */
  defaultRejection?: RejectionRoute;
  conditions: WorkflowConditionSpec[];
  /** Parallel when levels can approve independently */
  parallel: boolean;
  status: 'DRAFT' | 'VALIDATED' | 'READY_TO_PUBLISH' | 'PUBLISHED';
}

export interface WorkflowValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface WorkflowPreviewSection {
  title: string;
  lines: string[];
}

export interface WorkflowBuilderPreview {
  title: string;
  sections: WorkflowPreviewSection[];
  fieldsToCreate: string[];
  valuesToCreate: string[];
  warnings: string[];
  summaryText: string;
}

export interface WorkflowBuilderSession {
  sessionId: string;
  userId?: string;
  projectId?: string;
  originalRequest: string;
  requirements: AIWorkflowDefinition;
  missingInformation: MissingRequirement[];
  pendingActions: PendingConfigAction[];
  confirmations: Array<{ id: string; prompt: string; confirmed: boolean; at: string }>;
  validationIssues: WorkflowValidationIssue[];
  preview?: WorkflowBuilderPreview;
  /** Compiled designer nodes ready for create_workflow */
  compiledNodes?: any[];
  status: WorkflowBuilderStatus;
  /** Last assistant message shown to user */
  lastAssistantMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyLevel(level: number): WorkflowLevelSpec {
  return {
    level,
    label: `Level ${level}`,
    approver: { type: 'unresolved', resolved: false },
    onApprovalNext: 'next_level',
    onRejection: null,
    configured: false,
  };
}

export function createEmptyWorkflowDefinition(
  partial?: Partial<AIWorkflowDefinition>,
): AIWorkflowDefinition {
  return {
    name: partial?.name || 'AI Approval Workflow',
    description: partial?.description,
    objectId: partial?.objectId,
    objectName: partial?.objectName,
    workflowType: partial?.workflowType || 'approval',
    trigger: partial?.trigger || { kind: 'form_submission' },
    levels: partial?.levels || [],
    defaultRejection: partial?.defaultRejection,
    conditions: partial?.conditions || [],
    parallel: partial?.parallel ?? false,
    status: partial?.status || 'DRAFT',
  };
}

export function createWorkflowBuilderSession(params: {
  originalRequest: string;
  userId?: string;
  projectId?: string;
  formId?: string;
  formName?: string;
}): WorkflowBuilderSession {
  const now = new Date().toISOString();
  return {
    sessionId: `wfb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: params.userId,
    projectId: params.projectId,
    originalRequest: params.originalRequest,
    requirements: createEmptyWorkflowDefinition({
      trigger: {
        kind: 'form_submission',
        formId: params.formId,
        formName: params.formName,
      },
      objectId: params.formId,
      objectName: params.formName,
    }),
    missingInformation: [],
    pendingActions: [],
    confirmations: [],
    validationIssues: [],
    status: 'discovering',
    createdAt: now,
    updatedAt: now,
  };
}
