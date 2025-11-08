/**
 * SQL Function Evaluation for Client-Side Query Execution
 * This module provides JavaScript implementations of common SQL functions
 */

/**
 * String Functions
 */
export const stringFunctions = {
  CONCAT: (...args: any[]) => args.map(v => String(v ?? '')).join(''),
  LENGTH: (str: any) => String(str ?? '').length,
  LOWER: (str: any) => String(str ?? '').toLowerCase(),
  UPPER: (str: any) => String(str ?? '').toUpperCase(),
  TRIM: (str: any) => String(str ?? '').trim(),
  LTRIM: (str: any) => String(str ?? '').trimStart(),
  RTRIM: (str: any) => String(str ?? '').trimEnd(),
  SUBSTRING: (str: any, start: number, length?: number) => {
    const s = String(str ?? '');
    return length !== undefined ? s.substring(start - 1, start - 1 + length) : s.substring(start - 1);
  },
  REPLACE: (str: any, from: string, to: string) => String(str ?? '').replace(new RegExp(from, 'g'), to),
  LEFT: (str: any, n: number) => String(str ?? '').substring(0, n),
  RIGHT: (str: any, n: number) => {
    const s = String(str ?? '');
    return s.substring(Math.max(0, s.length - n));
  }
};

/**
 * Date & Time Functions
 */
export const dateFunctions = {
  NOW: () => new Date().toISOString(),
  CURRENT_TIMESTAMP: () => new Date().toISOString(),
  CURDATE: () => new Date().toISOString().split('T')[0],
  CURRENT_DATE: () => new Date().toISOString().split('T')[0],
  CURTIME: () => new Date().toISOString().split('T')[1].split('.')[0],
  CURRENT_TIME: () => new Date().toISOString().split('T')[1].split('.')[0],
  DATEDIFF: (date1: any, date2: any) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },
  DATE_ADD: (date: any, interval: number, unit: string) => {
    const d = new Date(date);
    switch (unit.toUpperCase()) {
      case 'DAY': d.setDate(d.getDate() + interval); break;
      case 'MONTH': d.setMonth(d.getMonth() + interval); break;
      case 'YEAR': d.setFullYear(d.getFullYear() + interval); break;
      case 'HOUR': d.setHours(d.getHours() + interval); break;
      case 'MINUTE': d.setMinutes(d.getMinutes() + interval); break;
      case 'SECOND': d.setSeconds(d.getSeconds() + interval); break;
    }
    return d.toISOString();
  },
  DATE_SUB: (date: any, interval: number, unit: string) => {
    return dateFunctions.DATE_ADD(date, -interval, unit);
  },
  YEAR: (date: any) => new Date(date).getFullYear(),
  MONTH: (date: any) => new Date(date).getMonth() + 1,
  DAY: (date: any) => new Date(date).getDate(),
  HOUR: (date: any) => new Date(date).getHours(),
  MINUTE: (date: any) => new Date(date).getMinutes(),
  SECOND: (date: any) => new Date(date).getSeconds()
};

/**
 * Mathematical Functions
 */
export const mathFunctions = {
  ABS: (n: any) => Math.abs(parseFloat(n) || 0),
  ROUND: (n: any, decimals: number = 0) => {
    const num = parseFloat(n) || 0;
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  },
  CEIL: (n: any) => Math.ceil(parseFloat(n) || 0),
  FLOOR: (n: any) => Math.floor(parseFloat(n) || 0),
  MOD: (a: any, b: any) => (parseFloat(a) || 0) % (parseFloat(b) || 1),
  POWER: (a: any, b: any) => Math.pow(parseFloat(a) || 0, parseFloat(b) || 0),
  SQRT: (n: any) => Math.sqrt(parseFloat(n) || 0),
  RAND: () => Math.random()
};

/**
 * Aggregate Functions
 */
export const aggregateFunctions = {
  COUNT: (values: any[]) => {
    // Handle COUNT(*) - count all rows, not just non-null values
    return values.length;
  },
  SUM: (values: any[]) => {
    const nums = values.filter(v => v != null && !isNaN(parseFloat(v))).map(v => parseFloat(v));
    return nums.reduce((sum, v) => sum + v, 0);
  },
  AVG: (values: any[]) => {
    const nums = values.filter(v => v != null && !isNaN(parseFloat(v))).map(v => parseFloat(v));
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  },
  MIN: (values: any[]) => {
    const nums = values.filter(v => v != null && !isNaN(parseFloat(v))).map(v => parseFloat(v));
    return nums.length > 0 ? Math.min(...nums) : null;
  },
  MAX: (values: any[]) => {
    const nums = values.filter(v => v != null && !isNaN(parseFloat(v))).map(v => parseFloat(v));
    return nums.length > 0 ? Math.max(...nums) : null;
  }
};

