
import { supabase } from '@/integrations/supabase/client';

/** 
 * The shape of our parse result 
 */
export interface ParseResult {
  sql?: string
  errors: string[]
}

/** 
 * The shape of our execution result 
 */
export interface QueryResult {
  columns: string[]
  rows: any[][]
  errors: string[]
}

// List of allowed system tables
const ALLOWED_SYSTEM_TABLES = [
  'user_profiles',
  'organizations', 
  'projects',
  'forms',
  'form_fields',
  'form_submissions',
  'workflows',
  'reports',
  'project_users',
  'asset_permissions',
  'project_permissions'
];

/**
 * Parse custom UPDATE FORM syntax or SELECT queries
 * 1. Handle UPDATE FORM syntax for form field updates
 * 2. Handle SELECT queries with FIELD() syntax and SQL functions
 * 3. Handle SELECT queries against system tables
 */
export function parseUserQuery(input: string): ParseResult {
  const errors: string[] = []
  const cleaned = input.trim().replace(/;$/, '') // drop trailing semicolon

  // Check if this is an UPDATE FORM query
  if (/^UPDATE\s+FORM\s+/i.test(cleaned)) {
    return parseUpdateFormQuery(cleaned)
  }

  // 1. Only allow SELECT for non-UPDATE queries
  if (!/^SELECT\s+/i.test(cleaned)) {
    errors.push('Only SELECT queries and UPDATE FORM queries are allowed.')
    return { errors }
  }

  // Check if this is a system table query (not a form UUID)
  const systemTableMatch = cleaned.match(/FROM\s+(\w+)/i);
  if (systemTableMatch) {
    const tableName = systemTableMatch[1];
    if (ALLOWED_SYSTEM_TABLES.includes(tableName)) {
      // This is a system table query - pass through with metadata
      const sql = `-- SYSTEM_TABLE_QUERY\n${cleaned}`;
      return { sql, errors: [] };
    }
  }

  // 2. Extract main parts: SELECT … FROM "formUuid" [WHERE …] [GROUP BY …] [HAVING …] [ORDER BY …] [LIMIT …] [OFFSET …]
  // Normalize whitespace and newlines for multi-line queries
  const normalized = cleaned.replace(/\s+/g, ' ');
  
  // More flexible regex to capture all clauses
  const selectMatch = normalized.match(/^SELECT\s+(.+?)\s+FROM\s+['""]([0-9a-fA-F\-]{36})['""](.*)$/i)
  if (!selectMatch) {
    errors.push('Invalid syntax. Expected: SELECT … FROM "form_uuid" [WHERE …] [GROUP BY …] [ORDER BY …] [LIMIT …]')
    return { errors }
  }
  
  let [, selectExpr, formUuid, restOfQuery] = selectMatch
  
  // Parse optional clauses
  let whereExpr = ''
  let groupByExpr = ''
  let havingExpr = ''
  let orderByExpr = ''
  let limitExpr = ''
  let offsetExpr = ''
  
  // Extract WHERE clause
  const whereMatch = restOfQuery.match(/\s+WHERE\s+(.+?)(?=\s+(?:GROUP BY|ORDER BY|LIMIT|OFFSET|$))/i)
  if (whereMatch) {
    whereExpr = whereMatch[1].trim()
  }
  
  // Extract GROUP BY clause
  const groupByMatch = restOfQuery.match(/\s+GROUP BY\s+(.+?)(?=\s+(?:HAVING|ORDER BY|LIMIT|OFFSET|$))/i)
  if (groupByMatch) {
    groupByExpr = groupByMatch[1].trim()
  }
  
  // Extract HAVING clause
  const havingMatch = restOfQuery.match(/\s+HAVING\s+(.+?)(?=\s+(?:ORDER BY|LIMIT|OFFSET|$))/i)
  if (havingMatch) {
    havingExpr = havingMatch[1].trim()
  }
  
  // Extract ORDER BY clause
  const orderByMatch = restOfQuery.match(/\s+ORDER BY\s+(.+?)(?=\s+(?:LIMIT|OFFSET|$))/i)
  if (orderByMatch) {
    orderByExpr = orderByMatch[1].trim()
  }
  
  // Extract LIMIT clause
  const limitMatch = restOfQuery.match(/\s+LIMIT\s+(\d+)/i)
  if (limitMatch) {
    limitExpr = limitMatch[1]
  }
  
  // Extract OFFSET clause
  const offsetMatch = restOfQuery.match(/\s+OFFSET\s+(\d+)/i)
  if (offsetMatch) {
    offsetExpr = offsetMatch[1]
  }

  // Store all parsed clauses for client-side execution
  const queryMetadata = {
    formUuid,
    selectExpr,
    whereExpr,
    groupByExpr,
    havingExpr,
    orderByExpr,
    limitExpr,
    offsetExpr
  };

  // Encode metadata in SQL comment for client-side execution
  const sql = `-- QUERY_METADATA: ${JSON.stringify(queryMetadata)}\nSELECT ${selectExpr} FROM form_submissions WHERE form_id = '${formUuid}';`;

  return { sql, errors }
}

