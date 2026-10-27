export const RE_INGEST_PROVIDERS = [
  'website',
  'meta_ads',
  'google_ads',
  'linkedin',
  'portal_99acres',
  'portal_magicbricks',
  'portal_housing',
  'portal_email',
  'call',
  'manual',
] as const;

export type ReIngestProvider = (typeof RE_INGEST_PROVIDERS)[number];

export type NormalizedLeadInput = {
  source: ReIngestProvider | string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notesPreview?: string | null;
  listingId?: string | null;
  externalId?: string | null;
  projectId?: string | null;
  rawPayload: Record<string, unknown>;
};

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function fromFieldData(fields: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(fields)) return out;
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue;
    const row = f as Record<string, unknown>;
    const name = firstString(row.name, row.field_name, row.key);
    const value = firstString(row.values?.[0], row.value, Array.isArray(row.values) ? row.values.join(', ') : null);
    if (name && value) out[name.toLowerCase()] = value;
  }
  return out;
}

/** Meta Lead Ads (Graph leadgen field_data or direct form fields). */
export function normalizeMetaPayload(body: Record<string, unknown>): NormalizedLeadInput {
  const entry = Array.isArray(body.entry) ? (body.entry[0] as Record<string, unknown>) : null;
  const changes = entry && Array.isArray(entry.changes) ? (entry.changes[0] as Record<string, unknown>) : null;
  const value = (changes?.value || body.lead || body) as Record<string, unknown>;
  const fieldMap = fromFieldData(value.field_data || body.field_data);
  return {
    source: 'meta_ads',
    contactName: firstString(fieldMap.full_name, fieldMap.name, fieldMap['full name'], body.full_name, body.name),
    contactEmail: firstString(fieldMap.email, fieldMap.email_address, body.email),
    contactPhone: firstString(fieldMap.phone_number, fieldMap.phone, fieldMap.mobile, body.phone),
    notesPreview: firstString(fieldMap.city, fieldMap.project, body.notes),
    externalId: firstString(value.leadgen_id, body.leadgen_id, body.id),
    rawPayload: body,
  };
}

/** Google Ads lead form extension webhook. */
export function normalizeGooglePayload(body: Record<string, unknown>): NormalizedLeadInput {
  const user = (body.user_column_data || body.userColumnData || []) as unknown;
  const fieldMap = fromFieldData(user);
  if (Array.isArray(body.column_data)) {
    Object.assign(fieldMap, fromFieldData(body.column_data));
  }
  if (Array.isArray(user)) {
    for (const col of user) {
      if (!col || typeof col !== 'object') continue;
      const row = col as Record<string, unknown>;
      const id = firstString(row.column_id, row.columnId, row.name);
      const val = firstString(row.string_value, row.stringValue, row.value);
      if (id && val) fieldMap[id.toLowerCase().replace(/_/g, ' ')] = val;
    }
  }
  return {
    source: 'google_ads',
    contactName: firstString(
      fieldMap['full name'],
      fieldMap.full_name,
      fieldMap.name,
      body.full_name,
      body.name,
    ),
    contactEmail: firstString(
      fieldMap['user email'],
      fieldMap.email,
      fieldMap['email'],
      body.email,
    ),
    contactPhone: firstString(
      fieldMap['user phone'],
      fieldMap.phone,
      fieldMap['phone number'],
      body.phone_number,
      body.phone,
    ),
    notesPreview: firstString(body.gcl_id, body.campaign_id, fieldMap.campaign),
    externalId: firstString(body.lead_id, body.id, body.resource_name),
    rawPayload: body,
  };
}

/** LinkedIn Lead Gen Forms. */
export function normalizeLinkedInPayload(body: Record<string, unknown>): NormalizedLeadInput {
  const formResponse = (body.formResponse || body.leadFormResponse || body) as Record<string, unknown>;
  const answers = (formResponse.answers || body.answers || []) as unknown;
  const fieldMap: Record<string, string> = {};
  if (Array.isArray(answers)) {
    for (const a of answers) {
      if (!a || typeof a !== 'object') continue;
      const row = a as Record<string, unknown>;
      const q = firstString(row.question, row.name, row.field);
      const ans = firstString(
        row.answer,
        Array.isArray(row.answerDetails) ? (row.answerDetails as unknown[]).map(String).join(', ') : null,
        row.value,
      );
      if (q && ans) fieldMap[q.toLowerCase()] = ans;
    }
  }
  return {
    source: 'linkedin',
    contactName: firstString(
      fieldMap['full name'],
      fieldMap.name,
      body.firstName && body.lastName ? `${body.firstName} ${body.lastName}` : null,
      body.firstName as string,
    ),
    contactEmail: firstString(fieldMap.email, fieldMap['email address'], body.email),
    contactPhone: firstString(fieldMap.phone, fieldMap['phone number'], body.phone),
    notesPreview: firstString(fieldMap.company, body.company),
    externalId: firstString(body.id, formResponse.id as string),
    rawPayload: body,
  };
}

/** Website / embed / Form API style. */
export function normalizeWebsitePayload(body: Record<string, unknown>): NormalizedLeadInput {
  const data = (body.data || body.fields || body) as Record<string, unknown>;
  return {
    source: 'website',
    contactName: firstString(data.name, data.full_name, data.contact_name, body.name),
    contactEmail: firstString(data.email, data.contact_email, body.email),
    contactPhone: firstString(data.phone, data.mobile, data.contact_phone, body.phone),
    notesPreview: firstString(data.message, data.notes, data.requirement, body.message),
    listingId: firstString(data.listing_id, body.listingId, body.listing_id),
    projectId: firstString(data.project_id, body.projectId, body.project_id),
    externalId: firstString(body.submission_id, body.id),
    rawPayload: body,
  };
}

/** Property portal webhook or parsed email body. */
export function normalizePortalPayload(
  provider: ReIngestProvider,
  body: Record<string, unknown>,
): NormalizedLeadInput {
  const text = firstString(body.body, body.text, body.email_body, body.raw) || '';
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(\+?\d[\d\s\-()]{8,}\d)/);
  return {
    source: provider,
    contactName: firstString(body.name, body.contact_name, body.buyer_name, body.from_name),
    contactEmail: firstString(body.email, body.contact_email, body.from_email, emailMatch?.[0]),
    contactPhone: firstString(body.phone, body.mobile, body.contact_phone, phoneMatch?.[0]),
    notesPreview: firstString(body.subject, body.property, body.project, text.slice(0, 240)),
    externalId: firstString(body.lead_id, body.enquiry_id, body.message_id, body.id),
    rawPayload: body,
  };
}

export function normalizeCallPayload(body: Record<string, unknown>): NormalizedLeadInput {
  return {
    source: 'call',
    contactName: firstString(body.name, body.caller_name, body.contact_name),
    contactEmail: firstString(body.email),
    contactPhone: firstString(body.phone, body.from, body.caller_id, body.contact_phone),
    notesPreview: firstString(body.notes, body.summary, body.recording_url),
    externalId: firstString(body.call_id, body.id),
    rawPayload: body,
  };
}
