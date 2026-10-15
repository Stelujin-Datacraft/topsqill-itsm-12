/**
 * Nest-only AI invoke policy helpers.
 * AI assistant / copilot must never fall back to Supabase Edge (Lovable).
 */

export const NEST_ONLY_AI_FUNCTIONS = new Set([
  'ai-assistant',
  'ai-copilot-action',
  'calculate-field',
]);

export function isNestOnlyAiFunction(functionName: string): boolean {
  return NEST_ONLY_AI_FUNCTIONS.has(functionName);
}

export interface AiInvokeEnvelope {
  success?: boolean;
  error?: string;
  message?: string;
  result?: unknown;
}

/**
 * Map a Nest `/ai/*` response into the `{ data, error }` shape callers expect
 * from `supabase.functions.invoke` / `api.invoke`.
 */
export function mapNestAiInvokeResult<T = unknown>(input: {
  data: T | null;
  error: { message: string } | null;
}): { data: T | null; error: { message: string } | null } {
  const { data, error } = input;

  const payload =
    data && typeof data === 'object'
      ? (data as AiInvokeEnvelope)
      : null;

  if (payload && typeof payload.success === 'boolean') {
    if (payload.success === false) {
      return {
        data,
        error: {
          message:
            payload.error ||
            payload.message ||
            error?.message ||
            'AI request failed',
        },
      };
    }
    return { data, error: null };
  }

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: { message: 'Empty response from AI service' } };
  }

  // Unexpected Nest body (e.g. serialized Response `{}`) — surface clearly.
  return {
    data,
    error: {
      message:
        'Unexpected AI response from Nest backend (missing success field). Check OpenRouter configuration and Nest /ai routes.',
    },
  };
}
