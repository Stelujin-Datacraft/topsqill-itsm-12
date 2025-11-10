
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
  // Normalize whitespace and newlines for multi-line queries - preserve structure but collapse whitespace
  const normalized = cleaned.replace(/\s+/g, ' ').trim();
  
  // Check for DISTINCT - use 's' flag to match across newlines
  const distinctMatch = normalized.match(/^SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM\s+['""]([0-9a-fA-F\-]{36})['""](.*)$/is)
  if (!distinctMatch) {
    errors.push('Invalid syntax. Expected: SELECT [DISTINCT] … FROM "form_uuid" [WHERE …] [GROUP BY …] [ORDER BY …] [LIMIT …]')
    return { errors }
  }
  
  let [, distinctKeyword, selectExpr, formUuid, restOfQuery] = distinctMatch
  const isDistinct = Boolean(distinctKeyword)
  
  // Parse optional clauses
  let whereExpr = ''
  let groupByExpr = ''
  let havingExpr = ''
  let orderByExpr = ''
  let limitExpr = ''
  let offsetExpr = ''
  
  // Extract WHERE clause - use 's' flag to match across newlines
  const whereMatch = restOfQuery.match(/\s+WHERE\s+(.+?)(?=\s+(?:GROUP BY|ORDER BY|LIMIT|OFFSET|$))/is)
  if (whereMatch) {
    whereExpr = whereMatch[1].trim()
  }
  
  // Extract GROUP BY clause - use 's' flag to match across newlines
  const groupByMatch = restOfQuery.match(/\s+GROUP BY\s+(.+?)(?=\s+(?:HAVING|ORDER BY|LIMIT|OFFSET|$))/is)
  if (groupByMatch) {
    groupByExpr = groupByMatch[1].trim()
  }
  
  // Extract HAVING clause - use 's' flag to match across newlines
  const havingMatch = restOfQuery.match(/\s+HAVING\s+(.+?)(?=\s+(?:ORDER BY|LIMIT|OFFSET|$))/is)
  if (havingMatch) {
    havingExpr = havingMatch[1].trim()
  }
  
  // Extract ORDER BY clause - use 's' flag to match across newlines
  const orderByMatch = restOfQuery.match(/\s+ORDER BY\s+(.+?)(?=\s+(?:LIMIT|OFFSET|$))/is)
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
    offsetExpr,
    isDistinct
  };

  // Encode metadata in SQL comment for client-side execution
  const sql = `-- QUERY_METADATA: ${JSON.stringify(queryMetadata)}\nSELECT ${selectExpr} FROM form_submissions WHERE form_id = '${formUuid}';`;

  return { sql, errors }
}

