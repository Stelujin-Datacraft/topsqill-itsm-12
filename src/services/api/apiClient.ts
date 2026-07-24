/**
 * NestJS API client — replaces direct Supabase Edge Function invocations.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function getAuthToken(): Promise<string | null> {
  try {
    const { rawSupabase } = await import('@/integrations/supabase/rawClient');
    const { data: { session } } = await rawSupabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
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
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: { message: data.message || data.error || `Request failed (${response.status})` },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Network error' },
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
      return { data: null, error: { message: `Unknown function: ${functionName}` } };
    }

    return request<T>(route.path, {
      method: route.method || 'POST',
      body: options?.body ? JSON.stringify(options.body) : undefined,
    }, route.auth !== false);
  },
};

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getPublicApiUrl(): string {
  return `${API_BASE_URL}/public-api`;
}

export function getFormApiUrl(): string {
  return `${API_BASE_URL}/form-api`;
}

export function getPolicyPreviewUrl(policyId: string): string {
  return `${API_BASE_URL}/policies/preview?id=${policyId}`;
}

export { request };
