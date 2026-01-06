import { supabase } from '@/integrations/supabase/client';
import { replaceFieldReferencesInExpression, extractFieldIdsFromExpression } from './fieldReferenceParser';

export interface CalculationContext {
  formData: Record<string, any>;
  allSubmissions?: any[];
  targetFormId?: string;
}

export interface FunctionDefinition {
  name: string;
  category: string;
  description: string;
  syntax: string;
  example: string;
  minArgs?: number;
  maxArgs?: number;
}

export const CALCULATION_FUNCTIONS: FunctionDefinition[] = [
  // Basic Arithmetic
  { name: 'ADD', category: 'Basic Arithmetic', description: 'Adds two numbers', syntax: 'ADD(a, b)', example: 'ADD(#price, #tax)', minArgs: 2, maxArgs: 2 },
  { name: 'SUBTRACT', category: 'Basic Arithmetic', description: 'Subtracts second number from first', syntax: 'SUBTRACT(a, b)', example: 'SUBTRACT(#deadline, #current_time)', minArgs: 2, maxArgs: 2 },
  { name: 'MULTIPLY', category: 'Basic Arithmetic', description: 'Multiplies two numbers', syntax: 'MULTIPLY(a, b)', example: 'MULTIPLY(#cost_per_user, #users)', minArgs: 2, maxArgs: 2 },
  { name: 'DIVIDE', category: 'Basic Arithmetic', description: 'Divides first number by second', syntax: 'DIVIDE(a, b)', example: 'DIVIDE(#total_time, #count)', minArgs: 2, maxArgs: 2 },
  { name: 'MOD', category: 'Basic Arithmetic', description: 'Returns remainder of division', syntax: 'MOD(a, b)', example: 'MOD(#ticket_number, 2)', minArgs: 2, maxArgs: 2 },

  // Advanced Math
  { name: 'POWER', category: 'Advanced Math', description: 'Exponential calculation', syntax: 'POWER(base, exponent)', example: 'POWER(#growth_rate, #years)', minArgs: 2, maxArgs: 2 },
  { name: 'SQRT', category: 'Advanced Math', description: 'Square root of a number', syntax: 'SQRT(x)', example: 'SQRT(#variance)', minArgs: 1, maxArgs: 1 },
  { name: 'ABS', category: 'Advanced Math', description: 'Absolute value', syntax: 'ABS(x)', example: 'ABS(#deviation)', minArgs: 1, maxArgs: 1 },
  { name: 'ROUND', category: 'Advanced Math', description: 'Rounds to defined decimal points', syntax: 'ROUND(x, precision)', example: 'ROUND(#response_time, 2)', minArgs: 1, maxArgs: 2 },
  { name: 'FLOOR', category: 'Advanced Math', description: 'Rounds down to nearest integer', syntax: 'FLOOR(x)', example: 'FLOOR(#hours)', minArgs: 1, maxArgs: 1 },
  { name: 'CEIL', category: 'Advanced Math', description: 'Rounds up to nearest integer', syntax: 'CEIL(x)', example: 'CEIL(#escalation_level)', minArgs: 1, maxArgs: 1 },
  { name: 'MAX', category: 'Advanced Math', description: 'Returns the maximum value', syntax: 'MAX(a, b, c...)', example: 'MAX(#delay1, #delay2, #delay3)', minArgs: 2 },
  { name: 'MIN', category: 'Advanced Math', description: 'Returns the minimum value', syntax: 'MIN(a, b, c...)', example: 'MIN(#time1, #time2, #time3)', minArgs: 2 },
  { name: 'EXP', category: 'Advanced Math', description: 'e to the power x', syntax: 'EXP(x)', example: 'EXP(#growth_factor)', minArgs: 1, maxArgs: 1 },
  { name: 'LOG', category: 'Advanced Math', description: 'Natural logarithm', syntax: 'LOG(x)', example: 'LOG(#metric_value)', minArgs: 1, maxArgs: 1 },
  { name: 'LOG10', category: 'Advanced Math', description: 'Base-10 logarithm', syntax: 'LOG10(x)', example: 'LOG10(#large_value)', minArgs: 1, maxArgs: 1 },

  // Logical & Conditional
  { name: 'IF', category: 'Logical & Conditional', description: 'Conditional logic', syntax: 'IF(condition, trueValue, falseValue)', example: 'IF(#priority = "high", 2, 5)', minArgs: 3, maxArgs: 3 },
  { name: 'AND', category: 'Logical & Conditional', description: 'Logical AND', syntax: 'AND(cond1, cond2...)', example: 'AND(#overdue, #high_priority)', minArgs: 2 },
  { name: 'OR', category: 'Logical & Conditional', description: 'Logical OR', syntax: 'OR(cond1, cond2...)', example: 'OR(#vip_user, #critical_asset)', minArgs: 2 },
  { name: 'NOT', category: 'Logical & Conditional', description: 'Logical negation', syntax: 'NOT(condition)', example: 'NOT(#resolved)', minArgs: 1, maxArgs: 1 },
  { name: 'ISNULL', category: 'Logical & Conditional', description: 'Checks if a value is null', syntax: 'ISNULL(value)', example: 'ISNULL(#effort)', minArgs: 1, maxArgs: 1 },
  { name: 'IFNULL', category: 'Logical & Conditional', description: 'Returns value or default if null', syntax: 'IFNULL(value, default)', example: 'IFNULL(#effort, 0)', minArgs: 2, maxArgs: 2 },
  { name: 'SWITCH', category: 'Logical & Conditional', description: 'Multi-condition logic', syntax: 'SWITCH(expr, case1, val1, case2, val2, default)', example: 'SWITCH(#priority, "high", 1, "medium", 3, 5)', minArgs: 3 },

  // Date & Time
  { name: 'NOW', category: 'Date & Time', description: 'Current date/time', syntax: 'NOW()', example: 'NOW()', minArgs: 0, maxArgs: 0 },
  { name: 'TODAY', category: 'Date & Time', description: 'Current date without time', syntax: 'TODAY()', example: 'TODAY()', minArgs: 0, maxArgs: 0 },
  { name: 'DATEDIFF', category: 'Date & Time', description: 'Difference between dates', syntax: 'DATEDIFF(date1, date2, unit)', example: 'DATEDIFF(#deadline, NOW(), "days")', minArgs: 2, maxArgs: 3 },
  { name: 'DATEADD', category: 'Date & Time', description: 'Add time to a date', syntax: 'DATEADD(date, amount, unit)', example: 'DATEADD(#start_date, 3, "days")', minArgs: 3, maxArgs: 3 },
  { name: 'YEAR', category: 'Date & Time', description: 'Extract year from date', syntax: 'YEAR(date)', example: 'YEAR(#created_date)', minArgs: 1, maxArgs: 1 },
  { name: 'MONTH', category: 'Date & Time', description: 'Extract month from date', syntax: 'MONTH(date)', example: 'MONTH(#created_date)', minArgs: 1, maxArgs: 1 },
  { name: 'DAY', category: 'Date & Time', description: 'Extract day from date', syntax: 'DAY(date)', example: 'DAY(#created_date)', minArgs: 1, maxArgs: 1 },
  { name: 'HOUR', category: 'Date & Time', description: 'Extract hour from date', syntax: 'HOUR(date)', example: 'HOUR(#timestamp)', minArgs: 1, maxArgs: 1 },
  { name: 'MINUTE', category: 'Date & Time', description: 'Extract minute from date', syntax: 'MINUTE(date)', example: 'MINUTE(#timestamp)', minArgs: 1, maxArgs: 1 },
  { name: 'SECOND', category: 'Date & Time', description: 'Extract second from date', syntax: 'SECOND(date)', example: 'SECOND(#timestamp)', minArgs: 1, maxArgs: 1 },
  { name: 'WEEKDAY', category: 'Date & Time', description: 'Day of the week (1 = Sunday)', syntax: 'WEEKDAY(date)', example: 'WEEKDAY(#date)', minArgs: 1, maxArgs: 1 },
  { name: 'ISWEEKEND', category: 'Date & Time', description: 'Boolean for weekend', syntax: 'ISWEEKEND(date)', example: 'ISWEEKEND(#date)', minArgs: 1, maxArgs: 1 },

  // String & Conversion
  { name: 'LENGTH', category: 'String & Conversion', description: 'Length of a string', syntax: 'LENGTH(text)', example: 'LENGTH(#description)', minArgs: 1, maxArgs: 1 },
  { name: 'UPPER', category: 'String & Conversion', description: 'Convert to uppercase', syntax: 'UPPER(text)', example: 'UPPER(#category)', minArgs: 1, maxArgs: 1 },
  { name: 'LOWER', category: 'String & Conversion', description: 'Convert to lowercase', syntax: 'LOWER(text)', example: 'LOWER(#status)', minArgs: 1, maxArgs: 1 },
  { name: 'CONCAT', category: 'String & Conversion', description: 'Merge strings', syntax: 'CONCAT(str1, str2...)', example: 'CONCAT(#first_name, " ", #last_name)', minArgs: 2 },
  { name: 'SUBSTRING', category: 'String & Conversion', description: 'Extract part of string', syntax: 'SUBSTRING(text, start, length)', example: 'SUBSTRING(#id, 1, 5)', minArgs: 2, maxArgs: 3 },
  { name: 'TRIM', category: 'String & Conversion', description: 'Removes extra whitespace', syntax: 'TRIM(text)', example: 'TRIM(#input)', minArgs: 1, maxArgs: 1 },

  // Counting & Statistical
  { name: 'COUNT', category: 'Counting & Statistical', description: 'Number of elements', syntax: 'COUNT(field_id)', example: 'COUNT(#task_id)', minArgs: 1, maxArgs: 1 },
  { name: 'AVG', category: 'Counting & Statistical', description: 'Average value', syntax: 'AVG(field_id)', example: 'AVG(#resolution_time)', minArgs: 1, maxArgs: 1 },
  { name: 'SUM', category: 'Counting & Statistical', description: 'Total sum', syntax: 'SUM(field_id)', example: 'SUM(#cost)', minArgs: 1, maxArgs: 1 },
  { name: 'MEDIAN', category: 'Counting & Statistical', description: 'Median value', syntax: 'MEDIAN(field_id)', example: 'MEDIAN(#response_time)', minArgs: 1, maxArgs: 1 },
  { name: 'STDEV', category: 'Counting & Statistical', description: 'Standard deviation', syntax: 'STDEV(field_id)', example: 'STDEV(#scores)', minArgs: 1, maxArgs: 1 },

  // Other Utility
  { name: 'IN', category: 'Other Utility', description: 'Checks if value is in list', syntax: 'IN(value, list)', example: 'IN(#category, ["hardware", "software"])', minArgs: 2, maxArgs: 2 },
  { name: 'CONTAINS', category: 'Other Utility', description: 'True if text includes substring', syntax: 'CONTAINS(text, substring)', example: 'CONTAINS(#description, "urgent")', minArgs: 2, maxArgs: 2 },
  { name: 'FORMAT', category: 'Other Utility', description: 'Format number to currency, %, etc', syntax: 'FORMAT(number, pattern)', example: 'FORMAT(#amount, "$0.00")', minArgs: 2, maxArgs: 2 },
  { name: 'UUID', category: 'Other Utility', description: 'Generate unique identifier', syntax: 'UUID()', example: 'UUID()', minArgs: 0, maxArgs: 0 },
  { name: 'RANDOM', category: 'Other Utility', description: 'Generate random number', syntax: 'RANDOM(min, max)', example: 'RANDOM(1, 100)', minArgs: 0, maxArgs: 2 },
  { name: 'LOOKUP', category: 'Other Utility', description: 'Find value from mapping', syntax: 'LOOKUP(key, map)', example: 'LOOKUP(#priority, {"high": 1, "low": 5})', minArgs: 2, maxArgs: 2 },
  { name: 'REGEX', category: 'Other Utility', description: 'Regex match', syntax: 'REGEX(text, pattern)', example: 'REGEX(#email, "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$")', minArgs: 2, maxArgs: 2 },
  { name: 'TO_NUMBER', category: 'Other Utility', description: 'Convert to number', syntax: 'TO_NUMBER(value)', example: 'TO_NUMBER(#string_value)', minArgs: 1, maxArgs: 1 },
  { name: 'TO_STRING', category: 'Other Utility', description: 'Convert to string', syntax: 'TO_STRING(value)', example: 'TO_STRING(#number_value)', minArgs: 1, maxArgs: 1 },
  { name: 'TO_DATE', category: 'Other Utility', description: 'Convert to date', syntax: 'TO_DATE(value)', example: 'TO_DATE(#date_string)', minArgs: 1, maxArgs: 1 },
];