/**
 * Parse custom UPDATE FORM syntax with arithmetic and CASE WHEN support
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

  // Transform value expression to handle FIELD() syntax, functions, arithmetic, and CASE WHEN
  let transformedValue = valueExpression.trim()
  
  // Check for CASE WHEN expressions
  const hasCaseWhen = /CASE\s+WHEN/i.test(transformedValue);
  
  // Check for arithmetic expressions (e.g., FIELD('id') + 1, value * 2)
  const hasArithmetic = /[+\-*\/]/.test(transformedValue) && !/\s+AND\s+|\s+OR\s+/i.test(transformedValue);
  
  // Store function metadata for UPDATE query execution
  const functionPattern = /^(UPPER|LOWER|CONCAT|REPLACE|TRIM|LTRIM|RTRIM|ROUND|CEIL|FLOOR|ABS|COALESCE|NOW|CURRENT_TIMESTAMP|IF|LEFT|RIGHT|SUBSTRING|IFNULL|CASE)\s*\(/i;
  const hasFunction = functionPattern.test(transformedValue);
  
  if (hasCaseWhen || hasFunction || hasArithmetic) {
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

    // Extract SELECT clause - use 's' flag to handle multiline queries
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/is);
    const selectClause = selectMatch ? selectMatch[1].replace(/\s+/g, ' ').trim() : '*';
    
    // Check for JSONB operations in SELECT - we'll need to handle these specially
    const hasJsonbOperations = /->>|->/.test(selectClause);
    
    // Build the actual Supabase select clause (without JSONB operations)
    let supabaseSelectClause = selectClause;
    const jsonbExtractions: Array<{expr: string, alias: string, column: string, key: string}> = [];
    
    if (hasJsonbOperations) {
      // Extract JSONB operations and replace with base column names
      const columns: string[] = [];
      selectClause.split(',').forEach(col => {
        const trimmed = col.trim();
        
        // Match: column->>'key' as alias OR column->>'key'
        const jsonbMatch = trimmed.match(/(\w+)->>'(\w+)'(?:\s+(?:as\s+)?(\w+))?/i);
        if (jsonbMatch) {
          const [, columnName, key, alias] = jsonbMatch;
          const finalAlias = alias || trimmed;
          jsonbExtractions.push({ expr: trimmed, alias: finalAlias, column: columnName, key });
          // Add the base column if not already included
          if (!columns.includes(columnName)) {
            columns.push(columnName);
          }
        } else {
          columns.push(trimmed);
        }
      });
      supabaseSelectClause = columns.join(', ');
    }
    
    // Extract WHERE clause if present - use 's' flag to handle multiline queries
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|\s+OFFSET|$)/is);
    const whereClause = whereMatch ? whereMatch[1].replace(/\s+/g, ' ').trim() : null;
    
    // Extract ORDER BY clause if present - use 's' flag to handle multiline queries
    const orderMatch = query.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|\s+OFFSET|$)/is);
    const orderClause = orderMatch ? orderMatch[1].replace(/\s+/g, ' ').trim() : null;
    
    // Extract LIMIT clause if present
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    const limitValue = limitMatch ? parseInt(limitMatch[1]) : 100; // Default limit for safety
    
    // Extract OFFSET clause if present
    const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
    const offsetValue = offsetMatch ? parseInt(offsetMatch[1]) : 0;

    // Build the Supabase query - use any to bypass type checking for dynamic table names
    let supabaseQuery = (supabase as any).from(tableName).select(supabaseSelectClause);
    
    // Add WHERE conditions with support for AND/OR operators
    if (whereClause) {
      // Parse complex WHERE conditions with AND/OR logic
      const parseCondition = (conditionStr: string) => {
        // Handle equality with quotes: column = 'value'
        let match = conditionStr.trim().match(/(\w+)\s*=\s*'([^']+)'/);
        if (match) {
          return { column: match[1], operator: 'eq', value: match[2] };
        }
        
        // Handle equality without quotes (for UUIDs): column = value or column = value::uuid
        match = conditionStr.trim().match(/(\w+)\s*=\s*'?([0-9a-fA-F\-]{36})'?(?:::uuid)?/i);
        if (match) {
          return { column: match[1], operator: 'eq', value: match[2] };
        }
        
        // Handle other operators
        match = conditionStr.trim().match(/(\w+)\s*(!=|<>|>|<|>=|<=)\s*'?([^']+?)'?$/);
        if (match) {
          const operatorMap: Record<string, string> = {
            '!=': 'neq',
            '<>': 'neq',
            '>': 'gt',
            '<': 'lt',
            '>=': 'gte',
            '<=': 'lte'
          };
          return { column: match[1], operator: operatorMap[match[2]] || 'eq', value: match[3].replace(/::uuid$/i, '') };
        }
        
        return null;
      };
      
      // Check if we have OR conditions
      if (/\s+OR\s+/i.test(whereClause)) {
        // Split by OR and process each OR group
        const orGroups = whereClause.split(/\s+OR\s+/i);
        const orConditions = orGroups.map(group => {
          // Each OR group might have AND conditions
          if (/\s+AND\s+/i.test(group)) {
            const andConditions = group.split(/\s+AND\s+/i);
            const parsedConditions = andConditions.map(parseCondition).filter(c => c !== null);
            return parsedConditions;
          } else {
            const parsed = parseCondition(group);
            return parsed ? [parsed] : [];
          }
        }).filter(g => g.length > 0);
        
        // Apply OR filter - Supabase doesn't have direct OR support, so we need to use .or()
        if (orConditions.length > 0) {
          const orString = orConditions.map(andGroup => {
            if (andGroup.length === 1) {
              const cond = andGroup[0];
              return `${cond.column}.${cond.operator}.${cond.value}`;
            } else {
              // Multiple AND conditions in this OR group
              return `and(${andGroup.map(c => `${c.column}.${c.operator}.${c.value}`).join(',')})`;
            }
          }).join(',');
          
          supabaseQuery = supabaseQuery.or(orString);
        }
      } else {
        // Only AND conditions - apply each one
        const andConditions = whereClause.split(/\s+AND\s+/i);
        andConditions.forEach(condition => {
          const parsed = parseCondition(condition);
          if (parsed) {
            supabaseQuery = (supabaseQuery as any)[parsed.operator](parsed.column, parsed.value);
          }
        });
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

    // Extract columns - respect the SELECT clause including JSONB extractions
    let columns: string[];
    if (selectClause === '*') {
      // Select all columns
      columns = Object.keys(data[0]);
    } else {
      // Parse the SELECT clause to get exact column names/aliases
      columns = selectClause.split(',').map(col => {
        const trimmed = col.trim();
        // Handle JSONB with alias: custom_config->>'weightage' as weight
        const jsonbAliasMatch = trimmed.match(/\w+->>'?\w+'?\s+(?:as\s+)?(\w+)/i);
        if (jsonbAliasMatch) {
          return jsonbAliasMatch[1]; // Return the alias
        }
        // Handle regular aliases: column as alias
        const aliasMatch = trimmed.match(/^(.+?)\s+(?:as\s+)?(\w+)$/i);
        if (aliasMatch) {
          return aliasMatch[2]; // Return the alias
        }
        // Handle JSONB without alias: custom_config->>'weightage'
        const jsonbMatch = trimmed.match(/(\w+)->>'(\w+)'/);
        if (jsonbMatch) {
          return trimmed; // Keep the full expression as column name
        }
        return trimmed;
      });
    }
    
    // Convert data to rows format - handle JSONB extractions client-side
    const rows = data.map(row => {
      if (selectClause === '*') {
        return columns.map(col => row[col]);
      } else {
        // For specific columns, evaluate each expression
        return columns.map((col, idx) => {
          const selectExpr = selectClause.split(',')[idx].trim();
          
          // Check for JSONB extraction with or without alias
          const jsonbMatch = selectExpr.match(/(\w+)->>'(\w+)'(?:\s+(?:as\s+)?(\w+))?/i);
          if (jsonbMatch) {
            const [, columnName, key] = jsonbMatch;
            // Extract from the JSONB object
            const jsonbValue = row[columnName];
            if (jsonbValue && typeof jsonbValue === 'object') {
              return jsonbValue[key];
            }
            return null;
          }
          
          // Check for regular aliases
          const aliasMatch = selectExpr.match(/^(.+?)\s+(?:as\s+)?(\w+)$/i);
          if (aliasMatch && !/->>/.test(selectExpr)) {
            const columnName = aliasMatch[1].trim();
            return row[columnName];
          }
          
          // Simple column (no alias, no JSONB operation)
          return row[col];
        });
      }
    });
    
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
    const { formUuid, selectExpr, whereExpr, groupByExpr, havingExpr, orderByExpr, limitExpr, offsetExpr, isDistinct } = metadata;
    
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
    
    // Fetch form fields to get weightage values for WEIGHTED_VALUE function
    const { data: formFields } = await supabase
      .from('form_fields')
      .select('id, label, custom_config')
      .eq('form_id', formUuid);
    
    // Build field metadata for WEIGHTED_VALUE support
    const fieldMetadata: Record<string, any> = {};
    if (formFields) {
      formFields.forEach(field => {
        const customConfig = field.custom_config as Record<string, any> | null;
        const weightage = customConfig?.weightage || 1;
        // Map by both field ID and label for flexible lookup
        fieldMetadata[field.id] = { label: field.label, weightage };
        fieldMetadata[field.label] = { id: field.id, weightage };
      });
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
          let values: any[];
          
          if (part.fieldRef === '*') {
            // COUNT(*) - count all rows
            values = groupRows;
          } else {
            // Extract field values from each row
            values = groupRows.map(r => evaluateFieldReference(part.fieldRef, r));
          }
          
          const result = (aggregateFunctions as any)[part.func.toUpperCase()](values);
          row.push(result);
        } else {
          // Evaluate expression for first row in group
          const firstRow = groupRows[0];
          const result = evaluateSelectExpression(part.expr, firstRow, fieldMetadata);
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
    
    // Apply DISTINCT
    let distinctResults = filteredResults;
    if (isDistinct) {
      const seen = new Set<string>();
      distinctResults = filteredResults.filter(row => {
        const rowKey = JSON.stringify(row);
        if (seen.has(rowKey)) {
          return false;
        }
        seen.add(rowKey);
        return true;
      });
    }
    
    // Apply LIMIT and OFFSET
    let finalResults = distinctResults;
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
    
    // Check for aggregate functions - Pattern 1: AGG(FIELD("field-id"))
    const aggFieldMatch = actualExpr.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)\s*\)$/i);
    if (aggFieldMatch) {
      parts.push({
        expr: actualExpr,
        alias,
        isAggregate: true,
        func: aggFieldMatch[1],
        fieldRef: aggFieldMatch[2]
      });
      return;
    }
    
    // Check for aggregate functions - Pattern 2: COUNT(*)
    const countStarMatch = actualExpr.match(/^COUNT\s*\(\s*\*\s*\)$/i);
    if (countStarMatch) {
      parts.push({
        expr: actualExpr,
        alias,
        isAggregate: true,
        func: 'COUNT',
        fieldRef: '*'
      });
      return;
    }
    
    // Check for aggregate functions - Pattern 3: AGG(field_name) - direct field reference
    const aggDirectMatch = actualExpr.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([a-zA-Z0-9_-]+)\s*\)$/i);
    if (aggDirectMatch) {
      parts.push({
        expr: actualExpr,
        alias,
        isAggregate: true,
        func: aggDirectMatch[1],
        fieldRef: aggDirectMatch[2]
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
 * Evaluate SELECT expression for a row with CASE WHEN support
 */
