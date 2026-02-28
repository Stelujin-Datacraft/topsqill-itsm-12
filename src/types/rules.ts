
export type FieldOperator = 
  | '==' 
  | '!=' 
  | '<' 
  | '>' 
  | '<=' 
  | '>=' 
  | 'contains' 
  | 'not contains' 
  | 'startsWith' 
  | 'endsWith' 
  | 'in'
  | 'isEmpty'
  | 'isNotEmpty';

// Field rule actions - these trigger INSTANTLY when conditions are satisfied during form filling
export type FieldAction = 
  | 'show' 
  | 'hide' 
  | 'enable' 
  | 'disable' 
  | 'setRequired' 
  | 'setOptional' 
  | 'changeLabel' 
  | 'changeOptions' 
  | 'setDefault' 
  | 'clearValue' 
  | 'showTooltip' 
  | 'showError'
  | 'require'
  | 'optional'
  | 'filterOptions'
  // Form-level instant actions
  | 'redirect'
  | 'lockForm'
  | 'unlockForm'
  | 'showSuccessModal'
  | 'allowSubmit'
  | 'preventSubmit'
  // Instant notification/email actions (moved from form rules)
  | 'notify'
  | 'sendEmail';

// Form rule actions - these trigger ONLY on form submission when conditions are satisfied
export type FormAction = 
  | 'allowSubmit' 
  | 'preventSubmit' 
  | 'showMessage' 
  | 'redirectTo' 
  | 'triggerWebhook' 
  | 'sendEmail'  // Sends email on submit
  | 'updateField'
  | 'approve'
  | 'reject'
  | 'disapprove'
  | 'notify'     // Sends notification on submit
  | 'redirect'
  | 'startWorkflow'
  | 'assignForm'
  | 'lockForm'
  | 'unlockForm'
  | 'autoFillFields'
  | 'changeFormHeader'
  | 'saveDraft'
  | 'showSuccessModal';

// Export aliases for backward compatibility
export type FieldRuleAction = FieldAction;
export type FormRuleAction = FormAction;

export interface FieldRuleCondition {
  id: string;
  fieldId: string;
  operator: FieldOperator;
  value: string | string[] | number | boolean;
  compareToField?: string;
}

export interface FieldRule {
  id: string;
  name: string;
  targetFieldId: string;
  conditions?: FieldRuleCondition[]; // Multiple conditions for new system
  condition?: FieldRuleCondition; // Legacy single condition (backward compatibility)
  logicExpression?: string; // New: logical expression (e.g., "1 AND (2 OR 3) AND NOT 4")
  action: FieldAction;
  actionValue?: string | string[] | number | boolean;
  isActive: boolean;
  appliesTo?: 'all' | 'specific'; // Whether rule applies to all users or specific ones
  appliesToUserIds?: string[]; // User IDs the rule is scoped to (when appliesTo === 'specific')
}

export interface FormRuleCondition {
  id: string;
  type: 'single' | 'group';
  fieldId?: string;
  operator?: FieldOperator;
  value?: string | string[] | number | boolean;
  compareToField?: string;
  logic?: 'AND' | 'OR';
  conditions?: FormRuleCondition[];
}

export interface FormRule {
  id: string;
  name: string;
  conditions: FormRuleCondition[];
  rootLogic?: 'AND' | 'OR'; // Legacy logic (backward compatibility)
  logicExpression?: string; // New: logical expression (e.g., "1 AND (2 OR 3) AND NOT 4")
  action: FormAction;
  actionValue?: string | any;
  isActive: boolean;
}
