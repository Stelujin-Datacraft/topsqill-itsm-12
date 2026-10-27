import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { isReDedupeEnabled } from './re-access';
import {
  findExactDedupeMatch,
  findPossibleDuplicates,
  mergeEmptyFields,
  shouldRestartFollowUp,
  type DedupeCandidate,
} from './re-dedupe';
import { ReFollowupService } from './re-followup.service';
import {
  extractBudgetFromAnswers,
  normalizeLeadFields,
} from './re-normalize';

export type AcceptLeadInput = {
  organizationId: string;
  projectId?: string | null;
  source: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notesPreview?: string | null;
  listingId?: string | null;
  leadgenId?: string | null;
  externalId?: string | null;
  phoneE164?: string | null;
  phoneRaw?: string | null;
  phoneInvalid?: boolean;
  emailNormalized?: string | null;
  emailInvalid?: boolean;
  nameNormalized?: string | null;
  budgetInr?: number | null;
  budgetRaw?: string | null;
  customAnswers?: Record<string, unknown>;
  enrichmentStatus?: string;
  campaignId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  adId?: string | null;
  adName?: string | null;
  formIdExternal?: string | null;
  formName?: string | null;
  platform?: string | null;
  isOrganic?: boolean | null;
  rawPayload?: Record<string, unknown>;
  ingestEventId?: string | null;
  actorId?: string | null;
  skipFollowUpRestart?: boolean;
};

