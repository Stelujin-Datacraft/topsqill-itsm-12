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
  phone_e164?: string | null;
  email_normalized?: string | null;
  name_normalized?: string | null;
  budget_inr?: number | null;
  budget_raw?: string | null;
  custom_answers?: Record<string, unknown> | null;
  first_source?: string | null;
  latest_source?: string | null;
  campaign_name?: string | null;
  ad_name?: string | null;
  form_name?: string | null;
  enrichment_status?: string | null;
  enrichment_error?: string | null;
  is_re_enquiry?: boolean | null;
  re_enquired_at?: string | null;
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

  ensureSources: (organizationId: string, projectId?: string | null) =>
    reRequest<{ sources: ReSourceConfig[] }>('/re/sources/ensure', {
      method: 'POST',
      body: JSON.stringify({ organizationId, projectId }),
    }),

  listSources: (organizationId: string) =>
    reRequest<{ sources: ReSourceConfig[] }>(
      `/re/sources?organizationId=${encodeURIComponent(organizationId)}`,
      { method: 'GET' },
    ),

  updateSource: (body: {
    organizationId: string;
    provider: string;
    enabled?: boolean;
    displayName?: string;
    verifyToken?: string;
    accessToken?: string;
    appSecret?: string;
    pageId?: string | null;
    formIdExternal?: string | null;
    graphApiVersion?: string;
    fieldMappings?: Record<string, string>;
    rotateIngestKey?: boolean;
    clearNeedsReauth?: boolean;
  }) =>
    reRequest<{ source: ReSourceConfig }>('/re/sources', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  updateMetaFieldMappings: (organizationId: string, fieldMappings: Record<string, string>) =>
    reRequest<{ source: ReSourceConfig }>('/re/sources/meta/field-mappings', {
      method: 'POST',
      body: JSON.stringify({ organizationId, fieldMappings }),
    }),

  fetchMissedMetaLeads: (body: {
    organizationId: string;
    formId?: string;
    since?: string;
    until?: string;
    maxPages?: number;
  }) =>
    reRequest<{ enqueued: number; pages: number }>(
      '/re/sources/meta/fetch-missed',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

  processEnrichmentNow: () =>
    reRequest<{ processed: number; succeeded: number; failed: number }>(
      '/re/enrichment/process',
      { method: 'POST' },
    ),

  getOrgSettings: (organizationId: string) =>
    reRequest<{ settings: ReOrgSettings }>(
      `/re/org-settings?organizationId=${encodeURIComponent(organizationId)}`,
      { method: 'GET' },
    ),

  upsertOrgSettings: (body: {
    organizationId: string;
    defaultCountryCode?: string;
    dedupeWindowDays?: number;
  }) =>
    reRequest<{ settings: ReOrgSettings }>('/re/org-settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listPossibleDuplicates: async (leadId: string, organizationId: string) => {
    const res = await reRequest<{ possibles?: ReLead[]; duplicates?: ReLead[] }>(
      `/re/leads/${encodeURIComponent(leadId)}/possible-duplicates?organizationId=${encodeURIComponent(organizationId)}`,
      { method: 'GET' },
    );
    return { duplicates: res.duplicates || res.possibles || [] };
  },

  mergeLeads: (body: {
    organizationId: string;
    survivorLeadId: string;
    mergedLeadId: string;
  }) =>
    reRequest<{ survivor: ReLead; mergedId: string }>('/re/leads/merge', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listIngestEvents: (organizationId: string, limit = 50) =>
    reRequest<{ events: ReIngestEvent[] }>(
      `/re/ingest-events?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
      { method: 'GET' },
    ),

  testIngest: (organizationId: string, provider: string, sample?: Record<string, unknown>) =>
    reRequest<{ lead: ReLead }>('/re/ingest/test', {
      method: 'POST',
      body: JSON.stringify({ organizationId, provider, sample }),
    }),

  listFollowUpRules: (organizationId: string) =>
    reRequest<{ rules: ReFollowUpRule[] }>(
      `/re/follow-up-rules?organizationId=${encodeURIComponent(organizationId)}`,
      { method: 'GET' },
    ),

  upsertFollowUpRule: (body: {
    organizationId: string;
    id?: string;
    enabled?: boolean;
    name?: string;
    delayMinutes?: number;
    subjectTemplate?: string;
    bodyTemplate?: string;
  }) =>
    reRequest<{ rule: ReFollowUpRule }>('/re/follow-up-rules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listFollowUpJobs: (organizationId: string, limit = 50) =>
    reRequest<{ jobs: ReFollowUpJob[] }>(
      `/re/follow-up-jobs?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
      { method: 'GET' },
    ),

  processFollowUpsNow: () =>
    reRequest<{ processed: number; sent: number; failed: number }>(
      '/re/follow-up-jobs/process',
      { method: 'POST' },
    ),
};

export type ReSourceConfig = {
  id: string;
  organization_id: string;
  provider: string;
  enabled: boolean;
  display_name?: string | null;
  ingest_key?: string | null;
  verify_token?: string | null;
  page_id?: string | null;
  form_id_external?: string | null;
  webhook_path_token?: string | null;
  settings?: Record<string, unknown>;
  needs_reauth?: boolean | null;
  reauth_reason?: string | null;
  graph_api_version?: string | null;
  field_mappings?: Record<string, string> | null;
};

export type ReOrgSettings = {
  organization_id: string;
  default_country_code: string;
  dedupe_window_days: number;
  settings?: Record<string, unknown>;
};

export type ReIngestEvent = {
  id: string;
  organization_id?: string | null;
  provider: string;
  status: string;
  lead_id?: string | null;
  external_id?: string | null;
  error_message?: string | null;
  created_at: string;
  enrichment_status?: string | null;
  enrichment_error?: string | null;
  leadgen_id?: string | null;
};

export type ReFollowUpRule = {
  id: string;
  organization_id: string;
  enabled: boolean;
  name: string;
  delay_minutes: number;
  channel: string;
  subject_template: string;
  body_template: string;
};

export type ReFollowUpJob = {
  id: string;
  lead_id: string;
  status: string;
  channel: string;
  run_at: string;
  last_error?: string | null;
  created_at: string;
};
