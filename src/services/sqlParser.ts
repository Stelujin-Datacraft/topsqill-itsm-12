
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

  // Parse the UPDATE FORM syntax
  const updateMatch = input.match(
    /^UPDATE\s+FORM\s+['""]([0-9a-fA-F\-]{36})['"\"]\s+SET\s+FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*=\s*(.+?)\s+WHERE\s+submission_id\s*=\s*['""]([0-9a-fA-F\-]{36})['"\"]/i
  )

  if (!updateMatch) {
    errors.push('Invalid UPDATE FORM syntax. Expected: UPDATE FORM \'form_id\' SET FIELD(\'field_id\') = value WHERE submission_id = \'submission_id\'')
    return { errors }
  }

  const [, formId, fieldId, valueExpression, submissionId] = updateMatch

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

  // Build the final SQL
  const sql = `UPDATE form_submissions
SET submission_data = jsonb_set(
  submission_data,
  '{${fieldId}}',
  to_jsonb(${transformedValue}::text),
  true
)
WHERE id = '${submissionId}'
AND form_id = '${formId}';`

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
        const rows = submissions.map(submission => 
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
    // Extract parameters from the SQL for manual execution
    const formIdMatch = sql.match(/AND form_id = '([^']+)'/);
    const submissionIdMatch = sql.match(/WHERE id = '([^']+)'/);
    const fieldIdMatch = sql.match(/'{([^}]+)}'/);
    const valueMatch = sql.match(/to_jsonb\((.+?)::text\)/);

    if (!formIdMatch || !submissionIdMatch || !fieldIdMatch || !valueMatch) {
      return { columns: [], rows: [], errors: ['Failed to parse UPDATE query parameters'] };
    }

    const formId = formIdMatch[1];
    const submissionId = submissionIdMatch[1];
    const fieldId = fieldIdMatch[1];
    const valueExpression = valueMatch[1];

    // First, get the current submission to evaluate the value expression
    const { data: currentSubmission, error: fetchError } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('id', submissionId)
      .eq('form_id', formId)
      .single();

    if (fetchError || !currentSubmission) {
      return { columns: [], rows: [], errors: ['Submission not found or access denied'] };
    }

    // Evaluate the value expression
    let newValue: string;
    try {
      // Handle LEFT function with field reference
      const leftMatch = valueExpression.match(/LEFT\(\(submission_data\s*->>\s*'([^']+)'\),\s*(\d+)\)/);
      if (leftMatch) {
        const sourceFieldId = leftMatch[1];
        const length = parseInt(leftMatch[2]);
        const sourceValue = currentSubmission.submission_data[sourceFieldId] || '';
        newValue = sourceValue.toString().substring(0, length);
      } else if (valueExpression.startsWith('(submission_data ->>')) {
        // Handle direct field reference
        const fieldRefMatch = valueExpression.match(/\(submission_data\s*->>\s*'([^']+)'\)/);
        if (fieldRefMatch) {
          const sourceFieldId = fieldRefMatch[1];
          newValue = currentSubmission.submission_data[sourceFieldId] || '';
        } else {
          newValue = valueExpression.replace(/['"]/g, '');
        }
      } else {
        // Handle literal values
        newValue = valueExpression.replace(/['"]/g, '');
      }
    } catch (error) {
      return { columns: [], rows: [], errors: ['Failed to evaluate value expression'] };
    }

    // Update the submission
    const currentData = currentSubmission.submission_data as Record<string, any> || {};
    const updatedSubmissionData = {
      ...currentData,
      [fieldId]: newValue
    };

    const { data: updatedData, error: updateError } = await supabase
      .from('form_submissions')
      .update({ submission_data: updatedSubmissionData })
      .eq('id', submissionId)
      .eq('form_id', formId)
      .select();

    if (updateError) {
      return { columns: [], rows: [], errors: [updateError.message] };
    }

    // Return success result
    return { 
      columns: ['message', 'updated_rows'], 
      rows: [['Field updated successfully', updatedData?.length || 1]], 
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