// Function implementations
export class CalculationEngine {
  private context: CalculationContext;

  constructor(context: CalculationContext) {
    this.context = context;
  }

  async evaluate(expression: string): Promise<any> {
    // Replace field references with actual values
    const processedExpression = await this.preprocessExpression(expression);
    
    // Parse and evaluate the expression
    return this.parseAndEvaluate(processedExpression);
  }

  private async preprocessExpression(expression: string): Promise<string> {
    let processed = expression;

    // Handle field references (#fieldid)
    const fieldRefRegex = /#([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = fieldRefRegex.exec(expression)) !== null) {
      const fieldId = match[1];
      const fieldValue = this.context.formData[fieldId];
      processed = processed.replace(match[0], JSON.stringify(fieldValue));
    }

    return processed;
  }

  private async parseAndEvaluate(expression: string): Promise<any> {
    try {
      // This is a simplified parser - in production, use a proper expression parser
      return this.evaluateFunction(expression);
    } catch (error) {
      throw new Error(`Calculation error: ${error.message}`);
    }
  }

  private async evaluateFunction(expression: string): Promise<any> {
    // Extract function calls
    const functionRegex = /([A-Z_]+)\s*\((.*?)\)/g;
    const match = functionRegex.exec(expression);
    
    if (!match) {
      // Not a function, try to parse as literal value
      return this.parseLiteral(expression);
    }

    const [, functionName, argsString] = match;
    const args = this.parseArguments(argsString);

    return this.executeFunction(functionName, args);
  }

  private parseArguments(argsString: string): any[] {
    if (!argsString.trim()) return [];
    
    // Simple argument parsing - in production, use proper parser
    return argsString.split(',').map(arg => {
      const trimmed = arg.trim();
      
      // Handle quoted strings
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1);
      }
      
      // Handle numbers
      if (!isNaN(Number(trimmed))) {
        return Number(trimmed);
      }
      
      // Handle booleans
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      
      // Handle null
      if (trimmed === 'null') return null;
      
      return trimmed;
    });
  }

  private parseLiteral(value: string): any {
    const trimmed = value.trim();
    
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    
    if (!isNaN(Number(trimmed))) {
      return Number(trimmed);
    }
    
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    
    return trimmed;
  }

  private async executeFunction(functionName: string, args: any[]): Promise<any> {
    switch (functionName) {
      // Basic Arithmetic
      case 'ADD': return args[0] + args[1];
      case 'SUBTRACT': return args[0] - args[1];
      case 'MULTIPLY': return args[0] * args[1];
      case 'DIVIDE': return args[1] !== 0 ? args[0] / args[1] : null;
      case 'MOD': return args[0] % args[1];

      // Advanced Math
      case 'POWER': return Math.pow(args[0], args[1]);
      case 'SQRT': return Math.sqrt(args[0]);
      case 'ABS': return Math.abs(args[0]);
      case 'ROUND': return args.length > 1 ? Number(args[0].toFixed(args[1])) : Math.round(args[0]);
      case 'FLOOR': return Math.floor(args[0]);
      case 'CEIL': return Math.ceil(args[0]);
      case 'MAX': return Math.max(...args);
      case 'MIN': return Math.min(...args);
      case 'EXP': return Math.exp(args[0]);
      case 'LOG': return Math.log(args[0]);
      case 'LOG10': return Math.log10(args[0]);

      // Logical & Conditional
      case 'IF': return args[0] ? args[1] : args[2];
      case 'AND': return args.every(Boolean);
      case 'OR': return args.some(Boolean);
      case 'NOT': return !args[0];
      case 'ISNULL': return args[0] == null;
      case 'IFNULL': return args[0] != null ? args[0] : args[1];
      case 'SWITCH': return this.executeSwitch(args);

      // Date & Time
      case 'NOW': return new Date();
      case 'TODAY': return new Date().toISOString().split('T')[0];
      case 'DATEDIFF': return this.executeDateDiff(args);
      case 'DATEADD': return this.executeDateAdd(args);
      case 'YEAR': return new Date(args[0]).getFullYear();
      case 'MONTH': return new Date(args[0]).getMonth() + 1;
      case 'DAY': return new Date(args[0]).getDate();
      case 'HOUR': return new Date(args[0]).getHours();
      case 'MINUTE': return new Date(args[0]).getMinutes();
      case 'SECOND': return new Date(args[0]).getSeconds();
      case 'WEEKDAY': return new Date(args[0]).getDay() + 1;
      case 'ISWEEKEND': return [6, 0].includes(new Date(args[0]).getDay());

      // String & Conversion
      case 'LENGTH': return String(args[0]).length;
      case 'UPPER': return String(args[0]).toUpperCase();
      case 'LOWER': return String(args[0]).toLowerCase();
      case 'CONCAT': return args.map(String).join('');
      case 'SUBSTRING': return String(args[0]).substring(args[1] - 1, args[2] ? args[1] - 1 + args[2] : undefined);
      case 'TRIM': return String(args[0]).trim();

      // Counting & Statistical (these work with all submissions)
      case 'COUNT': return this.executeAggregateFunction('COUNT', args[0]);
      case 'AVG': return this.executeAggregateFunction('AVG', args[0]);
      case 'SUM': return this.executeAggregateFunction('SUM', args[0]);
      case 'MEDIAN': return this.executeAggregateFunction('MEDIAN', args[0]);
      case 'STDEV': return this.executeAggregateFunction('STDEV', args[0]);

      // Other Utility
      case 'IN': return Array.isArray(args[1]) ? args[1].includes(args[0]) : false;
      case 'CONTAINS': return String(args[0]).includes(String(args[1]));
      case 'FORMAT': return this.executeFormat(args[0], args[1]);
      case 'UUID': return crypto.randomUUID();
      case 'RANDOM': return args.length === 0 ? Math.random() : Math.random() * (args[1] - args[0]) + args[0];
      case 'LOOKUP': return this.executeLookup(args[0], args[1]);
      case 'REGEX': return new RegExp(args[1]).test(String(args[0]));
      case 'TO_NUMBER': return Number(args[0]);
      case 'TO_STRING': return String(args[0]);
      case 'TO_DATE': return new Date(args[0]);

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  private executeSwitch(args: any[]): any {
    const expr = args[0];
    for (let i = 1; i < args.length - 1; i += 2) {
      if (expr === args[i]) {
        return args[i + 1];
      }
    }
    return args[args.length - 1]; // default value
  }

  private executeDateDiff(args: any[]): number {
    const date1 = new Date(args[0]);
    const date2 = new Date(args[1]);
    const unit = args[2] || 'days';
    
    const diffMs = date1.getTime() - date2.getTime();
    
    switch (unit) {
      case 'days': return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case 'hours': return Math.floor(diffMs / (1000 * 60 * 60));
      case 'minutes': return Math.floor(diffMs / (1000 * 60));
      case 'seconds': return Math.floor(diffMs / 1000);
      default: return diffMs;
    }
  }

  private executeDateAdd(args: any[]): Date {
    const date = new Date(args[0]);
    const amount = args[1];
    const unit = args[2];
    
    switch (unit) {
      case 'days': date.setDate(date.getDate() + amount); break;
      case 'hours': date.setHours(date.getHours() + amount); break;
      case 'minutes': date.setMinutes(date.getMinutes() + amount); break;
      case 'seconds': date.setSeconds(date.getSeconds() + amount); break;
    }
    
    return date;
  }

  private async executeAggregateFunction(functionName: string, fieldId: string): Promise<number> {
    if (!this.context.targetFormId) {
      throw new Error('Target form ID required for aggregate functions');
    }

    // Fetch all submissions for the target form
    const { data: submissions, error } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('form_id', this.context.targetFormId);

    if (error) {
      throw new Error(`Error fetching submissions: ${error.message}`);
    }

    // Extract field values from all submissions
    const values = submissions
      ?.map(sub => sub.submission_data?.[fieldId])
      .filter(val => val != null && !isNaN(Number(val)))
      .map(Number) || [];

    switch (functionName) {
      case 'COUNT': return values.length;
      case 'SUM': return values.reduce((sum, val) => sum + val, 0);
      case 'AVG': return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      case 'MEDIAN': return this.calculateMedian(values);
      case 'STDEV': return this.calculateStandardDeviation(values);
      default: return 0;
    }
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[middle - 1] + sorted[middle]) / 2 
      : sorted[middle];
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private executeFormat(number: number, pattern: string): string {
    if (pattern.startsWith('$')) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
    }
    if (pattern.includes('%')) {
      return `${(number * 100).toFixed(2)}%`;
    }
    return number.toString();
  }

  private executeLookup(key: any, map: any): any {
    if (typeof map === 'object' && map !== null) {
      return map[key];
    }
    return null;
  }
}

