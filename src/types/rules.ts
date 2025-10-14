
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
  | 'optional'
  | 'filterOptions';

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
  conditions?: FieldRuleCondition[]; // Multiple conditions for new system
  condition?: FieldRuleCondition; // Legacy single condition (backward compatibility)
  logicExpression?: string; // New: logical expression (e.g., "1 AND (2 OR 3) AND NOT 4")
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
  rootLogic?: 'AND' | 'OR'; // Legacy logic (backward compatibility)
  logicExpression?: string; // New: logical expression (e.g., "1 AND (2 OR 3) AND NOT 4")
  action: FormAction;
  actionValue?: string | any;
  isActive: boolean;
}
