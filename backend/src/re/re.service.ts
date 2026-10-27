import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { getReAccessState } from './re-access';

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
  notesPreview?: string | null;
  rawPayload?: Record<string, unknown>;
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
      // Probe one table; missing relation → PostgREST error.
      const { error } = await client.from('re_leads').select('id').limit(1);
      if (!error) return true;
      const msg = String(error.message || error.code || '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('could not find') || error.code === '42P01') {
        return false;
      }
      // Other errors (RLS/network) — treat as not ready for safety.
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

  async overview(organizationId: string) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();

    const [profiles, listings, leads] = await Promise.all([
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
    ]);

    return {
      profiles: profiles.count ?? 0,
      listings: listings.count ?? 0,
      leads: leads.count ?? 0,
      openLeads:
        (
          await client
            .from('re_leads')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .in('status', ['new', 'contacted', 'qualified', 'site_visit', 'negotiation'])
        ).count ?? 0,
    };
  }

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
    await this.requireSchema();
    const client = this.supabaseService.getServiceClient();

    const row = {
      organization_id: dto.organizationId,
      project_id: dto.projectId || null,
      source: dto.source || 'manual',
      status: dto.status || 'new',
      contact_name: dto.contactName || null,
      contact_email: dto.contactEmail || null,
      contact_phone: dto.contactPhone || null,
      listing_id: dto.listingId || null,
      notes_preview: dto.notesPreview || null,
      raw_payload: dto.rawPayload || {},
    };

    const { data, error } = await client.from('re_leads').insert(row).select('*').single();
    if (error) throw new BadRequestException(error.message);

    if (data?.id) {
      await client.from('re_lead_activities').insert({
        organization_id: dto.organizationId,
        lead_id: data.id,
        activity_type: 'system',
        body: 'Lead created',
        created_by: createdBy || null,
        metadata: { source: row.source },
      });
    }

    return { lead: data };
  }

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
}
