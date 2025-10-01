/**
 * Expression Evaluator for Logical Rules
 * Supports AND, OR, NOT operators with parentheses for precedence
 * Examples: "1 AND 2", "1 OR (2 AND 3)", "NOT 1 AND (2 OR 3)"
 */

export interface EvaluationContext {
  [conditionId: string]: boolean;
}

export class ExpressionEvaluator {
  /**
   * Evaluates a logical expression string with condition results
   * @param expression - The logical expression (e.g., "1 AND (2 OR 3) AND NOT 4")
   * @param context - Map of condition IDs/numbers to their boolean results
   * @returns The evaluated result
   */
  static evaluate(expression: string, context: EvaluationContext): boolean {
    try {
      // Normalize the expression
      const normalized = this.normalizeExpression(expression);
      
      // Tokenize
      const tokens = this.tokenize(normalized);
      
      // Convert to postfix notation (Reverse Polish Notation)
      const postfix = this.infixToPostfix(tokens);
      
      // Evaluate postfix expression
      return this.evaluatePostfix(postfix, context);
    } catch (error) {
      console.error('Expression evaluation error:', error);
      throw new Error(`Failed to evaluate expression: ${expression}`);
    }
  }

  /**
   * Validates if an expression is syntactically correct
   */
  static validate(expression: string): { valid: boolean; error?: string } {
    try {
      const normalized = this.normalizeExpression(expression);
      const tokens = this.tokenize(normalized);
      
      // Check for balanced parentheses
      let parenCount = 0;
      for (const token of tokens) {
        if (token === '(') parenCount++;
        if (token === ')') parenCount--;
        if (parenCount < 0) {
          return { valid: false, error: 'Unbalanced parentheses' };
        }
      }
      if (parenCount !== 0) {
        return { valid: false, error: 'Unbalanced parentheses' };
      }

      // Check for valid token sequence
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const nextToken = tokens[i + 1];

        // Operand followed by operand without operator
        if (this.isOperand(token) && nextToken && this.isOperand(nextToken)) {
          return { valid: false, error: 'Missing operator between conditions' };
        }

        // Operator at the end (except NOT at the end before closing paren)
        if (i === tokens.length - 1 && this.isBinaryOperator(token)) {
          return { valid: false, error: 'Expression cannot end with a binary operator' };
        }

        // Two binary operators in a row
        if (this.isBinaryOperator(token) && nextToken && this.isBinaryOperator(nextToken)) {
          return { valid: false, error: 'Invalid operator sequence' };
        }
      }

      // Try converting to postfix (will throw if invalid)
      this.infixToPostfix(tokens);
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid expression' 
      };
    }
  }

  /**
   * Extracts all condition IDs from an expression
   */
  static extractConditionIds(expression: string): string[] {
    const normalized = this.normalizeExpression(expression);
    const tokens = this.tokenize(normalized);
    return tokens.filter(token => this.isOperand(token));
  }

  /**
   * Normalizes the expression by standardizing operators and whitespace
   */
  private static normalizeExpression(expression: string): string {
    return expression
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenizes the expression into an array of tokens
   */
  private static tokenize(expression: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      if (char === ' ') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else if (char === '(' || char === ')') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Converts infix notation to postfix (Reverse Polish Notation)
   * Uses the Shunting Yard algorithm
   */
  private static infixToPostfix(tokens: string[]): string[] {
    const output: string[] = [];
    const operators: string[] = [];

    for (const token of tokens) {
      if (this.isOperand(token)) {
        output.push(token);
      } else if (token === 'NOT') {
        operators.push(token);
      } else if (token === 'AND' || token === 'OR') {
        while (
          operators.length > 0 &&
          operators[operators.length - 1] !== '(' &&
          this.getPrecedence(operators[operators.length - 1]) >= this.getPrecedence(token)
        ) {
          output.push(operators.pop()!);
        }
        operators.push(token);
      } else if (token === '(') {
        operators.push(token);
      } else if (token === ')') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
          output.push(operators.pop()!);
        }
        if (operators.length === 0) {
          throw new Error('Mismatched parentheses');
        }
        operators.pop(); // Remove the '('
      } else {
        throw new Error(`Invalid token: ${token}`);
      }
    }

    while (operators.length > 0) {
      const op = operators.pop()!;
      if (op === '(' || op === ')') {
        throw new Error('Mismatched parentheses');
      }
      output.push(op);
    }

    return output;
  }

  /**
   * Evaluates a postfix expression
   */
  private static evaluatePostfix(postfix: string[], context: EvaluationContext): boolean {
    const stack: boolean[] = [];

    for (const token of postfix) {
      if (this.isOperand(token)) {
        // Look up the condition result in context
        const result = context[token];
        if (result === undefined) {
          throw new Error(`Condition ${token} not found in evaluation context`);
        }
        stack.push(result);
      } else if (token === 'NOT') {
        if (stack.length < 1) {
          throw new Error('Invalid expression: NOT requires one operand');
        }
        const operand = stack.pop()!;
        stack.push(!operand);
      } else if (token === 'AND') {
        if (stack.length < 2) {
          throw new Error('Invalid expression: AND requires two operands');
        }
        const right = stack.pop()!;
        const left = stack.pop()!;
        stack.push(left && right);
      } else if (token === 'OR') {
        if (stack.length < 2) {
          throw new Error('Invalid expression: OR requires two operands');
        }
        const right = stack.pop()!;
        const left = stack.pop()!;
        stack.push(left || right);
      } else {
        throw new Error(`Unknown operator: ${token}`);
      }
    }

    if (stack.length !== 1) {
      throw new Error('Invalid expression: malformed expression');
    }

    return stack[0];
  }

  /**
   * Checks if a token is an operand (condition ID)
   */
  private static isOperand(token: string): boolean {
    return token !== 'AND' && token !== 'OR' && token !== 'NOT' && token !== '(' && token !== ')';
  }

  /**
   * Checks if a token is a binary operator
   */
  private static isBinaryOperator(token: string): boolean {
    return token === 'AND' || token === 'OR';
  }

  /**
   * Gets operator precedence (higher number = higher precedence)
   */
  private static getPrecedence(operator: string): number {
    switch (operator) {
      case 'NOT':
        return 3;
      case 'AND':
        return 2;
      case 'OR':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Generates a default expression for a given number of conditions
   * Uses AND by default
   */
  static generateDefaultExpression(conditionCount: number, logic: 'AND' | 'OR' = 'AND'): string {
    if (conditionCount === 0) return '';
    if (conditionCount === 1) return '1';
    
    const conditions = Array.from({ length: conditionCount }, (_, i) => (i + 1).toString());
    return conditions.join(` ${logic} `);
  }
}
