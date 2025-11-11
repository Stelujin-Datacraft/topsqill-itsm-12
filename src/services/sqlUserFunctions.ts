/**
 * User-Defined Functions for SQL Queries
 * Allows users to create custom reusable functions
 */

export interface UserFunction {
  name: string;
  parameters: string[];
  returnType: string;
  body: string;
  implementation?: (...args: any[]) => any;
}

export class UserFunctionRegistry {
  private functions: Map<string, UserFunction> = new Map();
  
  /**
   * Parse and register a CREATE FUNCTION statement
   * Example: CREATE FUNCTION calculate_discount(@price DECIMAL, @percent INT) RETURNS DECIMAL AS BEGIN RETURN @price * @percent / 100 END
   */
  createFunction(statement: string): void {
    const funcMatch = statement.match(
      /CREATE\s+FUNCTION\s+(\w+)\s*\((.*?)\)\s+RETURNS\s+(\w+)\s+AS\s+BEGIN\s+([\s\S]+?)\s+END/i
    );
    
    if (!funcMatch) {
      throw new Error('Invalid CREATE FUNCTION syntax. Expected: CREATE FUNCTION name(params) RETURNS type AS BEGIN body END');
    }
    
    const [, name, paramsStr, returnType, body] = funcMatch;
    
    // Parse parameters
    const parameters: string[] = [];
    if (paramsStr.trim()) {
      const paramPairs = paramsStr.split(',').map(p => p.trim());
      paramPairs.forEach(pair => {
        const paramMatch = pair.match(/@(\w+)\s+\w+/);
        if (paramMatch) {
          parameters.push(paramMatch[1]);
        }
      });
    }
    
    // Create the function
    const userFunc: UserFunction = {
      name: name.toUpperCase(),
      parameters,
      returnType: returnType.toUpperCase(),
      body: body.trim(),
      implementation: this.compileFunction(parameters, body)
    };
    
    this.functions.set(userFunc.name, userFunc);
  }
  
  /**
   * Compile function body into executable JavaScript
   */
  private compileFunction(parameters: string[], body: string): (...args: any[]) => any {
    return (...args: any[]) => {
      // Create variable context
      const context = new Map<string, any>();
      parameters.forEach((param, index) => {
        context.set(param, args[index]);
      });
      
      // Replace variables in body
      let evaluatedBody = body;
      context.forEach((value, varName) => {
        const regex = new RegExp(`@${varName}\\b`, 'g');
        evaluatedBody = evaluatedBody.replace(regex, String(value));
      });
      
      // Extract RETURN statement
      const returnMatch = evaluatedBody.match(/RETURN\s+(.+)/i);
      if (!returnMatch) {
        throw new Error('Function body must contain a RETURN statement');
      }
      
      const returnExpr = returnMatch[1].trim();
      
      // Evaluate the return expression
      try {
        // Handle string concatenation
        if (returnExpr.includes('||')) {
          const parts = returnExpr.split('||').map(p => p.trim().replace(/['"]/g, ''));
          return parts.join('');
        }
        
        // Handle mathematical operations
        if (/^[\d\s\+\-\*\/\(\)\.]+$/.test(returnExpr)) {
          return Function(`"use strict"; return (${returnExpr})`)();
        }
        
        // Handle CASE statements
        if (returnExpr.toUpperCase().startsWith('CASE')) {
          return this.evaluateCaseStatement(returnExpr, context);
        }
        
        // Return as string
        if (returnExpr.startsWith("'") && returnExpr.endsWith("'")) {
          return returnExpr.slice(1, -1);
        }
        
        return returnExpr;
      } catch (e) {
        throw new Error(`Error evaluating function return: ${e}`);
      }
    };
  }
  
  /**
   * Evaluate CASE statements in function body
   */
  private evaluateCaseStatement(caseExpr: string, context: Map<string, any>): any {
    // Simple CASE evaluation
    const whenMatches = caseExpr.matchAll(/WHEN\s+(.+?)\s+THEN\s+(.+?)(?=\s+WHEN|\s+ELSE|\s+END)/gi);
    
    for (const match of whenMatches) {
      const [, condition, result] = match;
      if (this.evaluateCondition(condition.trim(), context)) {
        return this.parseValue(result.trim());
      }
    }
    
    // Check for ELSE clause
    const elseMatch = caseExpr.match(/ELSE\s+(.+?)\s+END/i);
    if (elseMatch) {
      return this.parseValue(elseMatch[1].trim());
    }
    
    return null;
  }
  
  /**
   * Evaluate a condition
   */
  private evaluateCondition(condition: string, context: Map<string, any>): boolean {
    let evaluated = condition;
    context.forEach((value, varName) => {
      const regex = new RegExp(`@${varName}\\b`, 'g');
      evaluated = evaluated.replace(regex, String(value));
    });
    
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
    
    return false;
  }
  
  /**
   * Parse a value
   */
  private parseValue(value: string): any {
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1);
    }
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
  
  /**
   * Check if a function exists
   */
  hasFunction(name: string): boolean {
    return this.functions.has(name.toUpperCase());
  }
  
  /**
   * Execute a user-defined function
   */
  executeFunction(name: string, args: any[]): any {
    const upperName = name.toUpperCase();
    const func = this.functions.get(upperName);
    
    if (!func) {
      throw new Error(`Function ${name} is not defined`);
    }
    
    if (!func.implementation) {
      throw new Error(`Function ${name} has no implementation`);
    }
    
    if (args.length !== func.parameters.length) {
      throw new Error(`Function ${name} expects ${func.parameters.length} arguments, got ${args.length}`);
    }
    
    return func.implementation(...args);
  }
  
  /**
   * Get all registered functions
   */
  getAllFunctions(): UserFunction[] {
    return Array.from(this.functions.values());
  }
  
  /**
   * Drop a function
   */
  dropFunction(name: string): boolean {
    return this.functions.delete(name.toUpperCase());
  }
  
  /**
   * Clear all functions
   */
  clear(): void {
    this.functions.clear();
  }
}

// Global registry instance
export const userFunctionRegistry = new UserFunctionRegistry();
