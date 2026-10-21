/**
 * Nest engines were ported from Deno Edge Functions that returned `Response`.
 * Express/Nest would JSON-serialize those as `{}`, so the frontend never saw
 * `{ success, result, error }`. Normalize to a plain object envelope.
 */
export async function unwrapEngineResult(
  raw: unknown,
): Promise<Record<string, unknown>> {
  if (raw == null) {
    return { success: false, error: 'Empty AI engine response' };
  }

  const maybeResponse = raw as {
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
    status?: number;
  };

  const looksLikeResponse =
    typeof raw === 'object' &&
    raw !== null &&
    typeof maybeResponse.json === 'function' &&
    typeof maybeResponse.text === 'function';

  if (looksLikeResponse) {
    try {
      const data = await maybeResponse.json!();
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
    } catch {
      // fall through to text parse
    }
    try {
      const text = await maybeResponse.text!();
      if (text?.trim()) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          return {
            success: false,
            error: text,
            statusCode: maybeResponse.status,
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      success: false,
      error: `AI engine returned an empty Response (status ${maybeResponse.status ?? 'unknown'})`,
    };
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  return { success: false, error: 'Unexpected AI engine response type' };
}
