/**
 * SQL Loop Support for Client-Side Query Execution
 * Implements WHILE loops and iterative operations
 */

export interface LoopContext {
  variables: Map<string, any>;
  maxIterations: number;
  currentIteration: number;
}

/**
 * Initialize a loop context with variables
 */
export function createLoopContext(initialVars: Record<string, any> = {}): LoopContext {
  const variables = new Map<string, any>();
  Object.entries(initialVars).forEach(([key, value]) => {
    variables.set(key, value);
  });
  
  return {
    variables,
    maxIterations: 1000, // Safety limit
    currentIteration: 0
  };
}

/**
 * Parse and execute DECLARE statements
 * Example: DECLARE @counter INT = 0
 */
export function executeDeclare(statement: string, context: LoopContext): void {
  const declareMatch = statement.match(/DECLARE\s+@(\w+)\s+(\w+)(?:\s*=\s*(.+))?/i);
  if (!declareMatch) {
    throw new Error('Invalid DECLARE syntax. Expected: DECLARE @variable_name TYPE [= value]');
  }
  
  const [, varName, varType, initialValue] = declareMatch;
  let value: any = null;
  
  if (initialValue) {
    value = parseValue(initialValue.trim(), varType);
  }
  
  context.variables.set(varName, value);
}

/**
 * Parse and execute SET statements
 * Example: SET @counter = @counter + 1
 */
export function executeSet(statement: string, context: LoopContext): void {
  const setMatch = statement.match(/SET\s+@(\w+)\s*=\s*(.+)/i);
  if (!setMatch) {
    throw new Error('Invalid SET syntax. Expected: SET @variable_name = expression');
  }
  
  const [, varName, expression] = setMatch;
  const value = evaluateExpression(expression.trim(), context);
  context.variables.set(varName, value);
}

/**
 * Parse and execute IF-ELSE statements
 * Example: IF @score >= 80 BEGIN SET @result = 'Pass' END ELSE BEGIN SET @result = 'Fail' END
 */
export function executeIfElse(
  statement: string,
  context: LoopContext,
  executeBlock: (blockStatements: string[], context: LoopContext) => any[]
): any[] {
  // Match IF condition with optional ELSE IF and ELSE blocks
  const ifMatch = statement.match(/IF\s+(.+?)\s+BEGIN\s+([\s\S]+?)\s+END/i);
  if (!ifMatch) {
    throw new Error('Invalid IF syntax. Expected: IF condition BEGIN statements END [ELSE IF condition BEGIN statements END] [ELSE BEGIN statements END]');
  }

  const [, condition, ifBlock] = ifMatch;
  
  // Check if condition is true
  if (evaluateCondition(condition.trim(), context)) {
    // Execute IF block
    const statements = ifBlock
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return executeBlock(statements, context);
  }
  
  // Check for ELSE IF blocks
  const elseIfRegex = /ELSE\s+IF\s+(.+?)\s+BEGIN\s+([\s\S]+?)\s+END/gi;
  let elseIfMatch;
  const remainingStatement = statement.substring(ifMatch.index! + ifMatch[0].length);
  
  while ((elseIfMatch = elseIfRegex.exec(remainingStatement)) !== null) {
    const [, elseIfCondition, elseIfBlock] = elseIfMatch;
    
    if (evaluateCondition(elseIfCondition.trim(), context)) {
      const statements = elseIfBlock
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      return executeBlock(statements, context);
    }
  }
  
  // Check for ELSE block
  const elseMatch = remainingStatement.match(/ELSE\s+BEGIN\s+([\s\S]+?)\s+END/i);
  if (elseMatch) {
    const [, elseBlock] = elseMatch;
    const statements = elseBlock
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return executeBlock(statements, context);
  }
  
  return [];
}

/**
 * Parse and execute WHILE loops
 * Example: WHILE @counter < 10 BEGIN ... END
 */
export function executeWhileLoop(
  statement: string, 
  context: LoopContext,
  executeBlock: (blockStatements: string[], context: LoopContext) => any[]
): any[] {
  const whileMatch = statement.match(/WHILE\s+(.+?)\s+BEGIN\s+([\s\S]+?)\s+END/i);
  if (!whileMatch) {
    throw new Error('Invalid WHILE syntax. Expected: WHILE condition BEGIN statements END');
  }
  
  const [, condition, blockContent] = whileMatch;
  const results: any[] = [];
  
  context.currentIteration = 0;
  
  while (evaluateCondition(condition.trim(), context)) {
    if (context.currentIteration >= context.maxIterations) {
      throw new Error(`Loop exceeded maximum iterations (${context.maxIterations})`);
    }
    
    // Split block into individual statements
    const statements = blockContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const blockResults = executeBlock(statements, context);
    results.push(...blockResults);
    
    context.currentIteration++;
  }
  
  return results;
}

