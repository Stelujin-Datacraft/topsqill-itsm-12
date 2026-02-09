/**
 * System Schema Definitions for AI Generation
 * 
 * This file contains all valid types, operators, actions, and configurations
 * that the AI must use when generating forms, workflows, reports, etc.
 * 
 * IMPORTANT: Keep this in sync with database constraints and type definitions.
 */

// ============= FORM FIELD TYPES =============
export const VALID_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'phone',
  'date',
  'time',
  'datetime',
  'select',
  'multi-select',
  'radio',
  'checkbox',
  'toggle-switch',
  'file',
  'image',
  'signature',
  'rating',
  'slider',
  'header',
  'description',
  'horizontal-line',
  'section-break',
  'tags',
  'country',
  'address',
  'currency',
  'url',
  'color',
  'barcode',
  'lifecycle',
  'cross-reference',
  'submission-access',
  'assigned-user',
  'calculated'
] as const;

export type ValidFieldType = typeof VALID_FIELD_TYPES[number];

// Field type aliases that AI might generate incorrectly
export const FIELD_TYPE_ALIASES: Record<string, ValidFieldType> = {
  'dropdown': 'select',
  'multiselect': 'multi-select',
  'checkbox-group': 'checkbox',
  'heading': 'header',
  'title': 'header',
  'divider': 'horizontal-line',
  'separator': 'horizontal-line',
  'paragraph': 'description',
  'help-text': 'description',
  'rich-text': 'textarea',
  'longtext': 'textarea',
  'short-text': 'text',
  'textfield': 'text',
  'integer': 'number',
  'decimal': 'number',
  'float': 'number',
  'datepicker': 'date',
  'timepicker': 'time',
  'datetime-local': 'datetime',
  'tel': 'phone',
  'telephone': 'phone',
  'upload': 'file',
  'attachment': 'file',
  'photo': 'image',
  'picture': 'image',
  'stars': 'rating',
  'range': 'slider',
  'switch': 'toggle-switch',
  'boolean': 'toggle-switch',
  'yes-no': 'toggle-switch',
  'link': 'url',
  'website': 'url',
  'money': 'currency',
  'price': 'currency',
  'amount': 'currency',
  'status': 'lifecycle',
  'stage': 'lifecycle',
  'lookup': 'cross-reference',
  'reference': 'cross-reference',
  'related': 'cross-reference'
};

// ============= WORKFLOW NODE TYPES =============
export const VALID_NODE_TYPES = [
  'start',
  'action',
  'condition',
  'wait',
  'end'
] as const;

export type ValidNodeType = typeof VALID_NODE_TYPES[number];

// Node type aliases that AI might generate incorrectly
export const NODE_TYPE_ALIASES: Record<string, ValidNodeType> = {
  'trigger': 'start',
  'begin': 'start',
  'notification': 'action',
  'email': 'action',
  'send': 'action',
  'form-assignment': 'action',
  'assignment': 'action',
  'approval': 'action',
  'approve': 'action',
  'branch': 'condition',
  'decision': 'condition',
  'if': 'condition',
  'switch': 'condition',
  'delay': 'wait',
  'pause': 'wait',
  'timer': 'wait',
  'stop': 'end',
  'finish': 'end',
  'complete': 'end',
  'terminate': 'end'
};

// ============= WORKFLOW TRIGGER TYPES =============
export const VALID_TRIGGER_TYPES = [
  'form_submission',
  'form_completion',
  'form_approval',
  'form_rejection',
  'rule_success',
  'rule_failure',
  'manual',
  'webhook',
  'schedule'
] as const;

export type ValidTriggerType = typeof VALID_TRIGGER_TYPES[number];

// ============= WORKFLOW ACTION TYPES =============
export const VALID_ACTION_TYPES = [
  'approve_form',
  'disapprove_form',
  'send_email',
  'send_notification',
  'send_sms',
  'trigger_webhook',
  'change_form_status',
  'set_field_values',
  'log_event',
  'update_workflow_variable',
  'wait_for_completion',
  'change_field_value',
  'change_record_status',
  'create_record',
  'create_linked_record',
  'update_linked_records',
  'create_combination_records'
] as const;

export type ValidActionType = typeof VALID_ACTION_TYPES[number];

// ============= CONDITION OPERATORS =============
export const VALID_CONDITION_OPERATORS = [
  '==',
  '!=',
  '<',
  '>',
  '<=',
  '>=',
  'contains',
  'not_contains',
  'startsWith',
  'endsWith',
  'in',
  'not_in',
  'exists',
  'not_exists',
  'isEmpty',
  'isNotEmpty'
] as const;

export type ValidConditionOperator = typeof VALID_CONDITION_OPERATORS[number];

// Operator aliases
export const CONDITION_OPERATOR_ALIASES: Record<string, ValidConditionOperator> = {
  'equals': '==',
  'equal': '==',
  'is': '==',
  'not_equals': '!=',
  'not_equal': '!=',
  'isnt': '!=',
  'less_than': '<',
  'lessThan': '<',
  'greater_than': '>',
  'greaterThan': '>',
  'less_than_or_equal': '<=',
  'lessThanOrEqual': '<=',
  'greater_than_or_equal': '>=',
  'greaterThanOrEqual': '>=',
  'includes': 'contains',
  'has': 'contains',
  'not_includes': 'not_contains',
  'does_not_contain': 'not_contains',
  'starts_with': 'startsWith',
  'begins_with': 'startsWith',
  'ends_with': 'endsWith',
  'is_in': 'in',
  'one_of': 'in',
  'is_not_in': 'not_in',
  'none_of': 'not_in',
  'is_empty': 'isEmpty',
  'empty': 'isEmpty',
  'is_not_empty': 'isNotEmpty',
  'not_empty': 'isNotEmpty',
  'has_value': 'isNotEmpty',
  'is_set': 'exists',
  'is_not_set': 'not_exists'
};

