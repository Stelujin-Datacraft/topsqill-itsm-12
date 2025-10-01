import { FieldRule, FormRule, FieldOperator, FieldRuleCondition } from '@/types/rules';
import { toast } from '@/hooks/use-toast';
import { ExpressionEvaluator, EvaluationContext } from './expressionEvaluator';

export interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  isVisible?: boolean;
  isEnabled?: boolean;
  options?: any[];
  tooltip?: string;
  errorMessage?: string;
  defaultValue?: any;
}

export interface RuleProcessingContext {
  formData: Record<string, any>;
  formFields: FormField[];
  setFormData: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  setFieldStates: (states: Record<string, any>) => void;
  onFormAction?: (action: string, value?: any) => void;
}

export interface ProcessedFieldState {
  isVisible: boolean;
  isEnabled: boolean;
  isRequired: boolean;
  label: string;
  options?: any[];
  tooltip?: string;
  errorMessage?: string;
  defaultValue?: any;
}

export class RuleProcessor {
  // Helper method to safely convert values to searchable strings
  private static valueToSearchableString(value: any): string {
    if (value === null || value === undefined) return '';
    
    // Handle complex field types
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.join(' ').toLowerCase();
      }
      
      // Handle phone object
      if (value.number !== undefined && value.countryCode !== undefined) {
        return `${value.countryCode} ${value.number}`.toLowerCase();
      }
      
      // Handle currency object
      if (value.amount !== undefined && value.currency !== undefined) {
        return `${value.amount} ${value.currency}`.toLowerCase();
      }
      
      // Handle address object
      if (value.street !== undefined || value.city !== undefined) {
        return `${value.street || ''} ${value.city || ''} ${value.state || ''} ${value.postal || ''} ${value.country || ''}`.toLowerCase().trim();
      }
      
