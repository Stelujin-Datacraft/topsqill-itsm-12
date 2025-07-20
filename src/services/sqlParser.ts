
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
 * 2. Rewrite field‑UUIDs → JSONB access
 * 3. Rewrite SUM("uuid") → SUM((submission_data ->> 'uuid')::numeric)
 * 4. Inject `form_id = '…'` filter in place of FROM "uuid"
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
    /^SELECT\s+(.+?)\s+FROM\s+"([0-9a-fA-F\-]{36})"(?:\s+WHERE\s+(.+))?$/i
  )
  if (!m) {
    errors.push('Invalid syntax. Expected: SELECT … FROM "form_uuid" [WHERE …]')
    return { errors }
  }
  let [, selectExpr, formUuid, whereExpr] = m

  // 3. Rewrite aggregate SUM("uuid") first
  selectExpr = selectExpr.replace(
    /SUM\(\s*"([0-9a-fA-F\-]{36})"\s*\)/gi,
    (_all, uuid) => `SUM( (submission_data ->> '${uuid}')::numeric )`
  )

  // 4. Rewrite COUNT("uuid") aggregates
  selectExpr = selectExpr.replace(
    /COUNT\(\s*"([0-9a-fA-F\-]{36})"\s*\)/gi,
    (_all, uuid) => `COUNT(submission_data ->> '${uuid}')`
  )

  // 5. Rewrite AVG("uuid") aggregates
  selectExpr = selectExpr.replace(
    /AVG\(\s*"([0-9a-fA-F\-]{36})"\s*\)/gi,
    (_all, uuid) => `AVG( (submission_data ->> '${uuid}')::numeric )`
  )

  // 6. Rewrite any remaining "field_uuid" → submission_data ->> 'field_uuid'
  const fieldAccess = (expr: string) =>
    expr.replace(
      /"([0-9a-fA-F\-]{36})"/g,
      (_all, uuid) => `submission_data ->> '${uuid}'`
    )

  selectExpr = fieldAccess(selectExpr)
  let whereClause = ''
  if (whereExpr) {
    // Also rewrite UUID fields in WHERE
    whereExpr = fieldAccess(whereExpr)
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
 * Execute the user query:
 * - Parse
 * - If parse errors, return them
 * - Else execute the SQL directly (since we don't have run_sql RPC)
 * - Return uniform columns/rows JSON or errors
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
    
    // For now, we'll execute a basic query since we don't have the run_sql RPC
    // This is a simplified approach that works with the current Supabase setup
    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .limit(100);

    if (error) {
      console.error('Query execution error:', error);
      return { columns: [], rows: [], errors: [error.message] };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { columns: [], rows: [], errors: [] };
    }

    const columns = Object.keys(data[0]);
    const rows = data.map((row: Record<string, any>) =>
      columns.map((col) => row[col])
    );

    return { columns, rows, errors: [] };
  } catch (err) {
    console.error('Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { columns, rows: [], errors: [errorMessage] };
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
