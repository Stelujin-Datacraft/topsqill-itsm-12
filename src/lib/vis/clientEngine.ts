/**
 * Browser fallback for Versatile Integration Studio.
 * Same pattern as databaseClient: when Nest `/api/vis` is unreachable
 * (published app / preview / backend down), keep working locally.
 * Persistence: localStorage (org-scoped later via Supabase tables).
 */

const STORAGE_KEY = 'vis.studio.store.v1';

type Row = Record<string, unknown> & { id: string };

interface Store {
  integrations: Row[];
  versions: Row[];
  connections: Row[];
  schemaCache: Row[];
  executions: Row[];
  logs: Row[];
  audits: Row[];
  mockForms: Row[];
  mockRecords: Row[];
}

const MOCK_FORMS: Row[] = [
  {
    id: 'form-vulnerability',
    name: 'Vulnerability',
    description: 'Internal Vulnerability tracking form (mock external app)',
    fields: [
      { name: 'vulnerability_id', label: 'Vulnerability ID', type: 'text', required: true, unique: true },
      {
        name: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        choices: [
          { value: '1', label: '1 - Critical' },
          { value: '2', label: '2 - High' },
          { value: '3', label: '3 - Medium' },
          { value: '4', label: '4 - Low' },
        ],
      },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'assignment_group', label: 'Assignment Group', type: 'reference', required: false },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        choices: [
          { value: 'Open', label: 'Open' },
          { value: 'In Progress', label: 'In Progress' },
          { value: 'Closed', label: 'Closed' },
        ],
      },
      { name: 'external_id', label: 'External ID', type: 'text', required: false, unique: true },
    ],
  },
  {
    id: 'form-security-incident',
    name: 'Security Incident',
    description: 'Mock Security Incident form',
    fields: [
      { name: 'incident_id', label: 'Incident ID', type: 'text', required: true, unique: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'severity', label: 'Severity', type: 'select', required: true },
    ],
  },
];

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyStore(): Store {
  return {
    integrations: [],
    versions: [],
    connections: [],
    schemaCache: [],
    executions: [],
    logs: [],
    audits: [],
    mockForms: structuredClone(MOCK_FORMS),
    mockRecords: [],
  };
}

function load(): Store {
  try {
    if (typeof localStorage === 'undefined') return emptyStore();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      ...emptyStore(),
      ...parsed,
      mockForms: parsed.mockForms?.length ? parsed.mockForms : structuredClone(MOCK_FORMS),
    };
  } catch {
    return emptyStore();
  }
}

let memoryStore: Store | null = null;

function save(store: Store): void {
  memoryStore = store;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    /* private mode / SSR */
  }
}

function loadStore(): Store {
  if (typeof localStorage === 'undefined') {
    if (!memoryStore) memoryStore = emptyStore();
    return memoryStore;
  }
  return load();
}

function audit(store: Store, integrationId: string | null, action: string, detail: unknown) {
  store.audits.push({
    id: uid(),
    integrationId,
    action,
    detail,
    createdAt: new Date().toISOString(),
  });
}

