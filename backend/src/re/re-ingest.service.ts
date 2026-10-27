import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { isReLeadgenEnabled, isReMetaEnrichEnabled } from './re-access';
import { ReDedupeService } from './re-dedupe.service';
import { ReMetaEnrichService } from './re-meta-enrich.service';
import {
  RE_INGEST_PROVIDERS,
  NormalizedLeadInput,
  ReIngestProvider,
  normalizeCallPayload,
  normalizeGooglePayload,
  normalizeLinkedInPayload,
  normalizeMetaPayload,
  normalizePortalPayload,
  normalizeWebsitePayload,
} from './re-providers';

const DEFAULT_PROVIDERS: ReIngestProvider[] = [
  'website',
  'meta_ads',
  'google_ads',
  'linkedin',
  'portal_99acres',
  'portal_magicbricks',
  'portal_housing',
  'portal_email',
  'call',
];

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

@Injectable()
export class ReIngestService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly dedupe: ReDedupeService,
    private readonly metaEnrich: ReMetaEnrichService,
  ) {}

  private client() {
    return this.supabaseService.getServiceClient();
  }

  private assertFeature() {
    if (!isReLeadgenEnabled()) {
      throw new ForbiddenException('Real Estate Lead Gen is disabled in this deployment');
    }
  }

  private async requireSchema() {
    const { error } = await this.client().from('re_lead_source_configs').select('id').limit(1);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('could not find') || error.code === '42P01') {
        throw new ServiceUnavailableException(
          'Apply migration 20261027130000_re_leadgen_ingest_followups.sql (and foundation migration)',
        );
      }
      throw new BadRequestException(error.message);
    }
  }

  async ensureSourceConfigs(organizationId: string, projectId?: string | null) {
    this.assertFeature();
    if (!organizationId) throw new BadRequestException('organizationId is required');
    await this.requireSchema();
    const client = this.client();
    for (const provider of DEFAULT_PROVIDERS) {
      const { data: existing } = await client
        .from('re_lead_source_configs')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('provider', provider)
        .maybeSingle();
      if (existing) continue;
      await client.from('re_lead_source_configs').insert({
        organization_id: organizationId,
        project_id: projectId || null,
        provider,
        enabled: provider === 'website',
        display_name: provider,
        ingest_key: randomBytes(24).toString('hex'),
        verify_token: randomBytes(12).toString('hex'),
        webhook_path_token: randomBytes(16).toString('hex'),
        settings: {},
      });
    }
    // Default follow-up rule
    const { data: rules } = await client
      .from('re_follow_up_rules')
      .select('id')
      .eq('organization_id', organizationId)
      .limit(1);
    if (!rules?.length) {
      await client.from('re_follow_up_rules').insert({
        organization_id: organizationId,
        enabled: true,
        name: 'First-touch email',
        delay_minutes: 15,
        channel: 'email',
      });
    }
    return this.listSourceConfigs(organizationId);
  }

  async listSourceConfigs(organizationId: string) {
    this.assertFeature();
    await this.requireSchema();
    const { data, error } = await this.client()
      .from('re_lead_source_configs')
      .select(
        'id, organization_id, project_id, provider, enabled, display_name, ingest_key, verify_token, page_id, form_id_external, webhook_path_token, settings, needs_reauth, reauth_reason, graph_api_version, field_mappings, created_at, updated_at',
      )
      .eq('organization_id', organizationId)
      .order('provider');
    if (error) throw new BadRequestException(error.message);
    // Never return access_token to the browser
    return { sources: data ?? [] };
  }

  async updateSourceConfig(
    organizationId: string,
    provider: string,
    patch: {
      enabled?: boolean;
      displayName?: string;
      verifyToken?: string;
      accessToken?: string;
      appSecret?: string;
      pageId?: string | null;
      formIdExternal?: string | null;
      graphApiVersion?: string;
      fieldMappings?: Record<string, string>;
      settings?: Record<string, unknown>;
      rotateIngestKey?: boolean;
      clearNeedsReauth?: boolean;
    },
  ) {
    this.assertFeature();
    await this.requireSchema();
    if (!RE_INGEST_PROVIDERS.includes(provider as ReIngestProvider) && provider !== 'manual') {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.enabled !== undefined) updates.enabled = patch.enabled;
    if (patch.displayName !== undefined) updates.display_name = patch.displayName;
    if (patch.verifyToken !== undefined) updates.verify_token = patch.verifyToken;
    if (patch.accessToken !== undefined) updates.access_token = patch.accessToken;
    if (patch.appSecret !== undefined) updates.app_secret = patch.appSecret;
    if (patch.pageId !== undefined) updates.page_id = patch.pageId;
    if (patch.formIdExternal !== undefined) updates.form_id_external = patch.formIdExternal;
    if (patch.graphApiVersion !== undefined) updates.graph_api_version = patch.graphApiVersion;
    if (patch.fieldMappings !== undefined) updates.field_mappings = patch.fieldMappings;
    if (patch.settings !== undefined) updates.settings = patch.settings;
    if (patch.rotateIngestKey) updates.ingest_key = randomBytes(24).toString('hex');
    if (patch.clearNeedsReauth) {
      updates.needs_reauth = false;
      updates.reauth_reason = null;
    }

    const { data, error } = await this.client()
      .from('re_lead_source_configs')
      .update(updates)
      .eq('organization_id', organizationId)
      .eq('provider', provider)
      .select(
        'id, organization_id, provider, enabled, display_name, ingest_key, verify_token, page_id, form_id_external, webhook_path_token, settings, needs_reauth, reauth_reason, graph_api_version, field_mappings, updated_at',
      )
      .single();
    if (error) throw new BadRequestException(error.message);
    return { source: data };
  }

  async listIngestEvents(organizationId: string, limit = 50) {
    this.assertFeature();
    await this.requireSchema();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { data, error } = await this.client()
      .from('re_ingest_events')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new BadRequestException(error.message);
    return { events: data ?? [] };
  }

  private async findConfigByPathToken(pathToken: string) {
    const { data, error } = await this.client()
      .from('re_lead_source_configs')
      .select('*')
      .eq('webhook_path_token', pathToken)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Unknown webhook path');
    return data;
  }

  private async findConfig(organizationId: string, provider: string) {
    const { data, error } = await this.client()
      .from('re_lead_source_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('provider', provider)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Source config missing for ${provider}`);
    return data;
  }

  private assertIngestKey(config: { ingest_key?: string | null; enabled?: boolean }, key?: string) {
    if (!config.enabled) throw new ForbiddenException('This lead source is disabled');
    if (!config.ingest_key || !key || !safeEqual(config.ingest_key, key)) {
      throw new ForbiddenException('Invalid ingest key');
    }
  }

  private async logEvent(row: {
    organization_id?: string | null;
    provider: string;
    status: string;
    lead_id?: string | null;
    external_id?: string | null;
    payload: Record<string, unknown>;
    error_message?: string | null;
    enrichment_status?: string | null;
    leadgen_id?: string | null;
  }) {
    const { data } = await this.client().from('re_ingest_events').insert(row).select('id').single();
    return data;
  }

  async acceptNormalized(
    organizationId: string,
    normalized: NormalizedLeadInput,
    opts?: { projectId?: string | null; actorId?: string | null },
  ) {
    const event = await this.logEvent({
      organization_id: organizationId,
      provider: String(normalized.source),
      status: 'received',
      external_id: normalized.externalId || null,
      payload: normalized.rawPayload,
      enrichment_status: 'none',
    });

    const result = await this.dedupe.acceptLead({
      organizationId,
      projectId: opts?.projectId || normalized.projectId || null,
      source: String(normalized.source),
      contactName: normalized.contactName,
      contactEmail: normalized.contactEmail,
      contactPhone: normalized.contactPhone,
      notesPreview: normalized.notesPreview,
      listingId: normalized.listingId,
      externalId: normalized.externalId,
      rawPayload: {
        ...normalized.rawPayload,
        external_id: normalized.externalId,
      },
      actorId: opts?.actorId || null,
      ingestEventId: event?.id || null,
    });

    return { lead: result.lead, mode: result.mode, success: true };
  }

  /** Website / generic JSON capture */
  async ingestWebsite(pathToken: string, ingestKey: string | undefined, body: Record<string, unknown>) {
    this.assertFeature();
    await this.requireSchema();
    const config = await this.findConfigByPathToken(pathToken);
    if (config.provider !== 'website') throw new BadRequestException('Path is not a website source');
    this.assertIngestKey(config, ingestKey);
    const normalized = normalizeWebsitePayload(body);
    return this.acceptNormalized(config.organization_id, normalized, {
      projectId: config.project_id,
    });
  }

  /** Meta webhook verification (GET) */
  async verifyMeta(pathToken: string, mode?: string, verifyToken?: string, challenge?: string) {
    this.assertFeature();
    await this.requireSchema();
    const config = await this.findConfigByPathToken(pathToken);
    if (config.provider !== 'meta_ads') throw new BadRequestException('Not a Meta source path');
    if (!config.enabled) throw new ForbiddenException('Meta source disabled');
    if (mode === 'subscribe' && verifyToken && config.verify_token && safeEqual(config.verify_token, verifyToken)) {
      return { challenge: challenge || '' };
    }
    throw new ForbiddenException('Meta verify token mismatch');
  }

  /**
   * Meta POST: verify signature, persist raw event, enqueue enrichment, return 200 fast.
   * Does not call Graph API inline.
   */
  async ingestMeta(
    pathToken: string,
    body: Record<string, unknown>,
    opts?: { rawBody?: Buffer | string; signature?: string },
  ) {
    this.assertFeature();
    await this.requireSchema();
    const config = await this.findConfigByPathToken(pathToken);
    if (config.provider !== 'meta_ads') throw new BadRequestException('Not a Meta source path');
    if (!config.enabled) throw new ForbiddenException('Meta source disabled');

    try {
      const raw =
        opts?.rawBody != null
          ? opts.rawBody
          : Buffer.from(JSON.stringify(body));
      this.metaEnrich.verifySignature(raw, opts?.signature, config.app_secret);
    } catch (e) {
      await this.logEvent({
        organization_id: config.organization_id,
        provider: 'meta_ads',
        status: 'rejected',
        payload: body,
        error_message: e instanceof Error ? e.message : 'signature failed',
        enrichment_status: 'failed',
      });
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid Meta signature');
    }

    const event = await this.logEvent({
      organization_id: config.organization_id,
      provider: 'meta_ads',
      status: 'received',
      payload: body,
      enrichment_status: isReMetaEnrichEnabled() ? 'pending' : 'none',
    });

    if (isReMetaEnrichEnabled()) {
      const queued = await this.metaEnrich.enqueueFromWebhook({
        organizationId: config.organization_id,
        sourceConfigId: config.id,
        ingestEventId: event?.id,
        body,
      });
      return { success: true, queued: true, ...queued };
    }

    // Enrichment flag off → sync path (still normalised + deduped)
    const normalized = normalizeMetaPayload(body);
    return this.acceptNormalized(config.organization_id, normalized, {
      projectId: config.project_id,
    });
  }

  async ingestGoogle(pathToken: string, ingestKey: string | undefined, body: Record<string, unknown>) {
    this.assertFeature();
    await this.requireSchema();
    const config = await this.findConfigByPathToken(pathToken);
    if (config.provider !== 'google_ads') throw new BadRequestException('Not a Google source path');
    this.assertIngestKey(config, ingestKey);
    const normalized = normalizeGooglePayload(body);
    return this.acceptNormalized(config.organization_id, normalized, { projectId: config.project_id });
  }

  async ingestLinkedIn(pathToken: string, ingestKey: string | undefined, body: Record<string, unknown>) {
    this.assertFeature();
    await this.requireSchema();
    const config = await this.findConfigByPathToken(pathToken);
    if (config.provider !== 'linkedin') throw new BadRequestException('Not a LinkedIn source path');
    this.assertIngestKey(config, ingestKey);
    const normalized = normalizeLinkedInPayload(body);
    return this.acceptNormalized(config.organization_id, normalized, { projectId: config.project_id });
  }

  async ingestPortal(
    pathToken: string,
    ingestKey: string | undefined,
    body: Record<string, unknown>,
  ) {
    this.assertFeature();
    await this.requireSchema();
    const config = await this.findConfigByPathToken(pathToken);
    const portalProviders = [
      'portal_99acres',
      'portal_magicbricks',
      'portal_housing',
      'portal_email',
    ];
    if (!portalProviders.includes(config.provider)) {
      throw new BadRequestException('Not a portal source path');
    }
    this.assertIngestKey(config, ingestKey);
    const normalized = normalizePortalPayload(config.provider as ReIngestProvider, body);
    return this.acceptNormalized(config.organization_id, normalized, { projectId: config.project_id });
  }

  async ingestCall(pathToken: string, ingestKey: string | undefined, body: Record<string, unknown>) {
    this.assertFeature();
    await this.requireSchema();
    const config = await this.findConfigByPathToken(pathToken);
    if (config.provider !== 'call') throw new BadRequestException('Not a call source path');
    this.assertIngestKey(config, ingestKey);
    const normalized = normalizeCallPayload(body);
    return this.acceptNormalized(config.organization_id, normalized, { projectId: config.project_id });
  }

  /** Org-authenticated test fire (no external network). */
  async testIngest(organizationId: string, provider: string, sample?: Record<string, unknown>) {
    this.assertFeature();
    await this.requireSchema();
    const config = await this.findConfig(organizationId, provider);
    if (!config.enabled) throw new ForbiddenException('Enable the source before testing');
    const body = sample || {
      name: 'Test Lead',
      email: 'test.lead@example.com',
      phone: '+919999000000',
      message: `Synthetic ${provider} test lead`,
    };
    let normalized: NormalizedLeadInput;
    switch (provider) {
      case 'meta_ads':
        normalized = normalizeMetaPayload({
          field_data: [
            { name: 'full_name', values: [body.name] },
            { name: 'email', values: [body.email] },
            { name: 'phone_number', values: [body.phone] },
          ],
          leadgen_id: `test-${Date.now()}`,
        });
        break;
      case 'google_ads':
        normalized = normalizeGooglePayload({
          user_column_data: [
            { column_id: 'FULL_NAME', string_value: body.name },
            { column_id: 'EMAIL', string_value: body.email },
            { column_id: 'PHONE_NUMBER', string_value: body.phone },
          ].map((c) => ({ name: c.column_id.toLowerCase().replace('_', ' '), values: [c.string_value] })),
          lead_id: `test-${Date.now()}`,
        });
        break;
      case 'linkedin':
        normalized = normalizeLinkedInPayload({
          answers: [
            { question: 'Full name', answer: body.name },
            { question: 'Email', answer: body.email },
            { question: 'Phone', answer: body.phone },
          ],
          id: `test-${Date.now()}`,
        });
        break;
      case 'call':
        normalized = normalizeCallPayload(body);
        break;
      case 'website':
        normalized = normalizeWebsitePayload(body);
        break;
      default:
        if (String(provider).startsWith('portal_')) {
          normalized = normalizePortalPayload(provider as ReIngestProvider, body);
        } else {
          normalized = normalizeWebsitePayload(body);
          normalized.source = provider;
        }
    }
    return this.acceptNormalized(organizationId, normalized, { projectId: config.project_id });
  }

  webhookUrlHint(pathToken: string, provider: string, apiBase = '/api') {
    const base = `${apiBase}/re/ingest/${provider}/${pathToken}`;
    return base;
  }

  hashFingerprint(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 12);
  }
}
