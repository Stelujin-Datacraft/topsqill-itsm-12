
import { 
  ConditionConfig, 
  IfConditionConfig, 
  SwitchConditionConfig,
  SimpleCondition, 
  LogicalGroup, 
  FieldPath,
  ComparisonOperator,
  ConditionEvaluationContext,
  ConditionEvaluationResult,
  EnhancedCondition,
  FormLevelCondition,
  FieldLevelCondition,
  ConditionItem
} from '@/types/conditions';
import { ExpressionEvaluator, EvaluationContext } from '@/utils/expressionEvaluator';

export class ConditionEvaluator {
  static evaluateCondition(
    config: ConditionConfig, 
    context: ConditionEvaluationContext
  ): ConditionEvaluationResult {
    try {
      if (config.type === 'if') {
        return this.evaluateIfCondition(config, context);
      } else if (config.type === 'switch') {
        return this.evaluateSwitchCondition(config, context);
      }

      return {
        success: false,
        result: false,
        error: `Unknown condition type: ${(config as any).type}`
      };
    } catch (error) {
      return {
        success: false,
        result: false,
        error: error instanceof Error ? error.message : 'Unknown evaluation error'
      };
    }
  }

  private static evaluateIfCondition(
    config: IfConditionConfig, 
    context: ConditionEvaluationContext
  ): ConditionEvaluationResult {
    let result: boolean;

    // Check if it's an enhanced condition
    if (typeof config.condition === 'object' && 'systemType' in config.condition) {
      result = this.evaluateEnhancedCondition(config.condition as EnhancedCondition, context);
    } else {
      result = this.evaluateConditionGroup(config.condition as SimpleCondition | LogicalGroup, context);
    }
    
    return {
      success: true,
      result: result,
      evaluatedConditions: { conditionResult: result }
    };
  }

  private static evaluateEnhancedCondition(
    condition: EnhancedCondition,
    context: ConditionEvaluationContext
  ): boolean {
    // Handle multiple conditions with individual logical operators
    if (condition.conditions && condition.conditions.length > 0) {
      const conditions = condition.conditions;
      
      // First, evaluate all individual conditions
      const conditionResults: Record<string, boolean> = {};
      for (let i = 0; i < conditions.length; i++) {
        const result = this.evaluateSingleConditionItem(conditions[i], context);
        conditionResults[String(i + 1)] = result;
      }

      // Use manual expression if enabled
      if (condition.useManualExpression && condition.manualExpression) {
        try {
          return ExpressionEvaluator.evaluate(condition.manualExpression, conditionResults);
        } catch {
          // Fall back to sequential AND evaluation
        }
      }
      
      // Default: Chain with sequential logical operators
      let result = conditionResults['1'];
      
      for (let i = 1; i < conditions.length; i++) {
        const prevCondition = conditions[i - 1];
        const currentResult = conditionResults[String(i + 1)];
        const operator = prevCondition.logicalOperatorWithNext || 'AND';
        
        if (operator === 'AND') {
          result = result && currentResult;
        } else {
          result = result || currentResult;
        }
      }
      
      return result;
    }

    // Fallback to single condition evaluation (backward compatibility)
    if (condition.systemType === 'form_level' && condition.formLevelCondition) {
      return this.evaluateFormLevelCondition(condition.formLevelCondition, context);
    } else if (condition.systemType === 'field_level' && condition.fieldLevelCondition) {
      return this.evaluateFieldLevelCondition(condition.fieldLevelCondition, context);
    }

    return false;
  }

  private static evaluateSingleConditionItem(
    conditionItem: ConditionItem,
    context: ConditionEvaluationContext
  ): boolean {
    if (conditionItem.systemType === 'form_level' && conditionItem.formLevelCondition) {
      return this.evaluateFormLevelCondition(conditionItem.formLevelCondition, context);
    } else if (conditionItem.systemType === 'field_level' && conditionItem.fieldLevelCondition) {
      return this.evaluateFieldLevelCondition(conditionItem.fieldLevelCondition, context);
    }
    return false;
  }

  private static evaluateFormLevelCondition(
    condition: FormLevelCondition,
    context: ConditionEvaluationContext
  ): boolean {
    let actualValue: any;

    switch (condition.conditionType) {
      case 'form_status':
        actualValue = context.systemData.formStatus;
        break;
      case 'form_submission':
        actualValue = context.systemData.submissionStatus;
        break;
      case 'user_property':
        actualValue = context.userProperties.role || context.userProperties.user_role;
        break;
      default:
        return false;
    }

    return this.compareValues(actualValue, condition.value, condition.operator);
  }

  private static evaluateFieldLevelCondition(
    condition: FieldLevelCondition,
    context: ConditionEvaluationContext
  ): boolean {
    // Get the field value from form data
    const fieldValue = context.formData[condition.fieldId];
    return this.compareValues(fieldValue, condition.value, condition.operator);
  }

