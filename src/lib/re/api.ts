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
  assigned_to?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  listing_id?: string | null;
  interested_profile_id?: string | null;
  notes_preview?: string | null;
  created_at: string;
  updated_at?: string;
};

export type ReProfile = {
  id: string;
  organization_id: string;
  project_id?: string | null;
  profile_type: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  created_at: string;
};

export type ReListing = {
  id: string;
  organization_id: string;
  project_id?: string | null;
  title: string;
  listing_kind: string;
  listing_type?: string | null;
  status: string;
  city?: string | null;
  locality?: string | null;
  price?: number | null;
  currency?: string | null;
  owner_profile_id?: string | null;
  created_at: string;
};

export type ReAssignee = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  status?: string | null;
};

export type ReActivity = {
  id: string;
  lead_id: string;
  activity_type: string;
  body?: string | null;
  created_by?: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
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

  listAssignees: (organizationId: string) =>
    reRequest<{ users: ReAssignee[] }>(
      `/re/assignees?organizationId=${encodeURIComponent(organizationId)}`,
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
    status?: string;
    assignedTo?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    listingId?: string | null;
    notesPreview?: string | null;
  }) =>
    reRequest<{ lead: ReLead }>('/re/leads', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateLead: (
    leadId: string,
    body: {
      organizationId: string;
      status?: string;
      assignedTo?: string | null;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      listingId?: string | null;
      notesPreview?: string | null;
    },
  ) =>
    reRequest<{ lead: ReLead }>(`/re/leads/${encodeURIComponent(leadId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listLeadActivities: (leadId: string, organizationId: string, limit = 50) =>
    reRequest<{ activities: ReActivity[] }>(
      `/re/leads/${encodeURIComponent(leadId)}/activities?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
      { method: 'GET' },
    ),

  addLeadNote: (leadId: string, organizationId: string, note: string) =>
    reRequest<{ activities: ReActivity[] }>(
      `/re/leads/${encodeURIComponent(leadId)}/notes`,
      {
        method: 'POST',
        body: JSON.stringify({ organizationId, note }),
      },
    ),

  listProfiles: (organizationId: string, limit = 50) =>
    reRequest<{ profiles: ReProfile[] }>(
      `/re/profiles?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
      { method: 'GET' },
    ),

  createProfile: (body: {
    organizationId: string;
    projectId?: string | null;
    profileType: string;
    displayName: string;
    email?: string | null;
    phone?: string | null;
    status?: string;
  }) =>
    reRequest<{ profile: ReProfile }>('/re/profiles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateProfile: (
    profileId: string,
    body: {
      organizationId: string;
      profileType?: string;
      displayName?: string;
      email?: string | null;
      phone?: string | null;
      status?: string;
    },
  ) =>
    reRequest<{ profile: ReProfile }>(`/re/profiles/${encodeURIComponent(profileId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listListings: (organizationId: string, limit = 50) =>
    reRequest<{ listings: ReListing[] }>(
      `/re/listings?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
      { method: 'GET' },
    ),

  createListing: (body: {
    organizationId: string;
    projectId?: string | null;
    title: string;
    listingKind?: string;
    listingType?: string | null;
    status?: string;
    city?: string | null;
    locality?: string | null;
    price?: number | null;
    currency?: string | null;
    ownerProfileId?: string | null;
  }) =>
    reRequest<{ listing: ReListing }>('/re/listings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateListing: (
    listingId: string,
    body: {
      organizationId: string;
      title?: string;
      listingKind?: string;
      listingType?: string | null;
      status?: string;
      city?: string | null;
      locality?: string | null;
      price?: number | null;
      currency?: string | null;
      ownerProfileId?: string | null;
    },
  ) =>
    reRequest<{ listing: ReListing }>(`/re/listings/${encodeURIComponent(listingId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