function evaluateSelectExpression(expr: string, row: any, fieldMetadata?: Record<string, any>): any {
  // Handle CASE WHEN expressions
  const caseMatch = expr.match(/CASE\s+WHEN\s+(.+?)\s+THEN\s+(.+?)(?:\s+WHEN\s+(.+?)\s+THEN\s+(.+?))*(?:\s+ELSE\s+(.+?))?\s+END/i);
  if (caseMatch) {
    return evaluateCaseExpression(expr, row);
  }
  
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
  
  // Evaluate complex expressions with functions (pass fieldMetadata)
  try {
    return evaluateExpression(expr, row, fieldMetadata);
  } catch (e) {
    console.error('Expression evaluation error:', e);
    return null;
  }
}

/**
 * Evaluate CASE WHEN expressions
 */
function evaluateCaseExpression(caseExpr: string, row: any): any {
  try {
    // Extract all WHEN ... THEN ... clauses
    const whenMatches = [...caseExpr.matchAll(/WHEN\s+(.+?)\s+THEN\s+(.+?)(?=\s+WHEN|\s+ELSE|\s+END)/gi)];
    
    for (const match of whenMatches) {
      const condition = match[1].trim();
      const value = match[2].trim();
      
      // Evaluate condition
      if (evaluateWhereCondition(condition, row)) {
        // Evaluate and return the value
        return evaluateSelectExpression(value, row);
      }
    }
    
    // Check for ELSE clause
    const elseMatch = caseExpr.match(/ELSE\s+(.+?)\s+END/i);
    if (elseMatch) {
      const elseValue = elseMatch[1].trim();
      return evaluateSelectExpression(elseValue, row);
    }
    
    return null;
  } catch (e) {
    console.error('CASE expression evaluation error:', e);
    return null;
  }
}