  private static evaluateSwitchCondition(
    config: SwitchConditionConfig, 
    context: ConditionEvaluationContext
  ): ConditionEvaluationResult {
    const fieldValue = this.resolveFieldPath(config.field, context);

    // Find matching case
    const matchingCase = config.cases.find(caseItem => 
      this.compareValues(fieldValue, caseItem.value, '==')
    );

    const resultPath = matchingCase ? matchingCase.path : config.defaultPath;

    return {
      success: true,
      result: resultPath || 'default',
      evaluatedConditions: { 
        fieldValue, 
        matchedCase: matchingCase?.value,
        resultPath 
      }
    };
  }

  private static evaluateConditionGroup(
    condition: SimpleCondition | LogicalGroup, 
    context: ConditionEvaluationContext
  ): boolean {
    if ('operator' in condition && 'leftOperand' in condition) {
      // Simple condition
      return this.evaluateSimpleCondition(condition, context);
    } else if ('operator' in condition && 'conditions' in condition) {
      // Logical group
      const group = condition as LogicalGroup;
      
      if (group.operator === 'AND') {
        return group.conditions.every(cond => this.evaluateConditionGroup(cond, context));
      } else if (group.operator === 'OR') {
        return group.conditions.some(cond => this.evaluateConditionGroup(cond, context));
      }
    }
    
    return false;
  }

  private static evaluateSimpleCondition(
    condition: SimpleCondition, 
    context: ConditionEvaluationContext
  ): boolean {
    const leftValue = this.resolveFieldPath(condition.leftOperand, context);
    
    // Fix: Properly handle the rightOperand type checking
    let rightValue: any;
    if (typeof condition.rightOperand === 'object' && condition.rightOperand !== null) {
      if ('value' in condition.rightOperand) {
        // It's a static value object
        rightValue = condition.rightOperand.value;
      } else {
        // It's a FieldPath object
        rightValue = this.resolveFieldPath(condition.rightOperand as FieldPath, context);
      }
    } else {
      // Fallback for any other case
      rightValue = condition.rightOperand;
    }

    return this.compareValues(leftValue, rightValue, condition.operator);
  }

  private static resolveFieldPath(fieldPath: FieldPath, context: ConditionEvaluationContext): any {
    const { type, path } = fieldPath;

    switch (type) {
      case 'form':
        return this.getNestedValue(context.formData, path);
      case 'user':
        return this.getNestedValue(context.userProperties, path);
      case 'system':
        return this.getNestedValue(context.systemData, path);
      case 'static':
        return path; // For static values, the path IS the value
      default:
        return undefined;
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    
    return current;
  }

  private static compareValues(left: any, right: any, operator: ComparisonOperator): boolean {
    // Handle null/undefined cases
    if (left === null || left === undefined) {
      switch (operator) {
        case 'exists': return false;
        case 'not_exists': return true;
        default: return false;
      }
    }

    if (right === null || right === undefined) {
      switch (operator) {
        case '==': return left === right;
        case '!=': return left !== right;
        default: return false;
      }
    }

    // Convert to strings for consistent comparison if needed
    const leftStr = String(left).toLowerCase();
    const rightStr = String(right).toLowerCase();
    const leftNum = Number(left);
    const rightNum = Number(right);

    switch (operator) {
      case '==':
        return left === right || leftStr === rightStr;
      case '!=':
        return left !== right && leftStr !== rightStr;
      case '<':
        return !isNaN(leftNum) && !isNaN(rightNum) ? leftNum < rightNum : leftStr < rightStr;
      case '>':
        return !isNaN(leftNum) && !isNaN(rightNum) ? leftNum > rightNum : leftStr > rightStr;
      case '<=':
        return !isNaN(leftNum) && !isNaN(rightNum) ? leftNum <= rightNum : leftStr <= rightStr;
      case '>=':
        return !isNaN(leftNum) && !isNaN(rightNum) ? leftNum >= rightNum : leftStr >= rightStr;
      case 'contains':
        return leftStr.includes(rightStr);
      case 'not_contains':
        return !leftStr.includes(rightStr);
      case 'starts_with':
        return leftStr.startsWith(rightStr);
      case 'ends_with':
        return leftStr.endsWith(rightStr);
      case 'in':
        if (Array.isArray(right)) {
          return right.some(item => String(item).toLowerCase() === leftStr);
        }
        return rightStr.split(',').map(s => s.trim().toLowerCase()).includes(leftStr);
      case 'not_in':
        if (Array.isArray(right)) {
          return !right.some(item => String(item).toLowerCase() === leftStr);
        }
        return !rightStr.split(',').map(s => s.trim().toLowerCase()).includes(leftStr);
      case 'exists':
        return left !== null && left !== undefined && left !== '';
      case 'not_exists':
        return left === null || left === undefined || left === '';
      default:
        return false;
    }
  }
}
