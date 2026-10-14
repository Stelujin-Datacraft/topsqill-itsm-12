/**
 * Pure helpers for auth → profile → project loading gates and Nest auth header rules.
 * Keeps ProjectContext from treating a temporarily missing profile as "no projects".
 *
 * AuthContext must keep `authLoading` true until loadUserProfile settles so we do not
 * need a separate "profile_pending" phase (that would risk infinite deferral).
 */

export type ProfileLoadPhase = 'auth_loading' | 'ready' | 'failed';

export function resolveProfileLoadPhase(input: {
  authLoading: boolean;
  userId: string | null | undefined;
  userProfileId: string | null | undefined;
  profileError: string | null | undefined;
}): ProfileLoadPhase {
  if (input.authLoading) return 'auth_loading';
  if (input.userId && !input.userProfileId && input.profileError) {
    return 'failed';
  }
  return 'ready';
}

/** Project list fetch should wait — not finalize empty — while auth/profile is loading. */
export function shouldDeferProjectFetch(phase: ProfileLoadPhase): boolean {
  return phase === 'auth_loading';
}

/**
 * Nest auth rejection messages that may indicate JWT/config mismatch while the
 * browser still holds a valid Supabase session. Does not include 403 (forbidden).
 */
export function isNestAuthRejectionMessage(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('request failed (401)') ||
    m.includes('unauthorized') ||
    m.includes('invalid user token') ||
    m.includes('no authorization header') ||
    m.includes('jwt expired') ||
    m.includes('invalid jwt')
  );
}

/** Only fall back to direct Supabase when Nest auth-failed AND a client session exists. */
export function shouldUseSupabaseAuthFallback(input: {
  errorMessage?: string | null;
  hasSupabaseSession: boolean;
}): boolean {
  return input.hasSupabaseSession && isNestAuthRejectionMessage(input.errorMessage);
}

/**
 * Protected Nest `/api/database/*` calls must not be sent without a bearer token.
 * Without a session, use PostgREST+RLS (anon) instead of a guaranteed Nest 401.
 */
export function shouldSkipNestWithoutAccessToken(accessToken: string | null | undefined): boolean {
  return !accessToken;
}

/** Build Authorization header value when a usable access token exists. */
export function buildBearerAuthorization(accessToken: string | null | undefined): string | null {
  if (!accessToken || !String(accessToken).trim()) return null;
  return `Bearer ${accessToken}`;
}

/**
 * Pre-login security lookups (lockout by email) must not use the Nest database client.
 * They run before any session exists and would produce "No authorization header".
 */
export function mustUseRawSupabaseForPreAuthProfileLookup(hasSession: boolean): boolean {
  return !hasSession;
}

/** Forms/projects should not finalize empty while auth or project list is still loading. */
export function shouldKeepFormsLoading(input: {
  authLoading: boolean;
  projectsLoading: boolean;
}): boolean {
  return input.authLoading || input.projectsLoading;
}

/** Genuine permission/auth failures must not be treated as an empty project list. */
export function isGenuineProfilePermissionFailure(profileError: string | null | undefined): boolean {
  if (!profileError) return false;
  const m = profileError.toLowerCase();
  return (
    m.includes('permission') ||
    m.includes('row-level security') ||
    m.includes('rls') ||
    m.includes('forbidden') ||
    m.includes('not authorized') ||
    m.includes('401') ||
    m.includes('403') ||
    isNestAuthRejectionMessage(profileError)
  );
}
