/**
 * Pure helpers for auth → profile → project loading gates.
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
