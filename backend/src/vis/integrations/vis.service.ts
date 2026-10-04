import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { getVisStore, VisStore, VisRecord } from '../store/vis.store';
import { VisAssistant, MockAIProvider } from '../ai/vis-assistant';
import { RestConnector } from '../connectors/rest.connector';
import { InternalApplicationConnector } from '../connectors/internal-app.connector';
import { maskSecrets } from '../core/security/index';
import type {
  ClarificationAnswers,
  DirectionConfig,
  DiscoveredField,
  FieldMappingSpec,
  IntegrationDesign,
  MatchingStrategy,
  ProgrammingLanguage,
} from '../core/types/index';
import { validateIntegrationDesign } from '../core/schemas/integrationDesign';
import { OpenApiDiscovery, inferSourceFieldsFromSample, inferSourceFieldsFromOpenApiSchema } from '../core/discovery/openApi';
import { defaultMatchingStrategy, diffSchemas, filterMappingsByConfidence } from '../core/mapping/index';
import {
  buildCorrelationId,
  buildExecutionPlan,
  ExecutionPlanError,
  ExecutionRunner,
  createArraySourceReader,
  createStoreTargetAdapter,
  createHttpInternalAppTargetAdapter,
  failExecutionForPlanError,
  canCancel,
} from '../executions/index';
import type { DeadLetterRecord } from '../executions/in-memory-queue';
import type { SourceReader } from '../executions/source-processor';
import {
  EventIngestionService,
  getEventIngestionService,
  PollingFallbackService,
  defaultRealtimeConfig,
} from '../events/index';
import type { RealtimeEventConfig } from '../core/types/index';

@Injectable()
export class VisService {
  private readonly store: VisStore;
  private readonly assistant: VisAssistant;
  private readonly openApi = new OpenApiDiscovery();
  /** Active runners for cancel / live metrics */
  private readonly runners = new Map<string, ExecutionRunner>();
  /** Idempotency keys across retries within process lifetime */
  private readonly processedKeys = new Map<string, Set<string>>();
  private readonly events: EventIngestionService;
  private readonly polling: PollingFallbackService;

  constructor() {
    this.store = getVisStore();
    this.assistant = new VisAssistant(new MockAIProvider());
    this.events = getEventIngestionService(this.store);
    this.polling = new PollingFallbackService(this.store, this.events);
  }

  // ── Dashboard ──────────────────────────────────────────────────────────
  getDashboard() {
    const integrations = this.store.list('integrations');
    const executions = this.store.list('executions');
    return {
      totalIntegrations: integrations.length,
      active: integrations.filter((i) => i.status === 'ACTIVE').length,
      draft: integrations.filter((i) => i.status === 'DRAFT').length,
      running: executions.filter((e) => e.status === 'RUNNING' || e.status === 'QUEUED').length,
      successful: executions.filter((e) => e.status === 'SUCCESS').length,
      failed: executions.filter((e) => e.status === 'FAILED').length,
      recentExecutions: executions.slice(-10).reverse(),
      recentErrors: this.store
        .list('logs')
        .filter((l) => l.level === 'ERROR')
        .slice(-10)
        .reverse(),
    };
  }

  // ── Integrations ───────────────────────────────────────────────────────
  listIntegrations() {
    return this.store.list('integrations').map((i) => this.hydrateIntegration(i));
  }

  getIntegration(id: string) {
    const row = this.store.get('integrations', id);
    if (!row) throw new NotFoundException('Integration not found');
    return this.hydrateIntegration(row);
  }

