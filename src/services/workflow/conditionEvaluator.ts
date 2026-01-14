
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

// Internal result type that tracks waiting state
interface InternalConditionResult {
  result: boolean;
  waiting: boolean;
  waitingField?: string;
}

export class ConditionEvaluator {
  // Check if a value is considered "empty" and should trigger waiting state
  private static isEmptyValue(v: any): boolean {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') {
      const trimmed = v.trim().toLowerCase();
      return trimmed === '' || trimmed === 'n/a' || trimmed === 'na' || trimmed === 'null' || trimmed === 'undefined';
    }
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  }

  // Check if operator should bypass waiting logic (exists/not_exists are checking for emptiness intentionally)
  private static shouldBypassWaiting(operator: ComparisonOperator): boolean {
    return ['exists', 'not_exists'].includes(operator);
  }

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
    let internalResult: InternalConditionResult;

    // Check if it's an enhanced condition
    if (typeof config.condition === 'object' && 'systemType' in config.condition) {
      internalResult = this.evaluateEnhancedConditionWithWaiting(config.condition as EnhancedCondition, context);
    } else {
      internalResult = this.evaluateConditionGroupWithWaiting(config.condition as SimpleCondition | LogicalGroup, context);
    }
    
    // If condition is FALSE and we're waiting for a value, flag it
    if (!internalResult.result && internalResult.waiting) {
      return {
        success: true,
        result: false,
        evaluatedConditions: { conditionResult: false },
        waitingForValue: true,
        waitingFields: internalResult.waitingField ? [internalResult.waitingField] : []
      };
    }
    
    return {
      success: true,
      result: internalResult.result,
      evaluatedConditions: { conditionResult: internalResult.result }
    };
  }

  // Enhanced condition evaluation with waiting support
  private static evaluateEnhancedConditionWithWaiting(
    condition: EnhancedCondition,
    context: ConditionEvaluationContext
  ): InternalConditionResult {
    // Handle multiple conditions with individual logical operators
    if (condition.conditions && condition.conditions.length > 0) {
      const conditions = condition.conditions;
      
      // Evaluate all individual conditions with waiting support
      const conditionResults: InternalConditionResult[] = [];
      for (let i = 0; i < conditions.length; i++) {
        const result = this.evaluateSingleConditionItemWithWaiting(conditions[i], context);
        conditionResults.push(result);
      }

      // Check if any condition is waiting for a value
      const waitingResults = conditionResults.filter(r => r.waiting);
      if (waitingResults.length > 0) {
        const waitingFields = waitingResults.map(r => r.waitingField).filter(Boolean).join(', ');
        return { result: false, waiting: true, waitingField: waitingFields };
      }

      // All conditions have values, evaluate normally
      const boolResults: Record<string, boolean> = {};
      conditionResults.forEach((r, i) => {
        boolResults[String(i + 1)] = r.result;
      });

      // Use manual expression if enabled
      if (condition.useManualExpression && condition.manualExpression) {
        try {
          const result = ExpressionEvaluator.evaluate(condition.manualExpression, boolResults);
          return { result, waiting: false };
        } catch {
          // Fall back to sequential AND evaluation
        }
      }
      
      // Default: Chain with sequential logical operators
      let result = boolResults['1'];
      
      for (let i = 1; i < conditions.length; i++) {
        const prevCondition = conditions[i - 1];
        const currentResult = boolResults[String(i + 1)];
        const operator = prevCondition.logicalOperatorWithNext || 'AND';
        
        if (operator === 'AND') {
          result = result && currentResult;
        } else {
          result = result || currentResult;
        }
      }
      
      return { result, waiting: false };
    }

    // Fallback to single condition evaluation (backward compatibility)
    if (condition.systemType === 'form_level' && condition.formLevelCondition) {
      return this.evaluateFormLevelConditionWithWaiting(condition.formLevelCondition, context);
    } else if (condition.systemType === 'field_level' && condition.fieldLevelCondition) {
      return this.evaluateFieldLevelConditionWithWaiting(condition.fieldLevelCondition, context);
    }

    return { result: false, waiting: false };
  }

  private static evaluateEnhancedCondition(
    condition: EnhancedCondition,
    context: ConditionEvaluationContext
  ): boolean {
    return this.evaluateEnhancedConditionWithWaiting(condition, context).result;
  }

  private static evaluateSingleConditionItemWithWaiting(
    conditionItem: ConditionItem,
    context: ConditionEvaluationContext
  ): InternalConditionResult {
    if (conditionItem.systemType === 'form_level' && conditionItem.formLevelCondition) {
      return this.evaluateFormLevelConditionWithWaiting(conditionItem.formLevelCondition, context);
    } else if (conditionItem.systemType === 'field_level' && conditionItem.fieldLevelCondition) {
      return this.evaluateFieldLevelConditionWithWaiting(conditionItem.fieldLevelCondition, context);
    }
    return { result: false, waiting: false };
  }

  private static evaluateSingleConditionItem(
    conditionItem: ConditionItem,
    context: ConditionEvaluationContext
  ): boolean {
    return this.evaluateSingleConditionItemWithWaiting(conditionItem, context).result;
  }

  private static evaluateFormLevelConditionWithWaiting(
    condition: FormLevelCondition,
    context: ConditionEvaluationContext
  ): InternalConditionResult {
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
        return { result: false, waiting: false };
    }

    // Form-level conditions don't wait - they're system-level checks
    return { result: this.compareValues(actualValue, condition.value, condition.operator), waiting: false };
  }

  private static evaluateFormLevelCondition(
    condition: FormLevelCondition,
    context: ConditionEvaluationContext
  ): boolean {
    return this.evaluateFormLevelConditionWithWaiting(condition, context).result;
  }

  private static evaluateFieldLevelConditionWithWaiting(
    condition: FieldLevelCondition,
    context: ConditionEvaluationContext
  ): InternalConditionResult {
    // Get the field value from form data
    const fieldValue = context.formData[condition.fieldId];
    
    // Check if field value is empty and should trigger waiting (unless operator is exists/not_exists)
    if (!this.shouldBypassWaiting(condition.operator) && this.isEmptyValue(fieldValue)) {
      console.log(`⏳ Field "${condition.fieldId}" has empty value, should wait for actual value`);
      return { result: false, waiting: true, waitingField: condition.fieldId };
    }
    
    return { result: this.compareValues(fieldValue, condition.value, condition.operator), waiting: false };
  }

  private static evaluateFieldLevelCondition(
    condition: FieldLevelCondition,
    context: ConditionEvaluationContext
  ): boolean {
    return this.evaluateFieldLevelConditionWithWaiting(condition, context).result;
  }

  // Condition group evaluation with waiting support
  private static evaluateConditionGroupWithWaiting(
    condition: SimpleCondition | LogicalGroup, 
    context: ConditionEvaluationContext
  ): InternalConditionResult {
    if ('operator' in condition && 'leftOperand' in condition) {
      // Simple condition
      return this.evaluateSimpleConditionWithWaiting(condition, context);
    } else if ('operator' in condition && 'conditions' in condition) {
      // Logical group
      const group = condition as LogicalGroup;
      
      const results = group.conditions.map(cond => this.evaluateConditionGroupWithWaiting(cond, context));
      
      // Check for waiting conditions
      const waitingResults = results.filter(r => r.waiting);
      if (waitingResults.length > 0) {
        const waitingFields = waitingResults.map(r => r.waitingField).filter(Boolean).join(', ');
        return { result: false, waiting: true, waitingField: waitingFields };
      }
      
      if (group.operator === 'AND') {
        return { result: results.every(r => r.result), waiting: false };
      } else if (group.operator === 'OR') {
        return { result: results.some(r => r.result), waiting: false };
      }
    }
    
    return { result: false, waiting: false };
  }

  private static evaluateSimpleConditionWithWaiting(
    condition: SimpleCondition, 
    context: ConditionEvaluationContext
  ): InternalConditionResult {
    const leftValue = this.resolveFieldPath(condition.leftOperand, context);
    
    // Check if left operand is from form data and is empty
    if (condition.leftOperand.type === 'form' && this.isEmptyValue(leftValue)) {
      // Check if operator should bypass waiting
      if (!this.shouldBypassWaiting(condition.operator)) {
        console.log(`⏳ Field "${condition.leftOperand.path}" has empty value, should wait for actual value`);
        return { result: false, waiting: true, waitingField: condition.leftOperand.path };
      }
    }
    
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

    return { result: this.compareValues(leftValue, rightValue, condition.operator), waiting: false };
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
