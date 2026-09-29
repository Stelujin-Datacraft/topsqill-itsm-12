/** VIS frontend API client — calls Nest /api/vis/* */

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

async function visFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.message || text;
    } catch {
      /* keep */
    }
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message || res.statusText));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const visApi = {
  dashboard: () => visFetch('/vis/dashboard'),
  listIntegrations: () => visFetch<any[]>('/vis/integrations'),
  getIntegration: (id: string) => visFetch<any>(`/vis/integrations/${id}`),
  createIntegration: (body: { name?: string; promptText?: string }) =>
    visFetch<any>('/vis/integrations', { method: 'POST', body: JSON.stringify(body) }),
  updateIntegration: (id: string, body: Record<string, unknown>) =>
    visFetch<any>(`/vis/integrations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  analyze: (id: string, promptText?: string) =>
    visFetch<any>(`/vis/integrations/${id}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ promptText }),
    }),
  setLanguage: (id: string, language: string) =>
    visFetch<any>(`/vis/integrations/${id}/language`, {
      method: 'POST',
      body: JSON.stringify({ language }),
    }),
  validate: (id: string) =>
    visFetch<any>(`/vis/integrations/${id}/validate`, { method: 'POST', body: '{}' }),
  listConnections: () => visFetch<any[]>('/vis/connections'),
  createConnection: (body: Record<string, unknown>) =>
    visFetch<any>('/vis/connections', { method: 'POST', body: JSON.stringify(body) }),
  testConnection: (id: string) =>
    visFetch<any>(`/vis/connections/${id}/test`, { method: 'POST', body: '{}' }),
  discoverForms: (connectionId: string) =>
    visFetch<any>(`/vis/connections/${connectionId}/forms`),
  discoverSchema: (integrationId: string, body: { connectionId: string; formId: string }) =>
    visFetch<any>(`/vis/integrations/${integrationId}/discover-schema`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getMappings: (id: string) => visFetch<any[]>(`/vis/integrations/${id}/mappings`),
  saveMappings: (id: string, mappings: unknown[]) =>
    visFetch<any[]>(`/vis/integrations/${id}/mappings`, {
      method: 'PUT',
      body: JSON.stringify({ mappings }),
    }),
  suggestMappings: (id: string, body: Record<string, unknown>) =>
    visFetch<any[]>(`/vis/integrations/${id}/suggest-mappings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createExecution: (id: string) =>
    visFetch<any>(`/vis/integrations/${id}/executions`, { method: 'POST', body: '{}' }),
  listExecutions: (integrationId?: string) =>
    visFetch<any[]>(`/vis/executions${integrationId ? `?integrationId=${integrationId}` : ''}`),
  getExecution: (id: string) => visFetch<any>(`/vis/executions/${id}`),
  listLogs: (executionId?: string) =>
    visFetch<any[]>(`/vis/logs${executionId ? `?executionId=${executionId}` : ''}`),
  listAudit: () => visFetch<any[]>('/vis/audit'),
  mockForms: () => visFetch<any>('/vis/mocks/forms'),
  mockVulnerabilities: () => visFetch<any>('/vis/mocks/vulnerabilities?status=Open'),
};

export const LANGUAGES = [
  { value: 'PYTHON', label: 'Python' },
  { value: 'TYPESCRIPT', label: 'TypeScript / Node.js' },
  { value: 'JAVA', label: 'Java' },
  { value: 'CSHARP', label: 'C#' },
  { value: 'GO', label: 'Go' },
] as const;