function buildDesign(prompt: string) {
  const p = prompt.toLowerCase();
  const every15 = /15\s*min|every\s*15|quarter.?hour/.test(p);
  const scheduled = /every|schedule|cron|hourly|daily|minute/.test(p) || every15;
  const upsert = /create\s+or\s+update|upsert|sync/.test(p);
  const servicenow = /servicenow|snow\b/.test(p);
  const vuln = /vulnerabilit/.test(p);
  const internal = /internal|form|topsqill|our\s+app/.test(p);

  return {
    name: vuln ? 'ServiceNow Vulnerabilities → Internal Form' : 'Prompt Integration',
    summary: prompt.trim().slice(0, 500) || 'Integration from natural-language requirement',
    source: 'REST_API',
    target: internal || vuln ? 'INTERNAL_APPLICATION_API' : 'REST_API',
    direction: /bidirectional|two.?way|↔/.test(p) ? 'BIDIRECTIONAL' : 'UNIDIRECTIONAL',
    executionMode: scheduled ? 'SCHEDULED' : /webhook|event/.test(p) ? 'EVENT_DRIVEN' : 'MANUAL',
    frequency: every15 ? '15_MINUTES' : scheduled ? 'HOURLY' : null,
    scheduleKind: every15 ? 'INTERVAL' : scheduled ? 'HOURLY' : 'MANUAL',
    operations: upsert
      ? ['READ', 'CREATE', 'UPDATE', 'UPSERT']
      : /delete/.test(p)
        ? ['READ', 'DELETE']
        : ['READ', 'CREATE'],
    language: 'PYTHON',
    languageReason:
      'REST API and data-transformation workload with moderate throughput; Python has strong HTTP/JSON ergonomics and mature connector patterns.',
    workers: 5,
    batchSize: 500,
    concurrency: 5,
    retryPolicy: 'EXPONENTIAL',
    rateLimitPerMinute: 120,
    idempotencyStrategy: 'EXTERNAL_ID',
    authHint: 'OAUTH2',
    sourceHints: {
      vendorExample: servicenow ? 'ServiceNow (generic REST)' : 'Generic REST',
      openFilter: /open/.test(p) ? 'status=Open' : null,
    },
    targetHints: { formHint: vuln ? 'Vulnerability' : 'Selected internal form' },
    suggestedMappings: vuln
      ? [
          { sourceField: 'id', targetField: 'vulnerability_id', confidence: 'HIGH' },
          {
            sourceField: 'severity',
            targetField: 'priority',
            confidence: 'HIGH',
            transformation: 'Critical→1;High→2;Medium→3;Low→4',
          },
          { sourceField: 'description', targetField: 'description', confidence: 'HIGH' },
          { sourceField: 'team', targetField: 'assignment_group', confidence: 'MEDIUM' },
          { sourceField: 'status', targetField: 'status', confidence: 'HIGH' },
          { sourceField: 'id', targetField: 'external_id', confidence: 'HIGH' },
        ]
      : [],
  };
}

function hydrate(store: Store, row: Row) {
  const version = row.currentVersionId
    ? store.versions.find((v) => v.id === row.currentVersionId)
    : store.versions
        .filter((v) => v.integrationId === row.id)
        .sort((a, b) => Number(b.version) - Number(a.version))[0];
  return {
    ...row,
    design: version?.design || null,
    directions: version?.directions || [],
    version: version
      ? { id: version.id, version: version.version, status: version.status }
      : null,
    currentVersionId: version?.id || row.currentVersionId,
    __clientMode: true,
  };
}

