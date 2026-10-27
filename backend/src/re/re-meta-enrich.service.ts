import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { isReMetaEnrichEnabled } from './re-access';
import {
  extractBudgetFromAnswers,
  normalizeLeadFields,
} from './re-normalize';
import { ReDedupeService } from './re-dedupe.service';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function fieldDataToMap(fieldData: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(fieldData)) return out;
  for (const f of fieldData) {
    if (!f || typeof f !== 'object') continue;
    const row = f as Record<string, unknown>;
    const name = String(row.name || '').trim();
    const values = row.values;
    const value = Array.isArray(values) ? String(values[0] ?? '') : String(row.value ?? '');
    if (name) out[name] = value;
  }
  return out;
}

function applyFieldMappings(
  raw: Record<string, string>,
  mappings: Record<string, string> | null | undefined,
): { standard: Record<string, string>; custom: Record<string, string> } {
  const standard: Record<string, string> = {};
  const custom: Record<string, string> = {};
  const map = mappings || {};
  for (const [q, val] of Object.entries(raw)) {
    const target = map[q] || map[q.toLowerCase()];
    if (target && !target.startsWith('custom:')) {
      standard[target] = val;
    } else if (target?.startsWith('custom:')) {
      custom[target.slice(7) || q] = val;
    } else {
      // heuristic defaults
      const key = q.toLowerCase();
      if (/full_?name|^name$|first_?name|last_?name/.test(key)) {
        if (/first/.test(key)) standard.first_name = val;
        else if (/last/.test(key)) standard.last_name = val;
        else standard.full_name = val;
      } else if (/email/.test(key)) standard.email = val;
      else if (/phone|mobile/.test(key)) standard.phone_number = val;
      else if (/city/.test(key)) standard.city = val;
      else custom[q] = val;
    }
  }
  if (!standard.full_name && (standard.first_name || standard.last_name)) {
    standard.full_name = [standard.first_name, standard.last_name].filter(Boolean).join(' ');
  }
  return { standard, custom };
}

@Injectable()
export class ReMetaEnrichService {
  private readonly logger = new Logger(ReMetaEnrichService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly dedupe: ReDedupeService,
  ) {}

  private client() {
    return this.supabaseService.getServiceClient();
  }

  /** Validate X-Hub-Signature-256. */
  verifySignature(rawBody: string | Buffer, signatureHeader: string | undefined, appSecret: string | null | undefined) {
    if (!appSecret) {
      throw new UnauthorizedException('Meta app secret not configured for this source');
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256');
    }
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const given = signatureHeader.slice('sha256='.length);
    if (!safeEqual(expected, given)) {
      throw new UnauthorizedException('Invalid Meta signature');
    }
  }

