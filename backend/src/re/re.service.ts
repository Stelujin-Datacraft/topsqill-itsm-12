import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { getReAccessState } from './re-access';
import {
  RE_LEAD_STATUSES,
  RE_LISTING_STATUSES,
  RE_PROFILE_TYPES,
  isOneOf,
} from './re.constants';

const REQUIRED_TABLES = [
  're_profiles',
  're_listings',
  're_leads',
  're_lead_activities',
] as const;

export type ReCreateLeadDto = {
  organizationId: string;
  projectId?: string | null;
  source?: string;
  status?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  listingId?: string | null;
  interestedProfileId?: string | null;
  assignedTo?: string | null;
  notesPreview?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type ReUpdateLeadDto = {
  organizationId: string;
  status?: string;
  assignedTo?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  listingId?: string | null;
  interestedProfileId?: string | null;
  notesPreview?: string | null;
};

export type ReCreateProfileDto = {
  organizationId: string;
  projectId?: string | null;
  profileType: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ReUpdateProfileDto = {
  organizationId: string;
  profileType?: string;
  displayName?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type ReCreateListingDto = {
  organizationId: string;
  projectId?: string | null;
  title: string;
  listingKind?: string;
  listingType?: string | null;
  status?: string;
  city?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price?: number | null;
  currency?: string | null;
  ownerProfileId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ReUpdateListingDto = {
  organizationId: string;
  title?: string;
  listingKind?: string;
  listingType?: string | null;
  status?: string;
  city?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price?: number | null;
  currency?: string | null;
  ownerProfileId?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class ReService {
  constructor(private readonly supabaseService: SupabaseService) {}

  availability() {
    const access = getReAccessState();
    return {
      enabled: access.enabled,
      environment: access.environment,
      reason: access.reason,
      schemaReady: null as boolean | null,
      requiredTables: [...REQUIRED_TABLES],
    };
  }

  async availabilityWithSchema() {
    const base = this.availability();
    if (!base.enabled) {
      return { ...base, schemaReady: false };
    }
    const schemaReady = await this.checkSchemaReady();
    return { ...base, schemaReady };
  }

  private async checkSchemaReady(): Promise<boolean> {
    try {
      const client = this.supabaseService.getServiceClient();
      const { error } = await client.from('re_leads').select('id').limit(1);
      if (!error) return true;
      const msg = String(error.message || error.code || '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('could not find') || error.code === '42P01') {
        return false;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async requireSchema() {
    const ready = await this.checkSchemaReady();
    if (!ready) {
      throw new ServiceUnavailableException(
        'Real Estate Lead Gen schema is not applied. Run migration 20261027120000_re_leadgen_foundation.sql',
      );
    }
  }

  private async assertOrgRow(
    table: 're_leads' | 're_profiles' | 're_listings',
    id: string,
    organizationId: string,
  ) {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`${table} row not found`);
    return data;
  }

  private async addActivity(
    organizationId: string,
    leadId: string,
    activityType: string,
    body: string,
    createdBy?: string | null,
    metadata: Record<string, unknown> = {},
  ) {
    const client = this.supabaseService.getServiceClient();
    const { error } = await client.from('re_lead_activities').insert({
      organization_id: organizationId,
      lead_id: leadId,
      activity_type: activityType,
      body,
      created_by: createdBy || null,
      metadata,
    });
    if (error) throw new BadRequestException(error.message);
  }

  async overview(organizationId: string) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();

    const [profiles, listings, leads, openLeads] = await Promise.all([
      client
        .from('re_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      client
        .from('re_listings')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      client
        .from('re_leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      client
        .from('re_leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('status', ['new', 'contacted', 'qualified', 'site_visit', 'negotiation']),
    ]);

    return {
      profiles: profiles.count ?? 0,
      listings: listings.count ?? 0,
      leads: leads.count ?? 0,
      openLeads: openLeads.count ?? 0,
    };
  }

  async listAssignees(organizationId: string) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('user_profiles')
      .select('id, email, first_name, last_name, role, status')
      .eq('organization_id', organizationId)
      .order('first_name', { ascending: true })
      .limit(200);
    if (error) throw new BadRequestException(error.message);
    return { users: data ?? [] };
  }

  // ---- Leads ----

  async listLeads(organizationId: string, limit = 50) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { data, error } = await client
      .from('re_leads')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new BadRequestException(error.message);
    return { leads: data ?? [] };
  }

  async createLead(dto: ReCreateLeadDto, createdBy?: string) {
    if (!dto?.organizationId) throw new BadRequestException('organizationId is required');
    if (dto.status && !isOneOf(dto.status, RE_LEAD_STATUSES)) {
      throw new BadRequestException(`Invalid lead status: ${dto.status}`);
    }
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();

    const row = {
      organization_id: dto.organizationId,
      project_id: dto.projectId || null,
      source: dto.source || 'manual',
      status: dto.status || 'new',
      assigned_to: dto.assignedTo || null,
      contact_name: dto.contactName || null,
      contact_email: dto.contactEmail || null,
      contact_phone: dto.contactPhone || null,
      listing_id: dto.listingId || null,
      interested_profile_id: dto.interestedProfileId || null,
      notes_preview: dto.notesPreview || null,
      raw_payload: dto.rawPayload || {},
    };

    const { data, error } = await client.from('re_leads').insert(row).select('*').single();
    if (error) throw new BadRequestException(error.message);

    if (data?.id) {
      await this.addActivity(
        dto.organizationId,
        data.id,
        'system',
        'Lead created',
        createdBy,
        { source: row.source },
      );
    }

    return { lead: data };
  }

  async updateLead(leadId: string, dto: ReUpdateLeadDto, actorId?: string) {
    if (!leadId) throw new BadRequestException('leadId is required');
    if (!dto?.organizationId) throw new BadRequestException('organizationId is required');
    if (dto.status !== undefined && !isOneOf(dto.status, RE_LEAD_STATUSES)) {
      throw new BadRequestException(`Invalid lead status: ${dto.status}`);
    }
    await this.requireSchema();
    const existing = await this.assertOrgRow('re_leads', leadId, dto.organizationId);
    const client = this.supabaseService.getServiceClient();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.assignedTo !== undefined) patch.assigned_to = dto.assignedTo;
    if (dto.contactName !== undefined) patch.contact_name = dto.contactName;
    if (dto.contactEmail !== undefined) patch.contact_email = dto.contactEmail;
    if (dto.contactPhone !== undefined) patch.contact_phone = dto.contactPhone;
    if (dto.listingId !== undefined) patch.listing_id = dto.listingId;
    if (dto.interestedProfileId !== undefined) {
      patch.interested_profile_id = dto.interestedProfileId;
    }
    if (dto.notesPreview !== undefined) patch.notes_preview = dto.notesPreview;

    const { data, error } = await client
      .from('re_leads')
      .update(patch)
      .eq('id', leadId)
      .eq('organization_id', dto.organizationId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    if (dto.status !== undefined && dto.status !== existing.status) {
      await this.addActivity(
        dto.organizationId,
        leadId,
        'stage_change',
        `Stage changed: ${existing.status} → ${dto.status}`,
        actorId,
        { from: existing.status, to: dto.status },
      );
    }
    if (dto.assignedTo !== undefined && dto.assignedTo !== existing.assigned_to) {
      await this.addActivity(
        dto.organizationId,
        leadId,
        'assignment',
        dto.assignedTo ? `Assigned to ${dto.assignedTo}` : 'Unassigned',
        actorId,
        { from: existing.assigned_to, to: dto.assignedTo },
      );
    }

    return { lead: data };
  }

  async listLeadActivities(leadId: string, organizationId: string, limit = 50) {
    if (!leadId || !organizationId) {
      throw new BadRequestException('leadId and organizationId are required');
    }
    await this.requireSchema();
    await this.assertOrgRow('re_leads', leadId, organizationId);
    const client = this.supabaseService.getServiceClient();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { data, error } = await client
      .from('re_lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new BadRequestException(error.message);
    return { activities: data ?? [] };
  }

  async addLeadNote(
    leadId: string,
    body: { organizationId: string; note: string },
    actorId?: string,
  ) {
    if (!leadId) throw new BadRequestException('leadId is required');
    if (!body?.organizationId) throw new BadRequestException('organizationId is required');
    const note = String(body.note || '').trim();
    if (!note) throw new BadRequestException('note is required');
    await this.requireSchema();
    await this.assertOrgRow('re_leads', leadId, body.organizationId);
    await this.addActivity(body.organizationId, leadId, 'note', note, actorId);
    const client = this.supabaseService.getServiceClient();
    await client
      .from('re_leads')
      .update({
        notes_preview: note.slice(0, 240),
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('organization_id', body.organizationId);
    return this.listLeadActivities(leadId, body.organizationId, 50);
  }

  // ---- Profiles ----

  async listProfiles(organizationId: string, limit = 50) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { data, error } = await client
      .from('re_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new BadRequestException(error.message);
    return { profiles: data ?? [] };
  }

  async createProfile(dto: ReCreateProfileDto) {
    if (!dto?.organizationId) throw new BadRequestException('organizationId is required');
    if (!dto.displayName?.trim()) throw new BadRequestException('displayName is required');
    if (!isOneOf(dto.profileType, RE_PROFILE_TYPES)) {
      throw new BadRequestException(`Invalid profileType: ${dto.profileType}`);
    }
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();
    const row = {
      organization_id: dto.organizationId,
      project_id: dto.projectId || null,
      profile_type: dto.profileType,
      display_name: dto.displayName.trim(),
      email: dto.email || null,
      phone: dto.phone || null,
      status: dto.status || 'active',
      user_id: dto.userId || null,
      metadata: dto.metadata || {},
    };
    const { data, error } = await client.from('re_profiles').insert(row).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return { profile: data };
  }

  async updateProfile(profileId: string, dto: ReUpdateProfileDto) {
    if (!profileId) throw new BadRequestException('profileId is required');
    if (!dto?.organizationId) throw new BadRequestException('organizationId is required');
    if (dto.profileType !== undefined && !isOneOf(dto.profileType, RE_PROFILE_TYPES)) {
      throw new BadRequestException(`Invalid profileType: ${dto.profileType}`);
    }
    await this.requireSchema();
    await this.assertOrgRow('re_profiles', profileId, dto.organizationId);
    const client = this.supabaseService.getServiceClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.profileType !== undefined) patch.profile_type = dto.profileType;
    if (dto.displayName !== undefined) patch.display_name = dto.displayName.trim();
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.metadata !== undefined) patch.metadata = dto.metadata;
    const { data, error } = await client
      .from('re_profiles')
      .update(patch)
      .eq('id', profileId)
      .eq('organization_id', dto.organizationId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { profile: data };
  }

  // ---- Listings ----

  async listListings(organizationId: string, limit = 50) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { data, error } = await client
      .from('re_listings')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new BadRequestException(error.message);
    return { listings: data ?? [] };
  }

  async createListing(dto: ReCreateListingDto) {
    if (!dto?.organizationId) throw new BadRequestException('organizationId is required');
    if (!dto.title?.trim()) throw new BadRequestException('title is required');
    if (dto.status && !isOneOf(dto.status, RE_LISTING_STATUSES)) {
      throw new BadRequestException(`Invalid listing status: ${dto.status}`);
    }
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();
    const row = {
      organization_id: dto.organizationId,
      project_id: dto.projectId || null,
      title: dto.title.trim(),
      listing_kind: dto.listingKind || 'property',
      listing_type: dto.listingType || null,
      status: dto.status || 'draft',
      city: dto.city || null,
      locality: dto.locality || null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      price: dto.price ?? null,
      currency: dto.currency || 'INR',
      owner_profile_id: dto.ownerProfileId || null,
      metadata: dto.metadata || {},
    };
    const { data, error } = await client.from('re_listings').insert(row).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return { listing: data };
  }

  async updateListing(listingId: string, dto: ReUpdateListingDto) {
    if (!listingId) throw new BadRequestException('listingId is required');
    if (!dto?.organizationId) throw new BadRequestException('organizationId is required');
    if (dto.status !== undefined && !isOneOf(dto.status, RE_LISTING_STATUSES)) {
      throw new BadRequestException(`Invalid listing status: ${dto.status}`);
    }
    await this.requireSchema();
    await this.assertOrgRow('re_listings', listingId, dto.organizationId);
    const client = this.supabaseService.getServiceClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.listingKind !== undefined) patch.listing_kind = dto.listingKind;
    if (dto.listingType !== undefined) patch.listing_type = dto.listingType;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.city !== undefined) patch.city = dto.city;
    if (dto.locality !== undefined) patch.locality = dto.locality;
    if (dto.latitude !== undefined) patch.latitude = dto.latitude;
    if (dto.longitude !== undefined) patch.longitude = dto.longitude;
    if (dto.price !== undefined) patch.price = dto.price;
    if (dto.currency !== undefined) patch.currency = dto.currency;
    if (dto.ownerProfileId !== undefined) patch.owner_profile_id = dto.ownerProfileId;
    if (dto.metadata !== undefined) patch.metadata = dto.metadata;
    const { data, error } = await client
      .from('re_listings')
      .update(patch)
      .eq('id', listingId)
      .eq('organization_id', dto.organizationId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { listing: data };
  }
}
