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
    || m.includes('internal server error')
    // VIS module may not be deployed yet — treat gateway / missing route as unreachable
    || m.includes('request failed (404)')
    || m.includes('request failed (500)')
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
  analyze: (id: string, promptText?: string, answers?: Record<string, string>) =>
    withFallback(
      () =>
        nestVis(`/integrations/${id}/analyze`, {
          method: 'POST',
          body: { promptText, answers },
        }),
      () => visClientEngine.analyze(id, promptText, answers),
    ),
  clarify: (id: string, promptText?: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/clarify`, { method: 'POST', body: { promptText } }),
      () => visClientEngine.clarify(id, promptText),
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
  approve: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/approve`, { method: 'POST', body: {} }),
      () => visClientEngine.approve(id),
    ),
  saveDraft: (id: string, body: Record<string, unknown> = {}) =>
    withFallback(
      () => nestVis(`/integrations/${id}/save-draft`, { method: 'POST', body }),
      () => visClientEngine.saveDraft(id, body),
    ),
  bindConnections: (
    id: string,
    body: { sourceConnectionId?: string; targetConnectionId?: string; selectedFormId?: string },
  ) =>
    withFallback(
      () => nestVis(`/integrations/${id}/connections`, { method: 'POST', body }),
      () => visClientEngine.bindConnections(id, body),
    ),
  setMatchingStrategy: (id: string, strategy: Record<string, unknown>) =>
    withFallback(
      () => nestVis(`/integrations/${id}/matching-strategy`, { method: 'POST', body: strategy }),
      () => visClientEngine.setMatchingStrategy(id, strategy),
    ),
  dryRun: (id: string, sample?: Record<string, unknown>[]) =>
    withFallback(
      () => nestVis(`/integrations/${id}/dry-run`, { method: 'POST', body: { sample } }),
      () => visClientEngine.dryRun(id, sample),
    ),
  nlMapping: (id: string, instruction: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/nl-mapping`, { method: 'POST', body: { instruction } }),
      () => visClientEngine.nlMapping(id, instruction),
    ),
  setSampleSource: (id: string, sample: unknown) =>
    withFallback(
      () => nestVis(`/integrations/${id}/sample-source`, { method: 'POST', body: { sample } }),
      () => visClientEngine.setSampleSource(id, sample),
    ),
  discoverOpenApi: (id: string, body: { document?: unknown; url?: string }) =>
    withFallback(
      () => nestVis(`/integrations/${id}/openapi`, { method: 'POST', body }),
      () => visClientEngine.discoverOpenApi(id, body),
    ),
  selectOpenApiEndpoint: (id: string, body: { path: string; method: string }) =>
    withFallback(
      () => nestVis(`/integrations/${id}/openapi/select`, { method: 'POST', body }),
      () => visClientEngine.selectOpenApiEndpoint(id, body),
    ),
  refreshSchema: (id: string, body: { connectionId: string; formId: string }) =>
    withFallback(
      () => nestVis(`/integrations/${id}/refresh-schema`, { method: 'POST', body }),
      () => visClientEngine.discoverSchema(id, body),
    ),
  listAuditFor: (integrationId?: string) =>
    withFallback(
      () => nestVis(`/audit${integrationId ? `?integrationId=${integrationId}` : ''}`),
      () => visClientEngine.listAudit(integrationId),
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
  createExecution: (id: string, body: Record<string, unknown> = {}) =>
    withFallback(
      () => nestVis(`/integrations/${id}/executions`, { method: 'POST', body }),
      () => visClientEngine.createExecution(id),
    ),
  cancelExecution: (executionId: string) =>
    withFallback(
      () => nestVis(`/executions/${executionId}/cancel`, { method: 'POST', body: {} }),
      () => visClientEngine.cancelExecution(executionId),
    ),
  retryFailedExecution: (executionId: string) =>
    withFallback(
      () => nestVis(`/executions/${executionId}/retry-failed`, { method: 'POST', body: {} }),
      () => visClientEngine.retryFailedExecution(executionId),
    ),
  activateIntegration: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/activate`, { method: 'POST', body: {} }),
      async () => {
        throw new Error('Activate requires Nest backend');
      },
    ),
  pauseIntegration: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/pause`, { method: 'POST', body: {} }),
      async () => {
        throw new Error('Pause requires Nest backend');
      },
    ),
  resumeIntegration: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/resume`, { method: 'POST', body: {} }),
      async () => {
        throw new Error('Resume requires Nest backend');
      },
    ),
  getRealtimeStatus: (id: string) =>
    withFallback(
      () => nestVis(`/integrations/${id}/event-status`),
      async () => ({ health: 'DISCONNECTED', metrics: {} }),
    ),
  listEvents: (integrationId?: string) =>
    withFallback(
      () => nestVis(`/events${integrationId ? `?integrationId=${integrationId}` : ''}`),
      async () => [],
    ),
  getEvent: (id: string) =>
    withFallback(
      () => nestVis(`/events/${id}`),
      async () => {
        throw new Error('Event detail requires Nest backend');
      },
    ),
  setEventConfig: (id: string, body: Record<string, unknown>) =>
    withFallback(
      () => nestVis(`/integrations/${id}/event-config`, { method: 'POST', body }),
      async () => body,
    ),
  testEvent: (id: string, body: Record<string, unknown>) =>
    withFallback(
      () => nestVis(`/integrations/${id}/test-event`, { method: 'POST', body }),
      async () => ({ dryRun: true }),
    ),
  listDeadLetters: (executionId?: string) =>
    withFallback(
      () => nestVis(`/dead-letters${executionId ? `?executionId=${executionId}` : ''}`),
      () => visClientEngine.listDeadLetters(executionId),
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

  /** Seed the Phase-1 ServiceNow demo when the studio is empty. */
  ensureSampleStudio: () =>
    withFallback(
      async () => {
        const listed = await nestVis<any[]>('/integrations');
        if (listed.error) return listed;
        const items = Array.isArray(listed.data) ? listed.data : [];
        if (items.length > 0) {
          const dash = await nestVis('/dashboard');
          if (dash.error) return dash;
          return {
            data: {
              created: false,
              integration: items[0],
              dashboard: dash.data,
              integrations: items,
            },
            error: null,
          };
        }

        await nestVis('/demo/bootstrap', { method: 'POST', body: {} });
        const prompt =
          'Every 15 minutes, sync open ServiceNow vulnerabilities into our internal Vulnerability form. Create or update by external id. Map severity to priority (Critical→1, High→2, Medium→3, Low→4).';
        const created = await nestVis<any>('/integrations', {
          method: 'POST',
          body: {
            name: 'ServiceNow Vulnerabilities → Internal Form',
            promptText: prompt,
            description: 'Phase 1 demo — prompt-first orchestration into an internal form API',
          },
        });
        if (created.error || !created.data?.id) {
          return { data: null, error: created.error || 'Failed to create sample integration' };
        }
        const analyzed = await nestVis(`/integrations/${created.data.id}/analyze`, {
          method: 'POST',
          body: { promptText: prompt },
        });
        if (analyzed.error) return analyzed;
        await nestVis(`/integrations/${created.data.id}/validate`, { method: 'POST', body: {} });
        await nestVis(`/integrations/${created.data.id}/executions`, { method: 'POST', body: {} });
        const integrations = await nestVis<any[]>('/integrations');
        const dash = await nestVis('/dashboard');
        if (integrations.error) return integrations;
        if (dash.error) return dash;
        return {
          data: {
            created: true,
            integration: analyzed.data,
            dashboard: dash.data,
            integrations: integrations.data,
          },
          error: null,
        };
      },
      () => visClientEngine.ensureSampleStudio(),
    ),
};

export const LANGUAGES = [
  { value: 'PYTHON', label: 'Python' },
  { value: 'TYPESCRIPT', label: 'TypeScript / Node.js' },
  { value: 'JAVA', label: 'Java' },
  { value: 'CSHARP', label: 'C#' },
  { value: 'GO', label: 'Go' },
] as const;
