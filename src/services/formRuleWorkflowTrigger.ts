import { supabase } from '@/integrations/supabase/client';
import { FormRule, FieldOperator } from '@/types/rules';
import { TriggerService } from './triggerService';

interface FormField {
  id: string;
  label: string;
  type: string;
  options?: any[];
}

export class FormRuleWorkflowTrigger {
  /**
   * Evaluate form rules and trigger any associated workflows or direct actions
   */
  static async evaluateAndTriggerWorkflows(
    formId: string,
    formData: Record<string, any>,
    submissionId: string,
    userId?: string
  ): Promise<void> {
    console.log('🔍 Evaluating form rules for workflow triggers:', { formId, submissionId });

    try {
      // Fetch form with rules and fields
      const { data: form, error: formError } = await supabase
        .from('forms')
        .select('form_rules, project_id')
        .eq('id', formId)
        .single();

      if (formError || !form) {
        console.log('⚠️ No form found or error fetching form:', formError);
        return;
      }

      // Parse form rules
      let formRules: FormRule[] = [];
      if (form.form_rules) {
        formRules = typeof form.form_rules === 'string' 
          ? JSON.parse(form.form_rules) 
          : form.form_rules;
      }

      if (!formRules || formRules.length === 0) {
        console.log('📝 No form rules configured for this form');
        return;
      }

      // Fetch form fields for condition evaluation and field label mapping
      const { data: fields } = await supabase
        .from('form_fields')
        .select('id, label, field_type, options')
        .eq('form_id', formId);

      const formFields: FormField[] = (fields || []).map(f => ({
        id: f.id,
        label: f.label,
        type: f.field_type,
        options: f.options as any[]
      }));

      // Create a map of field ID to label for template variable resolution
      const fieldIdToLabel: Record<string, string> = {};
      formFields.forEach(f => {
        fieldIdToLabel[f.id] = f.label;
      });

      console.log(`📋 Evaluating ${formRules.length} form rules`);

      // Evaluate each active rule
      for (const rule of formRules) {
        if (!rule.isActive) continue;

        const conditionsMet = this.evaluateRuleConditions(rule, formData, formFields);
        
        console.log(`📊 Rule "${rule.name}" (${rule.id}) evaluation:`, {
          conditionsMet,
          action: rule.action,
          actionValue: rule.actionValue
        });

        // Execute the rule's direct action if conditions are met
        if (conditionsMet) {
          await this.executeRuleAction(rule, formData, formFields, fieldIdToLabel, submissionId, userId, form.project_id);
          
          // Also trigger any workflows configured for rule success
          await TriggerService.handleRuleTrigger(
            formId,
            rule.id,
            rule.name,
            true, // success
            formData,
            submissionId,
            userId
          );
        } else {
          // Trigger workflow for rule failure (no direct action execution)
          await TriggerService.handleRuleTrigger(
            formId,
            rule.id,
            rule.name,
            false, // failure
            formData,
            submissionId,
            userId
          );
        }
      }
    } catch (error) {
      console.error('❌ Error evaluating form rules for workflows:', error);
    }
  }

  /**
   * Execute the direct action defined in a form rule
   */
  private static async executeRuleAction(
    rule: FormRule,
    formData: Record<string, any>,
    formFields: FormField[],
    fieldIdToLabel: Record<string, string>,
    submissionId: string,
    userId?: string,
    projectId?: string
  ): Promise<void> {
    console.log(`🎯 Executing form rule action: ${rule.action}`, { ruleId: rule.id, ruleName: rule.name });

    try {
      switch (rule.action) {
        case 'sendEmail':
          await this.executeSendEmailAction(rule, formData, formFields, fieldIdToLabel, submissionId, userId, projectId);
          break;
        case 'notify':
          await this.executeNotifyAction(rule, formData, submissionId, userId);
          break;
        // Other actions can be handled here as needed
        default:
          console.log(`📝 Action "${rule.action}" does not require direct execution or is handled elsewhere`);
      }
    } catch (error) {
      console.error(`❌ Error executing rule action "${rule.action}":`, error);
    }
  }

  /**
   * Execute sendEmail action from form rule
   */
  private static async executeSendEmailAction(
    rule: FormRule,
    formData: Record<string, any>,
    formFields: FormField[],
    fieldIdToLabel: Record<string, string>,
    submissionId: string,
    userId?: string,
    projectId?: string
  ): Promise<void> {
    const actionValue = rule.actionValue as any;
    
    if (!actionValue?.templateId && !actionValue?.emailTemplate?.id) {
      console.error('❌ No email template configured for sendEmail action');
      return;
    }

    const templateId = actionValue.templateId || actionValue.emailTemplate?.id;
    console.log('📧 Executing sendEmail action with template:', templateId);

    try {
      // Build template data from form submission
      // Map field IDs to their labels for template variable replacement
      const templateData: Record<string, any> = {
        submissionId,
        submittedAt: new Date().toISOString(),
        ...formData
      };

      // Add label-keyed values for template variable replacement
      for (const [fieldId, value] of Object.entries(formData)) {
        const label = fieldIdToLabel[fieldId];
        if (label) {
          templateData[label] = value;
        }
      }

      // Add any custom template data from the rule configuration
      if (actionValue.templateData && Array.isArray(actionValue.templateData)) {
        for (const item of actionValue.templateData) {
          if (item.key) {
            if (item.type === 'field' && item.value) {
              // Map field value
              templateData[item.key] = formData[item.value] || '';
            } else if (item.type === 'static') {
              templateData[item.key] = item.value || '';
            }
          }
        }
      }

      // Get recipients - they can be configured in the rule or in the template
      let recipients: string[] = [];
      
      if (actionValue.recipients && Array.isArray(actionValue.recipients)) {
        // Recipients configured directly in the rule
        for (const recipient of actionValue.recipients) {
          if (typeof recipient === 'string') {
            recipients.push(recipient);
          } else if (recipient.type === 'static' && recipient.value) {
            recipients.push(...recipient.value.split(',').map((e: string) => e.trim()).filter(Boolean));
          } else if (recipient.type === 'field' && recipient.value) {
            const fieldValue = formData[recipient.value];
            if (fieldValue) {
              if (typeof fieldValue === 'string') {
                recipients.push(...fieldValue.split(',').map(e => e.trim()).filter(Boolean));
              } else if (Array.isArray(fieldValue)) {
                recipients.push(...fieldValue.filter(v => typeof v === 'string'));
              }
            }
          }
        }
      }

      console.log('📧 Calling send-template-email edge function:', {
        templateId,
        recipients: recipients.length > 0 ? recipients : 'Using template default recipients',
        templateDataKeys: Object.keys(templateData)
      });

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('send-template-email', {
        body: {
          templateId,
          recipients: recipients.length > 0 ? recipients : undefined,
          templateData,
          triggerContext: {
            trigger_type: 'form_rule',
            rule_id: rule.id,
            rule_name: rule.name,
            submission_id: submissionId,
            form_data: formData
          }
        }
      });

      if (error) {
        console.error('❌ Error sending email via form rule:', error);
        throw error;
      }

      console.log('✅ Email sent successfully via form rule:', data);
    } catch (error) {
      console.error('❌ Failed to execute sendEmail action:', error);
      throw error;
    }
  }

