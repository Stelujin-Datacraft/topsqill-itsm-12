/**
 * Inspect Supabase API JWTs without verifying the signature.
 * Used to fail closed when SUPABASE_SERVICE_ROLE_KEY is mis-set to the anon key.
 */

export type SupabaseApiJwtRole = 'anon' | 'service_role' | 'authenticated' | string;

export interface ParsedSupabaseApiKey {
  /** False when the value is not a 3-part JWT (e.g. placeholder). */
  isJwt: boolean;
  role: SupabaseApiJwtRole | null;
}

/** Decode the JWT payload `role` claim from a Supabase API key (no signature verify). */
export function parseSupabaseApiKeyRole(apiKey: string | undefined | null): ParsedSupabaseApiKey {
  if (!apiKey || typeof apiKey !== 'string') {
    return { isJwt: false, role: null };
  }
  const parts = apiKey.split('.');
  if (parts.length < 2 || !parts[1]) {
    return { isJwt: false, role: null };
  }
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json) as { role?: string };
    const role = typeof payload?.role === 'string' ? payload.role : null;
    return { isJwt: true, role };
  } catch {
    return { isJwt: false, role: null };
  }
}

/**
 * True when the configured service-role env var is a JWT whose role is not service_role.
 * Placeholders / non-JWTs return false (cannot classify).
 */
export function isMisconfiguredServiceRoleKey(apiKey: string | undefined | null): boolean {
  const parsed = parseSupabaseApiKeyRole(apiKey);
  return parsed.isJwt && parsed.role !== null && parsed.role !== 'service_role';
}

/**
 * Message for operators when SUPABASE_SERVICE_ROLE_KEY holds anon (or another role).
 */
export function misconfiguredServiceRoleMessage(actualRole: string): string {
  return (
    `SUPABASE_SERVICE_ROLE_KEY JWT role is "${actualRole}" (expected service_role). `
    + 'Replace it with the service_role secret from Supabase Dashboard → Project Settings → API. '
    + 'Interactive CRUD uses the user JWT (RLS); background jobs that need service_role will fail until corrected.'
  );
}
