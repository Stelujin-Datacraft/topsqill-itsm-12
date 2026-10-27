import { request } from '@/services/api/apiClient';

export type ReAvailability = {
  enabled: boolean;
  environment: string;
  reason: string;
  schemaReady: boolean | null;
  requiredTables?: string[];
};

export type ReOverview = {
  profiles: number;
  listings: number;
  leads: number;
  openLeads: number;
};

export type ReLead = {
  id: string;
  organization_id: string;
  project_id?: string | null;
  source: string;
  status: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  listing_id?: string | null;
  notes_preview?: string | null;
  created_at: string;
};

async function reRequest<T>(
  path: string,
  init?: RequestInit,
  auth = true,
): Promise<T> {
  const result = await request<T>(path, init, auth);
  if (result.error) {
    throw new Error(result.error.message || 'Real Estate API request failed');
  }
  return result.data as T;
}

export const reApi = {
  availability: () => reRequest<ReAvailability>('/re/availability', { method: 'GET' }, false),

  overview: (organizationId: string) =>
    reRequest<ReOverview>(
      `/re/overview?organizationId=${encodeURIComponent(organizationId)}`,
      { method: 'GET' },
    ),

  listLeads: (organizationId: string, limit = 50) =>
    reRequest<{ leads: ReLead[] }>(
      `/re/leads?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
      { method: 'GET' },
    ),

  createLead: (body: {
    organizationId: string;
    projectId?: string | null;
    source?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    notesPreview?: string | null;
  }) =>
    reRequest<{ lead: ReLead }>('/re/leads', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listProfiles: (organizationId: string, limit = 50) =>
    reRequest<{ profiles: Record<string, unknown>[] }>(
      `/re/profiles?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
      { method: 'GET' },
    ),

  listListings: (organizationId: string, limit = 50) =>
    reRequest<{ listings: Record<string, unknown>[] }>(
      `/re/listings?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
      { method: 'GET' },
    ),
};