// Validation functions
export function validateExpression(expression: string, availableFields: string[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for field references
  const fieldRefRegex = /#([a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = fieldRefRegex.exec(expression)) !== null) {
    const fieldId = match[1];
    if (!availableFields.includes(fieldId)) {
      errors.push(`Field '${fieldId}' not found`);
    }
  }

  // Check for function syntax
  const functionRegex = /([A-Z_]+)\s*\(/g;
  while ((match = functionRegex.exec(expression)) !== null) {
    const functionName = match[1];
    const functionDef = CALCULATION_FUNCTIONS.find(f => f.name === functionName);
    if (!functionDef) {
      errors.push(`Unknown function '${functionName}'`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getAutoSuggestions(input: string, cursorPosition: number, availableFields: string[]): Array<{ label: string; insertText: string; detail: string }> {
  const suggestions = [];
  
  // Get word at cursor
  const beforeCursor = input.substring(0, cursorPosition);
  const afterCursor = input.substring(cursorPosition);
  const wordMatch = beforeCursor.match(/[A-Z_]*$/);
  const currentWord = wordMatch ? wordMatch[0] : '';

  // Function suggestions
  CALCULATION_FUNCTIONS.forEach(func => {
    if (func.name.startsWith(currentWord)) {
      suggestions.push({
        label: func.name,
        insertText: `${func.name}(${func.minArgs === 0 ? '' : 'arg1' + (func.minArgs > 1 ? ', arg2' : '')})`,
        detail: func.description
      });
    }
  });

  // Field suggestions when typing #
  if (beforeCursor.endsWith('#')) {
    availableFields.forEach(field => {
      suggestions.push({
        label: field,
        insertText: field,
        detail: `Field reference`
      });
    });
  }

  return suggestions;
}