export const visClientEngine = {
  mode: 'client' as const,

  dashboard() {
    const store = loadStore();
    return {
      totalIntegrations: store.integrations.length,
      active: store.integrations.filter((i) => i.status === 'ACTIVE').length,
      draft: store.integrations.filter((i) => i.status === 'DRAFT').length,
      running: store.executions.filter((e) => e.status === 'RUNNING' || e.status === 'QUEUED').length,
      successful: store.executions.filter((e) => e.status === 'SUCCESS').length,
      failed: store.executions.filter((e) => e.status === 'FAILED').length,
      recentExecutions: store.executions.slice(-10).reverse(),
      recentErrors: store.logs.filter((l) => l.level === 'ERROR').slice(-10).reverse(),
      __clientMode: true,
    };
  },

  listIntegrations() {
    const store = loadStore();
    return store.integrations.map((i) => hydrate(store, i));
  },

  getIntegration(id: string) {
    const store = loadStore();
    const row = store.integrations.find((i) => i.id === id);
    if (!row) throw new Error('Integration not found');
    return hydrate(store, row);
  },

  createIntegration(body: { name?: string; promptText?: string; description?: string }) {
    const store = loadStore();
    const integration: Row = {
      id: uid(),
      name: body.name || 'Untitled Integration',
      description: body.description || null,
      status: 'DRAFT',
      environment: 'DEV',
      promptText: body.promptText || null,
      currentVersionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const version: Row = {
      id: uid(),
      integrationId: integration.id,
      version: 1,
      status: 'DRAFT',
      design: null,
      directions: [],
      createdAt: new Date().toISOString(),
    };
    integration.currentVersionId = version.id;
    store.integrations.push(integration);
    store.versions.push(version);
    audit(store, integration.id, 'INTEGRATION_CREATED', { name: integration.name, mode: 'client' });
    save(store);
    return hydrate(store, integration);
  },

  analyze(id: string, promptText?: string) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const prompt = String(promptText || integration.promptText || '').trim();
    if (!prompt) throw new Error('promptText is required');
    const design = buildDesign(prompt);
    const direction = {
      id: uid(),
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
      concurrency: design.concurrency,
      retryPolicy: design.retryPolicy,
      retryMaxAttempts: 3,
      rateLimitPerMinute: design.rateLimitPerMinute,
      idempotencyStrategy: design.idempotencyStrategy,
      matchingKeys: ['external_id'],
      mappings: (design.suggestedMappings || []).map((m: any, i: number) => ({
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
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (version) {
      version.design = design;
      version.directions = [direction];
    }
    integration.promptText = prompt;
    integration.name = design.name || integration.name;
    integration.updatedAt = new Date().toISOString();
    audit(store, id, 'INTEGRATION_ANALYZED', { language: design.language, mode: 'client' });
    save(store);
    return hydrate(store, integration);
  },

  setLanguage(id: string, language: string) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (version?.design && typeof version.design === 'object') {
      (version.design as any).language = language;
    }
    if (Array.isArray(version?.directions)) {
      version!.directions = (version!.directions as any[]).map((d) => ({ ...d, language }));
    }
    audit(store, id, 'LANGUAGE_CHANGED', { language, mode: 'client' });
    save(store);
    return hydrate(store, integration);
  },

  listConnections() {
    return loadStore().connections.map((c) => ({ ...c, hasCredential: Boolean(c.credentialRefId) }));
  },

  createConnection(body: Record<string, unknown>) {
    const store = loadStore();
    const row: Row = {
      id: uid(),
      name: body.name || 'Connection',
      kind: body.kind || 'REST_API',
      environment: body.environment || 'DEV',
      baseUrl: body.baseUrl || null,
      authType: body.authType || 'NONE',
      credentialRefId: null,
      config: body.config || {},
      allowPrivateNetwork: Boolean(body.allowPrivateNetwork),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.connections.push(row);
    audit(store, null, 'CONNECTION_CREATED', { id: row.id, name: row.name, mode: 'client' });
    save(store);
    return { ...row, hasCredential: false };
  },

  bootstrapDemo() {
    const store = loadStore();
    const hasInternal = store.connections.some((c) => c.kind === 'INTERNAL_APPLICATION_API');
    const hasSource = store.connections.some((c) =>
      String(c.name || '').toLowerCase().includes('vulnerability'),
    );
    if (!hasInternal) {
      this.createConnection({
        name: 'Mock Internal Application',
        kind: 'INTERNAL_APPLICATION_API',
        baseUrl: 'client://mock-internal',
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
      });
    }
    if (!hasSource) {
      this.createConnection({
        name: 'Mock Vulnerability Source',
        kind: 'REST_API',
        baseUrl: 'client://mock-source',
        authType: 'NONE',
        allowPrivateNetwork: true,
        environment: 'DEV',
        config: { listPath: '/vulnerabilities' },
      });
    }
    return { connections: this.listConnections(), created: 2, __clientMode: true };
  },

  testConnection(id: string) {
    const conn = loadStore().connections.find((c) => c.id === id);
    if (!conn) throw new Error('Connection not found');
    return { ok: true, status: 200, data: { mode: 'client', name: conn.name } };
  },

  discoverForms(connectionId: string) {
    const store = loadStore();
    const conn = store.connections.find((c) => c.id === connectionId);
    if (!conn) throw new Error('Connection not found');
    return {
      items: store.mockForms.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
      })),
    };
  },

  discoverSchema(integrationId: string, body: { connectionId: string; formId: string }) {
    const store = loadStore();
    if (!store.integrations.some((i) => i.id === integrationId)) {
      throw new Error('Integration not found');
    }
    const form = store.mockForms.find((f) => f.id === body.formId);
    if (!form) throw new Error('Form not found');
    const fields = form.fields || [];
    const hash = String(JSON.stringify(fields).length);
    const payload = {
      id: uid(),
      connectionId: body.connectionId,
      formId: body.formId,
      formName: form.name,
      fields,
      apiVersion: 'v1',
      schemaVersion: hash,
      schemaHash: hash,
      retrievedAt: new Date().toISOString(),
      changed: false,
    };
    const existing = store.schemaCache.find(
      (s) => s.connectionId === body.connectionId && s.formId === body.formId,
    );
    if (existing) {
      Object.assign(existing, payload, { id: existing.id });
    } else {
      store.schemaCache.push(payload as Row);
    }
    save(store);
    return payload;
  },

  getMappings(id: string) {
    const integ = this.getIntegration(id);
    return (integ.directions || [])[0]?.mappings || [];
  },

  saveMappings(id: string, mappings: unknown[]) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (version && Array.isArray(version.directions) && version.directions[0]) {
      (version.directions as any[])[0] = {
        ...(version.directions as any[])[0],
        mappings,
      };
    }
    audit(store, id, 'MAPPING_CHANGED', { count: mappings.length, mode: 'client' });
    save(store);
    return mappings;
  },

  suggestMappings(id: string) {
    const integ = this.getIntegration(id);
    const suggested = (integ.design as any)?.suggestedMappings || [];
    return suggested.map((m: any, i: number) => ({
      id: `map_${i}`,
      sourceField: m.sourceField,
      targetField: m.targetField,
      confidence: m.confidence,
      transformation: m.transformation,
      enabled: m.confidence !== 'LOW',
    }));
  },

  validate(id: string) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (!version?.design) throw new Error('Analyze the requirement first');
    integration.status = 'VALIDATED';
    integration.updatedAt = new Date().toISOString();
    audit(store, id, 'INTEGRATION_VALIDATED', { mode: 'client' });
    save(store);
    return { ok: true, issues: [], integration: hydrate(store, integration) };
  },

  createExecution(integrationId: string) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === integrationId);
    if (!integration) throw new Error('Integration not found');
    const correlationId = uid();
    const execution: Row = {
      id: uid(),
      integrationId,
      versionId: integration.currentVersionId,
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      recordsRead: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      retryCount: 0,
      errorMessage: null,
      correlationId,
      createdAt: new Date().toISOString(),
    };
    store.executions.push(execution);
    store.logs.push({
      id: uid(),
      executionId: execution.id,
      integrationId,
      correlationId,
      level: 'INFO',
      step: 'complete',
      message: 'Client-mode stub execution completed (Nest /api/vis unavailable)',
      timestamp: new Date().toISOString(),
    });
    save(store);
    return execution;
  },

  listExecutions(integrationId?: string) {
    const all = loadStore().executions;
    return integrationId ? all.filter((e) => e.integrationId === integrationId) : all;
  },

  getExecution(id: string) {
    const store = loadStore();
    const row = store.executions.find((e) => e.id === id);
    if (!row) throw new Error('Execution not found');
    return {
      ...row,
      logs: store.logs.filter((l) => l.executionId === id),
    };
  },

  listLogs(executionId?: string) {
    const logs = loadStore().logs;
    return executionId ? logs.filter((l) => l.executionId === executionId) : [...logs].reverse();
  },

  listAudit() {
    return [...loadStore().audits].reverse();
  },

  mockForms() {
    return {
      items: loadStore().mockForms.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
      })),
    };
  },

  mockVulnerabilities() {
    return {
      items: [
        {
          id: 'VUL-1001',
          severity: 'Critical',
          description: 'Apache vulnerability',
          team: 'Infrastructure',
          status: 'Open',
        },
        {
          id: 'VUL-1002',
          severity: 'High',
          description: 'Outdated OpenSSL library',
          team: 'Platform',
          status: 'Open',
        },
      ],
      count: 2,
    };
  },
};