/**
 * Parse custom UPDATE FORM syntax
 * Expected format: UPDATE FORM 'form_id' SET FIELD('field_id') = value WHERE submission_id = 'submission_id'
 */
export function parseUpdateFormQuery(input: string): ParseResult {
  const errors: string[] = []

  // Parse the UPDATE FORM syntax with flexible WHERE clause
  // Supports both: WHERE submission_id = 'id' and WHERE FIELD('field_id') operator 'value'
  const updateMatch = input.match(
    /^UPDATE\s+FORM\s+['""]([0-9a-fA-F\-]{36})['"\"]\s+SET\s+FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*=\s*(.+?)\s+WHERE\s+(.+)$/i
  )

  if (!updateMatch) {
    errors.push('Invalid UPDATE FORM syntax. Expected: UPDATE FORM \'form_id\' SET FIELD(\'field_id\') = value WHERE condition')
    return { errors }
  }

  const [, formId, fieldId, valueExpression, whereClause] = updateMatch

  // Transform value expression to handle FIELD() syntax and all allowed UPDATE functions
  let transformedValue = valueExpression.trim()
  
  // Store function metadata for UPDATE query execution
  const functionPattern = /^(UPPER|LOWER|CONCAT|REPLACE|TRIM|LTRIM|RTRIM|ROUND|CEIL|FLOOR|ABS|COALESCE|NOW|CURRENT_TIMESTAMP|IF|LEFT|RIGHT|SUBSTRING)\s*\(/i;
  const hasFunction = functionPattern.test(transformedValue);
  
  if (hasFunction) {
    // Store the original expression with FIELD() references for later evaluation
    transformedValue = `FUNC::${transformedValue}`;
  } else {
    // Handle FIELD() references for simple assignments
    transformedValue = transformedValue.replace(
      /FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)/gi,
      (_match, uuid) => `FIELD_REF::${uuid}`
    );
  }

  // Parse WHERE clause
  let sqlWhereClause = ''
  
  // Check if it's a submission_id condition (maps to submission_ref_id in backend)
  const submissionIdMatch = whereClause.match(/submission_id\s*(=|!=)\s*['""]([0-9a-fA-F\-]{36})['"\"]/i)
  if (submissionIdMatch) {
    const operator = submissionIdMatch[1]
    const submissionId = submissionIdMatch[2]
    sqlWhereClause = `submission_ref_id ${operator} '${submissionId}'`
  } else {
    // Parse FIELD() condition
    const fieldConditionMatch = whereClause.match(
      /FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*(=|!=|>|<|>=|<=|LIKE|ILIKE)\s*['""]?([^'"]+?)['""]?$/i
    )
    
    if (fieldConditionMatch) {
      const conditionFieldId = fieldConditionMatch[1]
      const operator = fieldConditionMatch[2].toUpperCase()
      const conditionValue = fieldConditionMatch[3].trim()
      
      // Build SQL condition based on operator
      if (operator === 'LIKE' || operator === 'ILIKE') {
        sqlWhereClause = `submission_data ->> '${conditionFieldId}' ${operator} '${conditionValue}'`
      } else if (operator === '>' || operator === '<' || operator === '>=' || operator === '<=') {
        sqlWhereClause = `(submission_data ->> '${conditionFieldId}')::numeric ${operator} ${conditionValue}`
      } else {
        sqlWhereClause = `submission_data ->> '${conditionFieldId}' ${operator} '${conditionValue}'`
      }
    } else {
      errors.push('Invalid WHERE clause. Use: WHERE submission_id = \'id\' OR WHERE FIELD(\'field_id\') operator \'value\'')
      return { errors }
    }
  }

  // Build the final SQL - store metadata for batch update
  const sql = `UPDATE::BATCH::${formId}::${fieldId}::${transformedValue}::${sqlWhereClause}`

  return { sql, errors }
}

import { evaluateExpression, evaluateFunction, aggregateFunctions } from './sqlFunctions';

/**
 * Execute a query against a system table
 */
async function executeSystemTableQuery(query: string): Promise<QueryResult> {
  try {
    // Parse the query to extract table name and clauses
    const tableMatch = query.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      return { columns: [], rows: [], errors: ['Invalid query: could not identify table'] };
    }
    
    const tableName = tableMatch[1];
    
    // Security check: only allow whitelisted tables
    if (!ALLOWED_SYSTEM_TABLES.includes(tableName)) {
      return { columns: [], rows: [], errors: [`Table '${tableName}' is not accessible`] };
    }

    // Extract SELECT clause
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
    const selectClause = selectMatch ? selectMatch[1].trim() : '*';
    
    // Extract WHERE clause if present
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|\s+OFFSET|$)/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : null;
    
    // Extract ORDER BY clause if present
    const orderMatch = query.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|\s+OFFSET|$)/i);
    const orderClause = orderMatch ? orderMatch[1].trim() : null;
    
    // Extract LIMIT clause if present
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    const limitValue = limitMatch ? parseInt(limitMatch[1]) : 100; // Default limit for safety
    
    // Extract OFFSET clause if present
    const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
    const offsetValue = offsetMatch ? parseInt(offsetMatch[1]) : 0;

    // Build the Supabase query - use any to bypass type checking for dynamic table names
    let supabaseQuery = (supabase as any).from(tableName).select(selectClause);
    
    // Add WHERE conditions (basic support for simple conditions)
    if (whereClause) {
      // Parse simple conditions like "status = 'active'" or "id = '123'"
      const eqMatch = whereClause.match(/(\w+)\s*=\s*'([^']+)'/);
      if (eqMatch) {
        supabaseQuery = supabaseQuery.eq(eqMatch[1], eqMatch[2]);
      }
    }
    
    // Add ORDER BY
    if (orderClause) {
      const [column, direction] = orderClause.split(/\s+/);
      supabaseQuery = supabaseQuery.order(column, { 
        ascending: !direction || direction.toUpperCase() === 'ASC' 
      });
    }
    
    // Add pagination
    supabaseQuery = supabaseQuery.range(offsetValue, offsetValue + limitValue - 1);

    const { data, error } = await supabaseQuery;
    
    if (error) {
      return { columns: [], rows: [], errors: [error.message] };
    }
    
    if (!data || data.length === 0) {
      return { columns: [], rows: [], errors: [] };
    }

    // Extract columns from first row
    const columns = Object.keys(data[0]);
    
    // Convert data to rows format
    const rows = data.map(row => columns.map(col => row[col]));
    
    return { columns, rows, errors: [] };
    
  } catch (error) {
    console.error('System table query error:', error);
    return { 
      columns: [], 
      rows: [], 
      errors: [error instanceof Error ? error.message : 'Unknown error executing system table query'] 
    };
  }
}

