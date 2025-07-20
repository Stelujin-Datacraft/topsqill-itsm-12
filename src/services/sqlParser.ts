export interface Token {
  type: 'SELECT' | 'FROM' | 'WHERE' | 'AND' | 'OR' | 'COUNT' | 'SUM' | 'AVG' | 'FIELD_ID' | 'FORM_ID' | 'STRING' | 'NUMBER' | 'OPERATOR' | 'COMMA' | 'SEMICOLON' | 'LPAREN' | 'RPAREN' | 'UNKNOWN';
  value: string;
  position: number;
}

export interface SelectClause {
  type: 'select';
  fields: string[];
  aggregates: Array<{ function: string; field?: string }>;
}

export interface FromClause {
  type: 'from';
  formId: string;
}

export interface WhereCondition {
  field: string;
  operator: string;
  value: string | number;
}

export interface WhereClause {
  type: 'where';
  conditions: WhereCondition[];
  operators: ('AND' | 'OR')[];
}

export interface ParsedQuery {
  select: SelectClause;
  from: FromClause;
  where?: WhereClause;
}

export interface ParseError {
  message: string;
  position: number;
  type: 'syntax' | 'validation' | 'unknown_field' | 'unknown_form';
}

export interface ParseResult {
  sql?: string;
  errors: ParseError[];
  ast?: ParsedQuery;
}

const KEYWORDS = new Set(['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'COUNT', 'SUM', 'AVG']);
const OPERATORS = new Set(['=', '!=', '<>', '>', '<', '>=', '<=']);
const ALLOWED_FUNCTIONS = new Set(['COUNT', 'SUM', 'AVG']);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  
  while (position < input.length) {
    const char = input[position];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      position++;
      continue;
    }
    
    // Handle quoted strings (field IDs, form IDs, string literals)
    if (char === '"' || char === "'") {
      const quote = char;
      const start = position;
      position++; // Skip opening quote
      
      let value = '';
      while (position < input.length && input[position] !== quote) {
        value += input[position];
        position++;
      }
      
      if (position >= input.length) {
        tokens.push({ type: 'UNKNOWN', value: input.substring(start), position: start });
        break;
      }
      
      position++; // Skip closing quote
      
      // Determine if it's a UUID (field/form ID) or string literal
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      tokens.push({
        type: isUUID ? (tokens.length > 0 && tokens[tokens.length - 1].type === 'FROM' ? 'FORM_ID' : 'FIELD_ID') : 'STRING',
        value,
        position: start
      });
      continue;
    }
    
    // Handle numbers
    if (/\d/.test(char)) {
      const start = position;
      let value = '';
      while (position < input.length && /[\d.]/.test(input[position])) {
        value += input[position];
        position++;
      }
      tokens.push({ type: 'NUMBER', value, position: start });
      continue;
    }
    
    // Handle operators
    if (char === '!' && position + 1 < input.length && input[position + 1] === '=') {
      tokens.push({ type: 'OPERATOR', value: '!=', position });
      position += 2;
      continue;
    }
    
    if (char === '<' && position + 1 < input.length && input[position + 1] === '>') {
      tokens.push({ type: 'OPERATOR', value: '<>', position });
      position += 2;
      continue;
    }
    
    if (char === '>' && position + 1 < input.length && input[position + 1] === '=') {
      tokens.push({ type: 'OPERATOR', value: '>=', position });
      position += 2;
      continue;
    }
    
    if (char === '<' && position + 1 < input.length && input[position + 1] === '=') {
      tokens.push({ type: 'OPERATOR', value: '<=', position });
      position += 2;
      continue;
    }
    
    if (OPERATORS.has(char)) {
      tokens.push({ type: 'OPERATOR', value: char, position });
      position++;
      continue;
    }
    
    // Handle single character tokens
    switch (char) {
      case ',':
        tokens.push({ type: 'COMMA', value: char, position });
        position++;
        continue;
      case ';':
        tokens.push({ type: 'SEMICOLON', value: char, position });
        position++;
        continue;
      case '(':
        tokens.push({ type: 'LPAREN', value: char, position });
        position++;
        continue;
      case ')':
        tokens.push({ type: 'RPAREN', value: char, position });
        position++;
        continue;
    }
    
    // Handle words (keywords, identifiers)
    if (/[a-zA-Z_]/.test(char)) {
      const start = position;
      let value = '';
      while (position < input.length && /[a-zA-Z0-9_]/.test(input[position])) {
        value += input[position];
        position++;
      }
      
      const upperValue = value.toUpperCase();
      if (KEYWORDS.has(upperValue)) {
        tokens.push({ type: upperValue as any, value: upperValue, position: start });
      } else {
        tokens.push({ type: 'UNKNOWN', value, position: start });
      }
      continue;
    }
    
    // Unknown character
    tokens.push({ type: 'UNKNOWN', value: char, position });
    position++;
  }
  
  return tokens;
}

