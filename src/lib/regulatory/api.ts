import { request } from '@/services/api/apiClient';

async function regulatoryRequest<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const result = await request<T>(path, init, auth);
  if (result.error) throw new Error(result.error.message || 'Regulatory API request failed');
  return result.data as T;
}

export const regulatoryApi = {
  availability: () => regulatoryRequest<{ enabled: boolean; reason: string }>('/regulatory/availability', { method: 'GET' }, false),
  provision: (projectId: string) => regulatoryRequest<Record<string, unknown>>('/regulatory/provision', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  }),
  importInstrument: (projectId: string, instrument: 'gdpr' | 'dpdp') => regulatoryRequest<Record<string, unknown>>('/regulatory/import', {
    method: 'POST',
    body: JSON.stringify({ projectId, instrument }),
  }),
  quality: (projectId: string) => regulatoryRequest<Array<{ code: string; sourceKey: string; message: string }>>('/regulatory/quality', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  }),
};