  /**
   * Execute notify action from form rule
   */
  private static async executeNotifyAction(
    rule: FormRule,
    formData: Record<string, any>,
    submissionId: string,
    userId?: string
  ): Promise<void> {
    const actionValue = rule.actionValue as any;
    
    console.log('🔔 Executing notify action:', { ruleId: rule.id, actionValue });
    
    try {
      // Create notification in the database
      if (actionValue?.message && userId) {
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'form_rule',
            title: actionValue.title || `Rule: ${rule.name}`,
            message: actionValue.message,
            data: {
              rule_id: rule.id,
              rule_name: rule.name,
              submission_id: submissionId,
              form_data: formData
            }
          });

        if (error) {
          console.error('❌ Error creating notification:', error);
        } else {
          console.log('✅ Notification created successfully');
        }
      }
    } catch (error) {
      console.error('❌ Failed to execute notify action:', error);
    }
  }

  /**
   * Evaluate rule conditions
   */
  private static evaluateRuleConditions(
    rule: FormRule,
    formData: Record<string, any>,
    formFields: FormField[]
  ): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return false;

    // Build evaluation results for each condition
    const results = rule.conditions.map((condition, index) => {
      if (condition.type === 'single' && condition.fieldId && condition.operator) {
        const currentValue = formData[condition.fieldId];
        return this.evaluateCondition(
          condition.operator as FieldOperator,
          currentValue,
          condition.value
        );
      }
      return false;
    });

    // Check if using expression-based logic
    if (rule.logicExpression) {
      return this.evaluateExpression(rule.logicExpression, results);
    }

    // Legacy logic support (AND/OR)
    const logic = rule.rootLogic || 'AND';
    if (logic === 'AND') {
      return results.every(result => result);
    } else {
      return results.some(result => result);
    }
  }

  /**
   * Evaluate a single condition
   */
  private static evaluateCondition(
    operator: FieldOperator,
    currentValue: any,
    targetValue: any
  ): boolean {
    const current = this.normalizeValue(currentValue);
    const target = this.normalizeValue(targetValue);

    switch (operator) {
      case '==':
        return current === target;
      case '!=':
        return current !== target;
      case '<':
        return parseFloat(current) < parseFloat(target);
      case '>':
        return parseFloat(current) > parseFloat(target);
      case '<=':
        return parseFloat(current) <= parseFloat(target);
      case '>=':
        return parseFloat(current) >= parseFloat(target);
      case 'contains':
        return current.toLowerCase().includes(target.toLowerCase());
      case 'not contains':
        return !current.toLowerCase().includes(target.toLowerCase());
      case 'startsWith':
        return current.toLowerCase().startsWith(target.toLowerCase());
      case 'endsWith':
        return current.toLowerCase().endsWith(target.toLowerCase());
      case 'isEmpty':
        return !current || current === '';
      case 'isNotEmpty':
        return !!current && current !== '';
      case 'in':
        const targetArray = Array.isArray(targetValue) ? targetValue : [targetValue];
        return targetArray.includes(currentValue);
      default:
        return false;
    }
  }

  /**
   * Normalize value for comparison
   */
  private static normalizeValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.join(',');
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Evaluate logical expression (e.g., "1 AND (2 OR 3)")
   */
  private static evaluateExpression(expression: string, results: boolean[]): boolean {
    try {
      // Replace condition numbers with their boolean results
      let evalExpr = expression;
      results.forEach((result, index) => {
        const conditionNum = index + 1;
        evalExpr = evalExpr.replace(
          new RegExp(`\\b${conditionNum}\\b`, 'g'),
          result ? 'true' : 'false'
        );
      });

      // Replace logical operators
      evalExpr = evalExpr.replace(/\bAND\b/gi, '&&');
      evalExpr = evalExpr.replace(/\bOR\b/gi, '||');
      evalExpr = evalExpr.replace(/\bNOT\b/gi, '!');

      // Evaluate the expression safely
      return Function(`"use strict"; return (${evalExpr})`)();
    } catch (error) {
      console.error('Error evaluating expression:', expression, error);
      return false;
    }
  }
}
