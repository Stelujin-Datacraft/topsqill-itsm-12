/**
 * Helpers for user_sessions rows returned via Nest /database/query.
 * Guards against nested envelopes / missing UUIDs that would produce:
 *   invalid input syntax for type uuid: "undefined"
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSessionUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export type UserSessionRow = {
  id: string;
  is_active?: boolean | null;
  session_token?: string | null;
};

/**
 * Normalize a maybeSingle user_sessions payload into a flat row with a UUID id.
 * Returns null when no usable session id is present (do not update by id).
 */
export function normalizeUserSessionRow(data: unknown): UserSessionRow | null {
  let current: unknown = data;

  // Unwrap Nest-style { data, error?, count? } or accidental { data: row }
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) break;
    const obj = current as Record<string, unknown>;
    if (isSessionUuid(obj.id)) {
      return {
        id: obj.id,
        is_active: obj.is_active as boolean | null | undefined,
        session_token: (obj.session_token as string | null | undefined) ?? null,
      };
    }
    if ('data' in obj && obj.data != null) {
      current = obj.data;
      continue;
    }
    break;
  }

  if (Array.isArray(current)) {
    if (current.length === 0) return null;
    return normalizeUserSessionRow(current[0]);
  }

  return null;
}