/**
 * Evaluate a condition expression
 */
function evaluateCondition(condition: string, context: LoopContext): boolean {
  // Replace variables with their values
  let evaluated = condition;
  context.variables.forEach((value, varName) => {
    const regex = new RegExp(`@${varName}\\b`, 'g');
    evaluated = evaluated.replace(regex, String(value));
  });
  
  // Evaluate comparison operators
  const operators = [
    { op: '<=', fn: (a: any, b: any) => Number(a) <= Number(b) },
    { op: '>=', fn: (a: any, b: any) => Number(a) >= Number(b) },
    { op: '<>', fn: (a: any, b: any) => a !== b },
    { op: '!=', fn: (a: any, b: any) => a !== b },
    { op: '<', fn: (a: any, b: any) => Number(a) < Number(b) },
    { op: '>', fn: (a: any, b: any) => Number(a) > Number(b) },
    { op: '=', fn: (a: any, b: any) => a == b }
  ];
  
  for (const { op, fn } of operators) {
    if (evaluated.includes(op)) {
      const [left, right] = evaluated.split(op).map(s => s.trim());
      const leftVal = parseFloat(left);
      const rightVal = parseFloat(right);
      
      if (!isNaN(leftVal) && !isNaN(rightVal)) {
        return fn(leftVal, rightVal);
      }
      return fn(left, right);
    }
  }
  
  // Check for boolean expressions
  if (evaluated === 'TRUE' || evaluated === '1') return true;
  if (evaluated === 'FALSE' || evaluated === '0') return false;
  
  return false;
}

/**
 * Evaluate an expression with variables
 */
function evaluateExpression(expression: string, context: LoopContext): any {
  let evaluated = expression;
  
  // Replace variables with their values
  context.variables.forEach((value, varName) => {
    const regex = new RegExp(`@${varName}\\b`, 'g');
    evaluated = evaluated.replace(regex, String(value));
  });
  
  // Try to evaluate as mathematical expression
  try {
    // Handle string concatenation
    if (evaluated.includes('||')) {
      const parts = evaluated.split('||').map(p => p.trim().replace(/['"]/g, ''));
      return parts.join('');
    }
    
    // Handle mathematical operations
    if (/^[\d\s\+\-\*\/\(\)\.]+$/.test(evaluated)) {
      return Function(`"use strict"; return (${evaluated})`)();
    }
    
    // Return as-is if it's a string literal
    if (evaluated.startsWith("'") && evaluated.endsWith("'")) {
      return evaluated.slice(1, -1);
    }
    
    return evaluated;
  } catch (e) {
    return evaluated;
  }
}

/**
 * Parse a value based on its type
 */
function parseValue(value: string, type: string): any {
  const upperType = type.toUpperCase();
  
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  
  switch (upperType) {
    case 'INT':
    case 'INTEGER':
    case 'BIGINT':
      return parseInt(value);
    case 'FLOAT':
    case 'DECIMAL':
    case 'NUMERIC':
      return parseFloat(value);
    case 'BOOLEAN':
    case 'BOOL':
      return value.toUpperCase() === 'TRUE' || value === '1';
    case 'VARCHAR':
    case 'TEXT':
    case 'STRING':
    default:
      return value;
  }
}

/**
 * Extract variable value from context
 */
export function getVariable(varName: string, context: LoopContext): any {
  if (!context.variables.has(varName)) {
    throw new Error(`Variable @${varName} is not defined`);
  }
  return context.variables.get(varName);
}

/**
 * Replace all variables in a SQL statement with their values
 */
export function replaceVariables(sql: string, context: LoopContext): string {
  let result = sql;
  context.variables.forEach((value, varName) => {
    const regex = new RegExp(`@${varName}\\b`, 'g');
    const replacement = typeof value === 'string' ? `'${value}'` : String(value);
    result = result.replace(regex, replacement);
  });
  return result;
}
