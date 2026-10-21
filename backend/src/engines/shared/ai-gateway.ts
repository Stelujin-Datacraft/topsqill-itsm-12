/**
 * Shared AI chat-completions gateway for Nest engines.
 * Provider is selected by server-side env only (never VITE_* / frontend).
 *
 * Dev OpenRouter:
 *   AI_PROVIDER=openrouter
 *   OPENROUTER_API_KEY=...
 *   OPENROUTER_MODEL=google/gemini-2.5-flash  (optional override)
 *
 * Default / Production Lovable:
 *   AI_PROVIDER unset or lovable
 *   LOVABLE_API_KEY=...
 */

export type AiProvider = 'lovable' | 'openrouter';

export const LOVABLE_CHAT_COMPLETIONS_URL =
  'https://ai.gateway.lovable.dev/v1/chat/completions';
export const OPENROUTER_CHAT_COMPLETIONS_URL =
  'https://openrouter.ai/api/v1/chat/completions';

/**
 * Verified on OpenRouter models API: available, supports `tools` / `tool_choice`,
 * and is a stable Flash SKU (not a retiring preview alias).
 * Override with OPENROUTER_MODEL when needed.
 */
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash';

export type EnvGetter = (key: string) => string | undefined;

export interface AiGatewayConfig {
  provider: AiProvider;
  apiKey: string;
  endpoint: string;
  /** Model used when the caller does not override; OpenRouter always uses this. */
  model: string;
}

export interface ChatCompletionsRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  [key: string]: unknown;
}

export interface ChatCompletionsSuccess {
  ok: true;
  status: number;
  data: {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };
}

export interface ChatCompletionsFailure {
  ok: false;
  status: number;
  error: string;
  /** Raw body for logging (must not include API keys). */
  bodyText?: string;
}

export type ChatCompletionsResult = ChatCompletionsSuccess | ChatCompletionsFailure;

export function normalizeAiProvider(raw: string | undefined | null): AiProvider {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  return value === 'openrouter' ? 'openrouter' : 'lovable';
}

export function resolveAiGatewayConfig(getEnv: EnvGetter): AiGatewayConfig {
  const provider = normalizeAiProvider(getEnv('AI_PROVIDER'));

  if (provider === 'openrouter') {
    const apiKey = String(getEnv('OPENROUTER_API_KEY') || '').trim();
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }
    const model =
      String(getEnv('OPENROUTER_MODEL') || '').trim() || DEFAULT_OPENROUTER_MODEL;
    return {
      provider: 'openrouter',
      apiKey,
      endpoint: OPENROUTER_CHAT_COMPLETIONS_URL,
      model,
    };
  }

  const apiKey = String(getEnv('LOVABLE_API_KEY') || '').trim();
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }
  return {
    provider: 'lovable',
    apiKey,
    endpoint: LOVABLE_CHAT_COMPLETIONS_URL,
    // Lovable engines historically pass their own model per call site.
    model: String(getEnv('LOVABLE_MODEL') || '').trim(),
  };
}

/** Optional AI paths (e.g. SLA insights) — returns null when credentials are absent. */
export function tryResolveAiGatewayConfig(getEnv: EnvGetter): AiGatewayConfig | null {
  const provider = normalizeAiProvider(getEnv('AI_PROVIDER'));
  if (provider === 'openrouter') {
    if (!String(getEnv('OPENROUTER_API_KEY') || '').trim()) return null;
  } else if (!String(getEnv('LOVABLE_API_KEY') || '').trim()) {
    return null;
  }
  return resolveAiGatewayConfig(getEnv);
}

export function mapAiGatewayHttpError(
  status: number,
  provider: AiProvider,
): { status: number; error: string } | null {
  if (status === 429) {
    return {
      status: 429,
      error: 'AI rate limit exceeded. Please try again in a few moments.',
    };
  }
  if (status === 402) {
    return {
      status: 402,
      error:
        provider === 'openrouter'
          ? 'AI credits or quota exhausted. Please check your OpenRouter account.'
          : 'AI credits exhausted. Please add credits to your Lovable workspace.',
    };
  }
  return null;
}

export function parseAiJsonContent(content: string | null | undefined): unknown {
  if (content == null) return { text: '' };
  const trimmed = String(content).trim();
  if (!trimmed) return { text: '' };
  try {
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;
    return JSON.parse(jsonStr);
  } catch {
    return { text: trimmed };
  }
}

export function resolveChatModel(
  config: AiGatewayConfig,
  requestedModel?: string,
): string {
  if (config.provider === 'openrouter') {
    return config.model;
  }
  return (requestedModel && requestedModel.trim()) || config.model || requestedModel || '';
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export async function chatCompletions(
  config: AiGatewayConfig,
  request: ChatCompletionsRequest,
  fetchImpl: FetchLike = fetch as FetchLike,
): Promise<ChatCompletionsResult> {
  const model = resolveChatModel(config, request.model);
  if (!model) {
    return {
      ok: false,
      status: 500,
      error: 'AI model is not configured',
    };
  }

  const { model: _ignored, ...rest } = request;
  const payload = { ...rest, model };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };

  // OpenRouter optionally accepts attribution headers; never include secrets.
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://topsqill.com';
    headers['X-Title'] = 'TopSqill ITSM';
  }

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      ok: false,
      status: 503,
      error: err instanceof Error ? err.message : 'AI gateway network error',
    };
  }

  if (!response.ok) {
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch {
      bodyText = '';
    }
    const mapped = mapAiGatewayHttpError(response.status, config.provider);
    if (mapped) {
      return { ok: false, status: mapped.status, error: mapped.error, bodyText };
    }
    return {
      ok: false,
      status: response.status,
      error: `AI Gateway error: ${response.status}`,
      bodyText,
    };
  }

  try {
    const data = (await response.json()) as ChatCompletionsSuccess['data'];
    return { ok: true, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: response.status,
      error: 'Invalid JSON response from AI gateway',
    };
  }
}