  extractLeadgenIds(body: Record<string, unknown>): string[] {
    const ids = new Set<string>();
    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const changes = Array.isArray((entry as any).changes) ? (entry as any).changes : [];
      for (const ch of changes) {
        const value = ch?.value || {};
        const id = value.leadgen_id || value.lead_id;
        if (id) ids.add(String(id));
      }
    }
    if (body.leadgen_id) ids.add(String(body.leadgen_id));
    return [...ids];
  }

  async enqueueFromWebhook(opts: {
    organizationId: string;
    sourceConfigId: string;
    ingestEventId: string;
    body: Record<string, unknown>;
  }) {
    if (!isReMetaEnrichEnabled()) {
      return { enqueued: 0, skipped: true, reason: 'RE_LEADGEN_META_ENRICH disabled' };
    }
    const leadgenIds = this.extractLeadgenIds(opts.body);
    let enqueued = 0;
    for (const leadgenId of leadgenIds) {
      // Idempotent: existing lead with same leadgen_id → skip create path later
      const { error } = await this.client().from('re_enrichment_jobs').upsert(
        {
          organization_id: opts.organizationId,
          source_config_id: opts.sourceConfigId,
          ingest_event_id: opts.ingestEventId,
          provider: 'meta_ads',
          leadgen_id: leadgenId,
          status: 'pending',
          run_at: new Date().toISOString(),
          payload: opts.body,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,leadgen_id', ignoreDuplicates: true },
      );
      // unique pending index may reject; also try plain insert if upsert unsupported on partial
      if (error) {
        const { data: existing } = await this.client()
          .from('re_enrichment_jobs')
          .select('id, status')
          .eq('organization_id', opts.organizationId)
          .eq('leadgen_id', leadgenId)
          .in('status', ['pending', 'running', 'succeeded'])
          .maybeSingle();
        if (existing) continue;
        await this.client().from('re_enrichment_jobs').insert({
          organization_id: opts.organizationId,
          source_config_id: opts.sourceConfigId,
          ingest_event_id: opts.ingestEventId,
          provider: 'meta_ads',
          leadgen_id: leadgenId,
          status: 'pending',
          run_at: new Date().toISOString(),
          payload: opts.body,
        });
      }
      enqueued += 1;
      await this.client()
        .from('re_ingest_events')
        .update({ enrichment_status: 'pending', leadgen_id: leadgenId })
        .eq('id', opts.ingestEventId);
    }
    return { enqueued, leadgenIds };
  }

  private backoffMinutes(attempt: number): number {
    // 1, 2, 4, 8, 16
    return Math.min(60, 2 ** Math.max(0, attempt - 1));
  }

  private async markNeedsReauth(sourceConfigId: string, reason: string) {
    await this.client()
      .from('re_lead_source_configs')
      .update({
        needs_reauth: true,
        reauth_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceConfigId);
  }

  async processDueJobs(limit = 20) {
    if (!isReMetaEnrichEnabled()) return { processed: 0, succeeded: 0, failed: 0 };
    const { data: jobs, error } = await this.client()
      .from('re_enrichment_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('run_at', new Date().toISOString())
      .order('run_at', { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 50));
    if (error || !jobs?.length) return { processed: 0, succeeded: 0, failed: 0 };

    let succeeded = 0;
    let failed = 0;
    for (const job of jobs) {
      await this.client()
        .from('re_enrichment_jobs')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', job.id);
      try {
        await this.runOne(job);
        succeeded += 1;
      } catch (err) {
        failed += 1;
        this.logger.error(`Enrichment job ${job.id} failed`, err);
      }
    }
    return { processed: jobs.length, succeeded, failed };
  }

  private async runOne(job: Record<string, any>) {
    const { data: source } = await this.client()
      .from('re_lead_source_configs')
      .select('*')
      .eq('id', job.source_config_id)
      .maybeSingle();
    if (!source?.access_token) {
      throw await this.failJob(job, 'Missing Page access token', true, 'missing_access_token');
    }
    if (source.needs_reauth) {
      await this.client()
        .from('re_enrichment_jobs')
        .update({
          status: 'needs_reauth',
          last_error: source.reauth_reason || 'Source needs re-auth',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      return;
    }

    const version = source.graph_api_version || 'v21.0';
    const fields =
      'created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic';
    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(job.leadgen_id)}?fields=${fields}&access_token=${encodeURIComponent(source.access_token)}`;

    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      const msg = String(json?.error?.message || res.statusText || 'Graph API error');
      const code = json?.error?.code;
      const isAuth =
        res.status === 401 ||
        res.status === 403 ||
        /expired|permission|leads_retrieval|OAuth/i.test(msg) ||
        code === 190 ||
        code === 10;
      if (isAuth) {
        await this.markNeedsReauth(source.id, msg);
        await this.client()
          .from('re_enrichment_jobs')
          .update({
            status: 'needs_reauth',
            last_error: msg,
            attempt_count: (job.attempt_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        if (job.ingest_event_id) {
          await this.client()
            .from('re_ingest_events')
            .update({ enrichment_status: 'failed', enrichment_error: msg })
            .eq('id', job.ingest_event_id);
        }
        return;
      }
      return this.retryOrFail(job, msg);
    }

    const rawFields = fieldDataToMap(json.field_data);
    const mapped = applyFieldMappings(rawFields, source.field_mappings);
    if (mapped.custom.city == null && mapped.standard.city) {
      mapped.custom.city = mapped.standard.city;
    }
    const budgetText =
      extractBudgetFromAnswers(mapped.custom) ||
      mapped.custom.budget ||
      mapped.custom.Budget ||
      null;

    const { data: orgSettings } = await this.client()
      .from('re_org_settings')
      .select('*')
      .eq('organization_id', job.organization_id)
      .maybeSingle();

    const norm = normalizeLeadFields({
      contactName: mapped.standard.full_name,
      contactEmail: mapped.standard.email,
      contactPhone: mapped.standard.phone_number,
      budgetText,
      customAnswers: mapped.custom,
      sourceLabel: 'meta_ads',
      defaultCountryCode: orgSettings?.default_country_code || '+91',
    });

    const leadPayload = {
      organizationId: job.organization_id,
      source: 'meta_ads',
      contactName: norm.contactName,
      contactEmail: norm.contactEmail,
      contactPhone: norm.phoneE164 || norm.phoneRaw,
      notesPreview: mapped.standard.city || mapped.custom.locality || null,
      leadgenId: job.leadgen_id,
      externalId: job.leadgen_id,
      phoneE164: norm.phoneE164,
      phoneRaw: norm.phoneRaw,
      phoneInvalid: norm.phoneInvalid,
      emailNormalized: norm.emailNormalized,
      emailInvalid: norm.emailInvalid,
      nameNormalized: norm.nameNormalized,
      budgetInr: norm.budgetInr,
      budgetRaw: norm.budgetRaw,
      customAnswers: norm.customAnswers,
      enrichmentStatus: 'enriched',
      campaignId: json.campaign_id || null,
      campaignName: json.campaign_name || null,
      adsetId: json.adset_id || null,
      adsetName: json.adset_name || null,
      adId: json.ad_id || null,
      adName: json.ad_name || null,
      formIdExternal: json.form_id || null,
      platform: json.platform || null,
      isOrganic: json.is_organic ?? null,
      rawPayload: json,
      ingestEventId: job.ingest_event_id,
      skipFollowUpRestart: false,
    };

    const result = await this.dedupe.acceptLead(leadPayload);

    await this.client()
      .from('re_enrichment_jobs')
      .update({
        status: 'succeeded',
        lead_id: result.leadId,
        attempt_count: (job.attempt_count || 0) + 1,
        result: { leadId: result.leadId, mode: result.mode },
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (job.ingest_event_id) {
      await this.client()
        .from('re_ingest_events')
        .update({
          enrichment_status: 'enriched',
          enrichment_error: null,
          lead_id: result.leadId,
          leadgen_id: job.leadgen_id,
          status: 'accepted',
        })
        .eq('id', job.ingest_event_id);
    }
  }

  private async retryOrFail(job: Record<string, any>, msg: string) {
    const attempts = (job.attempt_count || 0) + 1;
    const max = job.max_attempts || 5;
    if (attempts >= max) {
      return this.failJob(job, msg, false);
    }
    const delayMin = this.backoffMinutes(attempts);
    const runAt = new Date(Date.now() + delayMin * 60_000).toISOString();
    await this.client()
      .from('re_enrichment_jobs')
      .update({
        status: 'pending',
        attempt_count: attempts,
        last_error: msg,
        run_at: runAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }

  private async failJob(job: Record<string, any>, msg: string, _needsReauth: boolean, _code?: string) {
    await this.client()
      .from('re_enrichment_jobs')
      .update({
        status: 'failed',
        last_error: msg,
        attempt_count: (job.attempt_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    if (job.ingest_event_id) {
      await this.client()
        .from('re_ingest_events')
        .update({ enrichment_status: 'failed', enrichment_error: msg })
        .eq('id', job.ingest_event_id);
    }
    return new BadRequestException(msg);
  }

  /** Backfill: GET /{form_id}/leads paginated */
  async fetchMissedLeads(opts: {
    organizationId: string;
    provider?: string;
    formId?: string;
    since?: string;
    until?: string;
    maxPages?: number;
  }) {
    if (!isReMetaEnrichEnabled()) {
      throw new ForbiddenException('RE_LEADGEN_META_ENRICH is disabled');
    }
    const { data: source } = await this.client()
      .from('re_lead_source_configs')
      .select('*')
      .eq('organization_id', opts.organizationId)
      .eq('provider', opts.provider || 'meta_ads')
      .maybeSingle();
    if (!source) throw new BadRequestException('Meta source config not found');
    if (source.needs_reauth) {
      throw new ForbiddenException(source.reauth_reason || 'Meta source needs re-auth');
    }
    if (!source.access_token) throw new BadRequestException('Page access token required');
    const formId = opts.formId || source.form_id_external;
    if (!formId) throw new BadRequestException('form_id required');

    const version = source.graph_api_version || 'v21.0';
    let url: string | null =
      `https://graph.facebook.com/${version}/${encodeURIComponent(formId)}/leads?access_token=${encodeURIComponent(source.access_token)}&limit=50`;
    if (opts.since) url += `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(new Date(opts.since).getTime() / 1000) }]))}`;

    let pages = 0;
    let enqueued = 0;
    const maxPages = opts.maxPages ?? 10;
    while (url && pages < maxPages) {
      const res = await fetch(url);
      const json = (await res.json()) as any;
      if (!res.ok) {
        const msg = String(json?.error?.message || 'Graph leads list failed');
        if (/expired|permission|OAuth|leads_retrieval/i.test(msg)) {
          await this.markNeedsReauth(source.id, msg);
        }
        throw new BadRequestException(msg);
      }
      for (const lead of json.data || []) {
        const leadgenId = String(lead.id);
        const { data: ev } = await this.client()
          .from('re_ingest_events')
          .insert({
            organization_id: opts.organizationId,
            provider: 'meta_ads',
            status: 'received',
            enrichment_status: 'pending',
            leadgen_id: leadgenId,
            payload: lead,
          })
          .select('id')
          .single();
        const r = await this.enqueueFromWebhook({
          organizationId: opts.organizationId,
          sourceConfigId: source.id,
          ingestEventId: ev?.id,
          body: { leadgen_id: leadgenId, field_data: lead.field_data, ...lead },
        });
        enqueued += r.enqueued;
      }
      url = json.paging?.next || null;
      pages += 1;
    }
    return { pages, enqueued };
  }

  async updateFieldMappings(organizationId: string, fieldMappings: Record<string, string>) {
    const { data, error } = await this.client()
      .from('re_lead_source_configs')
      .update({
        field_mappings: fieldMappings,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('provider', 'meta_ads')
      .select('id, field_mappings, needs_reauth, reauth_reason, graph_api_version')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { source: data };
  }
}