/**
 * Execute the user query using Supabase and client-side processing
 */
export async function executeUserQuery(
  userInput: string
): Promise<QueryResult> {
  const { sql, errors: parseErrors } = parseUserQuery(userInput)
  if (parseErrors.length) {
    return { columns: [], rows: [], errors: parseErrors }
  }

  try {
    console.log('Executing SQL:', sql);
    
    // Handle UPDATE queries differently
    if (sql?.startsWith('UPDATE')) {
      return await executeUpdateQuery(sql)
    }

    // Check if this is a system table query
    if (sql?.includes('-- SYSTEM_TABLE_QUERY')) {
      return await executeSystemTableQuery(sql.replace('-- SYSTEM_TABLE_QUERY\n', ''));
    }
    
    // Extract query metadata from SQL comment
    const metadataMatch = sql.match(/-- QUERY_METADATA: (.+)\n/);
    if (!metadataMatch) {
      return { columns: [], rows: [], errors: ['Failed to parse query metadata'] };
    }
    
    const metadata = JSON.parse(metadataMatch[1]);
    const { formUuid, selectExpr, whereExpr, groupByExpr, havingExpr, orderByExpr, limitExpr, offsetExpr } = metadata;
    
    // Fetch all submissions for this form
    const { data: submissions, error: submissionsError } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formUuid);
    
    if (submissionsError) {
      return { columns: [], rows: [], errors: [submissionsError.message] };
    }
    
    if (!submissions || submissions.length === 0) {
      return { columns: [], rows: [], errors: [] };
    }
    
    // Transform submissions into rows with flattened field access
    let rows = submissions.map(sub => ({
      submission_id: sub.submission_ref_id || sub.id,
      submitted_by: sub.submitted_by,
      submitted_at: sub.submitted_at,
      ...(sub.submission_data as Record<string, any>)
    }));
    
    // Apply WHERE filter
    if (whereExpr) {
      rows = rows.filter(row => {
        try {
          const condition = evaluateWhereCondition(whereExpr, row);
          return Boolean(condition);
        } catch (e) {
          console.error('WHERE evaluation error:', e);
          return false;
        }
      });
    }
    
    // Parse SELECT expressions
    const selectParts = parseSelectExpressions(selectExpr);
    const isAggregateQuery = selectParts.some(p => p.isAggregate);
    
    // Apply GROUP BY if present
    let groupedRows: any[] = [];
    if (groupByExpr) {
      const groupByFields = groupByExpr.split(',').map(f => f.trim());
      const groups = new Map<string, any[]>();
      
      rows.forEach(row => {
        const groupKey = groupByFields.map(field => {
          const fieldValue = evaluateFieldReference(field, row);
          return String(fieldValue ?? '');
        }).join('|||');
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(row);
      });
      
      // Create grouped rows
      groups.forEach(groupRows => {
        groupedRows.push(groupRows);
      });
    } else if (isAggregateQuery) {
      // Treat entire dataset as one group for aggregates without GROUP BY
      groupedRows = [rows];
    } else {
      // No grouping
      groupedRows = rows.map(r => [r]);
    }
    
    // Evaluate SELECT expressions for each group
    const resultRows: any[][] = [];
    const columns: string[] = selectParts.map(p => p.alias);
    
    groupedRows.forEach(groupRows => {
      const row: any[] = [];
      selectParts.forEach(part => {
        if (part.isAggregate) {
          // Evaluate aggregate function
          const values = groupRows.map(r => evaluateFieldReference(part.fieldRef, r));
          const result = (aggregateFunctions as any)[part.func.toUpperCase()](values);
          row.push(result);
        } else {
          // Evaluate expression for first row in group
          const firstRow = groupRows[0];
          const result = evaluateSelectExpression(part.expr, firstRow);
          row.push(result);
        }
      });
      resultRows.push(row);
    });
    
    // Apply HAVING filter (after GROUP BY)
    let filteredResults = resultRows;
    if (havingExpr && groupByExpr) {
      filteredResults = resultRows.filter((row, idx) => {
        try {
          const rowObj: any = {};
          columns.forEach((col, i) => {
            rowObj[col] = row[i];
          });
          return evaluateWhereCondition(havingExpr, rowObj);
        } catch (e) {
          console.error('HAVING evaluation error:', e);
          return false;
        }
      });
    }
    
    // Apply ORDER BY
    if (orderByExpr) {
      const orderParts = orderByExpr.split(',').map(part => {
        const trimmed = part.trim();
        const descMatch = trimmed.match(/^(.+?)\s+(ASC|DESC)$/i);
        if (descMatch) {
          return { field: descMatch[1].trim(), direction: descMatch[2].toUpperCase() };
        }
        return { field: trimmed, direction: 'ASC' };
      });
      
      filteredResults.sort((a, b) => {
        for (const { field, direction } of orderParts) {
          const colIndex = columns.indexOf(field);
          if (colIndex === -1) continue;
          
          const aVal = a[colIndex];
          const bVal = b[colIndex];
          
          let comparison = 0;
          if (aVal < bVal) comparison = -1;
          else if (aVal > bVal) comparison = 1;
          
          if (comparison !== 0) {
            return direction === 'DESC' ? -comparison : comparison;
          }
        }
        return 0;
      });
    }
    
    // Apply LIMIT and OFFSET
    let finalResults = filteredResults;
    const offset = offsetExpr ? parseInt(offsetExpr) : 0;
    const limit = limitExpr ? parseInt(limitExpr) : undefined;
    
    if (offset > 0) {
      finalResults = finalResults.slice(offset);
    }
    if (limit !== undefined) {
      finalResults = finalResults.slice(0, limit);
    }
    
    return { columns, rows: finalResults, errors: [] };
    
  } catch (err) {
    console.error('Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { columns: [], rows: [], errors: [errorMessage] };
  }
}

