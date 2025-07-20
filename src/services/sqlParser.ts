
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
    
    // For now, use fallback query since execute_sql RPC is not available
    // TODO: Add execute_sql RPC function to Supabase
    console.log('SQL execution not available, using fallback query');
    throw new Error('SQL execution not available');
  } catch (err) {
    console.error('Unexpected error:', err);
    
    // Fallback to basic form_submissions query for development
    try {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('form_submissions')
        .select('*')
        .limit(10);

      if (fallbackError) {
        return { columns: [], rows: [], errors: [fallbackError.message] };
      }

      if (!Array.isArray(fallbackData) || fallbackData.length === 0) {
        return { columns: [], rows: [], errors: ['No data found'] };
      }

      const columns = Object.keys(fallbackData[0]);
      const rows = fallbackData.map((row: Record<string, any>) =>
        columns.map((col) => row[col])
      );

      return { columns, rows, errors: ['Using fallback query - RPC not available'] };
    } catch (fallbackErr) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      return { columns: [], rows: [], errors: [errorMessage] };
    }
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
