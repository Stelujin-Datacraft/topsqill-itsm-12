
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

  // Helper to parse date/time values
  private static parseDateValue(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    
    const strValue = String(value).trim();
    if (!strValue) return null;
    
    // Try parsing as ISO date/datetime
    const date = new Date(strValue);
    if (!isNaN(date.getTime())) return date;
    
    return null;
  }

  // Helper to normalize time string for comparison (HH:MM:SS format)
  private static normalizeTime(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':').map(p => p.padStart(2, '0'));
    while (parts.length < 3) parts.push('00');
    return parts.slice(0, 3).join(':');
  }

  // Check if a value is a time string (HH:MM or HH:MM:SS)
  private static isTimeValue(value: any): boolean {
    if (typeof value !== 'string') return false;
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim());
  }

  // Get start and end of various time periods
  private static getDateRanges() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return {
      today: { start: today, end: tomorrow },
      yesterday: { 
        start: new Date(today.getTime() - 86400000), 
        end: today 
      },
      tomorrow: { 
        start: tomorrow, 
        end: new Date(tomorrow.getTime() + 86400000) 
      },
      currentWeek: {
        start: new Date(today.getTime() - today.getDay() * 86400000),
        end: new Date(today.getTime() + (7 - today.getDay()) * 86400000)
      },
      lastWeek: {
        start: new Date(today.getTime() - (today.getDay() + 7) * 86400000),
        end: new Date(today.getTime() - today.getDay() * 86400000)
      },
      nextWeek: {
        start: new Date(today.getTime() + (7 - today.getDay()) * 86400000),
        end: new Date(today.getTime() + (14 - today.getDay()) * 86400000)
      },
      currentMonth: {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      },
      lastMonth: {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 1)
      },
      nextMonth: {
        start: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        end: new Date(now.getFullYear(), now.getMonth() + 2, 1)
      },
      currentYear: {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear() + 1, 0, 1)
      },
      lastYear: {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear(), 0, 1)
      }
    };
  }

  private static compareValues(left: any, right: any, operator: ComparisonOperator): boolean {
    // Handle null/undefined cases
    if (left === null || left === undefined) {
      switch (operator) {
        case 'exists': return false;
        case 'not_exists': return true;
        // For relative date operators, null means condition is false
        case 'is_today': case 'is_yesterday': case 'is_tomorrow':
        case 'is_current_week': case 'is_last_week': case 'is_next_week':
        case 'is_current_month': case 'is_last_month': case 'is_next_month':
        case 'is_current_year': case 'is_last_year':
        case 'last_n_days': case 'next_n_days':
          return false;
        default: return false;
      }
    }

    if (right === null || right === undefined) {
      switch (operator) {
        case '==': return left === right;
        case '!=': return left !== right;
        // For date operators that don't need a value, continue evaluation
        case 'is_today': case 'is_yesterday': case 'is_tomorrow':
        case 'is_current_week': case 'is_last_week': case 'is_next_week':
        case 'is_current_month': case 'is_last_month': case 'is_next_month':
        case 'is_current_year': case 'is_last_year':
          break; // Continue to evaluate
        default: return false;
      }
    }

    // Helper to normalize a single value for comparison
    const normalizeValue = (v: any): string => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && !Array.isArray(v)) {
        // For objects like {label, value}, extract the value
        if ('value' in v) return String(v.value).toLowerCase().trim();
        if ('id' in v) return String(v.id).toLowerCase().trim();
        return JSON.stringify(v).toLowerCase();
      }
      return String(v).toLowerCase().trim();
    };

    // Helper to check if value exists in array (handles array of objects and primitives)
    const arrayContainsValue = (arr: any[], searchValue: string): boolean => {
      return arr.some(item => {
        const normalized = normalizeValue(item);
        return normalized === searchValue;
      });
    };

    // Helper to extract array of normalized values from left operand
    const getArrayValues = (v: any): string[] => {
      if (Array.isArray(v)) {
        return v.map(item => normalizeValue(item));
      }
      // Handle submission-access field format {users: [], groups: []}
      if (typeof v === 'object' && v !== null) {
        if ('users' in v && Array.isArray(v.users)) {
          return v.users.map((u: any) => normalizeValue(u));
        }
        if ('groups' in v && Array.isArray(v.groups)) {
          return v.groups.map((g: any) => normalizeValue(g));
        }
      }
      return [normalizeValue(v)];
    };

    const isLeftArray = Array.isArray(left) || (typeof left === 'object' && left !== null && ('users' in left || 'groups' in left));
    
    // Parse right operand if it's a JSON string (for multi-select conditions)
    let parsedRight = right;
    if (typeof right === 'string' && (right.startsWith('[') || right.startsWith('{'))) {
      try {
        parsedRight = JSON.parse(right);
      } catch {
        // Keep as string if not valid JSON
      }
    }
    const isRightArray = Array.isArray(parsedRight);
    
    const rightStr = normalizeValue(right);
    const leftNum = Number(left);
    const rightNum = Number(right);

    switch (operator) {
      case '==':
        if (isLeftArray && isRightArray) {
          // Both are arrays - check if ALL right values are in left AND same length (exact match)
          const leftValues = getArrayValues(left);
          const rightValues = getArrayValues(parsedRight);
          // For exact equality, lengths must match and all right values must be in left
          if (leftValues.length !== rightValues.length) return false;
          return rightValues.every(rv => leftValues.includes(rv));
        }
        if (isLeftArray) {
          // Left is array, right is single value - check if ONLY that value exists in array
          const leftValues = getArrayValues(left);
          // For equality, array should have exactly that one value
          return leftValues.length === 1 && leftValues.includes(rightStr);
        }
        if (isRightArray) {
          // Left is single value, right is array - check if left value is the ONLY value expected
          const rightValues = getArrayValues(parsedRight);
          return rightValues.length === 1 && rightValues.includes(normalizeValue(left));
        }
        return left === right || normalizeValue(left) === rightStr;
      case '!=':
        if (isLeftArray && isRightArray) {
          // Both are arrays - NOT equal means different lengths or different values
          const leftValues = getArrayValues(left);
          const rightValues = getArrayValues(parsedRight);
          if (leftValues.length !== rightValues.length) return true;
          return !rightValues.every(rv => leftValues.includes(rv));
        }
        if (isLeftArray) {
          // For array fields with != single value, true if array has more/less than just that value
          const leftValues = getArrayValues(left);
          return leftValues.length !== 1 || !leftValues.includes(rightStr);
        }
        if (isRightArray) {
          // Left is single value, right is array - not equal if not exactly that one value
          const rightValues = getArrayValues(parsedRight);
          return rightValues.length !== 1 || !rightValues.includes(normalizeValue(left));
        }
        return left !== right && normalizeValue(left) !== rightStr;
      case '<':
        return !isNaN(leftNum) && !isNaN(rightNum) ? leftNum < rightNum : normalizeValue(left) < rightStr;
      case '>':
        return !isNaN(leftNum) && !isNaN(rightNum) ? leftNum > rightNum : normalizeValue(left) > rightStr;
      case '<=':
        return !isNaN(leftNum) && !isNaN(rightNum) ? leftNum <= rightNum : normalizeValue(left) <= rightStr;
      case '>=':
        return !isNaN(leftNum) && !isNaN(rightNum) ? leftNum >= rightNum : normalizeValue(left) >= rightStr;
      case 'contains':
        if (isLeftArray) {
          // For array fields, check if any element contains the right value
          const leftValues = getArrayValues(left);
          return leftValues.some(v => v.includes(rightStr));
        }
        return normalizeValue(left).includes(rightStr);
      case 'not_contains':
        if (isLeftArray) {
          // For array fields, check if NO element contains the right value
          const leftValues = getArrayValues(left);
          return !leftValues.some(v => v.includes(rightStr));
        }
        return !normalizeValue(left).includes(rightStr);
      case 'starts_with':
        if (isLeftArray) {
          const leftValues = getArrayValues(left);
          return leftValues.some(v => v.startsWith(rightStr));
        }
        return normalizeValue(left).startsWith(rightStr);
      case 'ends_with':
        if (isLeftArray) {
          const leftValues = getArrayValues(left);
          return leftValues.some(v => v.endsWith(rightStr));
        }
        return normalizeValue(left).endsWith(rightStr);
      case 'in':
        if (isRightArray || Array.isArray(right)) {
          const rightValues = getArrayValues(parsedRight);
          if (isLeftArray) {
            // Check if ANY left value is in right array
            const leftValues = getArrayValues(left);
            return leftValues.some(lv => rightValues.includes(lv));
          }
          return rightValues.includes(normalizeValue(left));
        }
        const rightList = rightStr.split(',').map(s => s.trim().toLowerCase());
        if (isLeftArray) {
          const leftValues = getArrayValues(left);
          return leftValues.some(lv => rightList.includes(lv));
        }
        return rightList.includes(normalizeValue(left));
      case 'not_in':
        if (isRightArray || Array.isArray(right)) {
          const rightValues = getArrayValues(parsedRight);
          if (isLeftArray) {
            // Check if NO left value is in right array
            const leftValues = getArrayValues(left);
            return !leftValues.some(lv => rightValues.includes(lv));
          }
          return !rightValues.includes(normalizeValue(left));
        }
        const rightListNot = rightStr.split(',').map(s => s.trim().toLowerCase());
        if (isLeftArray) {
          const leftValues = getArrayValues(left);
          return !leftValues.some(lv => rightListNot.includes(lv));
        }
        return !rightListNot.includes(normalizeValue(left));
      case 'exists':
        if (isLeftArray) {
          const leftValues = getArrayValues(left);
          return leftValues.length > 0 && leftValues.some(v => v !== '');
        }
        return left !== null && left !== undefined && left !== '';
      case 'not_exists':
        if (isLeftArray) {
          const leftValues = getArrayValues(left);
          return leftValues.length === 0 || leftValues.every(v => v === '');
        }
        return left === null || left === undefined || left === '';

      // Date/Time comparison operators
      case 'after': {
        // Handle time-only comparison
        if (this.isTimeValue(left) && this.isTimeValue(right)) {
          return this.normalizeTime(String(left)) > this.normalizeTime(String(right));
        }
        const leftDate = this.parseDateValue(left);
        const rightDate = this.parseDateValue(right);
        if (!leftDate || !rightDate) return false;
        return leftDate > rightDate;
      }
      case 'before': {
        if (this.isTimeValue(left) && this.isTimeValue(right)) {
          return this.normalizeTime(String(left)) < this.normalizeTime(String(right));
        }
        const leftDate = this.parseDateValue(left);
        const rightDate = this.parseDateValue(right);
        if (!leftDate || !rightDate) return false;
        return leftDate < rightDate;
      }
      case 'on_or_after': {
        if (this.isTimeValue(left) && this.isTimeValue(right)) {
          return this.normalizeTime(String(left)) >= this.normalizeTime(String(right));
        }
        const leftDate = this.parseDateValue(left);
        const rightDate = this.parseDateValue(right);
        if (!leftDate || !rightDate) return false;
        return leftDate >= rightDate;
      }
      case 'on_or_before': {
        if (this.isTimeValue(left) && this.isTimeValue(right)) {
          return this.normalizeTime(String(left)) <= this.normalizeTime(String(right));
        }
        const leftDate = this.parseDateValue(left);
        const rightDate = this.parseDateValue(right);
        if (!leftDate || !rightDate) return false;
        return leftDate <= rightDate;
      }
      case 'between': {
        const parts = String(right).split(',').map(v => v.trim());
        if (parts.length !== 2) return false;
        const [startStr, endStr] = parts;

        // Handle time-only comparison
        if (this.isTimeValue(left)) {
          const leftTime = this.normalizeTime(String(left));
          const startTime = this.normalizeTime(startStr);
          const endTime = this.normalizeTime(endStr);
          return leftTime >= startTime && leftTime <= endTime;
        }

        // Handle numeric comparison
        const numValue = parseFloat(String(left));
        if (!isNaN(numValue)) {
          const numStart = parseFloat(startStr);
          const numEnd = parseFloat(endStr);
          if (!isNaN(numStart) && !isNaN(numEnd)) {
            return numValue >= numStart && numValue <= numEnd;
          }
        }

        // Handle date comparison
        const leftDate = this.parseDateValue(left);
        const startDate = this.parseDateValue(startStr);
        const endDate = this.parseDateValue(endStr);
        if (leftDate && startDate && endDate) {
          return leftDate >= startDate && leftDate <= endDate;
        }
        return false;
      }

      // Relative date operators
      case 'is_today': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { today } = this.getDateRanges();
        return leftDate >= today.start && leftDate < today.end;
      }
      case 'is_yesterday': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { yesterday } = this.getDateRanges();
        return leftDate >= yesterday.start && leftDate < yesterday.end;
      }
      case 'is_tomorrow': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { tomorrow } = this.getDateRanges();
        return leftDate >= tomorrow.start && leftDate < tomorrow.end;
      }
      case 'is_current_week': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { currentWeek } = this.getDateRanges();
        return leftDate >= currentWeek.start && leftDate < currentWeek.end;
      }
      case 'is_last_week': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { lastWeek } = this.getDateRanges();
        return leftDate >= lastWeek.start && leftDate < lastWeek.end;
      }
      case 'is_next_week': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { nextWeek } = this.getDateRanges();
        return leftDate >= nextWeek.start && leftDate < nextWeek.end;
      }
      case 'is_current_month': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { currentMonth } = this.getDateRanges();
        return leftDate >= currentMonth.start && leftDate < currentMonth.end;
      }
      case 'is_last_month': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { lastMonth } = this.getDateRanges();
        return leftDate >= lastMonth.start && leftDate < lastMonth.end;
      }
      case 'is_next_month': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { nextMonth } = this.getDateRanges();
        return leftDate >= nextMonth.start && leftDate < nextMonth.end;
      }
      case 'is_current_year': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { currentYear } = this.getDateRanges();
        return leftDate >= currentYear.start && leftDate < currentYear.end;
      }
      case 'is_last_year': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const { lastYear } = this.getDateRanges();
        return leftDate >= lastYear.start && leftDate < lastYear.end;
      }
      case 'last_n_days': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const nDays = parseInt(String(right), 10);
        if (isNaN(nDays) || nDays <= 0) return false;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startDate = new Date(today.getTime() - nDays * 86400000);
        return leftDate >= startDate && leftDate < new Date(today.getTime() + 86400000);
      }
      case 'next_n_days': {
        const leftDate = this.parseDateValue(left);
        if (!leftDate) return false;
        const nDays = parseInt(String(right), 10);
        if (isNaN(nDays) || nDays <= 0) return false;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endDate = new Date(today.getTime() + (nDays + 1) * 86400000);
        return leftDate >= today && leftDate < endDate;
      }

      default:
        return false;
    }
  }
}
