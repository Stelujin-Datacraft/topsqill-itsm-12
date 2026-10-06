import { request } from '@/services/api/apiClient';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function promoRequest<T>(
  path: string,
  options: { method?: Method; body?: unknown } = {},
): Promise<T> {
  const method = options.method || 'GET';
  const full = path.startsWith('/promotion') ? path : `/promotion${path.startsWith('/') ? path : `/${path}`}`;
  const result = await request<T>(
    full,
    {
      method,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    },
    true,
  );
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (result.data === null || result.data === undefined) {
    throw new Error('Empty response from promotion service');
  }
  return result.data;
}

export const promotionApi = {
  availability: async () => {
    // Public endpoint — do not require auth so the nav/gate can probe Prod safely.
    const { request } = await import('@/services/api/apiClient');
    const result = await request<any>('/promotion/availability', { method: 'GET' }, false);
    if (result.error) throw new Error(result.error.message);
    if (result.data == null) throw new Error('Empty availability response');
    return result.data;
  },
  dashboard: () => promoRequest<any>('/dashboard'),
  environments: () => promoRequest<any>('/environments'),
  registry: () => promoRequest<any>('/registry'),
  modules: () => promoRequest<any>('/modules'),
  objects: (params: { module?: string; objectType?: string; projectId?: string; organizationId?: string }) => {
    const q = new URLSearchParams();
    if (params.module) q.set('module', params.module);
    if (params.objectType) q.set('objectType', params.objectType);
    if (params.projectId) q.set('projectId', params.projectId);
    if (params.organizationId) q.set('organizationId', params.organizationId);
    const qs = q.toString();
    return promoRequest<any>(`/objects${qs ? `?${qs}` : ''}`);
  },
  listPackages: () => promoRequest<any>('/packages'),
  createPackage: (body: { name: string; module: string; projectId?: string; organizationId?: string; notes?: string }) =>
    promoRequest<any>('/packages', { method: 'POST', body }),
  getPackage: (id: string) => promoRequest<any>(`/packages/${id}`),
  setSelection: (
    id: string,
    selections: Array<{ objectType: string; objectId: string; stableId?: string; objectName?: string }>,
  ) => promoRequest<any>(`/packages/${id}/selection`, { method: 'PUT', body: { selections } }),
  resolveDependencies: (id: string, includeStableIds?: string[]) =>
    promoRequest<any>(`/packages/${id}/dependencies`, { method: 'POST', body: { includeStableIds } }),
  validate: (id: string) => promoRequest<any>(`/packages/${id}/validate`, { method: 'POST', body: {} }),
  summary: (id: string) => promoRequest<any>(`/packages/${id}/summary`),
  execute: (id: string) => promoRequest<any>(`/packages/${id}/execute`, { method: 'POST', body: {} }),
};