      // Handle other objects by converting to JSON string
      return JSON.stringify(value).toLowerCase();
    }
    
    return value.toString().toLowerCase();
  }

  static evaluateCondition(
    operator: FieldOperator,
    currentValue: any,
    conditionValue: any
  ): boolean {
    switch (operator) {
      case '==':
        return currentValue === conditionValue;
      case '!=':
        return currentValue !== conditionValue;
      case '<':
        return Number(currentValue) < Number(conditionValue);
      case '>':
        return Number(currentValue) > Number(conditionValue);
      case '<=':
        return Number(currentValue) <= Number(conditionValue);
      case '>=':
        return Number(currentValue) >= Number(conditionValue);
      case 'contains':
        const currentStr = this.valueToSearchableString(currentValue);
        const conditionStr = this.valueToSearchableString(conditionValue);
        return currentStr.includes(conditionStr);
      case 'not contains':
        const currentStr2 = this.valueToSearchableString(currentValue);
        const conditionStr2 = this.valueToSearchableString(conditionValue);
        return !currentStr2.includes(conditionStr2);
      case 'startsWith':
        const currentStr3 = this.valueToSearchableString(currentValue);
        const conditionStr3 = this.valueToSearchableString(conditionValue);
        return currentStr3.startsWith(conditionStr3);
      case 'endsWith':
        const currentStr4 = this.valueToSearchableString(currentValue);
        const conditionStr4 = this.valueToSearchableString(conditionValue);
        return currentStr4.endsWith(conditionStr4);
      case 'in':
        const values = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
        return values.includes(currentValue);
      case 'isEmpty':
        return !currentValue || currentValue === '' || (Array.isArray(currentValue) && currentValue.length === 0);
      case 'isNotEmpty':
        return currentValue && currentValue !== '' && (!Array.isArray(currentValue) || currentValue.length > 0);
      default:
        return false;
    }
  }

  static processFieldRules(
    fieldRules: FieldRule[],
    context: RuleProcessingContext
  ): Record<string, ProcessedFieldState> {
    const { formData, formFields } = context;
    
    // Initialize field states with defaults
    const fieldStates: Record<string, ProcessedFieldState> = {};
    formFields.forEach(field => {
      fieldStates[field.id] = {
        isVisible: field.isVisible ?? true,
        isEnabled: field.isEnabled ?? true,
        isRequired: field.required ?? false,
        label: field.label,
        options: field.options,
        tooltip: field.tooltip,
        errorMessage: field.errorMessage,
        defaultValue: field.defaultValue,
      };
    });

    // Process active rules
    fieldRules.forEach(rule => {
      if (!rule.isActive) return;

      let conditionMet = false;

      // Check if using new expression-based system
      if (rule.logicExpression && rule.conditions && rule.conditions.length > 0) {
        conditionMet = this.evaluateFieldRuleExpression(rule, formData, formFields);
      } 
      // Legacy single condition support (backward compatibility)
      else if (rule.condition) {
        const conditionField = formFields.find(f => f.id === rule.condition!.fieldId);
        const targetField = formFields.find(f => f.id === rule.targetFieldId);
        
        if (!conditionField || !targetField) return;

        const currentValue = formData[rule.condition.fieldId] || '';
        conditionMet = this.evaluateCondition(
          rule.condition.operator,
          currentValue,
          rule.condition.value
        );

        if (conditionMet) {
          console.log(`Rule "${rule.name}" condition met, applying action "${rule.action}" to field "${rule.targetFieldId}"`);
        } else {
          console.log(`Rule "${rule.name}" condition NOT met for field "${rule.condition.fieldId}" with value:`, currentValue, 'expected:', rule.condition.value);
        }
      }

      if (conditionMet) {
        this.applyFieldAction(rule, fieldStates, context);
      }
    });

    return fieldStates;
  }

  /**
   * Evaluates a field rule with logical expression support
   */
  private static evaluateFieldRuleExpression(
    rule: FieldRule,
    formData: Record<string, any>,
    formFields: FormField[]
  ): boolean {
    if (!rule.conditions || !rule.logicExpression) return false;

    try {
      // Build evaluation context by evaluating each condition
      const evalContext: EvaluationContext = {};
      
      rule.conditions.forEach((condition, index) => {
        const conditionId = (index + 1).toString(); // Use 1-based indexing
        const currentValue = formData[condition.fieldId] || '';
        
        evalContext[conditionId] = this.evaluateCondition(
          condition.operator,
          currentValue,
          condition.value
        );
      });

      // Evaluate the logical expression
      const result = ExpressionEvaluator.evaluate(rule.logicExpression, evalContext);
      
      console.log(`Field Rule "${rule.name}" expression "${rule.logicExpression}" evaluated to:`, result);
      
      return result;
    } catch (error) {
      console.error(`Error evaluating field rule expression for "${rule.name}":`, error);
      return false;
    }
  }

  private static applyFieldAction(
    rule: FieldRule,
    fieldStates: Record<string, ProcessedFieldState>,
    context: RuleProcessingContext
  ): void {
    const { setFormData } = context;
    const targetId = rule.targetFieldId;

    if (!fieldStates[targetId]) return;

    switch (rule.action) {
      case 'show':
        fieldStates[targetId].isVisible = true;
        break;
      
      case 'hide':
        fieldStates[targetId].isVisible = false;
        break;
      
      case 'enable':
        fieldStates[targetId].isEnabled = true;
        break;
      
      case 'disable':
        fieldStates[targetId].isEnabled = false;
        break;
      
      case 'require':
      case 'setRequired':
        fieldStates[targetId].isRequired = true;
        break;
      
      case 'optional':
      case 'setOptional':
        fieldStates[targetId].isRequired = false;
        break;
      
      case 'changeLabel':
        if (rule.actionValue) {
          fieldStates[targetId].label = rule.actionValue.toString();
        }
        break;
      
      case 'changeOptions':
        if (rule.actionValue && Array.isArray(rule.actionValue)) {
          fieldStates[targetId].options = rule.actionValue;
        }
        break;
      
      case 'setDefault':
        if (rule.actionValue !== undefined) {
          fieldStates[targetId].defaultValue = rule.actionValue;
          setFormData(prev => ({
            ...prev,
            [targetId]: rule.actionValue
          }));
        }
        break;
      
      case 'clearValue':
        // Get the target field to determine appropriate empty value
        const targetField = context.formFields.find(f => f.id === targetId);
        let emptyValue: any = '';
        
        if (targetField) {
          switch (targetField.type) {
            case 'tags':
              emptyValue = [];
              break;
            case 'multi-select':
            case 'checkbox':
              emptyValue = [];
              break;
            case 'currency':
              emptyValue = { amount: 0, currency: 'USD' };
              break;
            case 'address':
              emptyValue = { street: '', city: '', state: '', postal: '', country: '' };
              break;
            case 'phone':
              emptyValue = { number: '', countryCode: '+1' };
              break;
            case 'file':
              emptyValue = null;
              break;
            case 'number':
            case 'rating':
            case 'slider':
              emptyValue = 0;
              break;
            case 'toggle-switch':
              emptyValue = false;
              break;
            case 'date':
            case 'time':
            case 'datetime':
              emptyValue = null;
              break;
            default:
              emptyValue = '';
          }
        }
        
        setFormData(prev => ({
          ...prev,
          [targetId]: emptyValue
        }));
        break;
      
      case 'showTooltip':
        if (rule.actionValue) {
          fieldStates[targetId].tooltip = rule.actionValue.toString();
        }
        break;
      
      case 'showError':
        if (rule.actionValue) {
          fieldStates[targetId].errorMessage = rule.actionValue.toString();
        }
        break;
    }
  }

  static processFormRules(
    formRules: FormRule[],
    context: RuleProcessingContext
  ): void {
    const { formData, formFields, onFormAction } = context;

    formRules.forEach(rule => {
      if (!rule.isActive) return;

      const conditionsMet = this.evaluateFormRuleConditions(rule, formData, formFields);
      
      if (conditionsMet) {
        this.applyFormAction(rule, context);
      }
    });
  }

  private static evaluateFormRuleConditions(
    rule: FormRule,
    formData: Record<string, any>,
    formFields: FormField[]
  ): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return false;

    // Check if using new expression-based system
    if (rule.logicExpression) {
      return this.evaluateFormRuleExpression(rule, formData, formFields);
    }

    // Legacy logic support (backward compatibility)
    const results = rule.conditions.map(condition => {
      if (condition.type === 'single' && condition.fieldId && condition.operator) {
        const currentValue = formData[condition.fieldId] || '';
        return this.evaluateCondition(
          condition.operator,
          currentValue,
          condition.value
        );
      }
      return false;
    });

    // Apply root logic (default to AND if not specified)
    const logic = rule.rootLogic || 'AND';
    if (logic === 'AND') {
      return results.every(result => result);
    } else {
      return results.some(result => result);
    }
  }

  /**
   * Evaluates a form rule with logical expression support
   */
  private static evaluateFormRuleExpression(
    rule: FormRule,
    formData: Record<string, any>,
    formFields: FormField[]
  ): boolean {
    if (!rule.conditions || !rule.logicExpression) return false;

    try {
      // Build evaluation context by evaluating each condition
      const evalContext: EvaluationContext = {};
      
      rule.conditions.forEach((condition, index) => {
        const conditionId = (index + 1).toString(); // Use 1-based indexing
        
        if (condition.type === 'single' && condition.fieldId && condition.operator) {
          const currentValue = formData[condition.fieldId] || '';
          
          evalContext[conditionId] = this.evaluateCondition(
            condition.operator,
            currentValue,
            condition.value
          );
        } else {
          evalContext[conditionId] = false;
        }
      });

      // Evaluate the logical expression
      const result = ExpressionEvaluator.evaluate(rule.logicExpression, evalContext);
      
      console.log(`Form Rule "${rule.name}" expression "${rule.logicExpression}" evaluated to:`, result);
      
      return result;
    } catch (error) {
      console.error(`Error evaluating form rule expression for "${rule.name}":`, error);
      return false;
    }
  }

  private static applyFormAction(
    rule: FormRule,
    context: RuleProcessingContext
  ): void {
    const { setFormData, onFormAction } = context;

    switch (rule.action) {
      case 'allowSubmit':
        onFormAction?.('allowSubmit', true);
        break;
      
      case 'preventSubmit':
        onFormAction?.('preventSubmit', true);
        toast({
          title: "Form Submission Blocked",
          description: rule.actionValue?.toString() || "Form cannot be submitted due to rule condition.",
          variant: "destructive"
        });
        break;
      
      case 'approve':
        onFormAction?.('approve', rule.actionValue);
        toast({
          title: "Form Approved",
          description: rule.actionValue?.toString() || "Form has been approved.",
        });
        break;
      
      case 'disapprove':
      case 'reject':
        onFormAction?.('reject', rule.actionValue);
        toast({
          title: "Form Rejected",
          description: rule.actionValue?.toString() || "Form has been rejected.",
          variant: "destructive"
        });
        break;
      
      case 'notify':
        toast({
          title: "Notification",
          description: rule.actionValue?.toString() || "Rule condition triggered.",
        });
        break;
      
      case 'sendEmail':
        onFormAction?.('sendEmail', rule.actionValue);
        toast({
          title: "Email Triggered",
          description: "Email notification will be sent.",
        });
        break;
      
      case 'triggerWebhook':
        onFormAction?.('triggerWebhook', rule.actionValue);
        toast({
          title: "Webhook Triggered",
          description: "External API call initiated.",
        });
        break;
      
      case 'startWorkflow':
        onFormAction?.('startWorkflow', rule.actionValue);
        toast({
          title: "Workflow Started",
          description: rule.actionValue?.toString() || "Workflow has been initiated.",
        });
        break;
      
      case 'assignForm':
        onFormAction?.('assignForm', rule.actionValue);
        toast({
          title: "Form Assigned",
          description: `Form assigned to: ${rule.actionValue?.toString()}`,
        });
        break;
      
      case 'redirect':
        if (rule.actionValue) {
          onFormAction?.('redirect', rule.actionValue);
          toast({
            title: "Redirecting",
            description: `Redirecting to: ${rule.actionValue.toString()}`,
          });
        }
        break;
      
      case 'lockForm':
        onFormAction?.('lockForm', true);
        toast({
          title: "Form Locked",
          description: "Form has been locked for editing.",
          variant: "destructive"
        });
        break;
      
      case 'unlockForm':
        onFormAction?.('unlockForm', true);
        toast({
          title: "Form Unlocked",
          description: "Form is now available for editing.",
        });
        break;
      
      case 'autoFillFields':
        if (rule.actionValue && typeof rule.actionValue === 'object') {
          setFormData(prev => ({
            ...prev,
            ...rule.actionValue
          }));
          toast({
            title: "Fields Auto-filled",
            description: "Form fields have been automatically populated.",
          });
        }
        break;
      
      case 'changeFormHeader':
        onFormAction?.('changeFormHeader', rule.actionValue);
        break;
      
      case 'saveDraft':
        onFormAction?.('saveDraft', true);
        toast({
          title: "Draft Saved",
          description: "Form has been saved as draft.",
        });
        break;
      
      case 'showSuccessModal':
        toast({
          title: "Success!",
          description: rule.actionValue?.toString() || "Operation completed successfully.",
        });
        break;
      
      case 'showMessage':
        toast({
          title: "Message",
          description: rule.actionValue?.toString() || "Rule triggered.",
        });
        break;
      
      case 'updateField':
        if (rule.actionValue && typeof rule.actionValue === 'object') {
          const { fieldId, value } = rule.actionValue as { fieldId: string; value: any };
          if (fieldId) {
            setFormData(prev => ({
              ...prev,
              [fieldId]: value
            }));
          }
        }
        break;
    }
  }
}