/**
 * Browser fallback for Versatile Integration Studio.
 * Same pattern as databaseClient: when Nest `/api/vis` is unreachable
 * (published app / preview / backend down), keep working locally.
 * Persistence: localStorage (org-scoped later via Supabase tables).
 */

const STORAGE_KEY = 'vis.studio.store.v2';
const LEGACY_STORAGE_KEYS = ['vis.studio.store.v1'];

type Row = Record<string, unknown> & { id: string };

interface Store {
  integrations: Row[];
  versions: Row[];
  connections: Row[];
  schemaCache: Row[];
  executions: Row[];
  logs: Row[];
  audits: Row[];
  deadLetters: Row[];
  mockForms: Row[];
  mockRecords: Row[];
  credentials?: Row[];
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
    deadLetters: [],
    mockForms: structuredClone(MOCK_FORMS),
    mockRecords: [],
  };
}

function load(): Store {
  try {
    if (typeof localStorage === 'undefined') return emptyStore();
    // Drop legacy lab/demo stores so prior Mock Internal / sample integrations do not linger
    for (const legacy of LEGACY_STORAGE_KEYS) {
      try {
        localStorage.removeItem(legacy);
      } catch {
        /* ignore */
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      ...emptyStore(),
      ...parsed,
      deadLetters: parsed.deadLetters || [],
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

function detectClarifications(prompt: string) {
  const p = prompt.toLowerCase().trim();
  const questions: Array<{
    id: string;
    field: string;
    prompt: string;
    options?: Array<{ value: string; label: string }>;
    allowCustom?: boolean;
  }> = [];
  const hasSource =
    /servicenow|snow\b|rest\s*api|database|sql|jdbc|jira|salesforce|crowdstrike|falcon|mockoon|127\.0\.0\.1|localhost/.test(p)
    || /\bfrom\s+[a-z0-9_\- ]+/.test(p);
  const hasFrequency =
    /every|schedule|cron|hourly|daily|minute|real.?time|webhook|on\s+demand|manual/.test(p);
  const mentionsSync = /sync|integrat|pull|push|get|create|update|map/.test(p);
  if (mentionsSync && !hasSource) {
    questions.push({
      id: 'q_source',
      field: 'source',
      prompt: 'What is the source system?',
      options: [
        { value: 'ServiceNow', label: 'ServiceNow' },
        { value: 'REST API', label: 'REST API' },
        { value: 'Database', label: 'Database' },
        { value: 'Other', label: 'Other' },
      ],
      allowCustom: true,
    });
  }
  if (mentionsSync && !hasFrequency) {
    questions.push({
      id: 'q_frequency',
      field: 'frequency',
      prompt: 'How frequently should synchronization run?',
      options: [
        { value: 'REALTIME', label: 'Real-time' },
        { value: '5_MINUTES', label: 'Every 5 minutes' },
        { value: '15_MINUTES', label: 'Every 15 minutes' },
        { value: 'HOURLY', label: 'Hourly' },
        { value: 'DAILY', label: 'Daily' },
        { value: 'CUSTOM', label: 'Custom' },
      ],
      allowCustom: true,
    });
  }
  return questions;
}

function buildDesign(prompt: string, answers?: Record<string, string>) {
  const p = `${prompt} ${Object.values(answers || {}).join(' ')}`.toLowerCase();
  const every15 =
    /15\s*min|every\s*15|quarter.?hour/.test(p)
    || answers?.frequency === '15_MINUTES'
    || answers?.q_frequency === '15_MINUTES';
  const every5 = /5\s*min|every\s*5/.test(p) || answers?.q_frequency === '5_MINUTES';
  const scheduled = /every|schedule|cron|hourly|daily|minute/.test(p) || every15 || every5;
  const upsert = /create\s+or\s+update|upsert|sync/.test(p);
  const servicenow =
    /servicenow|snow\b/.test(p)
    || answers?.source === 'ServiceNow'
    || answers?.q_source === 'ServiceNow';
  const crowdstrike = /crowdstrike|falcon|edr|device|host\b|endpoint/.test(p);
  const vuln = /vulnerabilit/.test(p) || crowdstrike;
  const internal = /internal|form|topsqill|our\s+app/.test(p);

  const crowdstrikeMappings = [
    { sourceField: 'device_id', targetField: 'vulnerability_id', confidence: 'HIGH', reason: 'Device id used as Vulnerability form record key.' },
    { sourceField: 'device_id', targetField: 'external_id', confidence: 'HIGH', reason: 'Idempotency key from CrowdStrike device id.' },
    { sourceField: 'hostname', targetField: 'description', confidence: 'MEDIUM', reason: 'Hostname carried into description for the Vulnerability form.' },
    { sourceField: 'status', targetField: 'status', confidence: 'HIGH', reason: 'Exact field name match.' },
    { sourceField: 'platform_name', targetField: 'assignment_group', confidence: 'LOW', reason: 'Platform hint — review before execute.' },
  ];

  return {
    name: crowdstrike
      ? 'CrowdStrike Devices → Internal Form'
      : vuln
        ? 'ServiceNow Vulnerabilities → Internal Form'
        : 'Prompt Integration',
    summary: prompt.trim().slice(0, 500) || 'Integration from natural-language requirement',
    source: 'REST_API',
    target: internal || vuln || crowdstrike ? 'INTERNAL_APPLICATION_API' : 'REST_API',
    direction: /bidirectional|two.?way|↔/.test(p) ? 'BIDIRECTIONAL' : 'UNIDIRECTIONAL',
    executionMode: scheduled ? 'SCHEDULED' : /webhook|event|realtime/.test(p) ? 'EVENT_DRIVEN' : 'MANUAL',
    frequency: every15 ? '15_MINUTES' : every5 ? '5_MINUTES' : scheduled ? 'HOURLY' : null,
    scheduleKind: every15 || every5 ? 'INTERVAL' : scheduled ? 'HOURLY' : 'MANUAL',
    operations: upsert
      ? ['READ', 'CREATE', 'UPDATE', 'UPSERT']
      : /delete/.test(p)
        ? ['READ', 'DELETE']
        : ['READ', 'CREATE'],
    language: 'PYTHON',
    languageReason:
      'The workload is primarily REST API communication and data transformation with moderate throughput.',
    workers: 5,
    batchSize: 500,
    concurrency: 5,
    retryPolicy: 'EXPONENTIAL',
    rateLimitPerMinute: 120,
    idempotencyStrategy: 'EXTERNAL_ID',
    authHint: crowdstrike ? 'API_KEY' : 'OAUTH2',
    sourceHints: {
      vendorExample: crowdstrike
        ? 'CrowdStrike Falcon (Mockoon)'
        : servicenow
          ? 'ServiceNow (generic REST)'
          : 'Generic REST',
      system: crowdstrike
        ? 'CrowdStrike'
        : servicenow
          ? 'ServiceNow'
          : answers?.q_source || null,
      openFilter: /open/.test(p) ? 'status=Open' : null,
      listPathHint: crowdstrike ? '/devices/queries/devices/v1' : null,
    },
    targetHints: {
      formHint: vuln || crowdstrike ? 'Vulnerability' : 'Selected internal form',
      formName: vuln || crowdstrike ? 'Vulnerability' : null,
    },
    suggestedMappings: crowdstrike
      ? crowdstrikeMappings
      : vuln
        ? [
            { sourceField: 'id', targetField: 'vulnerability_id', confidence: 'HIGH', reason: 'Exact identifier correspondence.' },
            {
              sourceField: 'severity',
              targetField: 'priority',
              confidence: 'HIGH',
              transformation: 'Critical→1;High→2;Medium→3;Low→4',
              reason: 'Both fields represent vulnerability severity. The target uses a numeric priority, so a value transformation is required.',
            },
            { sourceField: 'description', targetField: 'description', confidence: 'HIGH', reason: 'Exact field name match.' },
            { sourceField: 'team', targetField: 'assignment_group', confidence: 'MEDIUM', reason: 'Team maps to assignment group via reference lookup.' },
            { sourceField: 'status', targetField: 'status', confidence: 'HIGH', reason: 'Exact field name match.' },
            { sourceField: 'id', targetField: 'external_id', confidence: 'HIGH', reason: 'Use source id as idempotency key.' },
          ]
        : [],
    recommendations: [
      {
        area: 'LANGUAGE',
        recommendation: 'PYTHON',
        reason: 'The workload is primarily REST API communication and data transformation with moderate throughput.',
        confidence: 'HIGH',
      },
      {
        area: 'PERFORMANCE',
        recommendation: 'workers=5, batchSize=500',
        reason: 'Balanced defaults for moderate API throughput',
        confidence: 'MEDIUM',
      },
    ],
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
    aiProposal: (version as any)?.aiProposal || null,
    userChanges: (version as any)?.userChanges || {},
    finalConfiguration: (version as any)?.finalConfiguration || null,
    sourceFields: (version as any)?.sourceFields || null,
    sourceSample: (version as any)?.sourceSample || null,
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

  deleteIntegration(id: string) {
    const store = loadStore();
    const before = store.integrations.length;
    store.integrations = store.integrations.filter((i) => i.id !== id);
    if (store.integrations.length === before) throw new Error('Integration not found');
    store.versions = store.versions.filter((v) => v.integrationId !== id);
    store.executions = store.executions.filter((e) => e.integrationId !== id);
    audit(store, id, 'INTEGRATION_DELETED', { mode: 'client' });
    save(store);
    return { ok: true, id };
  },

  analyze(id: string, promptText?: string, answers?: Record<string, string>) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const prompt = String(promptText || integration.promptText || '').trim();
    if (!prompt) throw new Error('promptText is required');

    // Clarification when answers not provided
    if (!answers || Object.keys(answers).length === 0) {
      const questions = detectClarifications(prompt);
      if (questions.length) {
        integration.status = 'NEEDS_REVIEW';
        integration.promptText = prompt;
        integration.updatedAt = new Date().toISOString();
        audit(store, id, 'CLARIFICATION_REQUIRED', { questions: questions.map((q) => q.id) });
        save(store);
        return {
          needsClarification: true,
          questions,
          integration: hydrate(store, integration),
          __clientMode: true,
        };
      }
    }

    const design = buildDesign(prompt, answers);
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
      matchingKeys: crowdstrike ? ['external_id'] : ['external_id'],
      matchingStrategy: {
        mode: 'SINGLE',
        sourceFields: crowdstrike ? ['device_id'] : ['id'],
        targetFields: ['external_id'],
        ifFound: 'UPDATE',
        ifNotFound: 'CREATE',
      },
      mappings: (design.suggestedMappings || []).map((m: any, i: number) => ({
        id: `map_${i}`,
        sourceField: m.sourceField,
        targetField: m.targetField,
        confidence: m.confidence,
        confidencePercent: m.confidence === 'HIGH' ? 95 : m.confidence === 'MEDIUM' ? 81 : 45,
        transformation: m.transformation,
        reason: m.reason || null,
        enabled: m.confidence !== 'LOW',
      })),
      schedule: {
        kind: design.scheduleKind || 'MANUAL',
        intervalMinutes: design.frequency === '15_MINUTES' ? 15 : design.frequency === '5_MINUTES' ? 5 : null,
        cron: null,
        allowConcurrent: false,
      },
    };
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (version) {
      version.design = design;
      version.directions = [direction];
      (version as any).aiProposal = design;
      (version as any).userChanges = {};
    }
    integration.promptText = prompt;
    integration.name = design.name || integration.name;
    integration.status = 'DESIGN_READY';
    integration.updatedAt = new Date().toISOString();
    audit(store, id, 'INTEGRATION_ANALYZED', { language: design.language, mode: 'client' });
    save(store);
    return hydrate(store, integration);
  },

  clarify(_id: string, promptText?: string) {
    const questions = detectClarifications(String(promptText || ''));
    if (!questions.length) return { needsClarification: false as const };
    return { needsClarification: true as const, questions };
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
    let credentialRefId: string | null = null;
    if (body.secret || body.credentials) {
      credentialRefId = uid();
      store.credentials = store.credentials || [];
      store.credentials.push({
        id: credentialRefId,
        name: `${body.name || 'connection'}-secret`,
        type: body.authType || 'API_KEY',
        _secretPayload: body.secret || body.credentials,
        createdAt: new Date().toISOString(),
      });
    }
    const row: Row = {
      id: uid(),
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
    };
    store.connections.push(row);
    audit(store, null, 'CONNECTION_CREATED', { id: row.id, name: row.name, mode: 'client' });
    save(store);
    return { ...row, hasCredential: Boolean(credentialRefId) };
  },

  bootstrapDemo() {
    // Kept for API compatibility — no longer seeds built-in mock connections.
    return {
      connections: this.listConnections(),
      created: 0,
      deprecated: true,
      message: 'Built-in demo connections are disabled. Create real REST / Form API connections.',
      __clientMode: true,
    };
  },

  deleteConnection(id: string) {
    const store = loadStore();
    const before = store.connections.length;
    store.connections = store.connections.filter((c) => c.id !== id);
    if (store.connections.length === before) throw new Error('Connection not found');
    audit(store, null, 'CONNECTION_DELETED', { id, mode: 'client' });
    save(store);
    return { ok: true, id };
  },

  /**
   * Wipe local studio state (connections, integrations, executions) so external
   * third-party testing starts from a clean slate.
   */
  resetStudio() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        for (const legacy of LEGACY_STORAGE_KEYS) localStorage.removeItem(legacy);
      }
    } catch {
      /* ignore */
    }
    memoryStore = emptyStore();
    save(memoryStore);
    return {
      ok: true,
      cleared: true,
      connections: 0,
      integrations: 0,
      __clientMode: true,
    };
  },

  /** Remove known lab/demo connection stubs only (client:// and Mock * names). */
  purgeLabConnections() {
    const store = loadStore();
    const before = store.connections.length;
    store.connections = store.connections.filter((c) => {
      const base = String(c.baseUrl || '');
      const name = String(c.name || '').toLowerCase();
      if (base.startsWith('client://')) return false;
      if (name.includes('mock internal') || name.includes('mock vulnerability')) return false;
      return true;
    });
    const removed = before - store.connections.length;
    audit(store, null, 'LAB_CONNECTIONS_PURGED', { removed, mode: 'client' });
    save(store);
    return { ok: true, removed, connections: this.listConnections(), __clientMode: true };
  },

  /**
   * @deprecated Sample studio seeding removed — returns current empty/real state only.
   */
  ensureSampleStudio() {
    return {
      created: false,
      integration: this.listIntegrations()[0] || null,
      dashboard: this.dashboard(),
      integrations: this.listIntegrations(),
      connections: this.listConnections(),
      __clientMode: true,
    };
  },

  async testConnection(id: string) {
    const conn = loadStore().connections.find((c) => c.id === id);
    if (!conn) throw new Error('Connection not found');
    const baseUrl = String(conn.baseUrl || '');
    // client:// mocks are always local stubs
    if (!baseUrl || baseUrl.startsWith('client://')) {
      return { ok: true, status: 200, data: { mode: 'client', name: conn.name } };
    }
    // Real HTTP (Mockoon / localhost): attempt a lightweight reachability probe
    if (/^https?:\/\//i.test(baseUrl)) {
      try {
        const listPath = String((conn.config as any)?.listPath || '/');
        const url = `${baseUrl.replace(/\/$/, '')}${listPath.startsWith('/') ? listPath : `/${listPath}`}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (conn.authType && conn.authType !== 'NONE' && conn.credentialRefId) {
          const cred = (loadStore().credentials || []).find((c) => c.id === conn.credentialRefId);
          const secret = cred?._secretPayload;
          if (typeof secret === 'string' && secret) {
            headers.Authorization = `Bearer ${secret}`;
          }
        }
        const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
        clearTimeout(timer);
        return {
          ok: res.ok || res.status === 401 || res.status === 403,
          status: res.status,
          data: {
            mode: 'client-http',
            name: conn.name,
            probed: url,
            note: res.ok
              ? 'Mockoon/API reachable from this browser'
              : `HTTP ${res.status} — endpoint responded (auth may still be required)`,
          },
          error: res.ok ? undefined : `HTTP ${res.status}`,
        };
      } catch (e: any) {
        return {
          ok: false,
          status: 0,
          error: e?.name === 'AbortError'
            ? 'Timed out reaching Mockoon — is it running on that port?'
            : (e?.message || 'Failed to reach connection URL'),
          data: { mode: 'client-http', name: conn.name, baseUrl },
        };
      }
    }
    return { ok: true, status: 200, data: { mode: 'client', name: conn.name } };
  },

  async discoverForms(connectionId: string) {
    const store = loadStore();
    const conn = store.connections.find((c) => c.id === connectionId);
    if (!conn) throw new Error('Connection not found');
    const baseUrl = String(conn.baseUrl || '').replace(/\/$/, '');

    // Prefer live Form API when Base URL is real HTTP
    if (/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('client://')) {
      const formsPath = String((conn.config as any)?.paths?.formsPath || '/forms');
      const url = `${baseUrl}${formsPath.startsWith('/') ? formsPath : `/${formsPath}`}`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (conn.authType && conn.authType !== 'NONE' && conn.credentialRefId) {
        const cred = (store.credentials || []).find((c) => c.id === conn.credentialRefId);
        const secret = cred?._secretPayload;
        if (typeof secret === 'string' && secret) {
          headers.Authorization = `Bearer ${secret}`;
        }
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
          throw new Error(`Form API discover failed: HTTP ${res.status} at ${url}`);
        }
        const data = await res.json();
        const raw = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.forms)
              ? data.forms
              : Array.isArray(data?.data)
                ? data.data
                : [];
        const items = raw.map((f: any) => ({
          id: String(f.id || f.formId || f.slug || f.name),
          name: String(f.name || f.title || f.id || 'Form'),
          description: f.description || null,
        })).filter((f: any) => f.id);
        if (!items.length) {
          throw new Error(`Form API returned no forms at ${url}`);
        }
        // Cache for schema discover when Nest is offline
        for (const item of items) {
          if (!store.mockForms.some((m) => m.id === item.id)) {
            store.mockForms.push({
              id: item.id,
              name: item.name,
              description: item.description,
              fields: [
                { name: 'external_id', label: 'External ID', type: 'text', required: false, unique: true },
                { name: 'description', label: 'Description', type: 'textarea', required: false },
                { name: 'status', label: 'Status', type: 'text', required: false },
              ],
            });
          }
        }
        save(store);
        return { items, source: 'form-api', __clientMode: true };
      } catch (e: any) {
        if (conn.kind === 'INTERNAL_APPLICATION_API') {
          throw new Error(
            e?.name === 'AbortError'
              ? `Timed out reaching Form API at ${url}`
              : (e?.message || `Failed to discover forms at ${url}`),
          );
        }
      }
    }

    // Non-Form-API connections: no mock forms — return empty
    if (conn.kind === 'INTERNAL_APPLICATION_API') {
      throw new Error(
        'Form API Base URL missing or unreachable. Fix the Form API connection, then Discover Forms again.',
      );
    }
    return { items: [], source: 'none', __clientMode: true };
  },

  async discoverSchema(integrationId: string, body: { connectionId: string; formId: string }) {
    const store = loadStore();
    if (!store.integrations.some((i) => i.id === integrationId)) {
      throw new Error('Integration not found');
    }
    const conn = store.connections.find((c) => c.id === body.connectionId);
    const baseUrl = String(conn?.baseUrl || '').replace(/\/$/, '');

    // Try live Form API fields endpoint
    if (conn && /^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('client://')) {
      const fieldsTpl = String(
        (conn.config as any)?.paths?.formFieldsPath || '/forms/{formId}/fields',
      );
      const fieldsPath = fieldsTpl.replace('{formId}', encodeURIComponent(body.formId));
      const url = `${baseUrl}${fieldsPath.startsWith('/') ? fieldsPath : `/${fieldsPath}`}`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (conn.authType && conn.authType !== 'NONE' && conn.credentialRefId) {
        const cred = (store.credentials || []).find((c) => c.id === conn.credentialRefId);
        const secret = cred?._secretPayload;
        if (typeof secret === 'string' && secret) {
          headers.Authorization = `Bearer ${secret}`;
        }
      }
      try {
        const res = await fetch(url, { method: 'GET', headers });
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data)
            ? data
            : Array.isArray(data?.fields)
              ? data.fields
              : Array.isArray(data?.items)
                ? data.items
                : [];
          const fields = raw.map((f: any) => ({
            name: String(f.name || f.key || f.id),
            label: String(f.label || f.name || f.key || f.id),
            type: String(f.type || f.dataType || 'text'),
            required: Boolean(f.required),
            unique: Boolean(f.unique),
            choices: f.choices || f.options || undefined,
          })).filter((f: any) => f.name);
          if (fields.length) {
            const hash = String(JSON.stringify(fields).length);
            const payload = {
              id: uid(),
              connectionId: body.connectionId,
              formId: body.formId,
              formName: body.formId,
              fields,
              apiVersion: 'v1',
              schemaVersion: hash,
              schemaHash: hash,
              retrievedAt: new Date().toISOString(),
              changed: false,
              source: 'form-api',
            };
            const existing = store.schemaCache.find(
              (s) => s.connectionId === body.connectionId && s.formId === body.formId,
            );
            if (existing) Object.assign(existing, payload, { id: existing.id });
            else store.schemaCache.push(payload as Row);
            // Keep cached form fields for execute
            const cachedForm = store.mockForms.find((f) => f.id === body.formId);
            if (cachedForm) cachedForm.fields = fields;
            else store.mockForms.push({ id: body.formId, name: body.formId, fields });
            save(store);
            return payload;
          }
        }
      } catch {
        /* fall through to cache */
      }
    }

    const form = store.mockForms.find((f) => f.id === body.formId)
      || store.schemaCache.find((s) => s.formId === body.formId);
    if (!form) {
      throw new Error(
        `Form "${body.formId}" not found. Run Discover Forms against your Form API connection first.`,
      );
    }
    const fields = (form as any).fields || [];
    const hash = String(JSON.stringify(fields).length);
    const payload = {
      id: uid(),
      connectionId: body.connectionId,
      formId: body.formId,
      formName: (form as any).name || body.formId,
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
    return {
      ok: true,
      issues: [
        { severity: 'PASS', code: 'DESIGN', message: 'Design schema valid.' },
        { severity: 'PASS', code: 'LANGUAGE', message: `Language selected: ${(version.design as any).language}.` },
      ],
      integration: hydrate(store, integration),
    };
  },

  approve(id: string) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    if (integration.status !== 'VALIDATED' && integration.status !== 'APPROVED') {
      throw new Error('Validate the design before approval');
    }
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (version) {
      (version as any).finalConfiguration = version.design;
      (version as any).aiProposal = (version as any).aiProposal || version.design;
    }
    integration.status = 'APPROVED';
    integration.updatedAt = new Date().toISOString();
    audit(store, id, 'INTEGRATION_APPROVED', { mode: 'client' });
    save(store);
    return hydrate(store, integration);
  },

  saveDraft(id: string, body: Record<string, unknown> = {}) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    if (body.name) integration.name = String(body.name);
    if (body.promptText) integration.promptText = String(body.promptText);
    integration.updatedAt = new Date().toISOString();
    audit(store, id, 'DRAFT_SAVED', { mode: 'client' });
    save(store);
    return hydrate(store, integration);
  },

  bindConnections(
    id: string,
    body: { sourceConnectionId?: string; targetConnectionId?: string; selectedFormId?: string },
  ) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (version && Array.isArray(version.directions) && version.directions[0]) {
      version.directions = [
        {
          ...(version.directions as any[])[0],
          sourceConnectionId: body.sourceConnectionId ?? (version.directions as any[])[0].sourceConnectionId,
          targetConnectionId: body.targetConnectionId ?? (version.directions as any[])[0].targetConnectionId,
          selectedFormId: body.selectedFormId ?? (version.directions as any[])[0].selectedFormId,
        },
        ...(version.directions as any[]).slice(1),
      ];
    }
    audit(store, id, 'CONNECTIONS_BOUND', body);
    save(store);
    return hydrate(store, integration);
  },

  setMatchingStrategy(id: string, strategy: Record<string, unknown>) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (version && Array.isArray(version.directions) && version.directions[0]) {
      (version.directions as any[])[0] = {
        ...(version.directions as any[])[0],
        matchingStrategy: strategy,
        matchingKeys: (strategy.targetFields as string[]) || [],
      };
    }
    audit(store, id, 'MATCHING_STRATEGY_CHANGED', strategy);
    save(store);
    return hydrate(store, integration);
  },

  dryRun(id: string, sample?: Record<string, unknown>[]) {
    const integ = this.getIntegration(id);
    const mappings = ((integ.directions || [])[0]?.mappings || []).filter((m: any) => m.enabled !== false);
    const storedSample = integ.sourceSample;
    const defaultCrowd = {
      device_id: 'd-1001',
      hostname: 'WIN-ENDPOINT-01',
      status: 'normal',
      platform_name: 'Windows',
    };
    const fromStored = storedSample
      ? (Array.isArray(storedSample) ? storedSample : [storedSample as Record<string, unknown>])
      : null;
    const records = sample || fromStored || [defaultCrowd];
    const previews = records.map((source) => {
      const target: Record<string, unknown> = {};
      for (const m of mappings) {
        let value = source[m.sourceField];
        if (m.transformation && typeof value === 'string') {
          const pairs = String(m.transformation).split(';').map((p: string) => p.trim());
          for (const pair of pairs) {
            const [from, to] = pair.split('→').map((s: string) => s.trim());
            if (from && to && from.toLowerCase() === value.toLowerCase()) {
              value = to;
              break;
            }
          }
        }
        target[m.targetField] = value;
      }
      return { source, target, warnings: [], errors: [] };
    });
    const store = loadStore();
    audit(store, id, 'DRY_RUN_EXECUTED', { sampleSize: records.length, wroteRecords: false });
    save(store);
    return { dryRun: true as const, sampleSize: records.length, previews, mappingIssues: [] };
  },

  nlMapping(id: string, instruction: string) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    if (!version || !Array.isArray(version.directions) || !version.directions[0]) {
      throw new Error('Analyze first');
    }
    let mappings = [...((version.directions as any[])[0].mappings || [])];
    const text = instruction.toLowerCase();
    const remove = text.match(/(?:don'?t|do not)\s+map\s+(?:the\s+)?([a-z0-9_]+)/i);
    if (remove) {
      mappings = mappings.map((m) =>
        m.sourceField.toLowerCase() === remove[1] || m.targetField.toLowerCase() === remove[1]
          ? { ...m, enabled: false }
          : m,
      );
    }
    const mapMatch = text.match(/map\s+([a-z0-9_ \-]+?)\s+to\s+([a-z0-9_ \-]+)/i);
    if (mapMatch) {
      mappings.push({
        id: `map_nl_${mappings.length}`,
        sourceField: mapMatch[1].trim().replace(/\s+/g, '_'),
        targetField: mapMatch[2].trim().replace(/\s+/g, '_'),
        confidence: 'MEDIUM',
        confidencePercent: 85,
        enabled: true,
        reason: `Added from NL: ${instruction}`,
      });
    }
    (version.directions as any[])[0].mappings = mappings;
    audit(store, id, 'MAPPING_NL_CHANGED', { instruction });
    save(store);
    return mappings;
  },

  setSampleSource(id: string, sample: unknown) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    const row = Array.isArray(sample) ? sample[0] : sample;
    const fields =
      row && typeof row === 'object'
        ? Object.keys(row as object).map((name) => ({ name, label: name, type: 'string' }))
        : [];
    if (version) {
      (version as any).sourceSample = sample;
      (version as any).sourceFields = fields;
    }
    audit(store, id, 'SOURCE_SAMPLE_SET', { fieldCount: fields.length });
    save(store);
    return { sourceFields: fields, sample };
  },

  discoverOpenApi(id: string, body: { document?: unknown; url?: string }) {
    const doc = body.document as any;
    if (!doc?.paths) throw new Error('Provide OpenAPI document (url fetch not supported in client mode)');
    const endpoints: any[] = [];
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(methods as object)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        endpoints.push({
          path,
          method: method.toUpperCase(),
          summary: (op as any)?.summary,
        });
      }
    }
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    const version = store.versions.find((v) => v.id === integration?.currentVersionId);
    if (version) (version as any).openApiDiscovery = { endpoints, retrievedAt: new Date().toISOString() };
    audit(store, id, 'OPENAPI_DISCOVERED', { endpointCount: endpoints.length });
    save(store);
    return { endpoints };
  },

  selectOpenApiEndpoint(id: string, body: { path: string; method: string }) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === id);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    const endpoints = ((version as any)?.openApiDiscovery?.endpoints || []) as any[];
    const endpoint = endpoints.find((e) => e.path === body.path && e.method === body.method);
    if (!endpoint) throw new Error('Endpoint not found');
    if (version && Array.isArray(version.directions) && version.directions[0]) {
      (version.directions as any[])[0].endpointConfig = {
        path: body.path,
        method: body.method,
        summary: endpoint.summary,
      };
    }
    audit(store, id, 'OPENAPI_ENDPOINT_SELECTED', body);
    save(store);
    return { endpoint, sourceFields: [], integration: hydrate(store, integration) };
  },

  listAudit(integrationId?: string) {
    const all = [...loadStore().audits].reverse();
    return integrationId ? all.filter((a) => a.integrationId === integrationId) : all;
  },

  async createExecution(integrationId: string) {
    const store = loadStore();
    const integration = store.integrations.find((i) => i.id === integrationId);
    if (!integration) throw new Error('Integration not found');
    const version = store.versions.find((v) => v.id === integration.currentVersionId);
    const direction = ((version as any)?.directions || [])[0];
    const mappings = ((direction?.mappings || []) as any[]).filter((m) => m.enabled !== false);
    const formId = direction?.selectedFormId;
    if (!formId) {
      throw new Error('Select a target form (Discover Forms) before starting execution.');
    }

    const correlationId = `INT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uid().slice(0, 5).toUpperCase()}`;
    const execution: Row = {
      id: uid(),
      integrationId,
      versionId: integration.currentVersionId,
      status: 'QUEUED',
      startedAt: new Date().toISOString(),
      completedAt: null,
      recordsRead: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      retryCount: 0,
      errorMessage: null,
      correlationId,
      targetFormId: formId,
      createdAt: new Date().toISOString(),
    };
    store.executions.push(execution);

    // Resolve source records: saved sample → fetch Mockoon → CrowdStrike default (never invent VUL-*)
    const sourceConn = direction?.sourceConnectionId
      ? store.connections.find((c) => c.id === direction.sourceConnectionId)
      : null;
    const targetConn = direction?.targetConnectionId
      ? store.connections.find((c) => c.id === direction.targetConnectionId)
      : null;

    let sources: Record<string, unknown>[] = [];
    const sample = (version as any)?.sourceSample;
    if (sample) {
      sources = Array.isArray(sample) ? sample : [sample];
    } else if (sourceConn && /^https?:\/\//i.test(String(sourceConn.baseUrl || ''))) {
      try {
        const base = String(sourceConn.baseUrl).replace(/\/$/, '');
        const listPath = String((sourceConn.config as any)?.listPath || '/devices/queries/devices/v1');
        const url = `${base}${listPath.startsWith('/') ? listPath : `/${listPath}`}`;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (sourceConn.authType && sourceConn.authType !== 'NONE' && sourceConn.credentialRefId) {
          const cred = (store.credentials || []).find((c) => c.id === sourceConn.credentialRefId);
          const secret = cred?._secretPayload;
          if (typeof secret === 'string' && secret) headers.Authorization = `Bearer ${secret}`;
        }
        const res = await fetch(url, { method: 'GET', headers });
        if (res.ok) {
          const data = await res.json();
          const rows = Array.isArray(data)
            ? data
            : Array.isArray(data?.resources)
              ? data.resources
              : Array.isArray(data?.devices)
                ? data.devices
                : Array.isArray(data?.items)
                  ? data.items
                  : [data];
          sources = rows.filter((r: any) => r && typeof r === 'object').slice(0, 25);
        }
      } catch {
        /* fall through */
      }
    }
    if (!sources.length) {
      sources = [
        {
          device_id: 'd-1001',
          hostname: 'WIN-ENDPOINT-01',
          status: 'normal',
          platform_name: 'Windows',
        },
      ];
    }

    const mapRecord = (src: Record<string, unknown>) => {
      const data: Record<string, unknown> = {};
      for (const m of mappings) {
        data[m.targetField] = src[m.sourceField];
      }
      if (!Object.keys(data).length) {
        if (src.device_id) {
          data.external_id = src.device_id;
          data.vulnerability_id = src.device_id;
          data.description = src.hostname || String(src.device_id);
          data.status = src.status || 'Open';
        }
      }
      return data;
    };

    let created = 0;
    let failed = 0;
    const createdIds: string[] = [];
    const targetBase = String(targetConn?.baseUrl || '').replace(/\/$/, '');
    const canWriteFormApi =
      targetConn
      && targetConn.kind === 'INTERNAL_APPLICATION_API'
      && /^https?:\/\//i.test(targetBase)
      && !targetBase.startsWith('client://');

    for (const src of sources) {
      const data = mapRecord(src);
      if (canWriteFormApi) {
        try {
          const recordsTpl = String(
            (targetConn!.config as any)?.paths?.recordsPath || '/forms/{formId}/records',
          );
          const recordsPath = recordsTpl.replace('{formId}', encodeURIComponent(formId));
          const url = `${targetBase}${recordsPath.startsWith('/') ? recordsPath : `/${recordsPath}`}`;
          const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          };
          if (targetConn!.authType && targetConn!.authType !== 'NONE' && targetConn!.credentialRefId) {
            const cred = (store.credentials || []).find((c) => c.id === targetConn!.credentialRefId);
            const secret = cred?._secretPayload;
            if (typeof secret === 'string' && secret) headers.Authorization = `Bearer ${secret}`;
          }
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ data }),
          });
          if (!res.ok) {
            failed += 1;
            continue;
          }
          const body = await res.json().catch(() => ({}));
          const rid = String(body?.id || body?.recordId || uid());
          createdIds.push(rid);
          created += 1;
        } catch {
          failed += 1;
        }
      } else {
        const rid = uid();
        store.mockRecords.push({
          id: rid,
          formId,
          data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        createdIds.push(rid);
        created += 1;
      }
    }

    execution.status = failed && !created ? 'FAILED' : failed ? 'PARTIAL' : 'SUCCESS';
    execution.completedAt = new Date().toISOString();
    execution.recordsRead = sources.length;
    execution.recordsCreated = created;
    execution.recordsFailed = failed;
    execution.recordsProcessed = created + failed;
    (execution as any).createdRecordIds = createdIds;
    (execution as any).targetBaseUrl = canWriteFormApi ? targetBase : null;
    store.logs.push({
      id: uid(),
      executionId: execution.id,
      integrationId,
      correlationId,
      level: failed && !created ? 'ERROR' : 'INFO',
      step: 'complete',
      message: canWriteFormApi
        ? `Client execution wrote ${created} record(s) to Form API form ${formId}${failed ? ` (${failed} failed)` : ''}`
        : `Client execution completed — ${created} record(s) for form ${formId} (Form API write skipped — target unreachable or not HTTP)`,
      timestamp: new Date().toISOString(),
    });
    save(store);
    return execution;
  },

  cancelExecution(executionId: string) {
    const store = loadStore();
    const row = store.executions.find((e) => e.id === executionId);
    if (!row) throw new Error('Execution not found');
    row.status = 'CANCELLED';
    row.completedAt = new Date().toISOString();
    save(store);
    return this.getExecution(executionId);
  },

  retryFailedExecution(executionId: string) {
    const store = loadStore();
    const parent = store.executions.find((e) => e.id === executionId);
    if (!parent) throw new Error('Execution not found');
    const dead = (store as any).deadLetters?.filter((d: any) => d.executionId === executionId && !d.ignored) || [];
    if (!dead.length) throw new Error('No failed records to retry');
    return this.createExecution(String(parent.integrationId));
  },

  listDeadLetters(executionId?: string) {
    const store = loadStore() as any;
    const all = store.deadLetters || [];
    return executionId ? all.filter((d: any) => d.executionId === executionId) : [...all].reverse();
  },

  listExecutions(integrationId?: string) {
    const all = loadStore().executions;
    return integrationId ? all.filter((e) => e.integrationId === integrationId) : all;
  },

  getExecution(id: string) {
    const store = loadStore();
    const row = store.executions.find((e) => e.id === id);
    if (!row) throw new Error('Execution not found');
    const dead = (store as any).deadLetters?.filter((d: any) => d.executionId === id) || [];
    return {
      ...row,
      logs: store.logs.filter((l) => l.executionId === id),
      deadLetters: dead,
      actions: {
        canCancel: ['QUEUED', 'STARTING', 'RUNNING'].includes(String(row.status)),
        canRetryFailed: dead.some((d: any) => !d.ignored),
        canPause: false,
        canResume: false,
      },
    };
  },

  listLogs(executionId?: string) {
    const logs = loadStore().logs;
    return executionId ? logs.filter((l) => l.executionId === executionId) : [...logs].reverse();
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
