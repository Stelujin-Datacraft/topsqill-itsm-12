/**
 * Resolve and validate auth + tenant IDs before inserting AI-generated forms.
 * forms_insert requires auth.uid() to match a profile in forms.organization_id
 * OR a project_users row for forms.project_id.
 */

export interface AiFormCreateIds {
  userId: string;
  projectId: string;
  organizationId: string;
}

export interface AiFormAccessSnapshot {
  authUserId: string;
  projectId: string;
  projectOrganizationId: string | null;
  profileOrganizationId: string | null;
  isProjectMember: boolean;
  submittedOrganizationId?: string | null;
  submittedUserId?: string | null;
}

export function isDevAiFormDiagnosticsEnabled(
  env: Record<string, unknown> | undefined = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: Record<string, unknown> }).env
    : undefined,
): boolean {
  if (!env) return false;
  if (env.DEV === true || env.MODE === 'development') return true;
  return String(env.VITE_AI_FORM_DIAGNOSTICS || '').toLowerCase() === 'true';
}

/** Safe diagnostics — never log JWTs, cookies, or secrets. */
export function formatAiFormCreateDiagnostics(snapshot: AiFormAccessSnapshot): string {
  return [
    '[ai-form-create]',
    `authUserId=${snapshot.authUserId}`,
    `projectId=${snapshot.projectId}`,
    `projectOrganizationId=${snapshot.projectOrganizationId ?? 'null'}`,
    `profileOrganizationId=${snapshot.profileOrganizationId ?? 'null'}`,
    `isProjectMember=${snapshot.isProjectMember}`,
    `submittedOrganizationId=${snapshot.submittedOrganizationId ?? 'n/a'}`,
    `submittedUserId=${snapshot.submittedUserId ?? 'n/a'}`,
  ].join(' ');
}

/**
 * Decide whether forms_insert would allow this row for the authenticated user.
 * Mirrors the policy in 20260218044247_* (profile org match OR project membership).
 */
export function canSatisfyFormsInsertPolicy(snapshot: AiFormAccessSnapshot): boolean {
  if (!snapshot.authUserId || !snapshot.projectId) return false;
  if (snapshot.isProjectMember) return true;
  if (
    snapshot.projectOrganizationId &&
    snapshot.profileOrganizationId &&
    snapshot.projectOrganizationId === snapshot.profileOrganizationId
  ) {
    return true;
  }
  return false;
}

export function assertAiFormCreateAccess(snapshot: AiFormAccessSnapshot): AiFormCreateIds {
  if (!snapshot.authUserId) {
    throw new Error('Not authenticated. Sign in again, then retry saving the form.');
  }
  if (!snapshot.projectId) {
    throw new Error('No project selected. Select a project, then retry.');
  }
  if (!snapshot.projectOrganizationId) {
    throw new Error('Selected project is missing an organization. Re-select the project and retry.');
  }

  if (
    snapshot.submittedUserId &&
    snapshot.submittedUserId !== snapshot.authUserId
  ) {
    throw new Error(
      'Form creator does not match the signed-in user. Refresh the page and try again.',
    );
  }

  if (
    snapshot.submittedOrganizationId &&
    snapshot.submittedOrganizationId !== snapshot.projectOrganizationId
  ) {
    throw new Error(
      'Organization does not match the selected project. Switch to the correct organization/project and retry.',
    );
  }

  if (!canSatisfyFormsInsertPolicy(snapshot)) {
    throw new Error(
      'You do not have permission to create forms in this project (missing organization or project membership).',
    );
  }

  return {
    userId: snapshot.authUserId,
    projectId: snapshot.projectId,
    organizationId: snapshot.projectOrganizationId,
  };
}
