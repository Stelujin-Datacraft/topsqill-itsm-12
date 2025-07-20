
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
 * 1. Ensure only a single SELECT … FROM … [WHERE …] statement
 * 2. Rewrite FIELD("uuid") → submission_data ->> 'uuid'
 * 3. Rewrite field‑UUIDs → JSONB access
 * 4. Rewrite SUM(FIELD("uuid")) → SUM((submission_data ->> 'uuid')::numeric)
 * 5. Inject `form_id = '…'` filter in place of FROM "uuid"
 */
export function parseUserQuery(input: string): ParseResult {
  const errors: string[] = []
  const cleaned = input.trim().replace(/;$/, '') // drop trailing semicolon

  // 1. Only allow SELECT
  if (!/^SELECT\s+/i.test(cleaned)) {
    errors.push('Only SELECT queries are allowed.')
    return { errors }
  }

  // 2. Extract main parts: SELECT … FROM "formUuid" [WHERE …]
  const m = cleaned.match(
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