/**
 * Parse SELECT expressions into structured format
 */
function parseSelectExpressions(selectExpr: string): Array<{
  expr: string;
  alias: string;
  isAggregate: boolean;
  func?: string;
  fieldRef?: string;
}> {
  const parts: Array<any> = [];
  const expressions = splitTopLevelCommas(selectExpr);
  
  expressions.forEach(expr => {
    const trimmed = expr.trim();
    
    // Check for alias
    const aliasMatch = trimmed.match(/^(.+?)\s+as\s+(\w+)$/i);
    const actualExpr = aliasMatch ? aliasMatch[1].trim() : trimmed;
    const alias = aliasMatch ? aliasMatch[2] : generateAlias(actualExpr);
    
    // Check for aggregate functions
    const aggMatch = actualExpr.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)\s*\)$/i);
    if (aggMatch) {
      parts.push({
        expr: actualExpr,
        alias,
        isAggregate: true,
        func: aggMatch[1],
        fieldRef: aggMatch[2]
      });
      return;
    }
    
    // Non-aggregate expression
    parts.push({
      expr: actualExpr,
      alias,
      isAggregate: false
    });
  });
  
  return parts;
}

/**
 * Evaluate SELECT expression for a row
 */
function evaluateSelectExpression(expr: string, row: any): any {
  // Handle FIELD() references
  expr = expr.replace(/FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)/gi, (_, fieldId) => {
    return `${fieldId}`;
  });
  
  // Handle system columns
  if (expr === 'submission_id') return row.submission_id;
  if (expr === 'submitted_by') return row.submitted_by;
  if (expr === 'submitted_at') return row.submitted_at;
  
  // Check if it's a simple field reference
  if (/^[a-zA-Z0-9_-]+$/.test(expr)) {
    return row[expr] ?? null;
  }
  
  // Evaluate complex expressions with functions
  try {
    return evaluateExpression(expr, row);
  } catch (e) {
    console.error('Expression evaluation error:', e);
    return null;
  }
}