export function buildAst(tokens: Token[]): ParsedQuery | null {
  let position = 0;
  
  const peek = () => tokens[position];
  const next = () => tokens[position++];
  const expect = (type: Token['type']) => {
    const token = next();
    if (!token || token.type !== type) {
      throw new Error(`Expected ${type}, got ${token?.type || 'EOF'}`);
    }
    return token;
  };
  
  try {
    // Parse SELECT clause
    expect('SELECT');
    
    const fields: string[] = [];
    const aggregates: Array<{ function: string; field?: string }> = [];
    
    while (peek() && peek().type !== 'FROM') {
      const token = peek();
      
      if (ALLOWED_FUNCTIONS.has(token.value)) {
        const func = next().value;
        expect('LPAREN');
        
        if (func === 'COUNT' && peek()?.value === '*') {
          next(); // consume *
          aggregates.push({ function: func });
        } else {
          const fieldToken = expect('FIELD_ID');
          aggregates.push({ function: func, field: fieldToken.value });
        }
        
        expect('RPAREN');
      } else if (token.type === 'FIELD_ID') {
        fields.push(next().value);
      } else {
        // Handle special fields like submission_id, submitted_by, approval_status
        const specialFields = ['submission_id', 'submitted_by', 'approval_status', 'submitted_at'];
        if (specialFields.includes(token.value)) {
          fields.push(next().value);
        } else {
          throw new Error(`Unexpected token: ${token.value}`);
        }
      }
      
      if (peek()?.type === 'COMMA') {
        next(); // consume comma
      }
    }
    
    // Parse FROM clause
    expect('FROM');
    const formIdToken = expect('FORM_ID');
    
    const ast: ParsedQuery = {
      select: { type: 'select', fields, aggregates },
      from: { type: 'from', formId: formIdToken.value }
    };
    
    // Parse optional WHERE clause
    if (peek()?.type === 'WHERE') {
      next(); // consume WHERE
      
      const conditions: WhereCondition[] = [];
      const operators: ('AND' | 'OR')[] = [];
      
      while (peek() && peek().type !== 'SEMICOLON') {
        const fieldToken = next();
        let fieldName = fieldToken.value;
        
        // Handle special system fields
        if (['submission_id', 'submitted_by', 'approval_status', 'submitted_at'].includes(fieldName)) {
          // Keep as is
        } else if (fieldToken.type === 'FIELD_ID') {
          // Regular field ID
        } else {
          throw new Error(`Invalid field in WHERE clause: ${fieldName}`);
        }
        
        const operatorToken = expect('OPERATOR');
        const valueToken = next();
        
        let value: string | number = valueToken.value;
        if (valueToken.type === 'NUMBER') {
          value = parseFloat(valueToken.value);
        }
        
        conditions.push({
          field: fieldName,
          operator: operatorToken.value,
          value
        });
        
        if (peek()?.type === 'AND' || peek()?.type === 'OR') {
          operators.push(next().value as 'AND' | 'OR');
        } else {
          break;
        }
      }
      
      ast.where = { type: 'where', conditions, operators };
    }
    
    return ast;
  } catch (error) {
    return null;
  }
}

