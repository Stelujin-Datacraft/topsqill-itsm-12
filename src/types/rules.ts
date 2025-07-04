
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
  | 'optional';

export type FormAction = 
  | 'allowSubmit' 
  | 'preventSubmit' 
  | 'showMessage' 
  | 'redirectTo' 
  | 'triggerWebhook' 
  | 'sendEmail' 
  | 'updateField'
  | 'approve'
  | 'reject'
  | 'disapprove'
  | 'notify'
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
  condition: FieldRuleCondition;
  action: FieldAction;
  actionValue?: string | string[] | number | boolean;
  isActive: boolean;
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
  rootLogic: 'AND' | 'OR';
  action: FormAction;
  actionValue?: string | any;
  isActive: boolean;
}
