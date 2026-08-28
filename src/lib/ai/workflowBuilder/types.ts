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
  /** User confirmed creating this value as a new option on the field */
  pendingOptionCreate?: boolean;
  /** Raw label the user asked for when option was missing */
  pendingOptionLabel?: string;
}

/**
 * Non-approval action node spec (Start → Condition → Action → End).
 * Action type is inferred from the prompt — never asked.
 */
export type WorkflowActionType =
  | 'change_field_value'
  | 'create_record'
  | 'create_linked_record'
  | 'update_linked_records'
  | 'create_combination_records'
  | 'send_notification';

export interface WorkflowCreateFieldValue {
  fieldId?: string;
  fieldLabel?: string;
  fieldType?: string;
  staticValue?: unknown;
  pendingOptionCreate?: boolean;
  pendingOptionLabel?: string;
}

/** Map a trigger-form field → create-record target field (type-compatible). */
export interface WorkflowCreateFieldMapping {
  sourceFieldId?: string;
  sourceFieldLabel?: string;
  sourceFieldType?: string;
  targetFieldId?: string;
  targetFieldLabel?: string;
  targetFieldType?: string;
}

export interface WorkflowActionSpec {
  actionType: WorkflowActionType;
  /** Field updated on trigger form (change_field_value) or linked form (update_linked) */
  targetFieldId?: string;
  targetFieldLabel?: string;
  targetFieldType?: string;
  valueType?: 'static' | 'dynamic';
  staticValue?: unknown;
  /** User confirmed creating this value as a new option on the action field */
  pendingOptionCreate?: boolean;
  pendingOptionLabel?: string;
  /** Cross-reference field on the trigger form */
  crossReferenceFieldId?: string;
  crossReferenceFieldLabel?: string;
  /** Combination records uses sourceCrossRef* naming in designer config */
  sourceCrossRefFieldId?: string;
  sourceCrossRefFieldLabel?: string;
  secondSourceCrossRefFieldId?: string;
  secondSourceCrossRefFieldLabel?: string;
  secondSourceLinkedFormId?: string;
  secondSourceLinkedFormName?: string;
  /** Linked / create target form (may be auto-detected from XR custom_config) */
  targetFormId?: string;
  targetFormName?: string;
  sourceLinkedFormId?: string;
  sourceLinkedFormName?: string;
  recordCount?: number;
  updateScope?: 'all' | 'first' | 'last';
  combinationMode?: 'single' | 'dual';
  /**
   * Combination: user confirmed the XR + destination form summary.
   * (Mappings / auto-link fields are compiled with sensible defaults.)
   */
  comboConfirmDone?: boolean;
  /** Combination: skip optional mapping customization (defaults only). */
  skipComboMappings?: boolean;
  /**
   * For create_record / create_linked_record / update_linked_records:
   * user chose not to set any static field values or mappings on the new/linked record.
   * (Update Linked ignores skip — at least one field change is required.)
   */
  skipCreateFieldValues?: boolean;
  /** Completed static field/value pairs for create_* and update_linked actions */
  createFieldValues?: WorkflowCreateFieldValue[];
  /** Completed trigger→target field mappings for create_* and update_linked actions */
  createFieldMappings?: WorkflowCreateFieldMapping[];
  /** User finished adding create/update field values / mappings */
  createFieldsDone?: boolean;
  /**
   * In-progress create draft: static value on a target field, or map from trigger.
   * Cleared when the pair is committed to createFieldValues / createFieldMappings.
   */
  createDraftKind?: 'static' | 'map';
  /** Draft map: field on the new (target) record */
  createMapTargetFieldId?: string;
  createMapTargetFieldLabel?: string;
  createMapTargetFieldType?: string;
  /** Draft map: field on the trigger form */
  createMapSourceFieldId?: string;
  createMapSourceFieldLabel?: string;
  createMapSourceFieldType?: string;
  configured: boolean;
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
  /** User confirmed creating Level N Status dropdown for this level's decision */
  pendingDecisionFieldCreate?: boolean;
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
    | 'user_select'
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
  /**
   * Shared Submission Access Control field used by approval workflows
   * to assign the current level's approver user(s).
   */
  accessFieldId?: string;
  accessFieldLabel?: string;
  /** User confirmed creating Submission Access Control when missing */
  pendingAccessFieldCreate?: boolean;
  /**
   * Main form Status field — updated from each Level N Status
   * (Pending with Level N / Level N Approved / Level N Rejected).
   */
  mainStatusFieldId?: string;
  mainStatusFieldLabel?: string;
  /** null = not asked yet; true = sync + create missing options; false = skip sync */
  syncMainStatus?: boolean | null;
  /** Option labels to add on main Status after user permission */
  pendingMainStatusOptions?: string[];
  /** Global rejection default when level-specific missing */
  defaultRejection?: RejectionRoute;
  conditions: WorkflowConditionSpec[];
  /**
   * Generic (non-approval) action. When set and levels are empty,
   * compiler builds Start → Condition → Action → End.
   */
  action?: WorkflowActionSpec | null;
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
    accessFieldId: partial?.accessFieldId,
    accessFieldLabel: partial?.accessFieldLabel,
    pendingAccessFieldCreate: partial?.pendingAccessFieldCreate,
    mainStatusFieldId: partial?.mainStatusFieldId,
    mainStatusFieldLabel: partial?.mainStatusFieldLabel,
    syncMainStatus: partial?.syncMainStatus,
    pendingMainStatusOptions: partial?.pendingMainStatusOptions,
    defaultRejection: partial?.defaultRejection,
    conditions: partial?.conditions || [],
    action: partial?.action ?? null,
    parallel: partial?.parallel ?? false,
    status: partial?.status || 'DRAFT',
  };
}

/** True when this definition uses multi-level approval Q&A (not generic action flow). */
export function isApprovalStyleDefinition(definition: AIWorkflowDefinition): boolean {
  if (definition.action && !definition.levels.length) return false;
  if (!definition.levels.length) return false;
  const t = definition.workflowType;
  return (
    t === 'approval'
    || t === 'sequential_approval'
    || t === 'parallel_approval'
    || t === 'conditional_approval'
    || t === 'escalation'
    || t === 'review'
    || t === 'rework'
    || t === 'multi_stage'
  );
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