/**
 * Conditional Functions
 */
export const conditionalFunctions = {
  IF: (condition: any, trueValue: any, falseValue: any) => condition ? trueValue : falseValue,
  COALESCE: (...args: any[]) => args.find(v => v != null) ?? null,
  NULLIF: (a: any, b: any) => a === b ? null : a,
  IFNULL: (value: any, defaultValue: any) => value != null ? value : defaultValue,
  CASE: (condition: any, whenThen: any[], elseValue: any = null) => {
    // Simple CASE implementation for use in expressions
    // whenThen should be array of [condition, value] pairs
    for (let i = 0; i < whenThen.length; i += 2) {
      if (whenThen[i]) return whenThen[i + 1];
    }
    return elseValue;
  }
};

/**
 * Evaluate a SQL function call with given arguments
 */
export function evaluateFunction(funcName: string, args: any[]): any {
  const upperFuncName = funcName.toUpperCase();
  
  // Check each function category
  if (upperFuncName in stringFunctions) {
    return (stringFunctions as any)[upperFuncName](...args);
  }
  if (upperFuncName in dateFunctions) {
    return (dateFunctions as any)[upperFuncName](...args);
  }
  if (upperFuncName in mathFunctions) {
    return (mathFunctions as any)[upperFuncName](...args);
  }
  if (upperFuncName in conditionalFunctions) {
    return (conditionalFunctions as any)[upperFuncName](...args);
  }
  
  // If function not found, return first argument or null
  return args[0] ?? null;
}

/**
 * Parse and evaluate a SQL expression with functions and mathematical operations
 * Example: "UPPER(CONCAT(field1, ' ', field2))" or "price * quantity + 10"
 */
export function evaluateExpression(expr: string, row: any): any {
  expr = expr.trim();
  
  // First check if it contains mathematical operators
  if (containsMathOperators(expr)) {
    return evaluateMathExpression(expr, row);
  }
  
  // Handle function calls recursively
  const funcPattern = /(\w+)\((.*)\)/;
  const match = expr.match(funcPattern);
  
  if (!match) {
    // No function, evaluate as literal or field reference
    if (expr.startsWith("'") && expr.endsWith("'")) {
      return expr.slice(1, -1); // String literal
    }
    if (!isNaN(Number(expr))) {
      return Number(expr); // Numeric literal
    }
    return row[expr] ?? expr; // Field reference or literal
  }
  
  const [, funcName, argsStr] = match;
  
  // Parse arguments (simple comma split - doesn't handle nested functions perfectly)
  const args = splitArguments(argsStr).map(arg => {
    const trimmedArg = arg.trim();
    // Recursively evaluate each argument
    if (funcPattern.test(trimmedArg)) {
      return evaluateExpression(trimmedArg, row);
    }
    // Evaluate literals and field references
    if (trimmedArg.startsWith("'") && trimmedArg.endsWith("'")) {
      return trimmedArg.slice(1, -1);
    }
    if (!isNaN(Number(trimmedArg))) {
      return Number(trimmedArg);
    }
    return row[trimmedArg] ?? trimmedArg;
  });
  
  return evaluateFunction(funcName, args);
}

/**
 * Check if expression contains mathematical operators
 */
