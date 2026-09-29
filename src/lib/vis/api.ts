/**
 * VIS API client — aligned with TopSqill backend access patterns:
 * 1) Call Nest `/api/vis/*` via shared `request` + getApiBaseUrl()
 * 2) If Nest is unreachable (published app / preview / backend down),
 *    fall back to the browser client engine — same resilience idea as
 *    databaseClient falling back to Supabase.
 */

import { request } from '@/services/api/apiClient';
import { visClientEngine } from './clientEngine';

/** Sticky switch: once Nest /vis is unreachable this session, stay on client engine. */
let backendUnavailable = false;

function isNetworkError(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('failed to fetch')
    || m.includes('network error')
    || m.includes('load failed')
    || m.includes('networkerror')
    || m.includes('econnrefused')
    || m.includes('request timed out')
    || m.includes('invalid response from server')
    // VIS module may not be deployed yet — treat gateway / missing route as unreachable
    || m.includes('request failed (404)')
    || m.includes('request failed (502)')
    || m.includes('request failed (503)')
    || m.includes('request failed (504)')
  );
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function nestVis<T>(
  path: string,
  options: { method?: Method; body?: unknown } = {},
): Promise<{ data: T | null; error: string | null }> {
  const method = options.method || 'GET';
  const visPath = path.startsWith('/vis') ? path : `/vis${path.startsWith('/') ? path : `/${path}`}`;
  const result = await request<T>(
    visPath,
    {
      method,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    },
    true,
  );
  return {
    data: result.data,
    error: result.error?.message || null,
  };
}

async function withFallback<T>(
  nestCall: () => Promise<{ data: T | null; error: string | null }>,
  clientCall: () => T | Promise<T>,
): Promise<T> {
  if (backendUnavailable) {
    return clientCall();
  }

  const nest = await nestCall();

  if (isNetworkError(nest.error)) {
    backendUnavailable = true;
    return clientCall();
  }

  if (nest.error) {
    throw new Error(nest.error);
  }

  // Successful Nest response (including empty arrays / zeroed dashboards)
  if (nest.data !== null && nest.data !== undefined) {
    return nest.data;
  }

  // 204 / empty — still prefer Nest success over inventing client data for mutations
  return clientCall();
}

export const visApi = {
  dashboard: () =>
    withFallback(
      () => nestVis('/dashboard'),
      () => visClientEngine.dashboard(),
    ),
  listIntegrations: () =>
    withFallback(
      () => nestVis('/integrations'),
      () => visClientEngine.listIntegrations(),
    ),
  getIntegration: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}`),
      () => visClientEngine.getIntegration(id),
    ),
  createIntegration: (body: { name?: string; promptText?: string }) =>
    withFallback(
      () => nestVis('/integrations', { method: 'POST', body }),
      () => visClientEngine.createIntegration(body),
    ),
  updateIntegration: (id: string, body: Record<string, unknown>) =>
    withFallback(
      () => nestVis(`/integrations/${id}`, { method: 'PUT', body }),
      async () => {
        throw new Error('Client update not supported for this field while Nest is offline');
      },
    ),
  analyze: (id: string, promptText?: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/analyze`, { method: 'POST', body: { promptText } }),
      () => visClientEngine.analyze(id, promptText),
    ),
  setLanguage: (id: string, language: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/language`, { method: 'POST', body: { language } }),
      () => visClientEngine.setLanguage(id, language),
    ),
  validate: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/validate`, { method: 'POST', body: {} }),
      () => visClientEngine.validate(id),
    ),
  listConnections: () =>
    withFallback(
      () => nestVis('/connections'),
      () => visClientEngine.listConnections(),
    ),
  createConnection: (body: Record<string, unknown>) =>
    withFallback(
      () => nestVis('/connections', { method: 'POST', body }),
      () => visClientEngine.createConnection(body),
    ),
  bootstrapDemo: () =>
    withFallback(
      () => nestVis('/demo/bootstrap', { method: 'POST', body: {} }),
      () => visClientEngine.bootstrapDemo(),
    ),
  testConnection: (id: string) =>
    withFallback(
      () => nestVis(`/connections/${id}/test`, { method: 'POST', body: {} }),
      () => visClientEngine.testConnection(id),
    ),
  discoverForms: (connectionId: string) =>
    withFallback(
      () => nestVis(`/connections/${connectionId}/forms`),
      () => visClientEngine.discoverForms(connectionId),
    ),
  discoverSchema: (integrationId: string, body: { connectionId: string; formId: string }) =>
    withFallback(
      () => nestVis(`/integrations/${integrationId}/discover-schema`, { method: 'POST', body }),
      () => visClientEngine.discoverSchema(integrationId, body),
    ),
  getMappings: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/mappings`),
      () => visClientEngine.getMappings(id),
    ),
  saveMappings: (id: string, mappings: unknown[]) =>
    withFallback(
      () => nestVis(`/integrations/${id}/mappings`, { method: 'PUT', body: { mappings } }),
      () => visClientEngine.saveMappings(id, mappings),
    ),
  suggestMappings: (id: string, body: Record<string, unknown>) =>
    withFallback(
      () => nestVis(`/integrations/${id}/suggest-mappings`, { method: 'POST', body }),
      () => visClientEngine.suggestMappings(id),
    ),
  createExecution: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/executions`, { method: 'POST', body: {} }),
      () => visClientEngine.createExecution(id),
    ),
  listExecutions: (integrationId?: string) =>
    withFallback(
      () => nestVis(`/executions${integrationId ? `?integrationId=${integrationId}` : ''}`),
      () => visClientEngine.listExecutions(integrationId),
    ),
  getExecution: (id: string) =>
    withFallback(
      () => nestVis(`/executions/${id}`),
      () => visClientEngine.getExecution(id),
    ),
  listLogs: (executionId?: string) =>
    withFallback(
      () => nestVis(`/logs${executionId ? `?executionId=${executionId}` : ''}`),
      () => visClientEngine.listLogs(executionId),
    ),
  listAudit: () =>
    withFallback(
      () => nestVis('/audit'),
      () => visClientEngine.listAudit(),
    ),
  mockForms: () =>
    withFallback(
      () => nestVis('/mocks/forms'),
      () => visClientEngine.mockForms(),
    ),
  mockVulnerabilities: () =>
    withFallback(
      () => nestVis('/mocks/vulnerabilities?status=Open'),
      () => visClientEngine.mockVulnerabilities(),
    ),
};

export const LANGUAGES = [
  { value: 'PYTHON', label: 'Python' },
  { value: 'TYPESCRIPT', label: 'TypeScript / Node.js' },
  { value: 'JAVA', label: 'Java' },
  { value: 'CSHARP', label: 'C#' },
  { value: 'GO', label: 'Go' },
] as const;
