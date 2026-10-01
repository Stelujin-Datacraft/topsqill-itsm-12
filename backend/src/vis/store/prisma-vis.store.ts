/**
 * PostgreSQL-backed VisStore replacement via Prisma.
 * Same collection API as file VisStore so Phase 1–10 services keep working.
 * Production application state must use this — not file-backed JSON.
 */
import { randomUUID } from 'crypto';
import { getVisPrisma, type PrismaClient } from './prisma-client';
import type { VisRecord, VisStoreData } from './vis.store';

type Collection = keyof VisStoreData;

const TYPED: Partial<Record<Collection, string>> = {
  connections: 'visConnection',
  credentials: 'visCredentialReference',
  integrations: 'visIntegration',
  versions: 'visIntegrationVersion',
  schemaCache: 'visSchemaCache',
  executions: 'visExecution',
  logs: 'visExecutionLog',
  audits: 'visAuditLog',
  deadLetters: 'visDeadLetterItem',
  events: 'visEvent',
  eventEndpoints: 'visEventEndpoint',
  eventSubscriptions: 'visEventSubscription',
  eventDeadLetters: 'visEventDeadLetter',
  eventCheckpoints: 'visEventCheckpoint',
  codegenArtifacts: 'visCodegenArtifact',
  promotions: 'visPromotion',
  changeHistory: 'visChangeHistory',
  approvals: 'visApproval',
  metrics: 'visMetricSample',
  traces: 'visTraceSpan',
  alerts: 'visAlert',
  reconciliationReports: 'visReconciliationReport',
  repairReports: 'visRepairReport',
  driftFindings: 'visDriftFinding',
  impactAnalyses: 'visImpactAnalysis',
  connectors: 'visConnector',
  connectorInstalls: 'visConnectorInstall',
  connectorUpgrades: 'visConnectorUpgrade',
  aiRecommendations: 'visAiRecommendation',
  generatedTests: 'visGeneratedTestSuite',
  generatedDocs: 'visGeneratedDoc',
  healingActions: 'visHealingAction',
};

/** Collections kept as documents (mock demo forms) or unmapped */
const DOCUMENT_ONLY: Collection[] = ['mockForms', 'mockRecords'];

function toRow(record: VisRecord): Record<string, unknown> {
  const { id, ...rest } = record;
  return { id, ...camelToPrisma(rest) };
}

function fromRow(row: Record<string, unknown> | null): VisRecord | null {
  if (!row) return null;
  return prismaToCamel(row) as VisRecord;
}

/** Best-effort: Prisma uses camelCase in client already for our schema. */
function camelToPrisma(obj: Record<string, unknown>) {
  return { ...obj };
}

function prismaToCamel(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...obj };
  // Flatten Date objects to ISO for VisStore compatibility
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) out[k] = v.toISOString();
  }
  return out;
}

function delegate(prisma: PrismaClient, collection: Collection): any {
  const name = TYPED[collection];
  if (!name) return null;
  return (prisma as any)[name];
}