function containsMathOperators(expr: string): boolean {
  // Exclude operators inside quotes
  let inQuotes = false;
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if (char === "'" || char === '"') {
      inQuotes = !inQuotes;
    }
    if (!inQuotes && /[+\-*/%^]/.test(char)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluate mathematical expression with operators: +, -, *, /, %, ^
 * Uses Shunting-yard algorithm for proper operator precedence
 */
function evaluateMathExpression(expr: string, row: any): any {
  const tokens = tokenizeMathExpression(expr);
  const postfix = infixToPostfixMath(tokens, row);
  return evaluatePostfixMath(postfix);
}

/**
 * Tokenize mathematical expression
 */
function tokenizeMathExpression(expr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let depth = 0;
  
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    
    // Handle quotes
    if ((char === "'" || char === '"') && (i === 0 || expr[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
      current += char;
      continue;
    }
    
    if (inQuotes) {
      current += char;
      continue;
    }
    
    // Handle parentheses
    if (char === '(') {
      depth++;
      if (current && !/^[+\-*/%^]$/.test(current)) {
        // This is a function call, keep building
        current += char;
        continue;
      }
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      tokens.push(char);
      continue;
    }
    
    if (char === ')') {
      depth--;
      if (depth > 0) {
        current += char;
        continue;
      }
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      tokens.push(char);
      continue;
    }
    
    // Handle operators
    if (depth === 0 && /[+\-*/%^]/.test(char)) {
      // Check if it's a negative number (minus after operator or at start)
      if (char === '-' && (tokens.length === 0 || /[+\-*/%^(]/.test(tokens[tokens.length - 1]))) {
        current += char;
        continue;
      }
      
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      tokens.push(char);
      continue;
    }
    
    // Handle whitespace
    if (/\s/.test(char) && depth === 0) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    tokens.push(current.trim());
  }
  
  return tokens;
}

/**
 * Convert infix notation to postfix using Shunting-yard algorithm
 */
function infixToPostfixMath(tokens: string[], row: any): any[] {
  const output: any[] = [];
  const operators: string[] = [];
  const precedence: { [key: string]: number } = {
    '^': 4,
    '*': 3,
    '/': 3,
    '%': 3,
    '+': 2,
    '-': 2
  };
  const rightAssociative = new Set(['^']);
  
  for (const token of tokens) {
    // If token is a number
    if (!isNaN(Number(token))) {
      output.push(Number(token));
      continue;
    }
    
    // If token is an operator
    if (token in precedence) {
      while (
        operators.length > 0 &&
        operators[operators.length - 1] !== '(' &&
        operators[operators.length - 1] in precedence &&
        (
          (rightAssociative.has(token) && precedence[operators[operators.length - 1]] > precedence[token]) ||
          (!rightAssociative.has(token) && precedence[operators[operators.length - 1]] >= precedence[token])
        )
      ) {
        output.push(operators.pop()!);
      }
      operators.push(token);
      continue;
    }
    
    // If token is left parenthesis
    if (token === '(') {
      operators.push(token);
      continue;
    }
    
    // If token is right parenthesis
    if (token === ')') {
      while (operators.length > 0 && operators[operators.length - 1] !== '(') {
        output.push(operators.pop()!);
      }
      operators.pop(); // Remove the '('
      continue;
    }
    
    // Token is a field reference, string literal, or function call
    output.push(evaluateToken(token, row));
  }
  
  while (operators.length > 0) {
    output.push(operators.pop()!);
  }
  
  return output;
}

/**
 * Evaluate a single token (field reference, literal, or function)
 */
function evaluateToken(token: string, row: any): any {
  // String literal
  if (token.startsWith("'") && token.endsWith("'")) {
    return token.slice(1, -1);
  }
  
  // Function call
  if (token.includes('(')) {
    return evaluateExpression(token, row);
  }
  
  // Field reference
  return row[token] ?? token;
}

/**
 * Evaluate postfix expression
 */
function evaluatePostfixMath(postfix: any[]): any {
  const stack: number[] = [];
  
  for (const item of postfix) {
    if (typeof item === 'number') {
      stack.push(item);
      continue;
    }
    
    if (typeof item === 'string' && /[+\-*/%^]/.test(item)) {
      if (stack.length < 2) {
        throw new Error(`Invalid expression: insufficient operands for ${item}`);
      }
      const b = stack.pop()!;
      const a = stack.pop()!;
      
      switch (item) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': 
          if (b === 0) throw new Error('Division by zero');
          stack.push(a / b); 
          break;
        case '%': stack.push(a % b); break;
        case '^': stack.push(Math.pow(a, b)); break;
      }
      continue;
    }
    
    // It's a value (from field reference or function)
    const numValue = parseFloat(item);
    if (!isNaN(numValue)) {
      stack.push(numValue);
    } else {
      // Can't do math with non-numeric values
      return item;
    }
  }
  
  if (stack.length !== 1) {
    throw new Error('Invalid expression: malformed postfix notation');
  }
  
  return stack[0];
}

/**
 * Split function arguments by comma, respecting nested parentheses and quotes
 */
function splitArguments(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    
    if ((char === "'" || char === '"') && (i === 0 || argsStr[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
    }
    
    if (!inQuotes) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      
      if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
    }
    
    current += char;
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}
