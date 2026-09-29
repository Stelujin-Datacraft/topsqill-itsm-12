/**
 * NestJS API client — replaces direct Supabase Edge Function invocations.
 */

function resolveNestApiBase(): string {
  const configured = String(import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const pageIsLocal = host === 'localhost' || host === '127.0.0.1';
    const configuredIsLocal = !configured || /localhost|127\.0\.0\.1/.test(configured);
    // Published/preview must never call a developer's localhost Nest URL
    if (!pageIsLocal && configuredIsLocal) return '/api';
    // Local Vite: prefer same-origin /api so the proxy forwards to Nest
    if (pageIsLocal && configuredIsLocal) return '/api';
  }
  return configured || 'http://localhost:3001/api';
}

const API_BASE_URL = resolveNestApiBase();

let cachedAuthToken: string | null = null;
let authTokenExpiresAt = 0;
const AUTH_TOKEN_CACHE_MS = 30_000;

async function getAuthToken(): Promise<string | null> {
  if (cachedAuthToken && Date.now() < authTokenExpiresAt) {
    return cachedAuthToken;
  }

  try {
    const { rawSupabase } = await import('@/integrations/supabase/rawClient');
    const { data: { session } } = await rawSupabase.auth.getSession();
    cachedAuthToken = session?.access_token || null;
    authTokenExpiresAt = Date.now() + AUTH_TOKEN_CACHE_MS;
    return cachedAuthToken;
  } catch {
    cachedAuthToken = null;
    authTokenExpiresAt = 0;
    return null;
  }
}

/** Clear cached auth token after login/logout. */
export function clearAuthTokenCache(): void {
  cachedAuthToken = null;
  authTokenExpiresAt = 0;
}

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  requireAuth = true,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (requireAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 60000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timer);

    let data: T;
    const contentType = response.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = (text ? JSON.parse(text) : {}) as T;
      }
    } catch {
      return { data: null, error: { message: `Invalid response from server (${response.status})` } };
    }

    if (!response.ok) {
      const errBody = data as { message?: string; error?: string };
      return {
        data: null,
        error: { message: errBody.message || errBody.error || `Request failed (${response.status})` },
      };
    }

    return { data, error: null };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { data: null, error: { message: 'Request timed out' } };
    }
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Network error' },
    };
  }
}

/** Errors that mean the NestJS backend is unreachable, not a real API failure. */
function isNetworkFailure(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('failed to fetch') ||
    m.includes('network error') ||
    m.includes('load failed') ||
    m.includes('networkerror') ||
    m.includes('econnrefused') ||
    m.includes('unknown function') ||
    m.includes('request failed (404)') ||
    m.includes('request failed (502)') ||
    m.includes('request failed (503)') ||
    m.includes('request failed (504)')
  );
}

/** Fallback: call the Supabase Edge Function directly via fetch so we always read the JSON body. */
async function invokeEdgeFunction<T>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  try {
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = await import('@/integrations/supabase/rawClient');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    clearTimeout(timer);

    let payload: Record<string, unknown> = {};
    const contentType = response.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        payload = (await response.json()) as Record<string, unknown>;
      } else {
        const text = await response.text();
        payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      }
    } catch {
      payload = {};
    }

    const businessError =
      (typeof payload.error === 'string' && payload.error) ||
      (typeof payload.message === 'string' && payload.message) ||
      null;

    if (!response.ok) {
      if (response.status === 404) {
        return {
          data: (payload as T) ?? null,
          error: {
            message:
              businessError ||
              `Signup service is not available yet (${functionName}). Please deploy the edge function or Nest API and try again.`,
          },
        };
      }

      return {
        data: (payload as T) ?? null,
        error: {
          message:
            businessError ||
            `Could not complete request (${response.status}). Check SMTP settings and try again.`,
        },
      };
    }

    if (payload.success === false) {
      return {
        data: payload as T,
        error: {
          message: businessError || 'Request failed',
        },
      };
    }

    return { data: payload as T, error: null };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { data: null, error: { message: 'Request timed out while sending verification code.' } };
    }
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Could not reach signup service',
      },
    };
  }
}

