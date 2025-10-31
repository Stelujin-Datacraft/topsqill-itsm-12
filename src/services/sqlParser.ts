
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

/**
 * Parse custom UPDATE FORM syntax or SELECT queries
 * 1. Handle UPDATE FORM syntax for form field updates
 * 2. Handle SELECT queries with FIELD() syntax
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

  // 2. Extract main parts: SELECT … FROM "formUuid" [WHERE …]
  // Normalize whitespace and newlines for multi-line queries
  const normalized = cleaned.replace(/\s+/g, ' ');
  const m = normalized.match(
    /^SELECT\s+(.+?)\s+FROM\s+['""]([0-9a-fA-F\-]{36})['""](?:\s+WHERE\s+(.+))?$/i
  )
  if (!m) {
    errors.push('Invalid syntax. Expected: SELECT … FROM "form_uuid" [WHERE …]')
    return { errors }
  }
  let [, selectExpr, formUuid, whereExpr] = m

  // 3. Transform FIELD() wrapper syntax
  const transformFieldAccess = (expr: string) => {
    // Handle FIELD('uuid') or FIELD("uuid") syntax
    expr = expr.replace(
      /FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)/gi,
      (_all, uuid) => `submission_data ->> '${uuid}'`
    )
    
    // Handle legacy "field_uuid" → submission_data ->> 'field_uuid'
    // But avoid double transformation by excluding already transformed expressions
    expr = expr.replace(
      /(?<!submission_data\s*->>\s*)['""]([0-9a-fA-F\-]{36})['"\"]/g,
      (_all, uuid) => `submission_data ->> '${uuid}'`
    )
    
    return expr
  }

  // 4. Handle aggregates with FIELD() syntax
  selectExpr = selectExpr.replace(
    /SUM\(\s*FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*\)/gi,
    (_all, uuid) => `SUM( (submission_data ->> '${uuid}')::numeric )`
  )

  selectExpr = selectExpr.replace(
    /COUNT\(\s*FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*\)/gi,
    (_all, uuid) => `COUNT(submission_data ->> '${uuid}')`
  )

  selectExpr = selectExpr.replace(
    /AVG\(\s*FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*\)/gi,
    (_all, uuid) => `AVG( (submission_data ->> '${uuid}')::numeric )`
  )

  selectExpr = selectExpr.replace(
    /MIN\(\s*FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*\)/gi,
    (_all, uuid) => `MIN( (submission_data ->> '${uuid}')::numeric )`
  )

  selectExpr = selectExpr.replace(
    /MAX\(\s*FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*\)/gi,
    (_all, uuid) => `MAX( (submission_data ->> '${uuid}')::numeric )`
  )

  // 5. Transform remaining field access patterns
  selectExpr = transformFieldAccess(selectExpr)
  
  // 6. Handle system columns mapping
  selectExpr = selectExpr.replace(/\bsubmission_id\b/gi, 'id as submission_id')
  selectExpr = selectExpr.replace(/\bsubmitted_by\b/gi, 'submitted_by')
  selectExpr = selectExpr.replace(/\bsubmitted_at\b/gi, 'created_at as submitted_at')

  let whereClause = ''
  if (whereExpr) {
    // Also rewrite field access in WHERE
    whereExpr = transformFieldAccess(whereExpr)
    whereClause = `\nWHERE form_id = '${formUuid}'\n  AND ${whereExpr}`
  } else {
    whereClause = `\nWHERE form_id = '${formUuid}'`
  }

  // 7. Assemble full SQL
  const sql =
    `SELECT ${selectExpr}\n` +
    `FROM form_submissions` +
    whereClause +
    `;`

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

  // Transform value expression to handle FIELD() syntax and functions
  let transformedValue = valueExpression.trim()
  
  // Handle FIELD() references in the value expression
  transformedValue = transformedValue.replace(
    /FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)/gi,
    (_match, uuid) => `(submission_data ->> '${uuid}')`
  )

  // Handle string functions that work with FIELD values
  transformedValue = transformedValue.replace(
    /LEFT\(\s*\(submission_data\s*->>\s*'([^']+)'\)\s*,\s*(\d+)\s*\)/gi,
    (_match, uuid, length) => `LEFT((submission_data ->> '${uuid}'), ${length})`
  )

  // Parse WHERE clause
  let sqlWhereClause = ''
  
  // Check if it's a submission_id condition (backward compatibility)
  const submissionIdMatch = whereClause.match(/submission_id\s*(=|!=)\s*['""]([0-9a-fA-F\-]{36})['"\"]/i)
  if (submissionIdMatch) {
    const operator = submissionIdMatch[1]
    const submissionId = submissionIdMatch[2]
    sqlWhereClause = `id ${operator} '${submissionId}'`
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

/**
 * Execute the user query using Supabase RPC or direct query execution
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
    
    // Since we're working with form_submissions, we can parse the query and execute it manually
    // This is a temporary solution until proper SQL execution RPC is available
    
    // Extract the form_id from the WHERE clause
    const formIdMatch = sql.match(/WHERE form_id = '([^']+)'/);
    if (!formIdMatch) {
      return { columns: [], rows: [], errors: ['Unable to extract form_id from query'] };
    }
    
    const formId = formIdMatch[1];
    
    // Query form_submissions for this form
    const { data: submissions, error: submissionsError } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId);
    
    if (submissionsError) {
      return { columns: [], rows: [], errors: [submissionsError.message] };
    }
    
    if (!submissions || submissions.length === 0) {
      return { columns: [], rows: [], errors: [] };
    }
    
    // Parse the SELECT clause to extract all columns
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const selectClause = selectMatch[1];
      const columnExpressions = selectClause.split(',').map(expr => expr.trim());
      
      const columns: string[] = [];
      const columnExtractors: ((submission: any) => any)[] = [];
      
      columnExpressions.forEach(expr => {
        // Handle aggregate functions - SUM, AVG, MIN, MAX, COUNT
        const sumMatch = expr.match(/SUM\(\s*\(\s*submission_data\s*->>\s*'([^']+)'\s*\)::numeric\s*\)(?:\s+as\s+(\w+))?/i);
        if (sumMatch) {
          const fieldId = sumMatch[1];
          const alias = sumMatch[2] || `sum_${fieldId}`;
          columns.push(alias);
          columnExtractors.push(() => {
            const sum = submissions.reduce((acc, sub) => {
              const val = parseFloat(sub.submission_data[fieldId]) || 0;
              return acc + val;
            }, 0);
            return sum;
          });
          return;
        }

        const avgMatch = expr.match(/AVG\(\s*\(\s*submission_data\s*->>\s*'([^']+)'\s*\)::numeric\s*\)(?:\s+as\s+(\w+))?/i);
        if (avgMatch) {
          const fieldId = avgMatch[1];
          const alias = avgMatch[2] || `avg_${fieldId}`;
          columns.push(alias);
          columnExtractors.push(() => {
            const values = submissions.map(sub => parseFloat(sub.submission_data[fieldId]) || 0).filter(v => !isNaN(v));
            return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          });
          return;
        }

        const minMatch = expr.match(/MIN\(\s*\(\s*submission_data\s*->>\s*'([^']+)'\s*\)::numeric\s*\)(?:\s+as\s+(\w+))?/i);
        if (minMatch) {
          const fieldId = minMatch[1];
          const alias = minMatch[2] || `min_${fieldId}`;
          columns.push(alias);
          columnExtractors.push(() => {
            const values = submissions.map(sub => parseFloat(sub.submission_data[fieldId]) || 0).filter(v => !isNaN(v));
            return values.length > 0 ? Math.min(...values) : 0;
          });
          return;
        }

        const maxMatch = expr.match(/MAX\(\s*\(\s*submission_data\s*->>\s*'([^']+)'\s*\)::numeric\s*\)(?:\s+as\s+(\w+))?/i);
        if (maxMatch) {
          const fieldId = maxMatch[1];
          const alias = maxMatch[2] || `max_${fieldId}`;
          columns.push(alias);
          columnExtractors.push(() => {
            const values = submissions.map(sub => parseFloat(sub.submission_data[fieldId]) || 0).filter(v => !isNaN(v));
            return values.length > 0 ? Math.max(...values) : 0;
          });
          return;
        }

        const countMatch = expr.match(/COUNT\(\s*submission_data\s*->>\s*'([^']+)'\s*\)(?:\s+as\s+(\w+))?/i);
        if (countMatch) {
          const fieldId = countMatch[1];
          const alias = countMatch[2] || `count_${fieldId}`;
          columns.push(alias);
          columnExtractors.push(() => {
            return submissions.filter(sub => sub.submission_data[fieldId] != null).length;
          });
          return;
        }
        
        // Handle submission_data field access
        const fieldMatch = expr.match(/submission_data ->> '([^']+)'(?:\s+as\s+(\w+))?/i);
        if (fieldMatch) {
          const fieldId = fieldMatch[1];
          const alias = fieldMatch[2] || fieldId;
          columns.push(alias);
          columnExtractors.push((submission) => {
            const submissionData = submission.submission_data as Record<string, any>;
            return submissionData[fieldId] || null;
          });
          return;
        }
        
        // Handle system columns
        if (expr.match(/id\s+as\s+submission_id/i)) {
          columns.push('submission_id');
          columnExtractors.push((submission) => submission.id);
          return;
        }
        
        if (expr.match(/submitted_by/i)) {
          columns.push('submitted_by');
          columnExtractors.push((submission) => submission.submitted_by);
          return;
        }
        
        if (expr.match(/created_at\s+as\s+submitted_at/i)) {
          columns.push('submitted_at');
          columnExtractors.push((submission) => submission.created_at);
          return;
        }
      });
      
      if (columns.length > 0) {
        // Check if this is an aggregate query (returns single row)
        const isAggregateQuery = columnExpressions.some(expr => 
          /^(SUM|AVG|MIN|MAX|COUNT)\(/i.test(expr.trim())
        );
        
        const rows = isAggregateQuery 
          ? [columnExtractors.map(extractor => extractor(null))]
          : submissions.map(submission => 
              columnExtractors.map(extractor => extractor(submission))
            );
        
        return { columns, rows, errors: [] };
      }
    }
    
    // If we can't parse the specific field access, return basic submission data
    const columns = ['id', 'form_id', 'submitted_at', 'submission_data'];
    const rows = submissions.map(submission => [
      submission.id,
      submission.form_id,
      submission.submitted_at,
      JSON.stringify(submission.submission_data)
    ]);
    
    return { columns, rows, errors: [] };
    
  } catch (err) {
    console.error('Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { columns: [], rows: [], errors: [errorMessage] };
  }
}

/**
 * Execute UPDATE queries using Supabase client
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
      .select('id, submission_data')
      .eq('form_id', formId);

    // Apply WHERE filter
    if (whereClause.startsWith('id ')) {
      // submission_id condition
      const idMatch = whereClause.match(/id (=|!=) '([^']+)'/);
      if (idMatch) {
        const operator = idMatch[1];
        const submissionId = idMatch[2];
        if (operator === '=') {
          query = query.eq('id', submissionId);
        } else {
          query = query.neq('id', submissionId);
        }
      }
    }
    // For FIELD() conditions, we need to fetch all records and filter in memory
    // because Supabase doesn't support direct JSONB field comparison in the query builder

    const { data: submissions, error: fetchError } = await query;

    if (fetchError) {
      return { columns: [], rows: [], errors: [fetchError.message] };
    }

    if (!submissions || submissions.length === 0) {
      return { columns: [], rows: [], errors: ['No submissions found matching the WHERE clause'] };
    }

    // Filter submissions based on FIELD() conditions
    let filteredSubmissions = submissions;
    
    if (!whereClause.startsWith('id ')) {
      // Parse FIELD condition for filtering
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
      // Evaluate the value expression for this submission
      let newValue: string;
      
      try {
        // Handle LEFT function with field reference
        const leftMatch = valueExpression.match(/LEFT\(\(submission_data ->> '([^']+)'\), (\d+)\)/);
        if (leftMatch) {
          const sourceFieldId = leftMatch[1];
          const length = parseInt(leftMatch[2]);
          const sourceValue = submission.submission_data[sourceFieldId] || '';
          newValue = sourceValue.toString().substring(0, length);
        } else if (valueExpression.startsWith('(submission_data ->>')) {
          // Handle direct field reference
          const fieldRefMatch = valueExpression.match(/\(submission_data ->> '([^']+)'\)/);
          if (fieldRefMatch) {
            const sourceFieldId = fieldRefMatch[1];
            newValue = submission.submission_data[sourceFieldId] || '';
          } else {
            newValue = valueExpression.replace(/['"]/g, '');
          }
        } else {
          // Handle literal values
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