/**
 * Evaluate WHERE/HAVING condition with enhanced operator support
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
  
  try {
    // Handle IS NULL / IS NOT NULL
    processedCondition = processedCondition.replace(/(\w+|'[^']+')\s+IS\s+NOT\s+NULL/gi, (match, field) => {
      const cleanField = field.replace(/'/g, '');
      const value = field.startsWith("'") ? field.slice(1, -1) : row[cleanField];
      return value !== null && value !== undefined ? 'true' : 'false';
    });
    
    processedCondition = processedCondition.replace(/(\w+|'[^']+')\s+IS\s+NULL/gi, (match, field) => {
      const cleanField = field.replace(/'/g, '');
      const value = field.startsWith("'") ? field.slice(1, -1) : row[cleanField];
      return value === null || value === undefined ? 'true' : 'false';
    });
    
    // Handle IN operator
    processedCondition = processedCondition.replace(/(\w+|'[^']+')\s+IN\s*\(([^)]+)\)/gi, (match, field, list) => {
      const cleanField = field.replace(/'/g, '');
      const fieldValue = field.startsWith("'") ? field.slice(1, -1) : row[cleanField];
      const values = list.split(',').map((v: string) => {
        const trimmed = v.trim();
        return trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1) : trimmed;
      });
      return values.includes(String(fieldValue)) ? 'true' : 'false';
    });
    
    // Handle NOT IN operator
    processedCondition = processedCondition.replace(/(\w+|'[^']+')\s+NOT\s+IN\s*\(([^)]+)\)/gi, (match, field, list) => {
      const cleanField = field.replace(/'/g, '');
      const fieldValue = field.startsWith("'") ? field.slice(1, -1) : row[cleanField];
      const values = list.split(',').map((v: string) => {
        const trimmed = v.trim();
        return trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1) : trimmed;
      });
      return !values.includes(String(fieldValue)) ? 'true' : 'false';
    });
    
    // Handle BETWEEN operator
    processedCondition = processedCondition.replace(/(\w+|'[^']+'|\d+)\s+BETWEEN\s+([^\s]+)\s+AND\s+([^\s]+)/gi, (match, field, min, max) => {
      const cleanField = field.replace(/'/g, '');
      const fieldValue = parseFloat(field.startsWith("'") ? field.slice(1, -1) : (row[cleanField] ?? field));
      const minVal = parseFloat(min.replace(/'/g, ''));
      const maxVal = parseFloat(max.replace(/'/g, ''));
      return (fieldValue >= minVal && fieldValue <= maxVal) ? 'true' : 'false';
    });
    
    // Handle LIKE operator
    processedCondition = processedCondition.replace(/([^\s]+)\s+LIKE\s+'([^']+)'/gi, (match, field, pattern) => {
      const fieldValue = String(row[field] ?? '');
      const regexPattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
      const regex = new RegExp('^' + regexPattern + '$', 'i');
      return regex.test(fieldValue) ? 'true' : 'false';
    });
    
    // Handle NOT LIKE operator
    processedCondition = processedCondition.replace(/([^\s]+)\s+NOT\s+LIKE\s+'([^']+)'/gi, (match, field, pattern) => {
      const fieldValue = String(row[field] ?? '');
      const regexPattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
      const regex = new RegExp('^' + regexPattern + '$', 'i');
      return !regex.test(fieldValue) ? 'true' : 'false';
    });
    
    // Handle NOT operator (before converting other operators)
    processedCondition = processedCondition.replace(/\bNOT\s+\(/gi, '!(');
    
    // Convert SQL operators to JavaScript
    processedCondition = processedCondition.replace(/\s+AND\s+/gi, ' && ');
    processedCondition = processedCondition.replace(/\s+OR\s+/gi, ' || ');
    processedCondition = processedCondition.replace(/\s*<>\s*/g, ' !== ');
    processedCondition = processedCondition.replace(/\s*!=\s*/g, ' !== ');
    processedCondition = processedCondition.replace(/\s*=\s*/g, ' === ');
    
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
        // Check if value expression contains a function, CASE WHEN, or arithmetic
        if (valueExpression.startsWith('FUNC::')) {
          const funcExpr = valueExpression.substring(6);
          const row = {
            submission_id: submission.submission_ref_id || submission.id,
            ...(submission.submission_data as Record<string, any>)
          };
          
          // Handle CASE WHEN expressions
          if (/CASE\s+WHEN/i.test(funcExpr)) {
            newValue = evaluateCaseExpression(funcExpr, row);
          } else if (/[+\-*\/]/.test(funcExpr)) {
            // Handle arithmetic expressions
            const arithmeticExpr = funcExpr.replace(/FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)/gi, (_, fieldId) => {
              return String(row[fieldId] ?? 0);
            });
            try {
              newValue = new Function('return ' + arithmeticExpr)();
            } catch (e) {
              console.error('Arithmetic evaluation error:', e);
              newValue = funcExpr;
            }
          } else {
            // Regular function evaluation
            newValue = evaluateExpression(funcExpr.replace(/FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)/gi, '$1'), row);
          }
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
