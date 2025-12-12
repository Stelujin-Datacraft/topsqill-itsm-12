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
   * Evaluate form rules and trigger any associated workflows
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
        .select('form_rules')
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

      // Fetch form fields for condition evaluation
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

      console.log(`📋 Evaluating ${formRules.length} form rules`);

      // Evaluate each active rule
      for (const rule of formRules) {
        if (!rule.isActive) continue;

        const conditionsMet = this.evaluateRuleConditions(rule, formData, formFields);
        
        console.log(`📊 Rule "${rule.name}" (${rule.id}) evaluation:`, {
          conditionsMet,
          action: rule.action
        });

        // Trigger workflow for rule success
        if (conditionsMet) {
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
          // Trigger workflow for rule failure
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
