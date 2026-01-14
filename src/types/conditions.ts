
export type ConditionType = 'if' | 'switch';
export type ConditionSystemType = 'form_level' | 'field_level';

export type ComparisonOperator = 
  | '==' | '!=' 
  | '<' | '>' | '<=' | '>='
  | 'contains' | 'not_contains'
  | 'in' | 'not_in'
  | 'exists' | 'not_exists'
  | 'starts_with' | 'ends_with';

export type LogicalOperator = 'AND' | 'OR';

export interface FieldPath {
  type: 'form' | 'user' | 'system' | 'static';
  path: string;
}

// Form-level condition types
export type FormStatusType = 'draft' | 'published' | 'submitted' | 'approved' | 'rejected' | 'archived';
export type FormSubmissionStatusType = 'pending' | 'completed' | 'approved' | 'rejected' | 'in_review';
export type UserPropertyType = 'role' | 'email' | 'department' | 'organization_id' | 'user_id';

export interface FormLevelCondition {
  id: string;
  conditionType: 'form_status' | 'form_submission' | 'user_property';
  formId?: string;
  operator: ComparisonOperator;
  value: string | FormStatusType | FormSubmissionStatusType;
}

// Field-level condition types
export interface FieldLevelCondition {
  id: string;
  formId: string;
  fieldId: string;
  fieldType: string;
  operator: ComparisonOperator;
  value: any;
}

export interface SimpleCondition {
  id: string;
  leftOperand: FieldPath;
  operator: ComparisonOperator;
  rightOperand: FieldPath | { type: 'static'; value: any };
}

export interface LogicalGroup {
  id: string;
  operator: LogicalOperator;
  conditions: (SimpleCondition | LogicalGroup)[];
}

// Single condition item for multiple conditions support
export interface ConditionItem {
  id: string;
  systemType: ConditionSystemType;
  formLevelCondition?: FormLevelCondition;
  fieldLevelCondition?: FieldLevelCondition;
  // Logical operator to combine with the NEXT condition (not applicable for last item)
  logicalOperatorWithNext?: LogicalOperator;
}

export interface EnhancedCondition {
  id: string;
  systemType: ConditionSystemType;
  formLevelCondition?: FormLevelCondition;
  fieldLevelCondition?: FieldLevelCondition;
  logicalOperator?: LogicalOperator;
  // Multiple conditions support
  conditions?: ConditionItem[];
  // Manual expression mode
  useManualExpression?: boolean;
  manualExpression?: string; // e.g., "(1 AND 2) OR (3 AND 4)"
}

export interface IfConditionConfig {
  type: 'if';
  condition: SimpleCondition | LogicalGroup | EnhancedCondition;
  truePath?: string;
  falsePath?: string;
}

export interface SwitchCase {
  value: string;
  path: string;
}

export interface SwitchConditionConfig {
  type: 'switch';
  field: FieldPath;
  cases: SwitchCase[];
  defaultPath?: string;
}

export type ConditionConfig = IfConditionConfig | SwitchConditionConfig;

export interface ConditionNodeData {
  conditionType: ConditionType;
  config: ConditionConfig;
  label?: string;
}

export interface ConditionEvaluationContext {
  formData: Record<string, any>;
  userProperties: Record<string, any>;
  systemData: {
    approvalStatus?: string;
    currentUserId?: string;
    submissionId?: string;
    workflowExecutionId?: string;
    formStatus?: FormStatusType;
    submissionStatus?: FormSubmissionStatusType;
  };
}

export interface ConditionEvaluationResult {
  success: boolean;
  result: boolean | string;
  error?: string;
  evaluatedConditions?: Record<string, any>;
  // Waiting state for when field values are empty
  waitingForValue?: boolean;
  waitingFields?: string[];
}

// Form and field selection interfaces
export interface FormOption {
  id: string;
  name: string;
  fields: FormFieldOption[];
}

export interface FormFieldOption {
  id: string;
  label: string;
  type: string;
  options?: Array<{ id: string; value: string; label: string }>;
  required: boolean;
  custom_config?: Record<string, any>;
  validation?: Record<string, any>;
}
