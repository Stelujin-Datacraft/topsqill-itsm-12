/**
 * Align forms inserts with the authenticated JWT user and forms_insert RLS.
 * Never log JWTs, cookies, or secrets.
 */

export interface FormsInsertRow {
  created_by?: unknown;
  organization_id?: unknown;
  project_id?: unknown;
  [key: string]: unknown;
}

export interface FormsInsertAuthResult {
  rows: FormsInsertRow[];
  diagnostics: string;
}

export function isDevDatabaseDiagnosticsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.AI_FORM_DIAGNOSTICS === '1' || env.AI_FORM_DIAGNOSTICS === 'true') {
    return true;
  }
  const appEnv = String(env.ENVIRONMENT || env.APP_ENV || '').toLowerCase();
  if (appEnv === 'development' || appEnv === 'dev') return true;
  return env.NODE_ENV !== 'production';
}

export function formatFormsInsertDiagnostics(input: {
  authUserId: string;
  projectId: unknown;
  organizationId: unknown;
  createdBy: unknown;
}): string {
  return [
    '[forms-insert]',
    `authUserId=${input.authUserId}`,
    `projectId=${input.projectId ?? 'null'}`,
    `organizationId=${input.organizationId ?? 'null'}`,
    `createdBy=${input.createdBy ?? 'null'}`,
  ].join(' ');
}

/**
 * Force created_by to the JWT subject and reject empty project/org IDs.
 * Callers must use a user-scoped Supabase client (never service-role fallback).
 */
export function normalizeFormsInsertRowsForAuth(
  data: Record<string, unknown> | Record<string, unknown>[],
  authUserId: string,
): FormsInsertAuthResult {
  if (!authUserId) {
    throw new Error('Authenticated user is required to insert forms');
  }

  const rows = (Array.isArray(data) ? data : [data]).map((row) => {
    const projectId = row.project_id;
    const organizationId = row.organization_id;
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('forms insert requires project_id');
    }
    if (!organizationId || typeof organizationId !== 'string') {
      throw new Error('forms insert requires organization_id');
    }

    const submittedCreatedBy =
      typeof row.created_by === 'string' ? row.created_by : null;
    if (submittedCreatedBy && submittedCreatedBy !== authUserId) {
      throw new Error(
        'created_by must match the authenticated user for forms inserts',
      );
    }

    return {
      ...row,
      created_by: authUserId,
      project_id: projectId,
      organization_id: organizationId,
    };
  });

  const first = rows[0];
  const diagnostics = formatFormsInsertDiagnostics({
    authUserId,
    projectId: first?.project_id,
    organizationId: first?.organization_id,
    createdBy: first?.created_by,
  });

  return { rows, diagnostics };
}