/**
 * Evaluate WHERE/HAVING condition
 */
function evaluateWhereCondition(condition: string, row: any): boolean {
  // Replace FIELD() with actual values
  let processedCondition = condition.replace(/FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)/gi, (_, fieldId) => {
    const value = row[fieldId];
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
    return String(value);
  });
  
  // Handle system columns
  processedCondition = processedCondition.replace(/\bsubmission_id\b/gi, () => {
    return `'${row.submission_id}'`;
  });
  
  // Simple condition evaluation (supports: =, !=, <, >, <=, >=, LIKE, AND, OR)
  // This is a simplified evaluator - for production, use a proper SQL parser
  try {
    // Handle LIKE operator
    processedCondition = processedCondition.replace(/([^\s]+)\s+LIKE\s+'([^']+)'/gi, (match, field, pattern) => {
      const fieldValue = String(row[field] ?? '');
      const regexPattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
      const regex = new RegExp('^' + regexPattern + '$', 'i');
      return regex.test(fieldValue) ? 'true' : 'false';
    });
    
    // Convert SQL operators to JavaScript
    processedCondition = processedCondition.replace(/\s+AND\s+/gi, ' && ');
    processedCondition = processedCondition.replace(/\s+OR\s+/gi, ' || ');
    processedCondition = processedCondition.replace(/\s*=\s*/g, ' === ');
    processedCondition = processedCondition.replace(/\s*!=\s*/g, ' !== ');
    
    // Safely evaluate
    return new Function('return ' + processedCondition)();
  } catch (e) {
    console.error('Condition evaluation error:', e, 'Condition:', processedCondition);
    return false;
  }
}