/** Drop-in replacement for supabase.functions.invoke */
export const api = {
  invoke: async <T = unknown>(functionName: string, options?: { body?: Record<string, unknown> }): Promise<ApiResponse<T>> => {
    const routeMap: Record<string, { path: string; method?: string; auth?: boolean }> = {
      'send-mfa-code': { path: '/mfa/send-code', auth: false },
      'verify-mfa-code': { path: '/mfa/verify-code', auth: false },
      'terminate-session': { path: '/sessions/terminate' },
      'send-password-reset': { path: '/users/send-password-reset', auth: false },
      'accept-user-invitation': { path: '/auth/accept-invitation', auth: false },
      'request-signup-verification': { path: '/auth/request-signup-verification', auth: false },
      'verify-signup': { path: '/auth/verify-signup', auth: false },
      'request-signin-otp': { path: '/auth/request-signin-otp', auth: false },
      'verify-signin-otp': { path: '/auth/verify-signin-otp', auth: false },
      'check-signup-availability': { path: '/auth/check-signup-availability', auth: false },
      'send-welcome-email': { path: '/auth/send-welcome-email' },
      'send-user-invitation': { path: '/auth/send-user-invitation' },
      'delete-user': { path: '/users/delete' },
      'admin-change-password': { path: '/users/admin-change-password' },
      'test-smtp-connection': { path: '/email/test-smtp-connection' },
      'send-template-email': { path: '/email/send-template' },
      'send-delegation-email': { path: '/email/send-delegation' },
      'send-kb-notification-email': { path: '/email/send-kb-notification' },
      'ldap-authenticate': { path: '/ldap/authenticate', auth: false },
      'idp-oauth-callback': { path: '/ldap/oauth-callback', auth: false },
      'ldap-test-connection': { path: '/ldap/test-connection' },
      'ldap-sync': { path: '/ldap/sync' },
      'execute-data-feed': { path: '/data-feeds/execute' },
      'discover-external-fields': { path: '/data-feeds/discover-fields' },
      'ai-assistant': { path: '/ai/assistant' },
      'ai-copilot-action': { path: '/ai/copilot-action' },
      'analyze-performance': { path: '/performance/analyze' },
      'predict-sla-breach': { path: '/sla/predict-breach' },
      'enqueue-workflow': { path: '/workflows/enqueue', auth: false },
      'execute-workflow': { path: '/workflows/execute', auth: false },
      'process-workflow-queue': { path: '/workflows/process-queue', auth: false },
      'resume-waiting-workflows': { path: '/workflows/resume-waiting' },
      'notify-failure': { path: '/workflows/notify-failure', auth: false },
      'calculate-field': { path: '/ai/assistant' },
    };

    const route = routeMap[functionName];
    if (!route) {
      return invokeEdgeFunction<T>(functionName, options?.body);
    }

    const otpAuthFunctions = new Set([
      'request-signup-verification',
      'verify-signup',
      'request-signin-otp',
      'verify-signin-otp',
      'check-signup-availability',
    ]);

    const result = await request<T>(route.path, {
      method: route.method || 'POST',
      body: options?.body ? JSON.stringify(options.body) : undefined,
    }, route.auth !== false);

    const payload =
      result.data && typeof result.data === 'object'
        ? (result.data as { success?: boolean; error?: string; message?: string })
        : null;

    // Nest returned an explicit business payload — trust it (don't hide behind edge).
    if (payload && typeof payload.success === 'boolean') {
      if (payload.success === false) {
        return {
          data: result.data,
          error: { message: payload.error || payload.message || 'Request failed' },
        };
      }
      return { data: result.data, error: null };
    }

    // Nest unreachable / missing route / unexpected failure → try edge for auth OTP flows.
    if (
      otpAuthFunctions.has(functionName) &&
      (result.error || !result.data)
    ) {
      return invokeEdgeFunction<T>(functionName, options?.body);
    }

    if (result.error && isNetworkFailure(result.error.message)) {
      return invokeEdgeFunction<T>(functionName, options?.body);
    }

    return result;
  },
};

export function getApiBaseUrl(): string {
  // Re-resolve at call time so published hosts don't keep a stale localhost bake-in
  return resolveNestApiBase();
}

export function getPublicApiUrl(): string {
  return `${getApiBaseUrl()}/public-api`;
}

export function getFormApiUrl(): string {
  return `${getApiBaseUrl()}/form-api`;
}

export function getPolicyPreviewUrl(policyId: string): string {
  return `${getApiBaseUrl()}/policies/preview?id=${policyId}`;
}

export { request };