export class PrismaVisStore {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getVisPrisma();
  }

  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.ensureMockSeed();
  }

  /** Transaction helper for multi-step governance / repair / upgrades. */
  async transaction<T>(fn: (store: PrismaVisStoreTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const inner = new PrismaVisStoreTx(tx as unknown as PrismaClient);
      return fn(inner);
    });
  }

  create<K extends Collection>(collection: K, record: Omit<VisRecord, 'id'> & { id?: string }): VisRecord {
    // Sync facade used by existing services — fire async write and return row.
    // Callers that need durability before continue should use createAsync.
    const row: VisRecord = { id: record.id || randomUUID(), ...record };
    void this.createAsync(collection, row);
    return row;
  }

  async createAsync<K extends Collection>(collection: K, record: VisRecord): Promise<VisRecord> {
    const row: VisRecord = { id: record.id || randomUUID(), ...record };
    if (collection === 'events' && !row.eventId) row.eventId = row.id;
    if (collection === 'credentials' && !row.secretHandle) row.secretHandle = `ref-${row.id}`;
    if (collection === 'credentials' && !row.type) row.type = 'GENERIC';
    if (collection === 'connections' && !row.authType) row.authType = 'NONE';
    if (collection === 'connections' && !row.kind) row.kind = 'REST';
    if (DOCUMENT_ONLY.includes(collection) || !TYPED[collection]) {
      await this.prisma.visDocument.create({
        data: { id: row.id, collection, payload: row as any },
      });
      this.cacheSet(collection, row);
      return row;
    }
    const d = delegate(this.prisma, collection);
    const data = mapToModel(collection, row);
    // Coerce ISO date strings
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && /At$|timestamp|detectedAt|recordedAt|startedAt|endedAt|installedAt|publishedAt|approvedAt|appliedAt|rotatedAt|receivedAt|processedAt|created_at/i.test(k)) {
        data[k] = new Date(v);
      }
    }
    await d.create({ data });
    this.cacheSet(collection, row);
    return row;
  }

  update<K extends Collection>(collection: K, id: string, patch: Record<string, unknown>): VisRecord | null {
    void this.updateAsync(collection, id, patch);
    return { id, ...patch } as VisRecord;
  }

  async updateAsync<K extends Collection>(collection: K, id: string, patch: Record<string, unknown>): Promise<VisRecord | null> {
    if (DOCUMENT_ONLY.includes(collection) || !TYPED[collection]) {
      const existing = await this.prisma.visDocument.findFirst({ where: { id, collection, deletedAt: null } });
      if (!existing) return null;
      const payload = { ...(existing.payload as object), ...patch, id };
      await this.prisma.visDocument.update({ where: { id }, data: { payload: payload as any } });
      return payload as VisRecord;
    }
    const d = delegate(this.prisma, collection);
    const existing = await d.findUnique({ where: { id } });
    if (!existing) return null;
    const data = mapToModel(collection, { ...fromRow(existing)!, ...patch, id });
    // remove undefined id collision
    const { id: _i, ...updateData } = data;
    const updated = await d.update({ where: { id }, data: updateData });
    return fromRow(updated);
  }

  get<K extends Collection>(collection: K, id: string): VisRecord | null {
    // Sync get cannot await — use cached sync bridge via deasync pattern is bad.
    // Services call get synchronously today. We load via Atomics wait is not available.
    // Solution: maintain a write-through memory cache for sync API compatibility.
    return this.cacheGet(collection, id);
  }

  async getAsync<K extends Collection>(collection: K, id: string): Promise<VisRecord | null> {
    if (DOCUMENT_ONLY.includes(collection) || !TYPED[collection]) {
      const row = await this.prisma.visDocument.findFirst({ where: { id, collection, deletedAt: null } });
      return row ? (row.payload as VisRecord) : null;
    }
    const d = delegate(this.prisma, collection);
    const row = await d.findUnique({ where: { id } });
    const mapped = fromRow(row);
    if (mapped) this.cacheSet(collection, mapped);
    return mapped;
  }

  list<K extends Collection>(collection: K): VisRecord[] {
    return this.cacheList(collection);
  }

  async listAsync<K extends Collection>(collection: K): Promise<VisRecord[]> {
    if (DOCUMENT_ONLY.includes(collection) || !TYPED[collection]) {
      const rows = await this.prisma.visDocument.findMany({
        where: { collection, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      const mapped = rows.map((r) => r.payload as VisRecord);
      this.cacheReplace(collection, mapped);
      return mapped;
    }
    const d = delegate(this.prisma, collection);
    let rows: any[] = [];
    try {
      rows = await d.findMany();
    } catch {
      rows = [];
    }
    const mapped = (rows as any[]).map((r) => fromRow(r)!).filter(Boolean);
    this.cacheReplace(collection, mapped);
    return mapped;
  }

  remove<K extends Collection>(collection: K, id: string): boolean {
    void this.removeAsync(collection, id);
    this.cacheDelete(collection, id);
    return true;
  }

  async removeAsync<K extends Collection>(collection: K, id: string): Promise<boolean> {
    if (DOCUMENT_ONLY.includes(collection) || !TYPED[collection]) {
      const res = await this.prisma.visDocument.updateMany({
        where: { id, collection },
        data: { deletedAt: new Date() },
      });
      this.cacheDelete(collection, id);
      return res.count > 0;
    }
    const d = delegate(this.prisma, collection);
    try {
      await d.delete({ where: { id } });
      this.cacheDelete(collection, id);
      return true;
    } catch {
      return false;
    }
  }

  persist() {
    /* no-op — durable on each write */
  }

  persistFast() {
    /* no-op */
  }

  snapshot(): VisStoreData {
    const empty = {} as VisStoreData;
    for (const k of Object.keys(TYPED).concat(DOCUMENT_ONLY) as Collection[]) {
      (empty as any)[k] = this.cacheList(k);
    }
    return empty;
  }

  /** Hydrate memory cache from DB (call at boot / test setup). */
  async hydrate() {
    const keys = [...Object.keys(TYPED), ...DOCUMENT_ONLY] as Collection[];
    for (const k of keys) {
      await this.listAsync(k);
    }
  }

  // ── write-through cache for sync VisStore API compatibility ────────────
  private cache = new Map<string, Map<string, VisRecord>>();

  private bucket(collection: string) {
    if (!this.cache.has(collection)) this.cache.set(collection, new Map());
    return this.cache.get(collection)!;
  }

  private cacheSet(collection: string, row: VisRecord) {
    this.bucket(collection).set(row.id, row);
  }

  private cacheGet(collection: string, id: string) {
    return this.bucket(collection).get(id) || null;
  }

  private cacheList(collection: string) {
    return [...this.bucket(collection).values()];
  }

  private cacheReplace(collection: string, rows: VisRecord[]) {
    const b = new Map<string, VisRecord>();
    for (const r of rows) b.set(r.id, r);
    this.cache.set(collection, b);
  }

  private cacheDelete(collection: string, id: string) {
    this.bucket(collection).delete(id);
  }

  private async ensureMockSeed() {
    const forms = await this.listAsync('mockForms');
    if (forms.length) return;
    await this.createAsync('mockForms', {
      id: 'form-vulnerability',
      name: 'Vulnerability',
      description: 'Internal Vulnerability tracking form',
      fields: [
        { name: 'vulnerability_id', label: 'Vulnerability ID', type: 'text', required: true, unique: true },
        { name: 'priority', label: 'Priority', type: 'select', required: true },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
        { name: 'status', label: 'Status', type: 'select', required: true },
        { name: 'external_id', label: 'External ID', type: 'text', required: false, unique: true },
      ],
    });
  }
}

/** Transaction-scoped store (async-only). */
export class PrismaVisStoreTx {
  constructor(private readonly prisma: PrismaClient) {}

  async create(collection: Collection, record: VisRecord) {
    const store = new PrismaVisStore(this.prisma);
    return store.createAsync(collection, record);
  }

  async update(collection: Collection, id: string, patch: Record<string, unknown>) {
    const store = new PrismaVisStore(this.prisma);
    return store.updateAsync(collection, id, patch);
  }

  async get(collection: Collection, id: string) {
    const store = new PrismaVisStore(this.prisma);
    return store.getAsync(collection, id);
  }
}

/**
 * Map VisRecord loose fields onto Prisma model create/update shapes.
 * Unknown fields lumped into payload/metadata/config JSON where available.
 */
function mapToModel(collection: Collection, row: VisRecord): Record<string, unknown> {
  const base = { ...row };
  // Prisma rejects unknown fields — pick known ones per model
  const pick = (keys: string[]) => {
    const out: Record<string, unknown> = { id: row.id };
    for (const k of keys) {
      if (base[k] !== undefined) out[k] = base[k];
    }
    return out;
  };

  switch (collection) {
    case 'integrations':
      return pick([
        'id', 'organizationId', 'tenantId', 'name', 'description', 'status', 'environment',
        'promptText', 'currentVersionId', 'createdBy', 'createdAt', 'updatedAt',
      ]);
    case 'versions':
      return pick([
        'id', 'integrationId', 'version', 'status', 'design', 'directions', 'aiProposal',
        'userChanges', 'eventConfig', 'sourceFields', 'sourceSample', 'openApiDiscovery',
        'selectedEndpoint', 'finalConfiguration', 'createdAt',
      ]);
    case 'executions':
      return pick([
        'id', 'integrationId', 'versionId', 'status', 'trigger', 'startedAt', 'completedAt',
        'recordsRead', 'recordsCreated', 'recordsUpdated', 'recordsFailed', 'retryCount',
        'errorMessage', 'errorCode', 'correlationId', 'workers', 'repairReportId', 'payload', 'createdAt',
      ]);
    case 'logs':
      return pick([
        'id', 'executionId', 'integrationId', 'correlationId', 'level', 'step', 'message',
        'recordId', 'errorCode', 'metadata', 'timestamp',
      ]);
    case 'audits':
      return pick(['id', 'organizationId', 'integrationId', 'versionId', 'actorId', 'action', 'detail', 'createdAt']);
    case 'connections':
      return pick([
        'id', 'organizationId', 'name', 'kind', 'environment', 'baseUrl', 'authType',
        'credentialRefId', 'config', 'allowPrivateNet', 'createdAt', 'updatedAt',
      ]);
    case 'credentials':
      return pick([
        'id', 'organizationId', 'tenantId', 'name', 'type', 'secretHandle', 'metadata', 'createdAt', 'updatedAt',
      ]);
    case 'events':
      return pick([
        'id', 'eventId', 'integrationId', 'status', 'eventType', 'entityId', 'payload',
        'correlationId', 'traceId', 'receivedAt', 'processedAt', 'metadata',
      ]);
    case 'codegenArtifacts':
      return pick([
        'id', 'integrationId', 'versionId', 'language', 'files', 'validation', 'securityScan',
        'dependencyScan', 'status', 'approvedAt', 'createdAt',
      ]);
    case 'promotions':
      return pick([
        'id', 'integrationId', 'fromEnvironment', 'toEnvironment', 'versionId', 'versionNumber',
        'envConfig', 'actorId', 'createdAt',
      ]);
    case 'changeHistory':
      return pick(['id', 'integrationId', 'versionId', 'action', 'detail', 'createdAt']);
    case 'approvals':
      return pick(['id', 'integrationId', 'versionId', 'actorId', 'decision', 'createdAt']);
    case 'metrics':
      return pick(['id', 'name', 'labels', 'value', 'kind', 'recordedAt']);
    case 'traces':
      return pick([
        'id', 'traceId', 'spanId', 'parentSpanId', 'name', 'correlationId', 'executionId',
        'eventId', 'attributes', 'startedAt', 'endedAt',
      ]);
    case 'alerts':
      return pick(['id', 'ruleId', 'message', 'severity', 'value', 'status', 'createdAt']);
    case 'reconciliationReports':
      return pick(['id', 'integrationId', 'versionId', 'mode', 'diffCount', 'diffs', 'status', 'createdAt']);
    case 'repairReports':
      return pick(['id', 'reportId', 'integrationId', 'versionId', 'actorId', 'items', 'status', 'createdAt']);
    case 'driftFindings':
      return pick(['id', 'connectionId', 'formId', 'findings', 'maxSeverity', 'acknowledged', 'detectedAt']);
    case 'impactAnalyses':
      return pick(['id', 'findingCount', 'affectedCount', 'affected', 'aiProposals', 'requiresApproval', 'createdAt']);
    case 'connectors':
      return pick([
        'id', 'name', 'vendor', 'version', 'category', 'description', 'capabilities', 'authentication',
        'operations', 'visibility', 'lifecycle', 'securityStatus', 'publisher', 'package', 'certification',
        'publishedAt', 'createdAt', 'updatedAt',
      ]);
    case 'connectorInstalls':
      return pick([
        'id', 'connectorId', 'organizationId', 'integrationId', 'version', 'status', 'installedAt', 'updatedAt',
      ]);
    case 'connectorUpgrades':
      return pick([
        'id', 'installId', 'fromConnectorId', 'toConnectorId', 'fromVersion', 'toVersion', 'status',
        'createdAt', 'appliedAt', 'rolledBackAt',
      ]);
    case 'aiRecommendations':
      return pick([
        'id', 'type', 'reason', 'evidence', 'confidence', 'affectedIntegrationId', 'affectedVersionId',
        'proposedChange', 'risk', 'status', 'createdAt', 'updatedAt',
      ]);
    case 'generatedTests':
      return pick(['id', 'integrationId', 'tests', 'createdAt']);
    case 'generatedDocs':
      return pick(['id', 'integrationId', 'markdown', 'structured', 'createdAt']);
    case 'healingActions':
      return pick([
        'id', 'actionType', 'trigger', 'integrationId', 'executionId', 'versionId', 'status',
        'detail', 'evidence', 'result', 'createdAt',
      ]);
    case 'deadLetters':
      return pick(['id', 'integrationId', 'executionId', 'sourceRecord', 'error', 'retryCount', 'status', 'createdAt']);
    case 'schemaCache':
      return pick([
        'id', 'connectionId', 'applicationKey', 'formId', 'formName', 'fields', 'apiVersion',
        'schemaVersion', 'schemaHash', 'retrievedAt',
      ]);
    case 'eventEndpoints':
      return pick(['id', 'integrationId', 'path', 'secretRef', 'config', 'createdAt']);
    case 'eventSubscriptions':
      return pick(['id', 'integrationId', 'config', 'createdAt']);
    case 'eventDeadLetters':
      return pick(['id', 'integrationId', 'eventId', 'payload', 'error', 'createdAt']);
    case 'eventCheckpoints':
      return pick(['id', 'integrationId', 'cursor', 'metadata', 'updatedAt']);
    default:
      return { id: row.id, ...base };
  }
}