/**
 * Evaluate field reference from FIELD() syntax
 */
function evaluateFieldReference(fieldRef: string, row: any): any {
  if (!fieldRef) return null;
  
  // Extract field ID from FIELD('uuid') syntax
  const fieldMatch = fieldRef.match(/FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)/i);
  if (fieldMatch) {
    return row[fieldMatch[1]] ?? null;
  }
  
  // Direct field reference
  return row[fieldRef] ?? null;
}

/**
 * Split comma-separated expressions respecting parentheses
 */
function splitTopLevelCommas(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    
    if ((char === "'" || char === '"') && (i === 0 || expr[i - 1] !== '\\')) {
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
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    
    current += char;
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  return parts;
}

/**
 * Generate alias from expression
 */
function generateAlias(expr: string): string {
  // For aggregates, use function name + field
  const aggMatch = expr.match(/^(COUNT|SUM|AVG|MIN|MAX)/i);
  if (aggMatch) {
    return aggMatch[1].toLowerCase();
  }
  
  // For FIELD() references, use the field ID
  const fieldMatch = expr.match(/FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)/i);
  if (fieldMatch) {
    return fieldMatch[1];
  }
  
  // For simple identifiers
  if (/^[a-zA-Z0-9_-]+$/.test(expr)) {
    return expr;
  }
  
  return 'column';
}

/**
 * Execute UPDATE queries using Supabase client with support for SQL functions
 */