export function validateAst(ast: ParsedQuery, schemaCache: any): ParseError[] {
  const errors: ParseError[] = [];
  
  // Validate form ID exists
  if (!schemaCache.forms?.[ast.from.formId]) {
    errors.push({
      message: `Unknown form ID: ${ast.from.formId}`,
      position: 0,
      type: 'unknown_form'
    });
    return errors;
  }
  
  const formFields = schemaCache.forms[ast.from.formId].fields || {};
  
  // Validate field IDs in SELECT clause
  for (const fieldId of ast.select.fields) {
    if (!['submission_id', 'submitted_by', 'approval_status', 'submitted_at'].includes(fieldId) && !formFields[fieldId]) {
      errors.push({
        message: `Unknown field ID: ${fieldId}`,
        position: 0,
        type: 'unknown_field'
      });
    }
  }
  
  // Validate field IDs in aggregates
  for (const aggregate of ast.select.aggregates) {
    if (aggregate.field && !formFields[aggregate.field]) {
      errors.push({
        message: `Unknown field ID in ${aggregate.function}: ${aggregate.field}`,
        position: 0,
        type: 'unknown_field'
      });
    }
  }
  
  // Validate field IDs in WHERE clause
  if (ast.where) {
    for (const condition of ast.where.conditions) {
      if (!['submission_id', 'submitted_by', 'approval_status', 'submitted_at'].includes(condition.field) && !formFields[condition.field]) {
        errors.push({
          message: `Unknown field ID in WHERE clause: ${condition.field}`,
          position: 0,
          type: 'unknown_field'
        });
      }
    }
  }
  
  return errors;
}

export function astToSql(ast: ParsedQuery): string {
  let sql = 'SELECT ';
  
  // Build SELECT clause
  const selectParts: string[] = [];
  
  // Add regular fields
  for (const field of ast.select.fields) {
    if (['submission_id', 'submitted_by', 'approval_status', 'submitted_at'].includes(field)) {
      selectParts.push(field);
    } else {
      selectParts.push(`submission_data ->> '${field}' as "${field}"`);
    }
  }
  
  // Add aggregates
  for (const aggregate of ast.select.aggregates) {
    if (aggregate.function === 'COUNT' && !aggregate.field) {
      selectParts.push('COUNT(*)');
    } else if (aggregate.field) {
      if (['submission_id', 'submitted_by', 'approval_status', 'submitted_at'].includes(aggregate.field)) {
        selectParts.push(`${aggregate.function}(${aggregate.field})`);
      } else {
        selectParts.push(`${aggregate.function}((submission_data ->> '${aggregate.field}')::numeric)`);
      }
    }
  }
  
  sql += selectParts.join(', ');
  sql += ` FROM form_submissions WHERE form_id = '${ast.from.formId}'`;
  
  // Add WHERE conditions
  if (ast.where && ast.where.conditions.length > 0) {
    sql += ' AND (';
    
    for (let i = 0; i < ast.where.conditions.length; i++) {
      const condition = ast.where.conditions[i];
      
      if (i > 0) {
        sql += ` ${ast.where.operators[i - 1]} `;
      }
      
      if (['submission_id', 'submitted_by', 'approval_status', 'submitted_at'].includes(condition.field)) {
        sql += `${condition.field} ${condition.operator} `;
        if (typeof condition.value === 'string') {
          sql += `'${condition.value}'`;
        } else {
          sql += condition.value;
        }
      } else {
        sql += `submission_data ->> '${condition.field}' ${condition.operator} `;
        if (typeof condition.value === 'string') {
          sql += `'${condition.value}'`;
        } else {
          sql += condition.value;
        }
      }
    }
    
    sql += ')';
  }
  
  return sql;
}

export function parseUserQuery(input: string, schemaCache: any): ParseResult {
  try {
    const tokens = tokenize(input.trim());
    
    // Check for non-SELECT commands
    const firstToken = tokens[0];
    if (!firstToken || firstToken.type !== 'SELECT') {
      return {
        errors: [{
          message: 'Only SELECT statements are allowed',
          position: 0,
          type: 'syntax'
        }]
      };
    }
    
    const ast = buildAst(tokens);
    if (!ast) {
      return {
        errors: [{
          message: 'Invalid SQL syntax',
          position: 0,
          type: 'syntax'
        }]
      };
    }
    
    const errors = validateAst(ast, schemaCache);
    if (errors.length > 0) {
      return { errors, ast };
    }
    
    const sql = astToSql(ast);
    return { sql, errors: [], ast };
  } catch (error) {
    return {
      errors: [{
        message: error instanceof Error ? error.message : 'Unknown parsing error',
        position: 0,
        type: 'syntax'
      }]
    };
  }
}
