/**
 * ITAM API client — Nest `/api/itam/*` with browser fallback for Form Sync
 * when the Nest backend is unreachable (published app / preview).
 */

import { request } from '@/services/api/apiClient';
import { itamSyncClientEngine } from './syncClientEngine';

/** Sticky: once Nest ITAM is unreachable this session, stay on client engine for sync. */
let syncBackendUnavailable = false;

export function isItamSyncClientMode() {
  return syncBackendUnavailable;
}

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
    || m.includes('request failed (404)')
    || m.includes('request failed (500)')
    || m.includes('request failed (502)')
    || m.includes('request failed (503)')
    || m.includes('request failed (504)')
  );
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function nestItam<T>(
  path: string,
  options: { method?: Method; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ data: T | null; error: string | null }> {
  const method = options.method || 'GET';
  const itamPath = path.startsWith('/itam')
    ? path
    : `/itam${path.startsWith('/') ? path : `/${path}`}`;

  const org =
    (typeof localStorage !== 'undefined' && localStorage.getItem('current_organization_id')) || '';
  const headers: Record<string, string> = {
    'x-itam-roles': 'ITAM_ADMIN',
    ...(options.headers || {}),
  };
  if (org) headers['x-organization-id'] = org;

  const result = await request<T>(
    itamPath,
    {
      method,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      headers,
    },
    true,
  );
  return {
    data: result.data,
    error: result.error?.message || null,
  };
}

async function withSyncFallback<T>(
  nestCall: () => Promise<{ data: T | null; error: string | null }>,
  clientCall: () => T | Promise<T>,
): Promise<T> {
  if (syncBackendUnavailable) {
    return clientCall();
  }

  const nest = await nestCall();

  if (isNetworkError(nest.error)) {
    syncBackendUnavailable = true;
    return clientCall();
  }

  if (nest.error) {
    throw new Error(nest.error);
  }

  if (nest.data !== null && nest.data !== undefined) {
    return nest.data;
  }

  return clientCall();
}

function requireOrg(): string {
  const org =
    (typeof localStorage !== 'undefined' && localStorage.getItem('current_organization_id')) || '';
  if (!org) throw new Error('organization context required — select an organization and retry');
  return org;
}

/**
 * Shared Nest call for discovery / cloud / intelligence panels.
 * Uses apiClient base URL resolution (published apps never hit developer localhost).
 * Throws a clear error when Nest is down — those modules need the Nest service.
 */
export async function itamNestFetch<T = unknown>(
  path: string,
  init?: { method?: Method; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const nest = await nestItam<T>(path, init || {});
  if (nest.error) throw new Error(nest.error);
  if (nest.data === null || nest.data === undefined) {
    throw new Error('Empty response from ITAM API');
  }
  return nest.data;
}

/** Form Sync API — Nest first, local lab engine when Nest is unreachable. */
export const itamSyncApi = {
  listTargets: () =>
    withSyncFallback(
      () => nestItam('/sync/targets'),
      () => itamSyncClientEngine.listTargets(requireOrg()),
    ),

  createTarget: (body: Record<string, unknown>) =>
    withSyncFallback(
      () => nestItam('/sync/targets', { method: 'POST', body }),
      () =>
        itamSyncClientEngine.createTarget(requireOrg(), body as {
          name: string;
          baseUrl: string;
          credentialReferenceId: string;
          targetFormId?: string;
        }),
    ),

  listMappings: () =>
    withSyncFallback(
      () => nestItam('/sync/mappings'),
      () => itamSyncClientEngine.listMappings(requireOrg()),
    ),

  previewMappings: (body: { targetId: string; formId: string; name?: string }) =>
    withSyncFallback(
      () => nestItam('/sync/mappings/preview', { method: 'POST', body }),
      () => itamSyncClientEngine.previewMappings(requireOrg(), body),
    ),

  approveMapping: (id: string) =>
    withSyncFallback(
      () => nestItam(`/sync/mappings/${id}/approve`, { method: 'POST', body: {} }),
      () => itamSyncClientEngine.approveMapping(requireOrg(), id),
    ),

  getSchema: (formId: string, targetId?: string) =>
    withSyncFallback(
      () =>
        nestItam(`/sync/schema/${encodeURIComponent(formId)}`, {
          headers: targetId ? { 'x-sync-target-id': targetId } : undefined,
        }),
      () => itamSyncClientEngine.getSchema(requireOrg(), formId, targetId),
    ),

  previewSync: (body: { targetId: string; mappingId: string; assetIds?: string[] }) =>
    withSyncFallback(
      () => nestItam('/sync/preview', { method: 'POST', body }),
      () => itamSyncClientEngine.previewSync(requireOrg(), body),
    ),

  executeSync: (body: { targetId: string; mappingId: string; assetIds?: string[] }) =>
    withSyncFallback(
      () => nestItam('/sync/execute', { method: 'POST', body }),
      () => itamSyncClientEngine.executeSync(requireOrg(), body),
    ),

  listRuns: () =>
    withSyncFallback(
      () => nestItam('/sync/runs'),
      () => itamSyncClientEngine.listRuns(requireOrg()),
    ),

  getRun: (id: string) =>
    withSyncFallback(
      () => nestItam(`/sync/runs/${id}`),
      () => itamSyncClientEngine.getRun(requireOrg(), id),
    ),

  history: (assetExternalId: string) =>
    withSyncFallback(
      () => nestItam(`/sync/history/${encodeURIComponent(assetExternalId)}`),
      () => itamSyncClientEngine.history(requireOrg(), assetExternalId),
    ),

  provenance: (assetExternalId: string) =>
    withSyncFallback(
      () => nestItam(`/sync/provenance/${encodeURIComponent(assetExternalId)}`),
      () => itamSyncClientEngine.provenance(requireOrg(), assetExternalId),
    ),

  metrics: () =>
    withSyncFallback(
      () => nestItam('/sync/metrics'),
      () => itamSyncClientEngine.metrics(requireOrg()),
    ),
};
