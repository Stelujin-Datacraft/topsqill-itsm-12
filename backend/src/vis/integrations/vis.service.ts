import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { getVisStore, VisStore, VisRecord } from '../store/vis.store';
import { VisAssistant, MockAIProvider } from '../ai/vis-assistant';
import { RestConnector } from '../connectors/rest.connector';
import { InternalApplicationConnector } from '../connectors/internal-app.connector';
import { maskSecrets } from '../core/security/index';
import type { IntegrationDesign, DirectionConfig, FieldMappingSpec, ProgrammingLanguage } from '../core/types/index';
import { validateIntegrationDesign } from '../core/schemas/integrationDesign';

@Injectable()
export class VisService {
  private readonly store: VisStore;
  private readonly assistant: VisAssistant;

  constructor() {
    this.store = getVisStore();
    this.assistant = new VisAssistant(new MockAIProvider());
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

  async analyzeIntegration(id: string, promptText?: string) {
    const integration = this.store.get('integrations', id);
    if (!integration) throw new NotFoundException('Integration not found');
    const prompt = String(promptText || integration.promptText || '').trim();
    if (!prompt) throw new BadRequestException('promptText is required');
    const design = await this.assistant.analyzeRequirement(prompt);
    const lang = await this.assistant.recommendLanguage(design);
    design.language = lang.language;
    design.languageReason = lang.reason;

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
      matchingKeys: ['external_id'],
      mappings: (design.suggestedMappings || []).map((m, i) => ({
        id: `map_${i}`,
        sourceField: m.sourceField,
        targetField: m.targetField,
        confidence: m.confidence,
        transformation: m.transformation,
        enabled: m.confidence !== 'LOW',
      })),
      schedule: {
        kind: design.scheduleKind || 'MANUAL',
        intervalMinutes: design.frequency === '15_MINUTES' ? 15 : null,
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
      updatedAt: new Date().toISOString(),
    });
    this.patchCurrentVersion(id, { design, directions });
    this.audit(id, String(integration.currentVersionId || ''), 'INTEGRATION_ANALYZED', {
      language: design.language,
    });
    return this.getIntegration(id);
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
   * Create demo REST source + Internal App connections that call this Nest
   * process's /api/vis/mocks/* endpoints (loopback, allowPrivateNetwork).
   */
  bootstrapDemoConnections() {
    const port = process.env.PORT || '3001';
    const mockBase = `http://127.0.0.1:${port}/api/vis/mocks`;
    const existing = this.store.list('connections');
    const hasInternal = existing.some(
      (c) => c.kind === 'INTERNAL_APPLICATION_API' && String(c.baseUrl || '').includes('/vis/mocks'),
    );
    const hasSource = existing.some(
      (c) => c.kind === 'REST_API' && String(c.name || '').toLowerCase().includes('vulnerability'),
    );

    const created: VisRecord[] = [];
    if (!hasInternal) {
      created.push(
        this.createConnection({
          name: 'Mock Internal Application',
          kind: 'INTERNAL_APPLICATION_API',
          baseUrl: mockBase,
          authType: 'NONE',
          allowPrivateNetwork: true,
          environment: 'DEV',
          config: {
            apiVersion: 'v1',
            paths: {
              formsPath: '/forms',
              formFieldsPath: '/forms/{formId}/fields',
              recordsPath: '/forms/{formId}/records',
              recordByIdPath: '/forms/{formId}/records/{recordId}',
            },
          },
        }) as VisRecord,
      );
    }
    if (!hasSource) {
      created.push(
        this.createConnection({
          name: 'Mock Vulnerability Source',
          kind: 'REST_API',
          baseUrl: mockBase,
          authType: 'NONE',
          allowPrivateNetwork: true,
          environment: 'DEV',
          config: { listPath: '/vulnerabilities' },
        }) as VisRecord,
      );
    }
    return {
      mockBaseUrl: mockBase,
      connections: created.length ? created : this.listConnections(),
      created: created.length,
    };
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
    if (existing) {
      const changed = existing.schemaHash !== hash;
      this.store.update('schemaCache', existing.id, payload);
      return { ...payload, id: existing.id, changed };
    }
    const row = this.store.create('schemaCache', payload);
    return { ...payload, id: row.id, changed: false };
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
    const result = await this.assistant.validateIntegration(h.design);
    if (result.ok) {
      this.store.update('integrations', id, { status: 'VALIDATED', updatedAt: new Date().toISOString() });
      this.audit(id, String(h.currentVersionId || ''), 'INTEGRATION_VALIDATED', {});
    }
    return { ...result, integration: this.getIntegration(id) };
  }

  // ── Executions / logs ──────────────────────────────────────────────────
  createExecution(integrationId: string) {
    const integration = this.store.get('integrations', integrationId);
    if (!integration) throw new NotFoundException('Integration not found');
    const correlationId = randomUUID();
    const execution = this.store.create('executions', {
      integrationId,
      versionId: integration.currentVersionId,
      status: 'QUEUED',
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
    });
    this.log(execution.id, integrationId, correlationId, 'INFO', 'enqueue', 'Execution queued (Phase 1 — no production runner)');
    // Phase 1 stub: mark as SUCCESS with zero records (foundation only)
    this.store.update('executions', execution.id, {
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    this.log(execution.id, integrationId, correlationId, 'INFO', 'complete', 'Stub execution completed — advanced runtime deferred');
    return this.store.get('executions', execution.id);
  }

  listExecutions(integrationId?: string) {
    const all = this.store.list('executions');
    return integrationId ? all.filter((e) => e.integrationId === integrationId) : all;
  }

  getExecution(id: string) {
    const row = this.store.get('executions', id);
    if (!row) throw new NotFoundException('Execution not found');
    return {
      ...row,
      logs: this.store.list('logs').filter((l) => l.executionId === id),
    };
  }

  listLogs(filters?: { executionId?: string; level?: string }) {
    let logs = this.store.list('logs');
    if (filters?.executionId) logs = logs.filter((l) => l.executionId === filters.executionId);
    if (filters?.level) logs = logs.filter((l) => l.level === filters.level);
    return logs.slice().reverse();
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
      ...row,
      design: (version?.design as IntegrationDesign) || null,
      directions: (version?.directions as DirectionConfig[]) || [],
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
        createdAt: new Date().toISOString(),
      });
      this.store.update('integrations', integrationId, { currentVersionId: version.id });
    }
    const patch: Record<string, unknown> = {};
    if (body.design !== undefined) {
      patch.design = body.design ? validateIntegrationDesign(body.design) : null;
    }
    if (body.directions !== undefined) patch.directions = body.directions;
    this.store.update('versions', version.id, patch);
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