@Injectable()
export class ReDedupeService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followups: ReFollowupService,
  ) {}

  private client() {
    return this.supabaseService.getServiceClient();
  }

  async getOrgSettings(organizationId: string) {
    const { data } = await this.client()
      .from('re_org_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (data) return data;
    const { data: created } = await this.client()
      .from('re_org_settings')
      .upsert({
        organization_id: organizationId,
        default_country_code: '+91',
        dedupe_window_days: 90,
      })
      .select('*')
      .single();
    return created || {
      organization_id: organizationId,
      default_country_code: '+91',
      dedupe_window_days: 90,
    };
  }

  async upsertOrgSettings(
    organizationId: string,
    patch: { defaultCountryCode?: string; dedupeWindowDays?: number },
  ) {
    const { data, error } = await this.client()
      .from('re_org_settings')
      .upsert({
        organization_id: organizationId,
        default_country_code: patch.defaultCountryCode || '+91',
        dedupe_window_days: patch.dedupeWindowDays ?? 90,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { settings: data };
  }

  /**
   * Single entry for all sources: normalise → dedupe → create or re-enquire.
   */
  async acceptLead(input: AcceptLeadInput): Promise<{
    leadId: string;
    mode: 'created' | 're_enquiry';
    lead: Record<string, unknown>;
  }> {
    const settings = await this.getOrgSettings(input.organizationId);
    const budgetText =
      input.budgetRaw ||
      extractBudgetFromAnswers(input.customAnswers || {}) ||
      null;
    const norm = normalizeLeadFields({
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      budgetText,
      customAnswers: input.customAnswers,
      sourceLabel: input.source,
      defaultCountryCode: settings.default_country_code || '+91',
    });

    // Prefer precomputed E.164 if caller already normalised
    const phoneE164 = input.phoneE164 || norm.phoneE164;
    const emailNormalized = input.emailNormalized || norm.emailNormalized;

    // Idempotency on leadgen_id
    if (input.leadgenId) {
      const { data: byLg } = await this.client()
        .from('re_leads')
        .select('*')
        .eq('organization_id', input.organizationId)
        .eq('leadgen_id', input.leadgenId)
        .maybeSingle();
      if (byLg) {
        await this.recordTouch(byLg, input, norm.customAnswers, false);
        return { leadId: byLg.id, mode: 're_enquiry', lead: byLg };
      }
    }

    if (isReDedupeEnabled()) {
      const orFilters: string[] = [];
      if (phoneE164) orFilters.push(`phone_e164.eq.${phoneE164}`);
      if (emailNormalized) orFilters.push(`email_normalized.eq.${emailNormalized}`);
      let candidates: DedupeCandidate[] = [];
      if (orFilters.length) {
        const { data } = await this.client()
          .from('re_leads')
          .select(
            'id, phone_e164, email_normalized, name_normalized, custom_answers, created_at, updated_at, status, contact_name, contact_email, contact_phone, notes_preview, first_source, latest_source, budget_inr, budget_raw',
          )
          .eq('organization_id', input.organizationId)
          .or(orFilters.join(','))
          .limit(50);
        candidates = (data || []) as DedupeCandidate[];
      }
      const match = findExactDedupeMatch(candidates, {
        phoneE164,
        emailNormalized,
        windowDays: settings.dedupe_window_days ?? 90,
      });
      if (match) {
        const full = await this.applyReEnquiry(match.id, input, {
          ...norm,
          phoneE164,
          emailNormalized,
        });
        return { leadId: full.id, mode: 're_enquiry', lead: full };
      }
    }

    const row = {
      organization_id: input.organizationId,
      project_id: input.projectId || null,
      source: input.source,
      status: 'new',
      contact_name: norm.contactName,
      contact_email: norm.contactEmail,
      contact_phone: phoneE164 || norm.phoneRaw,
      notes_preview: input.notesPreview || null,
      listing_id: input.listingId || null,
      raw_payload: input.rawPayload || {},
      phone_e164: phoneE164,
      phone_raw: input.phoneRaw || norm.phoneRaw,
      phone_invalid: input.phoneInvalid ?? norm.phoneInvalid,
      email_normalized: emailNormalized,
      email_invalid: input.emailInvalid ?? norm.emailInvalid,
      name_normalized: input.nameNormalized || norm.nameNormalized,
      budget_inr: input.budgetInr ?? norm.budgetInr,
      budget_raw: input.budgetRaw || norm.budgetRaw,
      custom_answers: input.customAnswers || norm.customAnswers,
      leadgen_id: input.leadgenId || null,
      external_id: input.externalId || input.leadgenId || null,
      enrichment_status: input.enrichmentStatus || 'none',
      first_source: input.source,
      latest_source: input.source,
      campaign_id: input.campaignId || null,
      campaign_name: input.campaignName || null,
      adset_id: input.adsetId || null,
      adset_name: input.adsetName || null,
      ad_id: input.adId || null,
      ad_name: input.adName || null,
      form_id_external: input.formIdExternal || null,
      form_name: input.formName || null,
      platform: input.platform || null,
      is_organic: input.isOrganic ?? null,
    };

    const { data, error } = await this.client().from('re_leads').insert(row).select('*').single();
    if (error) throw new BadRequestException(error.message);

    await this.client().from('re_lead_activities').insert({
      organization_id: input.organizationId,
      lead_id: data.id,
      activity_type: 'system',
      body: `Lead created via ${input.source}`,
      created_by: input.actorId || null,
      metadata: { source: input.source },
    });

    await this.recordTouch(data, input, norm.customAnswers, true);

    if (input.ingestEventId) {
      await this.client()
        .from('re_ingest_events')
        .update({ lead_id: data.id, status: 'accepted' })
        .eq('id', input.ingestEventId);
    }

    try {
      await this.followups.scheduleForLead(input.organizationId, data);
    } catch {
      /* follow-up schema optional */
    }

    return { leadId: data.id, mode: 'created', lead: data };
  }

  private async applyReEnquiry(
    leadId: string,
    input: AcceptLeadInput,
    norm: ReturnType<typeof normalizeLeadFields> & {
      phoneE164?: string | null;
      emailNormalized?: string | null;
    },
  ) {
    const { data: existing, error } = await this.client()
      .from('re_leads')
      .select('*')
      .eq('id', leadId)
      .single();
    if (error || !existing) throw new BadRequestException('Lead not found for re-enquiry');

    const patch = mergeEmptyFields(
      existing as Record<string, unknown>,
      {
        contact_name: norm.contactName,
        contact_email: norm.contactEmail,
        contact_phone: norm.phoneE164 || norm.phoneRaw,
        phone_e164: norm.phoneE164,
        phone_raw: norm.phoneRaw,
        email_normalized: norm.emailNormalized,
        name_normalized: norm.nameNormalized,
        budget_inr: norm.budgetInr,
        budget_raw: norm.budgetRaw,
        notes_preview: input.notesPreview,
        campaign_name: input.campaignName,
        ad_name: input.adName,
        form_name: input.formName,
      } as Record<string, unknown>,
      [
        'contact_name',
        'contact_email',
        'contact_phone',
        'phone_e164',
        'phone_raw',
        'email_normalized',
        'name_normalized',
        'budget_inr',
        'budget_raw',
        'notes_preview',
        'campaign_name',
        'ad_name',
        'form_name',
      ],
    );

    const customAnswers = {
      ...(existing.custom_answers || {}),
      ...(norm.customAnswers || {}),
    };

    const { data: updated, error: upErr } = await this.client()
      .from('re_leads')
      .update({
        ...patch,
        custom_answers: customAnswers,
        latest_source: input.source,
        is_re_enquiry: true,
        re_enquired_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .select('*')
      .single();
    if (upErr) throw new BadRequestException(upErr.message);

    await this.client().from('re_lead_activities').insert({
      organization_id: input.organizationId,
      lead_id: leadId,
      activity_type: 're_enquiry',
      body: `Re-enquiry via ${input.source}${input.campaignName ? ` / ${input.campaignName}` : ''}`,
      created_by: input.actorId || null,
      metadata: {
        source: input.source,
        campaign_name: input.campaignName,
        ad_name: input.adName,
        custom_answers: norm.customAnswers,
      },
    });

    await this.recordTouch(updated, input, norm.customAnswers, false);

    // Follow-ups: only restart if still first-touch
    if (shouldRestartFollowUp(updated.status) && !input.skipFollowUpRestart) {
      try {
        await this.followups.scheduleForLead(input.organizationId, updated);
      } catch {
        /* ignore */
      }
    }

    return updated;
  }

  private async recordTouch(
    lead: Record<string, any>,
    input: AcceptLeadInput,
    customAnswers: Record<string, unknown>,
    isFirst: boolean,
  ) {
    // clear previous latest
    await this.client()
      .from('re_lead_source_touches')
      .update({ is_latest: false })
      .eq('lead_id', lead.id)
      .eq('is_latest', true);

    await this.client().from('re_lead_source_touches').insert({
      organization_id: input.organizationId,
      lead_id: lead.id,
      source: input.source,
      is_first: isFirst,
      is_latest: true,
      campaign_name: input.campaignName || null,
      ad_name: input.adName || null,
      form_name: input.formName || null,
      custom_answers: customAnswers || {},
      ingest_event_id: input.ingestEventId || null,
    });
  }

  async possibleDuplicates(organizationId: string, leadId: string) {
    const { data: lead } = await this.client()
      .from('re_leads')
      .select('*')
      .eq('id', leadId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!lead) throw new BadRequestException('Lead not found');
    const locality =
      lead.custom_answers?.locality ||
      lead.custom_answers?.city ||
      lead.notes_preview ||
      null;
    const { data: pool } = await this.client()
      .from('re_leads')
      .select(
        'id, phone_e164, email_normalized, name_normalized, custom_answers, contact_name, created_at, updated_at, status',
      )
      .eq('organization_id', organizationId)
      .neq('id', leadId)
      .limit(200);
    const possibles = findPossibleDuplicates(
      (pool || []) as DedupeCandidate[],
      lead.name_normalized,
      locality ? String(locality) : null,
      leadId,
    );
    return { leadId, possibles };
  }

  async mergeLeads(opts: {
    organizationId: string;
    survivorLeadId: string;
    mergedLeadId: string;
    mergedBy?: string;
  }) {
    if (opts.survivorLeadId === opts.mergedLeadId) {
      throw new BadRequestException('Cannot merge a lead into itself');
    }
    const client = this.client();
    const { data: survivor } = await client
      .from('re_leads')
      .select('*')
      .eq('id', opts.survivorLeadId)
      .eq('organization_id', opts.organizationId)
      .single();
    const { data: merged } = await client
      .from('re_leads')
      .select('*')
      .eq('id', opts.mergedLeadId)
      .eq('organization_id', opts.organizationId)
      .single();
    if (!survivor || !merged) throw new BadRequestException('Lead(s) not found');

    const patch = mergeEmptyFields(
      survivor as Record<string, unknown>,
      merged as Record<string, unknown>,
      [
        'contact_name',
        'contact_email',
        'contact_phone',
        'phone_e164',
        'email_normalized',
        'budget_inr',
        'notes_preview',
        'campaign_name',
        'ad_name',
      ],
    );
    const custom_answers = {
      ...(survivor.custom_answers || {}),
      ...(merged.custom_answers || {}),
    };

    await client
      .from('re_leads')
      .update({
        ...patch,
        custom_answers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', survivor.id);

    // Move activities & touches
    await client
      .from('re_lead_activities')
      .update({ lead_id: survivor.id })
      .eq('lead_id', merged.id);
    await client
      .from('re_lead_source_touches')
      .update({ lead_id: survivor.id })
      .eq('lead_id', merged.id);

    await client.from('re_lead_activities').insert({
      organization_id: opts.organizationId,
      lead_id: survivor.id,
      activity_type: 'merge',
      body: `Merged lead ${merged.id} into ${survivor.id}`,
      created_by: opts.mergedBy || null,
      metadata: { merged_lead_id: merged.id },
    });

    await client.from('re_lead_merges').insert({
      organization_id: opts.organizationId,
      survivor_lead_id: survivor.id,
      merged_lead_id: merged.id,
      merged_snapshot: merged,
      merged_by: opts.mergedBy || null,
    });

    // Soft-archive merged lead
    await client
      .from('re_leads')
      .update({
        status: 'archived',
        notes_preview: `Merged into ${survivor.id}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', merged.id);

    const { data: final } = await client.from('re_leads').select('*').eq('id', survivor.id).single();
    return { survivor: final, mergedId: merged.id };
  }
}
