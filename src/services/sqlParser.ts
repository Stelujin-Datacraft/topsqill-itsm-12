
import { supabase } from '@/integrations/supabase/client';
import { 
  createLoopContext, 
  executeDeclare, 
  executeSet, 
  executeIfElse,
  executeWhileLoop, 
  replaceVariables,
  type LoopContext 
} from './sqlLoops';
import { userFunctionRegistry } from './sqlUserFunctions';

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
 * 4. Handle CREATE FUNCTION statements
 * 5. Handle DECLARE, SET, and WHILE loop statements
 */
export function parseUserQuery(input: string): ParseResult {
  const errors: string[] = []
  const cleaned = input.trim().replace(/;$/, '') // drop trailing semicolon

  // Check if this is a CREATE FUNCTION statement
  if (/^CREATE\s+FUNCTION\s+/i.test(cleaned)) {
    return { sql: `-- CREATE_FUNCTION\n${cleaned}`, errors: [] };
  }

  // Check if this is a DECLARE statement
  if (/^DECLARE\s+@/i.test(cleaned)) {
    return { sql: `-- DECLARE\n${cleaned}`, errors: [] };
  }

  // Check if this is a SET statement
  if (/^SET\s+@/i.test(cleaned)) {
    return { sql: `-- SET\n${cleaned}`, errors: [] };
  }

  // Check if this is an IF statement
  if (/^IF\s+/i.test(cleaned)) {
    return { sql: `-- IF_ELSE\n${cleaned}`, errors: [] };
  }

  // Check if this is a WHILE loop
  if (/^WHILE\s+/i.test(cleaned)) {
    return { sql: `-- WHILE_LOOP\n${cleaned}`, errors: [] };
  }

  // Check if this is an UPDATE FORM query
  if (/^UPDATE\s+FORM\s+/i.test(cleaned)) {
    return parseUpdateFormQuery(cleaned)
  }

  // Check if this is an INSERT query (with or without FORM keyword)
  if (/^INSERT\s+(?:INTO\s+)?(?:FORM\s+)?/i.test(cleaned)) {
    return parseInsertQuery(cleaned)
  }

  // 1. Only allow SELECT for non-UPDATE queries
  if (!/^SELECT\s+/i.test(cleaned)) {
    errors.push('Only SELECT, INSERT, and UPDATE FORM queries are allowed.')
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
  // Support both quoted and unquoted form UUIDs as table names
  const distinctMatch = normalized.match(/^SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM\s+['""]?([0-9a-fA-F\-]{36})['""]?(.*)$/is)
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
  const whereMatch = restOfQuery.match(/\s+WHERE\s+(.+?)(?=\s+(?:GROUP BY|ORDER BY|LIMIT|OFFSET)|$)/is)
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
 * 
 * Supported value syntaxes:
 * 1. FIELD("source-field-id") - Copy value from another field
 * 2. VALUE_OF("source-field-id") - Alternative syntax for copying field value  
 * 3. 'static text' - Set a static text value
 * 4. FIELD("field-id") + 10 - Arithmetic with field values
 * 5. UPPER(FIELD("field-id")) - Functions applied to field values
 * 6. CASE WHEN ... - Conditional logic
 */
export function parseUpdateFormQuery(input: string): ParseResult {
  const errors: string[] = []

  console.log('📝 UPDATE Parser - Input query:', input);

  // Parse the UPDATE FORM syntax with flexible WHERE clause
  // Supports both: WHERE submission_ref_id = 'id' and WHERE FIELD('field_id') operator 'value'
  // Also supports subqueries with multiple lines
  // Strategy: Find the LAST WHERE that's not inside parentheses (i.e., belongs to UPDATE, not a subquery)
  const updateMatch = input.match(
    /^UPDATE\s+FORM\s+['""]([0-9a-fA-F\-]{36})['"\"]\s+SET\s+FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*=\s*([\s\S]+)\s+WHERE\s+((?:submission_id|submission_ref_id)\s*(?:=|!=)\s*['"]?[^'";\s]+['"]?)[\s;]*$/im
  )

  if (!updateMatch) {
    errors.push('Invalid UPDATE FORM syntax. Expected: UPDATE FORM \'form_id\' SET FIELD(\'field_id\') = value WHERE condition')
    return { errors }
  }

  const [, formId, fieldId, valueExpression, whereClause] = updateMatch

  console.log('📝 UPDATE Parser - Parsed components:');
  console.log('  - Form ID:', formId);
  console.log('  - Target Field ID:', fieldId);
  console.log('  - Value Expression (raw):', valueExpression);
  console.log('  - Where Clause:', whereClause);

  // Transform value expression to handle FIELD() syntax, functions, arithmetic, CASE WHEN, and SUBQUERIES
  let transformedValue = valueExpression.trim()
  
  console.log('🔍 UPDATE Parser - Processing value expression:', transformedValue);
  console.log('🔍 UPDATE Parser - Value length:', transformedValue.length);
  console.log('🔍 UPDATE Parser - Value char codes:', [...transformedValue.slice(0, 20)].map(c => `${c}(${c.charCodeAt(0)})`).join(' '));
  
  // Check for subquery (SELECT statement wrapped in parentheses)
  const hasSubquery = /^\s*\(\s*SELECT\s+/i.test(transformedValue);
  
  // Check for CASE WHEN expressions
  const hasCaseWhen = /CASE\s+WHEN/i.test(transformedValue);
  
  // Check for arithmetic expressions (e.g., FIELD('id') + 1, value * 2)
  // Use operators surrounded by whitespace to avoid matching hyphens inside UUIDs
  const hasArithmetic = /\s[+\-*\/]\s/.test(transformedValue) && !/\s+AND\s+|\s+OR\s+/i.test(transformedValue);

  // Store function metadata for UPDATE query execution
  const functionPattern = /^(UPPER|LOWER|CONCAT|REPLACE|TRIM|LTRIM|RTRIM|ROUND|CEIL|FLOOR|ABS|COALESCE|NOW|CURRENT_TIMESTAMP|IF|LEFT|RIGHT|SUBSTRING|IFNULL|CASE)\s*\(/i;
  const hasFunction = functionPattern.test(transformedValue);
  
  console.log('🔍 UPDATE Parser - Expression analysis:');
  console.log('  - Has Subquery:', hasSubquery);
  console.log('  - Has CASE WHEN:', hasCaseWhen);
  console.log('  - Has Arithmetic:', hasArithmetic);
  console.log('  - Has Function:', hasFunction);
  
  if (hasSubquery) {
    // Store the subquery for later execution
    transformedValue = `SUBQUERY::${transformedValue}`;
    console.log('✅ UPDATE Parser - Storing as SUBQUERY for runtime evaluation:', transformedValue);
  } else if (hasCaseWhen || hasFunction || hasArithmetic) {
    // Store the original expression with FIELD() references for later evaluation
    transformedValue = `FUNC::${transformedValue}`;
    console.log('✅ UPDATE Parser - Storing as FUNC for runtime evaluation:', transformedValue);
  } else {
    // Handle FIELD() or VALUE_OF() references for simple assignments
    console.log('🔍 UPDATE Parser - Looking for FIELD() or VALUE_OF() references');
    console.log('  - Original value:', transformedValue);
    
    // Permissive pattern to match VALUE_OF() or FIELD() with any quote type (including curly quotes)
    // Matches: VALUE_OF("uuid"), VALUE_OF('uuid'), FIELD("uuid"), FIELD('uuid'), and curly quote variants
    const fieldRefPattern = /(?:VALUE_OF|FIELD)\s*\(\s*['"""]([0-9a-fA-F-]{36})['"""\s]*\)/gi;
    
    const testMatch = transformedValue.match(fieldRefPattern);
    console.log('  - Pattern test result:', testMatch);
    
    if (testMatch && testMatch.length > 0) {
      console.log('✅ Found field reference patterns:', testMatch);
      
      // Replace VALUE_OF() or FIELD() with FIELD_REF:: prefix
      transformedValue = transformedValue.replace(
        fieldRefPattern,
        (fullMatch, uuid) => {
          console.log('  - Replacing:', fullMatch, '-> FIELD_REF::' + uuid);
          return `FIELD_REF::${uuid}`;
        }
      );
      
      console.log('✅ Transformed value:', transformedValue);
    } else {
      console.log('ℹ️ No field references found - treating as static value');
      console.log('  - To copy a field value, use: VALUE_OF("field-id") or FIELD("field-id")');
    }
  }

  // Parse WHERE clause
  let sqlWhereClause = ''
  
  // Check for boolean literals (true, false, 1, 0)
  const trimmedWhere = whereClause.trim();
  if (/^(true|false|1|0)$/i.test(trimmedWhere)) {
    const boolValue = trimmedWhere.toLowerCase();
    if (boolValue === 'true' || boolValue === '1') {
      sqlWhereClause = 'TRUE';  // Match all records
    } else {
      sqlWhereClause = 'FALSE';  // Match no records
    }
  } else if (whereClause.match(/(submission_id|submission_ref_id)\s*(=|!=)\s*['""]?([^'"\s]+)['""]?/i)) {
    // Check if it's a submission_id or submission_ref_id condition
    const submissionIdMatch = whereClause.match(/(submission_id|submission_ref_id)\s*(=|!=)\s*['""]?([^'"\s]+)['""]?/i)
    const operator = submissionIdMatch[2]
    const submissionId = submissionIdMatch[3]
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
      errors.push('Invalid WHERE clause. Use: WHERE true OR WHERE submission_id/submission_ref_id = \'id\' OR WHERE FIELD(\'field_id\') operator \'value\'')
      return { errors }
    }
  }

  // Build the final SQL - store metadata for batch update using unique delimiter
  const sql = `UPDATE||BATCH||${formId}||${fieldId}||${transformedValue}||${sqlWhereClause}`

  return { sql, errors }
}

/**
 * Parse INSERT query syntax (with or without FORM keyword)
 * Supports:
 * 1. INSERT INTO form_id (columns) VALUES (values)
 * 2. INSERT INTO form_id SELECT ...
 * 3. INSERT form_id (columns) VALUES (values) - without INTO
 * 4. INSERT INTO "form_id" (columns) VALUES (values) - with quotes
 * 5. Columns can be field names, field IDs (UUIDs), or FIELD("field-id") syntax
 */
export function parseInsertQuery(input: string): ParseResult {
  const errors: string[] = []
  
  // Flexible pattern to match INSERT with or without INTO/FORM keywords
  // Updated to handle nested parentheses in FIELD() syntax
  const insertPattern = /^INSERT\s+(?:INTO\s+)?(?:FORM\s+)?(['""]?[0-9a-fA-F\-]{36}['""]?)\s*(?:\(([^)]*(?:\([^)]*\)[^)]*)*)\))?\s+(?:VALUES|SELECT)/i;
  
  const match = input.match(insertPattern);
  
  console.log('parseInsertQuery Debug:', { input, match, matchedFormId: match?.[1], matchedColumns: match?.[2] });
  
  if (!match) {
    errors.push('Invalid INSERT syntax. Use: INSERT INTO form_id (columns) VALUES (values) or INSERT INTO form_id SELECT ...');
    return { errors };
  }
  
  // Extract form_id (remove quotes if present)
  const formId = match[1].replace(/['"]/g, '');
  
  // Validate form_id is a valid UUID
  const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidPattern.test(formId)) {
    errors.push('Form ID must be a valid UUID');
    return { errors };
  }
  
  console.log('parseInsertQuery Success:', { formId });
  
  // Return the original query for execution
  // The executeInsertQuery function will handle the actual parsing and execution
  // including FIELD() syntax in column names
  return { sql: input, errors };
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
  userInput: string,
  loopContext?: LoopContext
): Promise<QueryResult> {
  // Initialize loop context if not provided
  if (!loopContext) {
    loopContext = createLoopContext();
  }

  const { sql, errors: parseErrors } = parseUserQuery(userInput)
  if (parseErrors.length) {
    return { columns: [], rows: [], errors: parseErrors }
  }

  try {
    console.log('Executing SQL:', sql);

    // Handle CREATE FUNCTION
    if (sql?.startsWith('-- CREATE_FUNCTION')) {
      try {
        const functionDef = sql.replace('-- CREATE_FUNCTION\n', '');
        userFunctionRegistry.createFunction(functionDef);
        return {
          columns: ['Status'],
          rows: [['Function created successfully']],
          errors: []
        };
      } catch (error) {
        return {
          columns: [],
          rows: [],
          errors: [error instanceof Error ? error.message : 'Failed to create function']
        };
      }
    }

    // Handle DECLARE statements
    if (sql?.startsWith('-- DECLARE')) {
      try {
        const declareStmt = sql.replace('-- DECLARE\n', '');
        executeDeclare(declareStmt, loopContext);
        return {
          columns: ['Status'],
          rows: [['Variable declared']],
          errors: []
        };
      } catch (error) {
        return {
          columns: [],
          rows: [],
          errors: [error instanceof Error ? error.message : 'Failed to declare variable']
        };
      }
    }

    // Handle SET statements
    if (sql?.startsWith('-- SET')) {
      try {
        const setStmt = sql.replace('-- SET\n', '');
        executeSet(setStmt, loopContext);
        const varMatch = setStmt.match(/@(\w+)/);
        const varName = varMatch ? varMatch[1] : 'variable';
        const value = loopContext.variables.get(varName);
        return {
          columns: ['Variable', 'Value'],
          rows: [[`@${varName}`, String(value)]],
          errors: []
        };
      } catch (error) {
        return {
          columns: [],
          rows: [],
          errors: [error instanceof Error ? error.message : 'Failed to set variable']
        };
      }
    }

    // Handle IF-ELSE statements
    if (sql?.startsWith('-- IF_ELSE')) {
      try {
        const ifStmt = sql.replace('-- IF_ELSE\n', '');
        const results = executeIfElse(ifStmt, loopContext, (statements, ctx) => {
          const blockResults: any[] = [];
          for (const stmt of statements) {
            // Handle SET in IF block
            if (/^SET\s+@/i.test(stmt)) {
              executeSet(stmt, ctx);
            }
          }
          return blockResults;
        });
        
        // Return loop context variables as result
        const varColumns = ['Variable', 'Value'];
        const varRows = Array.from(loopContext.variables.entries()).map(([key, value]) => [
          `@${key}`,
          String(value)
        ]);
        
        return {
          columns: varColumns,
          rows: varRows,
          errors: []
        };
      } catch (error) {
        return {
          columns: [],
          rows: [],
          errors: [error instanceof Error ? error.message : 'Failed to execute IF statement']
        };
      }
    }

    // Handle WHILE loops
    if (sql?.startsWith('-- WHILE_LOOP')) {
      try {
        const whileStmt = sql.replace('-- WHILE_LOOP\n', '');
        const results = executeWhileLoop(whileStmt, loopContext, (statements, ctx) => {
          const blockResults: any[] = [];
          for (const stmt of statements) {
            // Handle SET in loop body
            if (/^SET\s+@/i.test(stmt)) {
              executeSet(stmt, ctx);
            }
          }
          return blockResults;
        });
        
        // Return loop context variables as result
        const varColumns = ['Variable', 'Final Value'];
        const varRows = Array.from(loopContext.variables.entries()).map(([key, value]) => [
          `@${key}`,
          String(value)
        ]);
        
        return {
          columns: varColumns,
          rows: varRows,
          errors: []
        };
      } catch (error) {
        return {
          columns: [],
          rows: [],
          errors: [error instanceof Error ? error.message : 'Failed to execute loop']
        };
      }
    }
    
    // Handle INSERT queries
    if (sql?.match(/^INSERT\s+INTO/i)) {
      return await executeInsertQuery(sql, loopContext);
    }

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
      .select('id, label, custom_config, field_type')
      .eq('form_id', formUuid)
      .order('field_order', { ascending: true });
    
    // Build field metadata for WEIGHTED_VALUE support
    const fieldMetadata: Record<string, any> = {};
    if (formFields) {
      formFields.forEach(field => {
        // Parse custom_config if it's a string
        let customConfig: Record<string, any> | null = null;
        if (field.custom_config) {
          if (typeof field.custom_config === 'string') {
            try {
              customConfig = JSON.parse(field.custom_config);
            } catch (e) {
              console.error('Failed to parse custom_config:', field.custom_config);
            }
          } else {
            customConfig = field.custom_config as Record<string, any>;
          }
        }
        
        const weightage = customConfig?.weightage || 1;
        // Map by both field ID and label for flexible lookup
        fieldMetadata[field.id] = { label: field.label, weightage };
        fieldMetadata[field.label] = { id: field.id, weightage };
      });
    }
    
    // Expand SELECT * to all form fields
    let expandedSelectExpr = selectExpr;
    if (selectExpr.trim() === '*') {
      if (formFields && formFields.length > 0) {
        // Filter to only include actual input fields (exclude display-only fields)
        const nonInputFieldTypes = ['label', 'divider', 'heading', 'paragraph', 'html', 'image'];
        const inputFields = formFields.filter(field => !nonInputFieldTypes.includes(field.field_type));
        
        if (inputFields.length > 0) {
          // Create SELECT expression with all input field IDs
          expandedSelectExpr = inputFields.map(field => `FIELD("${field.id}")`).join(', ');
        } else {
          // No input fields - just show system columns
          expandedSelectExpr = 'submission_id, submission_ref_id, submitted_by, submitted_at';
        }
      } else {
        // No fields defined - just show system columns
        expandedSelectExpr = 'submission_id, submission_ref_id, submitted_by, submitted_at';
      }
    }
    
    console.log('=== Field Metadata Built ===');
    console.log('Field Metadata:', fieldMetadata);
    console.log('Form Fields:', formFields);
    
    // Transform submissions into rows with flattened field access
    let rows = submissions.map(sub => ({
      // Stable aliases for identifiers
      submission_id: sub.submission_ref_id || sub.id,
      submission_ref_id: sub.submission_ref_id,
      id: sub.id,
      submitted_by: sub.submitted_by,
      submitted_at: sub.submitted_at,
      ...(sub.submission_data as Record<string, any>)
    }));
    
    // Apply WHERE filter
    if (whereExpr) {
      // Check if WHERE contains a subquery
      if (whereExpr.includes('SELECT')) {
        // Handle subquery - extract and execute it first
        const subqueryMatch = whereExpr.match(/submission_id\s*=\s*\(([\s\S]+)\)/i);
        if (subqueryMatch) {
          try {
            const subqueryResult = await executeSubquery(subqueryMatch[1], loopContext);
            if (subqueryResult && subqueryResult.rows.length > 0 && subqueryResult.rows[0].length > 0) {
              const targetRefId = subqueryResult.rows[0][0];
              rows = rows.filter(row => row.submission_id === targetRefId);
            } else {
              rows = []; // No matching subquery result
            }
          } catch (e) {
            console.error('Subquery execution error:', e);
            return { columns: [], rows: [], errors: ['Failed to execute subquery: ' + (e instanceof Error ? e.message : String(e))] };
          }
        }
      } else {
        // Regular WHERE evaluation
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
    }
    
    // Parse SELECT expressions
    const selectParts = parseSelectExpressions(expandedSelectExpr);
    const isAggregateQuery = selectParts.some(p => p.isAggregate);
    
    // Generate column headers - replace field IDs with labels
    const columns = selectParts.map(part => {
      // Check if the alias is a field ID (UUID format)
      const isFieldId = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(part.alias);
      
      if (isFieldId && fieldMetadata[part.alias]) {
        // Replace field ID with field label
        return fieldMetadata[part.alias].label;
      }
      
      return part.alias;
    });
    
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
        } else if (part.jsonPath && part.fieldRef) {
          // Handle JSON path extraction
          const firstRow = groupRows[0];
          const fieldValue = firstRow[part.fieldRef];
          
          try {
            // Parse the field value as JSON if it's a string
            let jsonData = typeof fieldValue === 'string' ? JSON.parse(fieldValue) : fieldValue;
            
            // Process the JSON path: -> 0 ->> 'submission_ref_id'
            const pathMatch = part.jsonPath.match(/->?\s*(\d+)\s*-?>>\s*['""]([^'"\"]+)['"\"]/);
            if (pathMatch) {
              const arrayIndex = parseInt(pathMatch[1], 10);
              const key = pathMatch[2];
              
              if (Array.isArray(jsonData) && jsonData[arrayIndex]) {
                row.push(jsonData[arrayIndex][key] || null);
              } else {
                row.push(null);
              }
            } else {
              row.push(null);
            }
          } catch (e) {
            console.error('Failed to parse JSON path:', e);
            row.push(null);
          }
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
    
    // Post-process: Replace field IDs with labels in cross-reference data
    let processedResults = await replaceFieldIdsWithLabels(finalResults);
    
    // Post-process: Replace user/group IDs with names in submission-access data
    processedResults = await replaceSubmissionAccessIdsWithNames(processedResults);
    
    return { columns, rows: processedResults, errors: [] };
    
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
  jsonPath?: string;
}> {
  const parts: Array<any> = [];
  const expressions = splitTopLevelCommas(selectExpr);
  
  expressions.forEach(expr => {
    const trimmed = expr.trim();
    
    // Check for alias
    const aliasMatch = trimmed.match(/^(.+?)\s+as\s+(\w+)$/i);
    const actualExpr = aliasMatch ? aliasMatch[1].trim() : trimmed;
    const alias = aliasMatch ? aliasMatch[2] : generateAlias(actualExpr);
    
    // Check for JSON path expressions: (FIELD(...)::jsonb -> 0 ->> 'key') or FIELD(...)::jsonb -> 0 ->> 'key'
    const jsonPathMatch = actualExpr.match(/^\(?\s*FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)\s*::jsonb\s*(.+?)\s*\)?$/i);
    if (jsonPathMatch) {
      parts.push({
        expr: actualExpr,
        alias,
        isAggregate: false,
        fieldRef: jsonPathMatch[1],
        jsonPath: jsonPathMatch[2].trim()
      });
      return;
    }
    
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
  // Handle WEIGHTED_VALUE with single field reference
  const weightedSingleMatch = expr.match(/WEIGHTED_VALUE\s*\(\s*FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)\s*\)/i);
  if (weightedSingleMatch) {
    const fieldId = weightedSingleMatch[1];
    const fieldValue = row[fieldId] ?? 0;
    const weightage = fieldMetadata?.[fieldId]?.weightage || 1;
    
    console.log('=== WEIGHTED_VALUE Debug ===');
    console.log('Field ID:', fieldId);
    console.log('Field Value from row:', fieldValue);
    console.log('Field Metadata:', fieldMetadata?.[fieldId]);
    console.log('Weightage:', weightage);
    console.log('Calculation:', fieldValue, 'x', weightage, '=', (parseFloat(fieldValue) || 0) * weightage);
    console.log('Row keys:', Object.keys(row));
    
    return (parseFloat(fieldValue) || 0) * weightage;
  }
  
  // Handle FIELD_WEIGHTAGE function
  const weightageMatch = expr.match(/FIELD_WEIGHTAGE\s*\(\s*FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)\s*\)/i);
  if (weightageMatch) {
    const fieldId = weightageMatch[1];
    const weightage = fieldMetadata?.[fieldId]?.weightage || 1;
    
    console.log('=== FIELD_WEIGHTAGE Debug ===');
    console.log('Field ID:', fieldId);
    console.log('Field Metadata:', fieldMetadata?.[fieldId]);
    console.log('Weightage:', weightage);
    
    return weightage;
  }
  
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
    const value = row[expr] ?? null;
    return serializeFieldValue(value);
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
  processedCondition = processedCondition.replace(/\bsubmission_ref_id\b/gi, () => {
    return `'${row.submission_ref_id}'`;
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
    const value = row[fieldMatch[1]] ?? null;
    return serializeFieldValue(value);
  }
  
  // Handle submission_id alias
  if (fieldRef === 'submission_id') {
    return row.submission_id ?? null;
  }
  
  // Direct field reference
  const value = row[fieldRef] ?? null;
  return serializeFieldValue(value);
}

/**
 * Execute a subquery and return its result
 */
async function executeSubquery(subqueryStr: string, loopContext?: LoopContext): Promise<QueryResult> {
  const subquery = subqueryStr.trim();
  
  // Parse the subquery to extract form_id and WHERE clause
  const subqueryMatch = subquery.match(/SELECT\s+(.+?)\s+FROM\s+['""]?([0-9a-fA-F\-]{36})['""]?\s+WHERE\s+(.+)/is);
  if (!subqueryMatch) {
    throw new Error('Invalid subquery syntax');
  }
  
  const [, selectExpr, formId, whereClause] = subqueryMatch;
  
  // Fetch submissions from the subquery form
  const { data: submissions, error } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('form_id', formId);
  
  if (error) {
    throw new Error(`Subquery failed: ${error.message}`);
  }
  
  if (!submissions || submissions.length === 0) {
    return { columns: [], rows: [], errors: [] };
  }
  
  // Transform to rows with helpful aliases
  let rows = submissions.map(sub => ({
    // Keep a stable "submission_id" alias used by the query engine
    submission_id: sub.submission_ref_id || sub.id,
    // Also expose both raw identifiers for WHERE clauses
    submission_ref_id: sub.submission_ref_id,
    id: sub.id,
    submitted_by: sub.submitted_by,
    submitted_at: sub.submitted_at,
    ...(sub.submission_data as Record<string, any>)
  }));
  
  // Apply WHERE filter - replace submission_id with actual check
  const normalizedWhere = whereClause.replace(/submission_id/g, 'submission_id');
  rows = rows.filter(row => {
    try {
      return evaluateWhereCondition(normalizedWhere, row);
    } catch (e) {
      console.error('Subquery WHERE evaluation error:', e);
      return false;
    }
  });
  
  if (rows.length === 0) {
    return { columns: [], rows: [], errors: [] };
  }
  
  // Evaluate the SELECT expression
  // Handle FIELD() with JSONB operators like: FIELD("uuid")::jsonb -> 0 ->> 'submission_ref_id'
  const fieldMatch = selectExpr.match(/FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)::jsonb\s*(.+)/i);
  
  if (fieldMatch) {
    const [, fieldId, jsonPath] = fieldMatch;
    let fieldValue = rows[0][fieldId];
    
    // If fieldValue is null or undefined, return empty result
    if (fieldValue == null) {
      return { columns: [], rows: [], errors: [] };
    }
    
    // Parse field value if it's a JSON string
    if (typeof fieldValue === 'string') {
      try {
        fieldValue = JSON.parse(fieldValue);
      } catch (e) {
        console.error('Failed to parse field value as JSON:', e);
        return { columns: [], rows: [], errors: ['Failed to parse field value'] };
      }
    }
    
    // Parse JSONB path like: -> 0 ->> 'submission_ref_id'
    let result = fieldValue;
    
    if (jsonPath) {
      const pathParts = jsonPath.trim().match(/(->>?)\s*(\d+|'[^']+')/g);
      if (pathParts) {
        for (const part of pathParts) {
          const [, operator, key] = part.match(/(->>?)\s*(\d+|'([^']+)')/) || [];
          
          if (operator === '->') {
            // Array/object access
            const index = key.replace(/'/g, '');
            result = Array.isArray(result) ? result[parseInt(index)] : result[index];
          } else if (operator === '->>') {
            // Text extraction
            const keyName = key.replace(/'/g, '');
            result = result?.[keyName];
          }
        }
      }
    }
    
    return {
      columns: ['result'],
      rows: [[result]],
      errors: []
    };
  }
  
  // Simple field selection
  const value = evaluateFieldReference(selectExpr.trim(), rows[0]);
  return {
    columns: ['result'],
    rows: [[value]],
    errors: []
  };
}

/**
 * Serialize field values properly for display in query results
 */
function serializeFieldValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle arrays (like cross-reference field values)
  if (Array.isArray(value)) {
    // If it's an array of primitives, join with commas
    if (value.length === 0) return null;
    if (typeof value[0] === 'string' || typeof value[0] === 'number') {
      return value.join(', ');
    }
    
    // If it's an array of cross-reference objects, format them nicely
    if (typeof value[0] === 'object' && value[0] !== null) {
      const formatted = value.map(item => {
        // Create a new object with submission_ref_id and form_id first, remove id, and flatten displayData
        const result: any = {};
        
        // Add submission_ref_id first if it exists
        if (item.submission_ref_id) {
          result.submission_ref_id = item.submission_ref_id;
        }
        
        // Add form_id after submission_ref_id
        if (item.form_id) {
          result.form_id = item.form_id;
        }
        
        // Flatten displayData into the main object (field values)
        if (item.displayData && typeof item.displayData === 'object') {
          Object.assign(result, item.displayData);
        }
        
        // Add any other properties except 'id', 'displayData', 'submission_ref_id', and 'form_id'
        Object.keys(item).forEach(key => {
          if (key !== 'id' && key !== 'displayData' && key !== 'submission_ref_id' && key !== 'form_id') {
            result[key] = item[key];
          }
        });
        
        return result;
      });
      
      // Return as formatted JSON string
      return JSON.stringify(formatted, null, 2);
    }
    
    // Otherwise stringify the array
    return JSON.stringify(value);
  }
  
  // Handle objects (like structured data)
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  // Return primitive values as-is
  return value;
}

/**
 * Replace field IDs with their labels in cross-reference data
 */
async function replaceFieldIdsWithLabels(results: any[][]): Promise<any[][]> {
  try {
    // Collect all unique field IDs from cross-reference data in results
    const fieldIds = new Set<string>();
    
    results.forEach(row => {
      row.forEach(cell => {
        if (typeof cell === 'string' && cell.startsWith('[')) {
          try {
            const parsed = JSON.parse(cell);
            if (Array.isArray(parsed)) {
              parsed.forEach(item => {
                if (item && typeof item === 'object') {
                  // Extract field IDs from the object (excluding submission_ref_id and other metadata)
                  Object.keys(item).forEach(key => {
                    // UUID pattern check (8-4-4-4-12 format)
                    if (key.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
                      fieldIds.add(key);
                    }
                  });
                }
              });
            }
          } catch (e) {
            // Not JSON or not cross-reference data, skip
          }
        }
      });
    });
    
    // If no field IDs found, return results as-is
    if (fieldIds.size === 0) {
      return results;
    }
    
    // Fetch field labels from database
    const { data: fields, error } = await supabase
      .from('form_fields')
      .select('id, label')
      .in('id', Array.from(fieldIds));
    
    if (error) {
      console.error('Error fetching field labels:', error);
      return results;
    }
    
    // Create field ID to label mapping
    const fieldIdToLabel = new Map<string, string>();
    fields?.forEach(field => {
      fieldIdToLabel.set(field.id, field.label);
    });
    
    // Replace field IDs with labels in results
    return results.map(row => 
      row.map(cell => {
        if (typeof cell === 'string' && cell.startsWith('[')) {
          try {
            const parsed = JSON.parse(cell);
            if (Array.isArray(parsed)) {
              const updated = parsed.map(item => {
                if (item && typeof item === 'object') {
                  const newItem: any = {};
                  
                  // Add submission_ref_id first if exists
                  if (item.submission_ref_id) {
                    newItem.submission_ref_id = item.submission_ref_id;
                  }
                  
                  // Replace field IDs with labels for other properties
                  Object.keys(item).forEach(key => {
                    if (key !== 'submission_ref_id') {
                      const label = fieldIdToLabel.get(key) || key;
                      newItem[label] = item[key];
                    }
                  });
                  
                  return newItem;
                }
                return item;
              });
              
              return JSON.stringify(updated, null, 2);
            }
          } catch (e) {
            // Not JSON or parsing error, return as-is
          }
        }
        return cell;
      })
    );
  } catch (error) {
    console.error('Error in replaceFieldIdsWithLabels:', error);
    return results;
  }
}

/**
 * Replace user and group IDs with names in submission-access data
 */
async function replaceSubmissionAccessIdsWithNames(results: any[][]): Promise<any[][]> {
  try {
    const userIds = new Set<string>();
    const groupIds = new Set<string>();
    
    // Collect all user and group IDs from submission-access data
    results.forEach(row => {
      row.forEach(cell => {
        if (typeof cell === 'string' && cell.startsWith('{')) {
          try {
            const parsed = JSON.parse(cell);
            if (parsed && typeof parsed === 'object') {
              // Check for users array
              if (Array.isArray(parsed.users)) {
                parsed.users.forEach((id: string) => {
                  if (typeof id === 'string' && id.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
                    userIds.add(id);
                  }
                });
              }
              // Check for groups array
              if (Array.isArray(parsed.groups)) {
                parsed.groups.forEach((id: string) => {
                  if (typeof id === 'string' && id.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
                    groupIds.add(id);
                  }
                });
              }
            }
          } catch (e) {
            // Not JSON or not submission-access data, skip
          }
        }
      });
    });
    
    // If no IDs found, return results as-is
    if (userIds.size === 0 && groupIds.size === 0) {
      return results;
    }
    
    // Fetch user names
    const userIdToName = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: users, error: userError } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .in('id', Array.from(userIds));
      
      if (!userError && users) {
        users.forEach(user => {
          userIdToName.set(user.id, user.email);
        });
      }
    }
    
    // Fetch group names
    const groupIdToName = new Map<string, string>();
    if (groupIds.size > 0) {
      const { data: groups, error: groupError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', Array.from(groupIds));
      
      if (!groupError && groups) {
        groups.forEach(group => {
          groupIdToName.set(group.id, group.name);
        });
      }
    }
    
    // Replace IDs with names in results
    return results.map(row => 
      row.map(cell => {
        if (typeof cell === 'string' && cell.startsWith('{')) {
          try {
            const parsed = JSON.parse(cell);
            if (parsed && typeof parsed === 'object') {
              const updated: any = { ...parsed };
              
              // Replace user IDs with names
              if (Array.isArray(updated.users)) {
                updated.users = updated.users.map((id: string) => 
                  userIdToName.get(id) || id
                );
              }
              
              // Replace group IDs with names
              if (Array.isArray(updated.groups)) {
                updated.groups = updated.groups.map((id: string) => 
                  groupIdToName.get(id) || id
                );
              }
              
              return JSON.stringify(updated, null, 2);
            }
          } catch (e) {
            // Not JSON or parsing error, return as-is
          }
        }
        return cell;
      })
    );
  } catch (error) {
    console.error('Error in replaceSubmissionAccessIdsWithNames:', error);
    return results;
  }
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
 * Execute INSERT query with support for complex operations
 */
async function executeInsertQuery(sql: string, loopContext?: LoopContext): Promise<QueryResult> {
  try {
    // Parse INSERT statement - handle nested parentheses in FIELD() syntax
    // First, find the form ID
    const formIdMatch = sql.match(/INSERT\s+(?:INTO\s+)?(?:FORM\s+)?(['""]?[0-9a-fA-F\-]{36}['""]?)/i);
    
    if (!formIdMatch) {
      return {
        columns: [],
        rows: [],
        errors: ['Invalid INSERT syntax. Form ID not found. Use: INSERT INTO form_id (field1, field2) VALUES (value1, value2)']
      };
    }

    const formId = formIdMatch[1].replace(/['"]/g, ''); // Remove quotes from form ID
    
    // Find columns part - handle nested parentheses
    let columnsPart = '';
    let columnsMatch = sql.match(/\(([^)]*(?:\([^)]*\)[^)]*)*)\)\s+(?:VALUES|SELECT)/i);
    if (columnsMatch) {
      columnsPart = columnsMatch[1];
    }
    
    console.log('INSERT Query Debug:', { formId, columnsPart });
    
    // Check if this is VALUES or SELECT
    const isSelect = /SELECT/i.test(sql);
    let valuesPart = '';
    let selectPart = '';
    
    if (isSelect) {
      const selectMatch = sql.match(/SELECT\s+(.+)$/is);
      if (selectMatch) {
        selectPart = selectMatch[1];
      }
    } else {
      // Extract VALUES part - handle nested parentheses
      const valuesMatch = sql.match(/VALUES\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/i);
      if (valuesMatch) {
        valuesPart = valuesMatch[1];
      }
      console.log('VALUES Debug:', { valuesPart });
    }

    // Get form fields for validation
    const { data: formFields, error: fieldsError } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId);

    if (fieldsError || !formFields) {
      return {
        columns: [],
        rows: [],
        errors: [`Form not found or error loading fields: ${fieldsError?.message}`]
      };
    }

    // Create field mapping (support both labels and IDs)
    const fieldMap = new Map(formFields.map(f => [f.label.toLowerCase(), f.id]));
    const fieldIdSet = new Set(formFields.map(f => f.id));
    
    // Helper function to resolve field ID from name, ID, or FIELD() syntax
    const resolveFieldId = (columnName: string): string | undefined => {
      // Check if it uses FIELD() syntax
      const fieldMatch = columnName.match(/FIELD\s*\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)/i);
      if (fieldMatch) {
        return fieldMatch[1]; // Return the UUID directly
      }
      
      // Check if it's already a valid UUID (field ID)
      if (fieldIdSet.has(columnName)) {
        return columnName;
      }
      // Otherwise, treat it as a field label
      return fieldMap.get(columnName.toLowerCase());
    };
    
    let insertData: any[] = [];

    if (selectPart) {
      // INSERT with SELECT - execute the SELECT query first
      const selectResult = await executeUserQuery(`SELECT ${selectPart}`, loopContext);
      
      if (selectResult.errors && selectResult.errors.length > 0) {
        return {
          columns: [],
          rows: [],
          errors: [`Error in SELECT clause: ${selectResult.errors.join(', ')}`]
        };
      }

      // Map SELECT results to insert data
      const columns = columnsPart ? columnsPart.split(',').map(c => c.trim()) : selectResult.columns;
      
      for (const row of selectResult.rows) {
        const submissionData: Record<string, any> = {};
        
        columns.forEach((col, idx) => {
          const fieldId = resolveFieldId(col);
          if (fieldId) {
            submissionData[fieldId] = Array.isArray(row) ? row[idx] : Object.values(row)[idx];
          }
        });
        
        insertData.push(submissionData);
      }
    } else if (valuesPart) {
      // INSERT with VALUES
      const columns = columnsPart ? columnsPart.split(',').map(c => c.trim()) : [];
      const values = splitTopLevelCommas(valuesPart);

      if (columns.length === 0) {
        return {
          columns: [],
          rows: [],
          errors: ['Column names are required for INSERT with VALUES']
        };
      }

      const submissionData: Record<string, any> = {};

      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        let value = values[i] ? values[i].trim() : '';

        // Handle FIELD() references
        if (value.match(/FIELD\s*\(/i)) {
          const fieldMatch = value.match(/FIELD\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"]\s*)?\)/i);
          if (fieldMatch) {
            const sourceFormId = fieldMatch[2] || formId;
            const sourceFieldLabel = fieldMatch[1];
            
            // Fetch the latest submission value
            const { data: submissions } = await supabase
              .from('form_submissions')
              .select('submission_data')
              .eq('form_id', sourceFormId)
              .order('submitted_at', { ascending: false })
              .limit(1);

            if (submissions && submissions.length > 0) {
              const sourceField = formFields.find(f => f.label.toLowerCase() === sourceFieldLabel.toLowerCase());
              if (sourceField) {
                value = submissions[0].submission_data[sourceField.id] || '';
              }
            }
          }
        } else {
          // Remove quotes and evaluate expressions
          value = value.replace(/^['"]|['"]$/g, '');
          
          // Handle loop variables
          if (loopContext && value.startsWith('@')) {
            const varName = value.substring(1);
            value = loopContext.variables.get(varName) || value;
          }
          
          // Handle arithmetic expressions
          if (value.match(/[\+\-\*\/]/) && !isNaN(eval(value.replace(/@/g, '')))) {
            try {
              value = eval(value.replace(/@/g, '')).toString();
            } catch (e) {
              // Keep original value if eval fails
            }
          }
        }

        const fieldId = resolveFieldId(column);
        if (fieldId) {
          submissionData[fieldId] = value;
        }
      }

      insertData.push(submissionData);
    }

    // Insert all records
    const results = [];
    for (const data of insertData) {
      const { data: submission, error: insertError } = await supabase
        .from('form_submissions')
        .insert({
          form_id: formId,
          submission_data: data,
          submitted_by: (await supabase.auth.getUser()).data.user?.id || 'system'
        })
        .select()
        .single();

      if (insertError) {
        results.push({ status: 'error', error: insertError.message });
      } else {
        results.push({ status: 'success', id: submission.id });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return {
      columns: ['Status', 'Records Inserted', 'Errors'],
      rows: [[
        'Completed',
        successCount.toString(),
        errorCount.toString()
      ]],
      errors: errorCount > 0 ? results.filter(r => r.status === 'error').map(r => r.error) : []
    };

  } catch (error) {
    return {
      columns: [],
      rows: [],
      errors: [`INSERT failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Execute UPDATE queries using Supabase client with support for SQL functions
 */
async function executeUpdateQuery(sql: string): Promise<QueryResult> {
  try {
    // Parse the batch update metadata using unique delimiter
    if (!sql.startsWith('UPDATE||BATCH||')) {
      return { columns: [], rows: [], errors: ['Invalid UPDATE query format'] };
    }

    const parts = sql.split('||');
    if (parts.length !== 6) {
      return { columns: [], rows: [], errors: ['Failed to parse UPDATE query parameters'] };
    }

    const formId = parts[2];
    const fieldId = parts[3];
    const valueExpression = parts[4];
    const whereClause = parts[5];

    console.log('🔍 UPDATE Executor - WHERE clause debug:');
    console.log('  - Form ID:', formId);
    console.log('  - WHERE clause:', whereClause);
    console.log('  - WHERE clause length:', whereClause.length);

    // Fetch all matching submissions based on WHERE clause
    let query = supabase
      .from('form_submissions')
      .select('id, submission_data, submission_ref_id')
      .eq('form_id', formId);

    // Apply WHERE filter for submission_ref_id or submission_id (both map to submission_ref_id column)
    const submissionIdMatch = whereClause.match(/(?:submission_ref_id|submission_id)\s+(=|!=)\s+'([^']+)'/i);
    console.log('  - Regex match result:', submissionIdMatch);
    
    if (submissionIdMatch) {
      const operator = submissionIdMatch[1];
      const submissionId = submissionIdMatch[2];
      console.log('  - Matched operator:', operator);
      console.log('  - Matched submission ID:', submissionId);
      if (operator === '=') {
        query = query.eq('submission_ref_id', submissionId);
      } else {
        query = query.neq('submission_ref_id', submissionId);
      }
    } else {
      console.log('  - ⚠️ WHERE clause did not match submission_id pattern');
    }

    const { data: submissions, error: fetchError } = await query;

    console.log('  - Query result:');
    console.log('    - Error:', fetchError);
    console.log('    - Submissions found:', submissions?.length || 0);
    if (submissions && submissions.length > 0) {
      console.log('    - First submission ref_id:', submissions[0].submission_ref_id);
    }

    if (fetchError) {
      return { columns: [], rows: [], errors: [fetchError.message] };
    }

    if (!submissions || submissions.length === 0) {
      return { columns: [], rows: [], errors: ['No submissions found matching the WHERE clause'] };
    }

    // Filter submissions based on FIELD() conditions or boolean literals
    let filteredSubmissions = submissions;
    
    // Check for boolean literals (TRUE/FALSE)
    if (whereClause === 'TRUE') {
      // Keep all submissions
      filteredSubmissions = submissions;
    } else if (whereClause === 'FALSE') {
      // Filter out all submissions
      filteredSubmissions = [];
    } else if (!submissionIdMatch) {
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
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 UPDATE Executor - Processing submission:', submission.id);
      console.log('🔄 UPDATE Executor - Value expression received:', valueExpression);
      console.log('🔄 UPDATE Executor - Expression type check:');
      console.log('  - Starts with FUNC::?', valueExpression.startsWith('FUNC::'));
      console.log('  - Starts with FIELD_REF::?', valueExpression.startsWith('FIELD_REF::'));
      console.log('  - Is static value?', !valueExpression.startsWith('FUNC::') && !valueExpression.startsWith('FIELD_REF::'));
      
      try {
        // Check if value expression contains a subquery, function, CASE WHEN, or arithmetic
        if (valueExpression.startsWith('SUBQUERY::')) {
          console.log('🔍 UPDATE Executor - Evaluating SUBQUERY expression');
          const subqueryExpr = valueExpression.substring(10).trim();
          console.log('🔍 Subquery expression:', subqueryExpr);
          
          // Parse the subquery: (SELECT FIELD("field-id") FROM "form-id" WHERE condition)
          const subqueryMatch = subqueryExpr.match(
            /^\s*\(\s*SELECT\s+FIELD\s*\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s+FROM\s+['""]([0-9a-fA-F\-]{36})['"\"]\s+WHERE\s+(.+?)\s*\)\s*$/i
          );
          
          if (!subqueryMatch) {
            console.error('Failed to parse subquery');
            newValue = null;
          } else {
            const [, selectFieldId, sourceFormId, subWhereClause] = subqueryMatch;
            console.log('🔍 Subquery parsed:');
            console.log('  - Select field:', selectFieldId);
            console.log('  - Source form:', sourceFormId);
            console.log('  - WHERE clause:', subWhereClause);
            
            // Parse WHERE clause: submission_ref_id = JSON_UNQUOTE(JSON_EXTRACT(FIELD("field-id"), '$[0].submission_ref_id'))
            const jsonExtractMatch = subWhereClause.match(
              /submission_ref_id\s*=\s*JSON_UNQUOTE\s*\(\s*JSON_EXTRACT\s*\(\s*FIELD\s*\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*,\s*['"](\$\[0\]\.submission_ref_id)['"]\s*\)\s*\)/i
            );
            
            if (!jsonExtractMatch) {
              console.error('Failed to parse JSON_EXTRACT in WHERE clause');
              newValue = null;
            } else {
              const [, crossRefFieldId, jsonPath] = jsonExtractMatch;
              console.log('🔍 JSON_EXTRACT parsed:');
              console.log('  - Cross-ref field:', crossRefFieldId);
              console.log('  - JSON path:', jsonPath);
              
              // Get the cross-reference value from current submission
              const crossRefValue = submission.submission_data[crossRefFieldId];
              console.log('🔍 Cross-reference field value:', crossRefValue);
              
              if (Array.isArray(crossRefValue) && crossRefValue.length > 0) {
                const linkedSubmissionRefId = crossRefValue[0]?.submission_ref_id;
                console.log('🔍 Linked submission ref ID:', linkedSubmissionRefId);
                
                if (linkedSubmissionRefId) {
                  // Query the source form to get the field value
                  const { data: linkedSubmissions, error: linkedError } = await supabase
                    .from('form_submissions')
                    .select('submission_data')
                    .eq('form_id', sourceFormId)
                    .eq('submission_ref_id', linkedSubmissionRefId)
                    .single();
                  
                  if (linkedError) {
                    console.error('Error fetching linked submission:', linkedError);
                    newValue = null;
                  } else if (linkedSubmissions) {
                    newValue = linkedSubmissions.submission_data[selectFieldId];
                    console.log('✅ Fetched value from linked submission:', newValue);
                  } else {
                    console.log('⚠️ No linked submission found');
                    newValue = null;
                  }
                } else {
                  console.log('⚠️ No submission_ref_id in cross-reference data');
                  newValue = null;
                }
              } else {
                console.log('⚠️ Cross-reference field is empty or not an array');
                newValue = null;
              }
            }
          }
        } else if (valueExpression.startsWith('FUNC::')) {
          console.log('📝 UPDATE Executor - Evaluating FUNC expression');
          const funcExpr = valueExpression.substring(6);
          console.log('📝 Function expression:', funcExpr);
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
          console.log('📝 Function result:', newValue);
        } else if (valueExpression.startsWith('FIELD_REF::')) {
          console.log('📋 UPDATE Executor - COPYING VALUE FROM FIELD');
          const sourceFieldId = valueExpression.substring(11); // Remove "FIELD_REF::" prefix
          console.log('📋 Source field ID:', sourceFieldId);
          console.log('📋 Current submission data:', JSON.stringify(submission.submission_data, null, 2));
          console.log('📋 Source field value:', submission.submission_data[sourceFieldId]);
          
          // Get the actual value from the source field
          const sourceValue = submission.submission_data[sourceFieldId];
          newValue = sourceValue !== undefined && sourceValue !== null ? sourceValue : '';
          
          console.log('📋 Value to copy:', newValue);
          console.log('📋 Value type:', typeof newValue);
        } else {
          console.log('💾 UPDATE Executor - Using STATIC VALUE (not copying from field)');
          console.log('💾 Raw expression:', valueExpression);
          // Remove surrounding quotes if present
          newValue = valueExpression.replace(/^['"]|['"]$/g, '');
          console.log('💾 Static value after quote removal:', newValue);
        }

        console.log('✅ UPDATE Executor - Final value to store:', newValue);
        console.log('✅ Value type:', typeof newValue);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