// ============= FIELD RULE ACTIONS =============
export const VALID_FIELD_RULE_ACTIONS = [
  'show',
  'hide',
  'enable',
  'disable',
  'require',
  'optional',
  'setDefault',
  'clearValue',
  'filterOptions',
  'preventSubmit',
  'allowSubmit'
] as const;

export type ValidFieldRuleAction = typeof VALID_FIELD_RULE_ACTIONS[number];

// ============= FORM RULE ACTIONS =============
export const VALID_FORM_RULE_ACTIONS = [
  'approve',
  'reject',
  'notify',
  'sendEmail',
  'startWorkflow',
  'assignForm',
  'lockForm',
  'unlockForm',
  'redirect'
] as const;

export type ValidFormRuleAction = typeof VALID_FORM_RULE_ACTIONS[number];

// ============= CHART TYPES =============
export const VALID_CHART_TYPES = [
  'bar',
  'line',
  'area',
  'pie',
  'scatter',
  'bubble',
  'table'
] as const;

export type ValidChartType = typeof VALID_CHART_TYPES[number];

// ============= AGGREGATION TYPES =============
export const VALID_AGGREGATION_TYPES = [
  'count',
  'sum',
  'avg',
  'min',
  'max'
] as const;

export type ValidAggregationType = typeof VALID_AGGREGATION_TYPES[number];

// ============= NOTIFICATION TYPES =============
export const VALID_NOTIFICATION_TYPES = [
  'email',
  'sms',
  'in_app',
  'webhook'
] as const;

export type ValidNotificationType = typeof VALID_NOTIFICATION_TYPES[number];

// ============= RECIPIENT TYPES =============
export const VALID_RECIPIENT_TYPES = [
  'submitter',
  'form_owner',
  'specific_users',
  'field_value',
  'group',
  'role'
] as const;

export type ValidRecipientType = typeof VALID_RECIPIENT_TYPES[number];

// ============= WAIT TYPES =============
export const VALID_WAIT_TYPES = [
  'duration',
  'until_date',
  'until_event'
] as const;

export type ValidWaitType = typeof VALID_WAIT_TYPES[number];

// ============= DURATION UNITS =============
export const VALID_DURATION_UNITS = [
  'minutes',
  'hours',
  'days',
  'weeks'
] as const;

export type ValidDurationUnit = typeof VALID_DURATION_UNITS[number];

// ============= ESCALATION LEVELS =============
export const VALID_ESCALATION_LEVELS = [
  'L1',
  'L2',
  'L3',
  'L4'
] as const;

export type ValidEscalationLevel = typeof VALID_ESCALATION_LEVELS[number];

// ============= WORKFLOW STATUSES =============
export const VALID_WORKFLOW_STATUSES = [
  'draft',
  'active',
  'inactive'
] as const;

export type ValidWorkflowStatus = typeof VALID_WORKFLOW_STATUSES[number];

// ============= FORM STATUSES =============
export const VALID_FORM_STATUSES = [
  'draft',
  'published',
  'archived'
] as const;

export type ValidFormStatus = typeof VALID_FORM_STATUSES[number];

// ============= COMPLETE SCHEMA EXPORT FOR AI PROMPTS =============
export const AI_SCHEMA_CONTEXT = {
  fieldTypes: VALID_FIELD_TYPES,
  fieldTypeAliases: FIELD_TYPE_ALIASES,
  nodeTypes: VALID_NODE_TYPES,
  nodeTypeAliases: NODE_TYPE_ALIASES,
  triggerTypes: VALID_TRIGGER_TYPES,
  actionTypes: VALID_ACTION_TYPES,
  conditionOperators: VALID_CONDITION_OPERATORS,
  operatorAliases: CONDITION_OPERATOR_ALIASES,
  fieldRuleActions: VALID_FIELD_RULE_ACTIONS,
  formRuleActions: VALID_FORM_RULE_ACTIONS,
  chartTypes: VALID_CHART_TYPES,
  aggregationTypes: VALID_AGGREGATION_TYPES,
  notificationTypes: VALID_NOTIFICATION_TYPES,
  recipientTypes: VALID_RECIPIENT_TYPES,
  waitTypes: VALID_WAIT_TYPES,
  durationUnits: VALID_DURATION_UNITS,
  escalationLevels: VALID_ESCALATION_LEVELS
};

/**
 * Generates a schema context string for AI prompts
 */
export function generateSchemaPromptContext(): string {
  return `
=== SYSTEM SCHEMA REFERENCE ===

VALID FIELD TYPES (use EXACTLY these values):
${VALID_FIELD_TYPES.map(t => `- ${t}`).join('\n')}

VALID WORKFLOW NODE TYPES (use EXACTLY these values):
${VALID_NODE_TYPES.map(t => `- ${t}`).join('\n')}

VALID TRIGGER TYPES:
${VALID_TRIGGER_TYPES.map(t => `- ${t}`).join('\n')}

VALID ACTION TYPES:
${VALID_ACTION_TYPES.map(t => `- ${t}`).join('\n')}

VALID CONDITION OPERATORS:
${VALID_CONDITION_OPERATORS.map(t => `- ${t}`).join('\n')}

VALID CHART TYPES:
${VALID_CHART_TYPES.map(t => `- ${t}`).join('\n')}

VALID AGGREGATION TYPES:
${VALID_AGGREGATION_TYPES.map(t => `- ${t}`).join('\n')}

=== END SCHEMA REFERENCE ===
`;
}