async function executeUpdateQuery(sql: string): Promise<QueryResult> {
  try {
    // Parse the batch update metadata
    if (!sql.startsWith('UPDATE::BATCH::')) {
      return { columns: [], rows: [], errors: ['Invalid UPDATE query format'] };
    }

    const parts = sql.split('::');
    if (parts.length !== 6) {
      return { columns: [], rows: [], errors: ['Failed to parse UPDATE query parameters'] };
    }

    const formId = parts[2];
    const fieldId = parts[3];
    const valueExpression = parts[4];
    const whereClause = parts[5];

    // Fetch all matching submissions based on WHERE clause
    let query = supabase
      .from('form_submissions')
      .select('id, submission_data, submission_ref_id')
      .eq('form_id', formId);

    // Apply WHERE filter for submission_id
    if (whereClause.startsWith('submission_ref_id ')) {
      const idMatch = whereClause.match(/submission_ref_id (=|!=) '([^']+)'/);
      if (idMatch) {
        const operator = idMatch[1];
        const submissionId = idMatch[2];
        if (operator === '=') {
          query = query.eq('submission_ref_id', submissionId);
        } else {
          query = query.neq('submission_ref_id', submissionId);
        }
      }
    }

    const { data: submissions, error: fetchError } = await query;

    if (fetchError) {
      return { columns: [], rows: [], errors: [fetchError.message] };
    }

    if (!submissions || submissions.length === 0) {
      return { columns: [], rows: [], errors: ['No submissions found matching the WHERE clause'] };
    }

    // Filter submissions based on FIELD() conditions
    let filteredSubmissions = submissions;
    
    if (!whereClause.startsWith('submission_ref_id ')) {
      const fieldConditionMatch = whereClause.match(
        /submission_data ->> '([^']+)' (=|!=|>|<|>=|<=|LIKE|ILIKE) '?([^']+)'?$/i
      );
      
      if (fieldConditionMatch) {
        const conditionFieldId = fieldConditionMatch[1];
        const operator = fieldConditionMatch[2];
        const conditionValue = fieldConditionMatch[3];

        filteredSubmissions = submissions.filter(sub => {
          const fieldValue = sub.submission_data[conditionFieldId];
          
          switch (operator) {
            case '=':
              return fieldValue == conditionValue;
            case '!=':
              return fieldValue != conditionValue;
            case '>':
              return parseFloat(fieldValue) > parseFloat(conditionValue);
            case '<':
              return parseFloat(fieldValue) < parseFloat(conditionValue);
            case '>=':
              return parseFloat(fieldValue) >= parseFloat(conditionValue);
            case '<=':
              return parseFloat(fieldValue) <= parseFloat(conditionValue);
            case 'LIKE':
            case 'ILIKE':
              const pattern = conditionValue.replace(/%/g, '.*');
              const regex = new RegExp(pattern, operator === 'ILIKE' ? 'i' : '');
              return regex.test(String(fieldValue || ''));
            default:
              return false;
          }
        });
      }
    }

    if (filteredSubmissions.length === 0) {
      return { columns: [], rows: [], errors: ['No submissions matched the filter criteria'] };
    }

    // Update each matching submission
    const updatePromises = filteredSubmissions.map(async (submission) => {
      let newValue: any;
      
      try {
        // Check if value expression contains a function
        if (valueExpression.startsWith('FUNC::')) {
          const funcExpr = valueExpression.substring(6);
          const row = {
            submission_id: submission.submission_ref_id || submission.id,
            ...(submission.submission_data as Record<string, any>)
          };
          newValue = evaluateExpression(funcExpr.replace(/FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)/gi, '$1'), row);
        } else if (valueExpression.startsWith('FIELD_REF::')) {
          const sourceFieldId = valueExpression.substring(11);
          newValue = submission.submission_data[sourceFieldId] || '';
        } else {
          newValue = valueExpression.replace(/['"]/g, '');
        }

        // Update the submission
        const updatedSubmissionData = {
          ...(submission.submission_data as Record<string, any>),
          [fieldId]: newValue
        };

        const { error: updateError } = await supabase
          .from('form_submissions')
          .update({ submission_data: updatedSubmissionData })
          .eq('id', submission.id)
          .eq('form_id', formId);

        if (updateError) {
          throw updateError;
        }

        return true;
      } catch (error) {
        console.error(`Failed to update submission ${submission.id}:`, error);
        return false;
      }
    });

    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r).length;
    const failureCount = results.filter(r => !r).length;

    if (failureCount > 0) {
      return {
        columns: ['message', 'updated_rows', 'failed_rows'],
        rows: [[`${successCount} record(s) updated successfully, ${failureCount} failed`, successCount, failureCount]],
        errors: []
      };
    }

    return {
      columns: ['message', 'updated_rows'],
      rows: [[`${successCount} record(s) updated successfully`, successCount]],
      errors: []
    };

  } catch (error) {
    console.error('UPDATE execution error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { columns: [], rows: [], errors: [errorMessage] };
  }
}

// Legacy exports for backward compatibility
export interface ParseError {
  message: string;
  position: number;
  type: 'syntax' | 'validation' | 'unknown_field' | 'unknown_form';
}

export interface LegacyParseResult {
  sql?: string;
  errors: ParseError[];
  ast?: any;
}

// Legacy function that converts new format to old format
export function parseUserQueryLegacy(input: string, schemaCache: any): LegacyParseResult {
  const result = parseUserQuery(input);
  const legacyErrors: ParseError[] = result.errors.map(error => ({
    message: error,
    position: 0,
    type: 'syntax' as const
  }));
  
  return {
    sql: result.sql,
    errors: legacyErrors
  };
}