  createIntegration(body: { name?: string; promptText?: string; description?: string; environment?: string }) {
    const name = body.name || 'Untitled Integration';
    const integration = this.store.create('integrations', {
      name,
      description: body.description || null,
      status: 'DRAFT',
      environment: body.environment || 'DEV',
      promptText: body.promptText || null,
      currentVersionId: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const version = this.store.create('versions', {
      integrationId: integration.id,
      version: 1,
      status: 'DRAFT',
      design: null,
      directions: [],
      createdAt: new Date().toISOString(),
    });
    this.store.update('integrations', integration.id, { currentVersionId: version.id });
    this.audit(integration.id, version.id, 'INTEGRATION_CREATED', { name });
    return this.getIntegration(integration.id);
  }

  updateIntegration(id: string, body: Record<string, unknown>) {
    const existing = this.store.get('integrations', id);
    if (!existing) throw new NotFoundException('Integration not found');
    if (existing.status === 'ACTIVE' && body.status && body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
      // allow deactivate
    }
    // Published production versions are not edited in place — create new version for design changes
    if (body.design || body.directions || body.language) {
      this.patchCurrentVersion(id, body);
    }
    const allowed = ['name', 'description', 'promptText', 'environment', 'status'] as const;
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    this.store.update('integrations', id, patch);
    this.audit(id, String(existing.currentVersionId || ''), 'INTEGRATION_CHANGED', maskSecrets(patch));
    return this.getIntegration(id);
  }

  deleteIntegration(id: string) {
    const ok = this.store.remove('integrations', id);
    if (!ok) throw new NotFoundException('Integration not found');
    for (const v of this.store.list('versions').filter((x) => x.integrationId === id)) {
      this.store.remove('versions', v.id);
    }
    this.audit(id, null, 'INTEGRATION_DELETED', {});
    return { ok: true };
  }

  async analyzeIntegration(id: string, promptText?: string, answers?: ClarificationAnswers) {
    const integration = this.store.get('integrations', id);
    if (!integration) throw new NotFoundException('Integration not found');
    const prompt = String(promptText || integration.promptText || '').trim();
    if (!prompt) throw new BadRequestException('promptText is required');

    this.store.update('integrations', id, {
      status: 'ANALYZING',
      updatedAt: new Date().toISOString(),
    });

    // Clarification gate — do not invent critical missing details
    if (!answers || Object.keys(answers).length === 0) {
      const clarify = await this.assistant.clarifyRequirement!(prompt);
      if (clarify.needsClarification) {
        this.store.update('integrations', id, {
          status: 'NEEDS_REVIEW',
          promptText: prompt,
          updatedAt: new Date().toISOString(),
        });
        this.audit(id, String(integration.currentVersionId || ''), 'CLARIFICATION_REQUIRED', {
          questions: clarify.questions.map((q) => q.id),
        });
        return {
          needsClarification: true,
          questions: clarify.questions,
          integration: this.getIntegration(id),
        };
      }
    }

    let design: IntegrationDesign;
    try {
      design = answers && Object.keys(answers).length
        ? await this.assistant.analyzeWithClarifications!(prompt, answers)
        : await this.assistant.analyzeRequirement(prompt);
    } catch (e: any) {
      this.store.update('integrations', id, {
        status: 'DRAFT',
        updatedAt: new Date().toISOString(),
      });
      throw new BadRequestException(e?.message || 'AI returned invalid configuration');
    }

    const lang = await this.assistant.recommendLanguage(design);
    design.language = lang.language;
    design.languageReason = lang.reason;
    design = await this.assistant.recommendArchitecture(design);

    const mappings = (design.suggestedMappings || []).map((m, i) => ({
      id: `map_${i}`,
      sourceField: m.sourceField,
      targetField: m.targetField,
      confidence: m.confidence,
      confidencePercent: m.confidence === 'HIGH' ? 95 : m.confidence === 'MEDIUM' ? 81 : 45,
      transformation: m.transformation,
      reason: m.reason || null,
      enabled: m.confidence !== 'LOW',
    }));
    const matchingStrategy = defaultMatchingStrategy(mappings);

    const direction: DirectionConfig = {
      id: randomUUID(),
      label: 'A → B',
      flow: 'A_TO_B',
      sourceKind: design.source,
      targetKind: design.target,
      operations: design.operations,
      language: design.language,
      languageRecommendedByAi: design.language,
      languageReason: design.languageReason,
      workers: design.workers,
      batchSize: design.batchSize,
      concurrency: design.concurrency || design.workers,
      retryPolicy: design.retryPolicy || 'EXPONENTIAL',
      retryMaxAttempts: 3,
      rateLimitPerMinute: design.rateLimitPerMinute ?? null,
      idempotencyStrategy: design.idempotencyStrategy || 'EXTERNAL_ID',
      matchingKeys: matchingStrategy.targetFields,
      matchingStrategy,
      mappings,
      schedule: {
        kind: design.scheduleKind || 'MANUAL',
        intervalMinutes:
          design.frequency === '15_MINUTES'
            ? 15
            : design.frequency === '5_MINUTES'
              ? 5
              : null,
        cron: null,
        allowConcurrent: false,
      },
    };

    const directions =
      design.direction === 'BIDIRECTIONAL'
        ? [
            direction,
            {
              ...direction,
              id: randomUUID(),
              label: 'B → A',
              flow: 'B_TO_A' as const,
              sourceKind: design.target,
              targetKind: design.source,
              mappings: [],
            },
          ]
        : [direction];

    this.store.update('integrations', id, {
      promptText: prompt,
      name: design.name || integration.name,
      status: 'DESIGN_READY',
      updatedAt: new Date().toISOString(),
    });
    const isRealtime =
      design.executionMode === 'REAL_TIME'
      || design.executionMode === 'REALTIME'
      || design.executionMode === 'EVENT_DRIVEN';
    const eventConfig = isRealtime
      ? defaultRealtimeConfig({
          eventEnabled: true,
          eventTriggerTypes: /updated/.test(prompt.toLowerCase())
            ? ['RECORD_CREATED', 'RECORD_UPDATED']
            : /deleted/.test(prompt.toLowerCase())
              ? ['RECORD_DELETED']
              : ['RECORD_CREATED', 'RECORD_UPDATED'],
          sourceEnvironmentId: /uat/.test(prompt.toLowerCase()) && /dev/.test(prompt.toLowerCase()) ? 'DEV' : 'DEV',
          targetEnvironmentId: /uat/.test(prompt.toLowerCase()) ? 'UAT' : 'PROD',
          webhookAuthType: 'NONE',
          loopPreventionEnabled: true,
          payloadStrategy: 'HYBRID',
        })
      : undefined;
    this.patchCurrentVersion(id, {
      design,
      directions,
      aiProposal: design,
      userChanges: {},
      ...(eventConfig ? { eventConfig } : {}),
    });
    this.audit(id, String(integration.currentVersionId || ''), 'INTEGRATION_ANALYZED', {
      language: design.language,
      status: 'DESIGN_READY',
      executionMode: design.executionMode,
    });
    return this.getIntegration(id);
  }

  async clarifyIntegration(id: string, promptText?: string) {
    const integration = this.store.get('integrations', id);
    if (!integration) throw new NotFoundException('Integration not found');
    const prompt = String(promptText || integration.promptText || '').trim();
    if (!prompt) throw new BadRequestException('promptText is required');
    return this.assistant.clarifyRequirement!(prompt);
  }

  setLanguage(id: string, language: ProgrammingLanguage) {
    const hydrated = this.getIntegration(id);
    const design = { ...(hydrated.design || {}), language } as IntegrationDesign;
    const directions = (hydrated.directions || []).map((d: DirectionConfig) => ({
      ...d,
      language,
    }));
    this.patchCurrentVersion(id, { design, directions });
    this.audit(id, String(hydrated.currentVersionId || ''), 'LANGUAGE_CHANGED', { language });
    return this.getIntegration(id);
  }

  // ── Connections ────────────────────────────────────────────────────────
  listConnections() {
    return this.store.list('connections').map((c) => this.maskConnection(c));
  }

  createConnection(body: Record<string, unknown>) {
    let credentialRefId: string | null = null;
    if (body.secret || body.credentials) {
      const cred = this.store.create('credentials', {
        organizationId: body.organizationId || null,
        name: `${body.name || 'connection'}-secret`,
        type: body.authType || 'API_KEY',
        secretHandle: `local:${randomUUID()}`,
        // Phase 1 local encrypted-at-rest placeholder — never returned via API
        _secretPayload: body.secret || body.credentials,
        metadata: { createdAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      credentialRefId = cred.id;
    }
    const row = this.store.create('connections', {
      organizationId: body.organizationId || null,
      name: body.name || 'Connection',
      kind: body.kind || 'REST_API',
      environment: body.environment || 'DEV',
      baseUrl: body.baseUrl || null,
      authType: body.authType || 'NONE',
      credentialRefId,
      config: body.config || {},
      allowPrivateNetwork: Boolean(body.allowPrivateNetwork),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.audit(null, null, 'CONNECTION_CREATED', { id: row.id, name: row.name });
    return this.maskConnection(row);
  }

  /**
   * Built-in demo seeding is disabled — use real external / Form API connections.
   */
  bootstrapDemoConnections() {
    return {
      created: 0,
      deprecated: true,
      message: 'Built-in demo connections are disabled. Create real REST / Form API connections.',
      connections: this.listConnections(),
    };
  }

  deleteConnection(id: string) {
    const existing = this.store.get('connections', id);
    if (!existing) throw new NotFoundException('Connection not found');
    this.store.remove('connections', id);
    this.audit(null, null, 'CONNECTION_DELETED', { id, name: existing.name });
    return { ok: true, id };
  }

  /** Remove lab/demo stub connections (mocks + client:// style). */
  purgeLabConnections() {
    const all = this.store.list('connections');
    const removed: string[] = [];
    for (const c of all) {
      const base = String(c.baseUrl || '');
      const name = String(c.name || '').toLowerCase();
      const isLab =
        base.includes('/vis/mocks')
        || base.startsWith('client://')
        || name.includes('mock internal')
        || name.includes('mock vulnerability');
      if (isLab) {
        this.store.remove('connections', c.id);
        removed.push(String(c.id));
      }
    }
    this.audit(null, null, 'LAB_CONNECTIONS_PURGED', { removed: removed.length });
    return { ok: true, removed: removed.length, connections: this.listConnections() };
  }

  async testConnection(id: string) {
    const conn = this.store.get('connections', id);
    if (!conn) throw new NotFoundException('Connection not found');
    const ctx = { correlationId: randomUUID() };
    const allowPrivate = Boolean(conn.allowPrivateNetwork);
    if (conn.kind === 'INTERNAL_APPLICATION_API') {
      const cfg = (conn.config || {}) as any;
      const connector = new InternalApplicationConnector(
        {
          baseUrl: String(conn.baseUrl || ''),
          apiVersion: cfg.apiVersion || 'v1',
          paths: cfg.paths || {
            formsPath: '/api/forms',
            formFieldsPath: '/api/forms/{formId}/fields',
            recordsPath: '/api/forms/{formId}/records',
            recordByIdPath: '/api/forms/{formId}/records/{recordId}',
          },
        },
        { allowPrivateNetwork: allowPrivate },
      );
      await connector.connect(ctx);
      return connector.testConnection(ctx);
    }
    const connector = new RestConnector(
      { baseUrl: String(conn.baseUrl || ''), timeoutMs: 10000 },
      { allowPrivateNetwork: allowPrivate },
    );
    await connector.connect(ctx);
    return connector.testConnection(ctx);
  }

  // ── Schema discovery ───────────────────────────────────────────────────
  async discoverForms(connectionId: string, baseUrlOverride?: string) {
    const conn = this.store.get('connections', connectionId);
    if (!conn && !baseUrlOverride) throw new NotFoundException('Connection not found');
    const baseUrl = baseUrlOverride || String(conn?.baseUrl || '');
    const cfg = ((conn?.config || {}) as any);
    const paths = cfg.paths || {
      formsPath: '/api/forms',
      formFieldsPath: '/api/forms/{formId}/fields',
      recordsPath: '/api/forms/{formId}/records',
      recordByIdPath: '/api/forms/{formId}/records/{recordId}',
    };
    const connector = new InternalApplicationConnector(
      { baseUrl, apiVersion: cfg.apiVersion || 'v1', paths },
      { allowPrivateNetwork: Boolean(conn?.allowPrivateNetwork) || /localhost|127\.0\.0\.1/.test(baseUrl) },
    );
    const ctx = { correlationId: randomUUID() };
    await connector.connect(ctx);
    return connector.discoverForms(ctx);
  }

  async discoverSchema(integrationId: string, body: { connectionId: string; formId: string }) {
    const integration = this.store.get('integrations', integrationId);
    if (!integration) throw new NotFoundException('Integration not found');
    const conn = this.store.get('connections', body.connectionId);
    if (!conn) throw new NotFoundException('Connection not found');
    const cfg = (conn.config || {}) as any;
    const paths = cfg.paths || {
      formsPath: '/api/forms',
      formFieldsPath: '/api/forms/{formId}/fields',
      recordsPath: '/api/forms/{formId}/records',
      recordByIdPath: '/api/forms/{formId}/records/{recordId}',
    };
    const connector = new InternalApplicationConnector(
      { baseUrl: String(conn.baseUrl), apiVersion: cfg.apiVersion || 'v1', paths },
      { allowPrivateNetwork: Boolean(conn.allowPrivateNetwork) || /localhost|127\.0\.0\.1/.test(String(conn.baseUrl)) },
    );
    const ctx = { correlationId: randomUUID(), integrationId };
    await connector.connect(ctx);
    const schema = await connector.getFormSchema(body.formId, ctx);
    if (!schema.ok) throw new BadRequestException(schema.error || 'Schema discovery failed');
    const fields = (schema.data as any)?.fields || [];
    const hash = createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0, 16);
    const existing = this.store
      .list('schemaCache')
      .find((s) => s.connectionId === body.connectionId && s.formId === body.formId);
    const previousFields = (existing?.fields as DiscoveredField[]) || [];
    const schemaDiff = diffSchemas(previousFields, fields);
    const payload = {
      connectionId: body.connectionId,
      applicationKey: 'default',
      formId: body.formId,
      formName: (schema.data as any)?.name || body.formId,
      fields,
      apiVersion: cfg.apiVersion || 'v1',
      schemaVersion: hash,
      schemaHash: hash,
      retrievedAt: new Date().toISOString(),
    };
    // Bind selected form onto direction (does not silently drop mappings)
    const h = this.getIntegration(integrationId);
    const directions = (h.directions || []).map((d: DirectionConfig, idx: number) =>
      idx === 0
        ? {
            ...d,
            targetConnectionId: body.connectionId,
            selectedFormId: body.formId,
          }
        : d,
    );
    this.patchCurrentVersion(integrationId, { directions });

    if (existing) {
      const changed = existing.schemaHash !== hash;
      this.store.update('schemaCache', existing.id, payload);
      this.audit(integrationId, String(integration.currentVersionId || ''), 'SCHEMA_REFRESHED', {
        formId: body.formId,
        changed,
        diff: schemaDiff,
      });
      return {
        ...payload,
        id: existing.id,
        changed,
        schemaDiff: changed ? schemaDiff : { ...schemaDiff, changed: false },
        message: changed ? 'Target form schema has changed.' : undefined,
      };
    }
    const row = this.store.create('schemaCache', payload);
    this.audit(integrationId, String(integration.currentVersionId || ''), 'SCHEMA_DISCOVERED', {
      formId: body.formId,
    });
    return { ...payload, id: row.id, changed: false, schemaDiff };
  }

  async refreshSchema(integrationId: string, body: { connectionId: string; formId: string }) {
    return this.discoverSchema(integrationId, body);
  }

  getSchemaCache(connectionId?: string) {
    const all = this.store.list('schemaCache');
    return connectionId ? all.filter((s) => s.connectionId === connectionId) : all;
  }

  // ── Mappings ───────────────────────────────────────────────────────────
  getMappings(integrationId: string) {
    const h = this.getIntegration(integrationId);
    return (h.directions || [])[0]?.mappings || [];
  }

  saveMappings(integrationId: string, mappings: FieldMappingSpec[]) {
    const h = this.getIntegration(integrationId);
    const directions = (h.directions || []).map((d: DirectionConfig, idx: number) =>
      idx === 0 ? { ...d, mappings } : d,
    );
    this.patchCurrentVersion(integrationId, { directions });
    this.audit(integrationId, String(h.currentVersionId || ''), 'MAPPING_CHANGED', {
      count: mappings.length,
    });
    return this.getMappings(integrationId);
  }

  async suggestMappings(integrationId: string, body: { sourceFields?: any[]; formId?: string; connectionId?: string }) {
    const h = this.getIntegration(integrationId);
    let targetFields: any[] = [];
    if (body.connectionId && body.formId) {
      const cached = this.store
        .list('schemaCache')
        .find((s) => s.connectionId === body.connectionId && s.formId === body.formId);
      targetFields = (cached?.fields as any[]) || [];
    }
    const sourceFields = body.sourceFields || [
      { name: 'id' },
      { name: 'severity' },
      { name: 'description' },
      { name: 'team' },
      { name: 'status' },
    ];
    let mappings = await this.assistant.suggestMappings({
      sourceFields,
      targetFields,
      design: h.design || undefined,
    });
    mappings = await this.assistant.suggestTransformations(mappings);
    return mappings;
  }

  async validateIntegration(id: string) {
    const h = this.getIntegration(id);
    if (!h.design) throw new BadRequestException('Analyze the requirement first');
    const direction = (h.directions || [])[0];
    const mappings = direction?.mappings || [];
    const formId = direction?.selectedFormId;
    const targetConnectionId = direction?.targetConnectionId;
    let targetFields: DiscoveredField[] = [];
    if (targetConnectionId && formId) {
      const cached = this.store
        .list('schemaCache')
        .find((s) => s.connectionId === targetConnectionId && s.formId === formId);
      targetFields = (cached?.fields as DiscoveredField[]) || [];
    }
    const sourceFields = ((h as any).sourceFields as Array<{ name: string }>)
      || (h.design.suggestedMappings || []).map((m) => ({ name: m.sourceField }));

    const report = await this.assistant.validateDesignComplete!({
      design: h.design,
      mappings,
      sourceFields: [...new Map(sourceFields.map((s) => [s.name, s])).values()],
      targetFields,
      hasSourceConnection: Boolean(direction?.sourceConnectionId),
      hasTargetConnection: Boolean(direction?.targetConnectionId),
      hasMatchingStrategy: Boolean(direction?.matchingStrategy),
    });

    if (report.ok) {
      this.store.update('integrations', id, {
        status: 'VALIDATED',
        updatedAt: new Date().toISOString(),
      });
      this.audit(id, String(h.currentVersionId || ''), 'INTEGRATION_VALIDATED', {
        issueCount: report.issues.length,
      });
    } else {
      this.store.update('integrations', id, {
        status: 'NEEDS_REVIEW',
        updatedAt: new Date().toISOString(),
      });
      this.audit(id, String(h.currentVersionId || ''), 'INTEGRATION_VALIDATION_FAILED', {
        errors: report.issues.filter((i) => i.severity === 'ERROR'),
      });
    }
    return { ...report, integration: this.getIntegration(id) };
  }

  approveIntegration(id: string) {
    const h = this.getIntegration(id);
    if (!h.design) throw new BadRequestException('Analyze the requirement first');
    if (h.status !== 'VALIDATED' && h.status !== 'APPROVED') {
      throw new BadRequestException('Validate the design before approval');
    }
    this.store.update('integrations', id, {
      status: 'APPROVED',
      updatedAt: new Date().toISOString(),
    });
    // Freeze AI proposal vs final configuration for audit
    const version = h.currentVersionId
      ? this.store.get('versions', String(h.currentVersionId))
      : null;
    const aiProposal = version?.aiProposal || version?.design || h.design;
    this.patchCurrentVersion(id, {
      finalConfiguration: h.design,
      aiProposal,
      userChanges: {
        language:
          h.design.language !== (aiProposal as any)?.language
            ? { from: (aiProposal as any)?.language, to: h.design.language }
            : undefined,
        workers:
          h.design.workers !== (aiProposal as any)?.workers
            ? { from: (aiProposal as any)?.workers, to: h.design.workers }
            : undefined,
      },
    });
    this.audit(id, String(h.currentVersionId || ''), 'INTEGRATION_APPROVED', {
      language: h.design.language,
    });
    return this.getIntegration(id);
  }

  saveDraft(id: string, body: Record<string, unknown> = {}) {
    const h = this.getIntegration(id);
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) patch.name = body.name;
    if (body.promptText !== undefined) patch.promptText = body.promptText;
    if (h.status === 'APPROVED' || h.status === 'ACTIVE') {
      // keep status
    } else if (body.status === 'DRAFT' || !body.status) {
      patch.status = h.status === 'DESIGN_READY' ? 'DESIGN_READY' : 'DRAFT';
    }
    this.store.update('integrations', id, patch);
    this.audit(id, String(h.currentVersionId || ''), 'DRAFT_SAVED', maskSecrets(patch));
    return this.getIntegration(id);
  }

  setDirectionConnections(
    id: string,
    body: { sourceConnectionId?: string; targetConnectionId?: string; selectedFormId?: string },
  ) {
    const h = this.getIntegration(id);
    const directions = (h.directions || []).map((d: DirectionConfig, idx: number) => {
      if (idx !== 0) return d;
      return {
        ...d,
        sourceConnectionId: body.sourceConnectionId ?? d.sourceConnectionId,
        targetConnectionId: body.targetConnectionId ?? d.targetConnectionId,
        selectedFormId: body.selectedFormId ?? d.selectedFormId,
      };
    });
    this.patchCurrentVersion(id, { directions });
    this.audit(id, String(h.currentVersionId || ''), 'CONNECTIONS_BOUND', {
      sourceConnectionId: body.sourceConnectionId,
      targetConnectionId: body.targetConnectionId,
      selectedFormId: body.selectedFormId,
    });
    return this.getIntegration(id);
  }

  setMatchingStrategy(id: string, strategy: MatchingStrategy) {
    if (!strategy?.sourceFields?.length || !strategy?.targetFields?.length) {
      throw new BadRequestException('matching strategy requires sourceFields and targetFields');
    }
    const h = this.getIntegration(id);
    const directions = (h.directions || []).map((d: DirectionConfig, idx: number) =>
      idx === 0
        ? {
            ...d,
            matchingStrategy: strategy,
            matchingKeys: strategy.targetFields,
            idempotencyStrategy:
              strategy.mode === 'COMPOSITE' ? 'COMPOSITE_KEY' : d.idempotencyStrategy,
          }
        : d,
    );
    this.patchCurrentVersion(id, { directions });
    // Track user change vs AI proposal
    this.recordUserChange(id, 'matchingStrategy', strategy);
    this.audit(id, String(h.currentVersionId || ''), 'MATCHING_STRATEGY_CHANGED', strategy);
    return this.getIntegration(id);
  }

  async applyNaturalLanguageMapping(id: string, instruction: string) {
    const h = this.getIntegration(id);
    const direction = (h.directions || [])[0];
    if (!direction) throw new BadRequestException('Analyze the requirement first');
    const formId = direction.selectedFormId;
    const targetConnectionId = direction.targetConnectionId;
    let targetFields: DiscoveredField[] = [];
    if (targetConnectionId && formId) {
      const cached = this.store
        .list('schemaCache')
        .find((s) => s.connectionId === targetConnectionId && s.formId === formId);
      targetFields = (cached?.fields as DiscoveredField[]) || [];
    }
    const sourceFields =
      ((h as any).sourceFields as Array<{ name: string }>)
      || direction.mappings.map((m) => ({ name: m.sourceField }));

    const next = await this.assistant.applyNaturalLanguageMappingChange!(
      direction.mappings || [],
      instruction,
      { sourceFields, targetFields },
    );
    this.saveMappings(id, next);
    this.audit(id, String(h.currentVersionId || ''), 'MAPPING_NL_CHANGED', {
      instruction,
      count: next.length,
    });
    return next;
  }

  setSampleSourceData(id: string, sample: Record<string, unknown> | Record<string, unknown>[]) {
    const fields = inferSourceFieldsFromSample(sample);
    const h = this.getIntegration(id);
    this.patchCurrentVersion(id, {
      sourceSample: sample,
      sourceFields: fields,
    });
    this.audit(id, String(h.currentVersionId || ''), 'SOURCE_SAMPLE_SET', {
      fieldCount: fields.length,
    });
    return { sourceFields: fields, sample };
  }

  async discoverOpenApi(id: string, body: { document?: unknown; url?: string }) {
    let document = body.document;
    if (!document && body.url) {
      // Fetch is allowed only for non-secret OpenAPI docs
      const res = await fetch(body.url);
      if (!res.ok) throw new BadRequestException(`Failed to fetch OpenAPI: ${res.status}`);
      document = await res.json();
    }
    if (!document) throw new BadRequestException('Provide OpenAPI document or url');
    const discovered = await this.openApi.fromOpenApi(document);
    const h = this.getIntegration(id);
    this.patchCurrentVersion(id, {
      openApiDiscovery: {
        endpoints: discovered.endpoints,
        auth: discovered.auth ? maskSecrets(discovered.auth) : undefined,
        retrievedAt: new Date().toISOString(),
      },
    });
    this.audit(id, String(h.currentVersionId || ''), 'OPENAPI_DISCOVERED', {
      endpointCount: discovered.endpoints.length,
    });
    return discovered;
  }

  selectOpenApiEndpoint(id: string, body: { path: string; method: string }) {
    const h = this.getIntegration(id);
    const version = h.currentVersionId
      ? this.store.get('versions', String(h.currentVersionId))
      : null;
    const discovery = version?.openApiDiscovery as any;
    const endpoint = (discovery?.endpoints || []).find(
      (e: any) => e.path === body.path && e.method === body.method,
    );
    if (!endpoint) throw new BadRequestException('Endpoint not found in discovered OpenAPI');
    const sourceFields = inferSourceFieldsFromOpenApiSchema(endpoint.responseSchema);
    const directions = (h.directions || []).map((d: DirectionConfig, idx: number) =>
      idx === 0
        ? {
            ...d,
            endpointConfig: {
              ...(d.endpointConfig || {}),
              path: body.path,
              method: body.method,
              summary: endpoint.summary,
            },
          }
        : d,
    );
    this.patchCurrentVersion(id, {
      directions,
      sourceFields: sourceFields.length ? sourceFields : version?.sourceFields,
      selectedEndpoint: endpoint,
    });
    this.audit(id, String(h.currentVersionId || ''), 'OPENAPI_ENDPOINT_SELECTED', {
      path: body.path,
      method: body.method,
    });
    return { endpoint, sourceFields, integration: this.getIntegration(id) };
  }

  async dryRun(id: string, body?: { sample?: Record<string, unknown>[] }) {
    const h = this.getIntegration(id);
    const direction = (h.directions || [])[0];
    if (!direction) throw new BadRequestException('Analyze the requirement first');
    const version = h.currentVersionId
      ? this.store.get('versions', String(h.currentVersionId))
      : null;
    const sample =
      body?.sample
      || (Array.isArray(version?.sourceSample)
        ? (version?.sourceSample as Record<string, unknown>[])
        : version?.sourceSample
          ? [version.sourceSample as Record<string, unknown>]
          : [
              {
                id: 'VUL-1001',
                severity: 'Critical',
                description: 'Apache vulnerability',
                team: 'Infrastructure',
                status: 'Open',
              },
            ]);

    let targetFields: DiscoveredField[] = [];
    if (direction.targetConnectionId && direction.selectedFormId) {
      const cached = this.store
        .list('schemaCache')
        .find(
          (s) =>
            s.connectionId === direction.targetConnectionId
            && s.formId === direction.selectedFormId,
        );
      targetFields = (cached?.fields as DiscoveredField[]) || [];
    }

    const result = await this.assistant.dryRun!({
      sourceRecords: sample,
      mappings: direction.mappings || [],
      targetFields,
    });
    this.audit(id, String(h.currentVersionId || ''), 'DRY_RUN_EXECUTED', {
      sampleSize: result.sampleSize,
      // Never write records — dry run only
      wroteRecords: false,
    });
    return result;
  }

  filterMappings(id: string, filter: 'ALL' | 'HIGH' | 'NEEDS_REVIEW' = 'ALL') {
    const mappings = this.getMappings(id);
    return filterMappingsByConfidence(mappings, filter);
  }

  // ── Executions / logs ──────────────────────────────────────────────────
  /**
   * Start an execution from an approved (or validated) integration.
   * Returns immediately with QUEUED/RUNNING; workers run in-process.
   * Pass `{ awaitCompletion: true }` for tests / small sync runs.
   */
  async createExecution(
    integrationId: string,
    opts?: {
      awaitCompletion?: boolean;
      sourceRecords?: Record<string, unknown>[];
      maxPages?: number;
      workers?: number;
      concurrency?: number;
      batchSize?: number;
      rateLimitPerMinute?: number | null;
    },
  ) {
    const hydrated = this.getIntegration(integrationId);
    if (!hydrated.design) throw new BadRequestException('Integration has no design — analyze first');
    if (!['APPROVED', 'ACTIVE', 'VALIDATED', 'DESIGN_READY'].includes(String(hydrated.status))) {
      throw new BadRequestException(
        `Integration status ${hydrated.status} cannot be executed — approve the design first`,
      );
    }
    const direction = (hydrated.directions || [])[0] as DirectionConfig | undefined;
    if (!direction) throw new BadRequestException('No direction configuration');

    const correlationId = buildCorrelationId('INT-VUL');
    const execution = this.store.create('executions', {
      integrationId,
      versionId: hydrated.currentVersionId,
      status: 'QUEUED',
      startedAt: null,
      completedAt: null,
      recordsRead: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      recordsProcessed: 0,
      recordsRetried: 0,
      recordsSkipped: 0,
      retryCount: 0,
      errorMessage: null,
      correlationId,
      createdAt: new Date().toISOString(),
    });
    this.log(execution.id, integrationId, correlationId, 'INFO', 'enqueue', 'Execution queued');

    let plan;
    try {
      const dirOverride: DirectionConfig = {
        ...direction,
        workers: opts?.workers ?? direction.workers,
        concurrency: opts?.concurrency ?? direction.concurrency,
        batchSize: opts?.batchSize ?? direction.batchSize,
        rateLimitPerMinute:
          opts?.rateLimitPerMinute !== undefined
            ? opts.rateLimitPerMinute
            : direction.rateLimitPerMinute,
      };
      plan = buildExecutionPlan({
        integrationId,
        versionId: hydrated.version?.id ? String(hydrated.version.id) : null,
        versionNumber: hydrated.version?.version != null ? Number(hydrated.version.version) : null,
        design: hydrated.design,
        direction: dirOverride,
        correlationId,
        sourceAuthType: hydrated.design.authHint,
        sourceCredentialRefId: null,
        sourceListPath:
          (direction.endpointConfig as any)?.path
          || '/vulnerabilities',
      });
    } catch (err) {
      const e = err instanceof Error ? err : new ExecutionPlanError(String(err));
      failExecutionForPlanError(
        {
          updateExecution: (id, patch) => this.store.update('executions', id, patch),
          saveDeadLetter: () => undefined,
          loadDeadLetters: () => [],
          updateDeadLetter: () => undefined,
        },
        execution.id,
        e,
      );
      this.log(execution.id, integrationId, correlationId, 'ERROR', 'plan', e.message, 'CONFIGURATION_ERROR');
      return this.getExecution(execution.id);
    }

    const formId = direction.selectedFormId || 'form-vulnerability';
    const matchFields = plan.matchingStrategy.targetFields;
    const targetConn = direction.targetConnectionId
      ? this.store.get('connections', String(direction.targetConnectionId))
      : null;
    const target =
      targetConn?.baseUrl
      && (targetConn.kind === 'INTERNAL_APPLICATION_API' || targetConn.kind === 'REST_API')
        ? createHttpInternalAppTargetAdapter({
          baseUrl: String(targetConn.baseUrl),
          formId,
          matchFields,
          allowPrivateNetwork: Boolean(targetConn.allowPrivateNetwork || targetConn.allowPrivateNet),
          paths: targetConn.kind === 'INTERNAL_APPLICATION_API'
            ? {
              formsPath: '/api/forms',
              formFieldsPath: '/api/forms/{formId}/fields',
              recordsPath: '/api/forms/{formId}/records',
              recordByIdPath: '/api/forms/{formId}/records/{recordId}',
            }
            : undefined,
        })
        : createStoreTargetAdapter(this.store, formId, matchFields);
    const sourceRecords =
      opts?.sourceRecords
      || this.defaultMockSourceRecords();
    const source: SourceReader = createArraySourceReader(sourceRecords);

    const keys =
      this.processedKeys.get(integrationId) || new Set<string>();
    this.processedKeys.set(integrationId, keys);

    const runner = new ExecutionRunner({
      plan,
      executionId: execution.id,
      integrationId,
      source,
      target,
      maxPages: opts?.maxPages,
      processedKeys: keys,
      logger: {
        log: (input) => {
          if (input.level === 'DEBUG') return;
          this.store.create('logs', {
            executionId: input.executionId,
            integrationId: input.integrationId,
            correlationId: input.correlationId,
            level: input.level,
            step: input.step,
            message: input.message,
            recordId: input.recordId || null,
            workerId: input.workerId || null,
            errorCode: input.errorCode || null,
            metadata: input.metadata ? maskSecrets(input.metadata) : null,
            timestamp: new Date().toISOString(),
          });
        },
      },
      callbacks: {
        updateExecution: (id, patch) => {
          this.store.update('executions', id, patch);
        },
        saveDeadLetter: (row) => {
          this.store.create('deadLetters', { ...row, ignored: false });
        },
        loadDeadLetters: (execId) =>
          this.store
            .list('deadLetters')
            .filter((d) => d.executionId === execId) as unknown as DeadLetterRecord[],
        updateDeadLetter: (id, patch) => {
          this.store.update('deadLetters', id, patch);
        },
      },
    });

    this.runners.set(execution.id, runner);

    const runPromise = runner.run().finally(() => {
      this.runners.delete(execution.id);
    });

    if (opts?.awaitCompletion) {
      await runPromise;
      return this.getExecution(execution.id);
    }

    // Fire-and-forget for API — client polls getExecution
    void runPromise;
    return this.getExecution(execution.id);
  }

  cancelExecution(executionId: string) {
    const row = this.store.get('executions', executionId);
    if (!row) throw new NotFoundException('Execution not found');
    if (!canCancel(String(row.status))) {
      throw new BadRequestException(`Cannot cancel execution in status ${row.status}`);
    }
    const runner = this.runners.get(executionId);
    if (runner) {
      runner.cancel();
    } else {
      this.store.update('executions', executionId, {
        status: 'CANCELLED',
        completedAt: new Date().toISOString(),
      });
    }
    this.log(
      executionId,
      String(row.integrationId),
      String(row.correlationId || ''),
      'WARN',
      'cancel',
      'Execution cancelled by user',
    );
    return this.getExecution(executionId);
  }

  async retryFailedRecords(executionId: string, opts?: { awaitCompletion?: boolean }) {
    const row = this.store.get('executions', executionId);
    if (!row) throw new NotFoundException('Execution not found');
    const integrationId = String(row.integrationId);
    const hydrated = this.getIntegration(integrationId);
    const direction = (hydrated.directions || [])[0] as DirectionConfig | undefined;
    if (!hydrated.design || !direction) {
      throw new BadRequestException('Integration design missing');
    }

    const dead = this.store
      .list('deadLetters')
      .filter((d) => d.executionId === executionId && !d.ignored) as unknown as DeadLetterRecord[];
    if (!dead.length) {
      throw new BadRequestException('No failed records to retry');
    }

    const correlationId = String(row.correlationId || buildCorrelationId('INT-VUL'));
    const retryExec = this.store.create('executions', {
      integrationId,
      versionId: row.versionId,
      status: 'QUEUED',
      parentExecutionId: executionId,
      startedAt: null,
      completedAt: null,
      recordsRead: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      retryCount: 0,
      errorMessage: null,
      correlationId,
      createdAt: new Date().toISOString(),
      mode: 'RETRY_FAILED',
    });

    const plan = buildExecutionPlan({
      integrationId,
      versionId: hydrated.version?.id || null,
      design: hydrated.design,
      direction,
      correlationId,
    });
    const formId = direction.selectedFormId || 'form-vulnerability';
    const target = createStoreTargetAdapter(this.store, formId, plan.matchingStrategy.targetFields);
    const keys = this.processedKeys.get(integrationId) || new Set<string>();
    // Allow retry of previously failed — remove only those keys that failed
    for (const d of dead) {
      const sid = String(d.sourceRecord?.id || d.sourceRecord?.vulnerability_id || '');
      keys.delete(`${integrationId}::REST_API::${sid}`);
      keys.delete(`${integrationId}::${plan.source.kind}::${sid}`);
    }

    const runner = new ExecutionRunner({
      plan,
      executionId: retryExec.id,
      integrationId,
      source: createArraySourceReader([]),
      target,
      processedKeys: keys,
      logger: {
        log: (input) => {
          this.store.create('logs', {
            executionId: input.executionId,
            integrationId: input.integrationId,
            correlationId: input.correlationId,
            level: input.level,
            step: input.step,
            message: input.message,
            recordId: input.recordId || null,
            errorCode: input.errorCode || null,
            metadata: input.metadata ? maskSecrets(input.metadata) : null,
            timestamp: new Date().toISOString(),
          });
        },
      },
      callbacks: {
        updateExecution: (id, patch) => this.store.update('executions', id, patch),
        saveDeadLetter: (r) => this.store.create('deadLetters', { ...r, ignored: false }),
        loadDeadLetters: (execId) =>
          this.store.list('deadLetters').filter((d) => d.executionId === execId) as any,
        updateDeadLetter: (id, patch) => this.store.update('deadLetters', id, patch),
      },
    });
    this.runners.set(retryExec.id, runner);

    // Mark original dead letters as retried (not ignored)
    for (const d of this.store.list('deadLetters').filter((x) => x.executionId === executionId && !x.ignored)) {
      this.store.update('deadLetters', d.id, { retriedIn: retryExec.id });
    }

    const runPromise = runner.retryFailed(dead).finally(() => this.runners.delete(retryExec.id));
    if (opts?.awaitCompletion !== false) await runPromise;
    else void runPromise;
    return this.getExecution(retryExec.id);
  }

  listDeadLetters(filters?: { executionId?: string; integrationId?: string }) {
    let rows = this.store.list('deadLetters');
    if (filters?.executionId) rows = rows.filter((d) => d.executionId === filters.executionId);
    if (filters?.integrationId) rows = rows.filter((d) => d.integrationId === filters.integrationId);
    return rows.slice().reverse();
  }

  ignoreDeadLetter(id: string) {
    const row = this.store.get('deadLetters', id);
    if (!row) throw new NotFoundException('Dead letter not found');
    return this.store.update('deadLetters', id, { ignored: true });
  }

  getRecordTrace(executionId: string, recordId: string) {
    const row = this.store.get('executions', executionId);
    if (!row) throw new NotFoundException('Execution not found');
    const traces = (row.traces as Record<string, unknown>) || {};
    const runner = this.runners.get(executionId);
    const live = runner?.getTraces(recordId);
    return {
      executionId,
      recordId,
      timeline: live || traces[recordId] || [],
      logs: this.store
        .list('logs')
        .filter((l) => l.executionId === executionId && l.recordId === recordId),
    };
  }

  listExecutions(integrationId?: string) {
    const all = this.store.list('executions');
    return integrationId ? all.filter((e) => e.integrationId === integrationId) : all;
  }

  getExecution(id: string) {
    const row = this.store.get('executions', id);
    if (!row) throw new NotFoundException('Execution not found');
    const runner = this.runners.get(id);
    const liveMetrics = runner?.getMetrics();
    return {
      ...row,
      metrics: liveMetrics || row.metrics || null,
      logs: this.store.list('logs').filter((l) => l.executionId === id),
      deadLetters: this.store.list('deadLetters').filter((d) => d.executionId === id),
      actions: {
        canCancel: canCancel(String(row.status)),
        canRetryFailed: this.store.list('deadLetters').some((d) => d.executionId === id && !d.ignored),
        // Designed for later
        canPause: false,
        canResume: false,
      },
    };
  }

  listLogs(filters?: { executionId?: string; level?: string }) {
    let logs = this.store.list('logs');
    if (filters?.executionId) logs = logs.filter((l) => l.executionId === filters.executionId);
    if (filters?.level) logs = logs.filter((l) => l.level === filters.level);
    return logs.slice().reverse();
  }

  /** Default demo source dataset (mock vulnerability API). */
  private defaultMockSourceRecords(): Record<string, unknown>[] {
    return [
      { id: 'VUL-1001', severity: 'Critical', description: 'Apache vulnerability', team: 'Infrastructure', status: 'Open' },
      { id: 'VUL-1002', severity: 'High', description: 'Outdated OpenSSL library', team: 'Platform', status: 'Open' },
      { id: 'VUL-1003', severity: 'Medium', description: 'Missing security headers', team: 'Application', status: 'Open' },
      { id: 'VUL-1004', severity: 'Low', description: 'Informational cookie flag', team: 'Application', status: 'Closed' },
    ];
  }

  // ── Phase 4 — Realtime / events ────────────────────────────────────────
  ingestWebhook(
    endpointId: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: Record<string, unknown>,
  ) {
    return this.events.ingestWebhook({ endpointId, headers, rawBody, parsedBody });
  }

  listEvents(filters?: { integrationId?: string; status?: string }) {
    return this.events.listEvents(filters);
  }

  getEvent(id: string) {
    const row = this.events.getEvent(id);
    if (!row) throw new NotFoundException('Event not found');
    return row;
  }

  replayEvent(id: string) {
    return this.events.replayEvent(id);
  }

  listEventDeadLetters(integrationId?: string) {
    return this.events.listEventDeadLetters(integrationId);
  }

  getEventConfig(id: string) {
    this.getIntegration(id);
    return this.events.getEventConfig(id);
  }

  setEventConfig(id: string, body: Record<string, unknown>) {
    this.getIntegration(id);
    const cfg = this.events.setEventConfig(id, body as Partial<RealtimeEventConfig>);
    this.audit(id, null, 'EVENT_CONFIG_UPDATED', { keys: Object.keys(body) });
    return cfg;
  }

  testEvent(
    id: string,
    event: Record<string, unknown>,
    opts?: { execute?: boolean; dryRun?: boolean },
  ) {
    this.getIntegration(id);
    return this.events.testEvent(id, event, opts);
  }

  activateIntegration(id: string) {
    const h = this.getIntegration(id);
    if (!['APPROVED', 'PAUSED', 'DISABLED', 'INACTIVE'].includes(String(h.status))) {
      throw new BadRequestException('Approve the design before activation');
    }
    this.store.update('integrations', id, {
      status: 'ACTIVATING',
      updatedAt: new Date().toISOString(),
    });
    const cfg = this.events.getEventConfig(id);
    if (!cfg.eventEnabled) {
      this.events.setEventConfig(id, defaultRealtimeConfig({
        eventEnabled: true,
        sourceEnvironmentId: cfg.sourceEnvironmentId || 'DEV',
        targetEnvironmentId: cfg.targetEnvironmentId || 'UAT',
        webhookAuthType: cfg.webhookAuthType || 'NONE',
      }));
    }
    const endpoint = this.events.ensureEndpoint(id);
    this.store.update('integrations', id, {
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    });
    this.events.ensureWorkers();
    const latest = this.events.getEventConfig(id);
    if (latest.eventSourceType === 'POLLING' && latest.pollingIntervalSeconds) {
      this.polling.start(id, latest.pollingIntervalSeconds);
    }
    this.audit(id, String(h.currentVersionId || ''), 'INTEGRATION_ACTIVATED', {
      endpointId: endpoint.id,
    });
    return this.getIntegration(id);
  }

  pauseIntegration(id: string) {
    const h = this.getIntegration(id);
    if (String(h.status) !== 'ACTIVE') {
      throw new BadRequestException('Only ACTIVE integrations can be paused');
    }
    this.store.update('integrations', id, {
      status: 'PAUSED',
      updatedAt: new Date().toISOString(),
    });
    this.polling.stop(id);
    this.audit(id, String(h.currentVersionId || ''), 'INTEGRATION_PAUSED', {});
    return this.getIntegration(id);
  }

  resumeIntegration(id: string) {
    const h = this.getIntegration(id);
    if (String(h.status) !== 'PAUSED') {
      throw new BadRequestException('Only PAUSED integrations can be resumed');
    }
    this.store.update('integrations', id, {
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    });
    const cfg = this.events.getEventConfig(id);
    if (cfg.eventSourceType === 'POLLING' && cfg.pollingIntervalSeconds) {
      this.polling.start(id, cfg.pollingIntervalSeconds);
    }
    this.audit(id, String(h.currentVersionId || ''), 'INTEGRATION_RESUMED', {});
    return this.getIntegration(id);
  }

  deactivateIntegration(id: string) {
    const h = this.getIntegration(id);
    this.store.update('integrations', id, {
      status: 'DEACTIVATING',
      updatedAt: new Date().toISOString(),
    });
    this.polling.stop(id);
    this.store.update('integrations', id, {
      status: 'DISABLED',
      updatedAt: new Date().toISOString(),
    });
    this.audit(id, String(h.currentVersionId || ''), 'INTEGRATION_DEACTIVATED', {});
    return this.getIntegration(id);
  }

  getRealtimeStatus(id: string) {
    const h = this.getIntegration(id);
    const cfg = this.events.getEventConfig(id);
    const metrics = this.events.metrics.snapshot();
    const recent = this.events.listEvents({ integrationId: id }).slice(0, 20);
    let health: string = 'DISCONNECTED';
    if (h.status === 'PAUSED') health = 'PAUSED';
    else if (h.status === 'ACTIVE') health = metrics.eventsFailed > metrics.eventsSucceeded ? 'DEGRADED' : 'HEALTHY';
    else if (h.status === 'DISABLED') health = 'UNHEALTHY';
    return {
      integrationId: id,
      status: h.status,
      health,
      eventConfig: cfg,
      endpoint: this.store.list('eventEndpoints').find((e) => e.integrationId === id) || null,
      metrics,
      recentEvents: recent,
    };
  }

  createEventSubscription(id: string, body: Record<string, unknown>) {
    this.getIntegration(id);
    const row = this.store.create('eventSubscriptions', {
      integrationId: id,
      eventTypes: body.eventTypes || ['RECORD_CREATED'],
      endpointUrl: body.endpointUrl || null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.audit(id, null, 'EVENT_SUBSCRIPTION_CREATED', { id: row.id });
    return row;
  }

  listEventSubscriptions(id: string) {
    return this.store.list('eventSubscriptions').filter((s) => s.integrationId === id);
  }

  deleteEventSubscription(id: string, subscriptionId: string) {
    const row = this.store.get('eventSubscriptions', subscriptionId);
    if (!row || row.integrationId !== id) throw new NotFoundException('Subscription not found');
    this.store.remove('eventSubscriptions', subscriptionId);
    this.audit(id, null, 'EVENT_SUBSCRIPTION_DELETED', { id: subscriptionId });
    return { ok: true };
  }

  async pollIntegration(id: string) {
    this.getIntegration(id);
    return this.polling.pollOnce(id);
  }

  listAudit(integrationId?: string) {
    const all = this.store.list('audits');
    return integrationId ? all.filter((a) => a.integrationId === integrationId) : all.slice().reverse();
  }

  // ── helpers ────────────────────────────────────────────────────────────
  private hydrateIntegration(row: VisRecord) {
    const version = row.currentVersionId
      ? this.store.get('versions', String(row.currentVersionId))
      : this.store.list('versions').filter((v) => v.integrationId === row.id).sort((a, b) => Number(b.version) - Number(a.version))[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: String(row.status || 'DRAFT'),
      environment: row.environment,
      promptText: row.promptText,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      design: (version?.design as IntegrationDesign) || null,
      directions: (version?.directions as DirectionConfig[]) || [],
      aiProposal: version?.aiProposal || null,
      userChanges: version?.userChanges || {},
      finalConfiguration: version?.finalConfiguration || null,
      sourceFields: version?.sourceFields || null,
      sourceSample: version?.sourceSample || null,
      openApiDiscovery: version?.openApiDiscovery || null,
      selectedEndpoint: version?.selectedEndpoint || null,
      eventConfig: version?.eventConfig || null,
      version: version
        ? { id: version.id, version: version.version, status: version.status }
        : null,
      currentVersionId: version?.id || row.currentVersionId,
    };
  }

  private patchCurrentVersion(integrationId: string, body: Record<string, unknown>) {
    const integration = this.store.get('integrations', integrationId);
    if (!integration) throw new NotFoundException('Integration not found');
    let version = integration.currentVersionId
      ? this.store.get('versions', String(integration.currentVersionId))
      : null;
    if (!version) {
      version = this.store.create('versions', {
        integrationId,
        version: 1,
        status: 'DRAFT',
        design: null,
        directions: [],
        aiProposal: null,
        userChanges: {},
        createdAt: new Date().toISOString(),
      });
      this.store.update('integrations', integrationId, { currentVersionId: version.id });
    }
    // If published, fork a new DRAFT version
    if (version.status === 'PUBLISHED') {
      const nextNum = Number(version.version) + 1;
      version = this.store.create('versions', {
        integrationId,
        version: nextNum,
        status: 'DRAFT',
        design: version.design,
        directions: version.directions,
        aiProposal: version.aiProposal,
        userChanges: version.userChanges || {},
        createdAt: new Date().toISOString(),
      });
      this.store.update('integrations', integrationId, { currentVersionId: version.id });
    }
    const patch: Record<string, unknown> = {};
    if (body.design !== undefined) {
      patch.design = body.design ? validateIntegrationDesign(body.design) : null;
    }
    if (body.directions !== undefined) patch.directions = body.directions;
    if (body.aiProposal !== undefined) patch.aiProposal = body.aiProposal;
    if (body.userChanges !== undefined) patch.userChanges = body.userChanges;
    if (body.finalConfiguration !== undefined) patch.finalConfiguration = body.finalConfiguration;
    if (body.sourceFields !== undefined) patch.sourceFields = body.sourceFields;
    if (body.sourceSample !== undefined) patch.sourceSample = body.sourceSample;
    if (body.openApiDiscovery !== undefined) patch.openApiDiscovery = body.openApiDiscovery;
    if (body.selectedEndpoint !== undefined) patch.selectedEndpoint = body.selectedEndpoint;
    if (body.eventConfig !== undefined) patch.eventConfig = body.eventConfig;
    this.store.update('versions', version.id, patch);
  }

  private recordUserChange(integrationId: string, key: string, value: unknown) {
    const integration = this.store.get('integrations', integrationId);
    if (!integration?.currentVersionId) return;
    const version = this.store.get('versions', String(integration.currentVersionId));
    if (!version) return;
    const prev = (version.userChanges as Record<string, unknown>) || {};
    this.store.update('versions', version.id, {
      userChanges: { ...prev, [key]: value },
    });
  }

  private maskConnection(conn: VisRecord) {
    return {
      ...conn,
      credentialRefId: conn.credentialRefId || null,
      hasCredential: Boolean(conn.credentialRefId),
    };
  }

  private audit(integrationId: string | null, versionId: string | null, action: string, detail: unknown) {
    this.store.create('audits', {
      organizationId: null,
      integrationId,
      versionId,
      actorId: null,
      action,
      detail: maskSecrets(detail),
      createdAt: new Date().toISOString(),
    });
  }

  private log(
    executionId: string,
    integrationId: string,
    correlationId: string,
    level: string,
    step: string,
    message: string,
    metadata?: unknown,
  ) {
    this.store.create('logs', {
      executionId,
      integrationId,
      correlationId,
      level,
      step,
      message,
      recordId: null,
      errorCode: null,
      metadata: metadata ? maskSecrets(metadata) : null,
      timestamp: new Date().toISOString(),
    });
  }
}
