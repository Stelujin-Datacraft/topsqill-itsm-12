/**
 * In-memory + optional Supabase-backed discovery state.
 * Production path uses Supabase tables; tests use memory so agent SoR stays intact.
 */
import { randomUUID } from 'crypto';
import type {
  DiscoveryJob,
  DiscoveryJobStatus,
  DiscoveryMode,
  DiscoveryEnvironment,
  NetworkScope,
  DiscoveredAssetStatus,
  DiscoveryConfidence,
  InventorySource,
} from './types';

export interface StoredDiscoveredHost {
  id: string;
  organizationId: string;
  jobId?: string;
  runId?: string;
  assetId?: string;
  status: DiscoveredAssetStatus;
  confidence: DiscoveryConfidence;
  ipAddress?: string;
  macAddress?: string;
  hostname?: string;
  dnsName?: string;
  deviceType: string;
  osName?: string;
  osFamily?: string;
  osVersion?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  biosUuid?: string;
  machineGuid?: string;
  responseTimeMs?: number;
  discoveryMethods: string[];
  services: unknown[];
  software: unknown[];
  fieldProvenance: Record<string, InventorySource | string>;
  rawEvidence: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface StoredAsset {
  id: string;
  organizationId: string;
  assetTag?: string;
  displayName: string;
  hostname?: string;
  assetType: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  ipAddress?: string;
  macAddress?: string;
  biosUuid?: string;
  machineGuid?: string;
  status: string;
  discoveryLifecycle: string;
  discoveryConfidence?: string;
  primaryDiscoverySource?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  customFields?: Record<string, unknown>;
}

export interface StoredSoftware {
  id: string;
  assetId: string;
  softwareName: string;
  version?: string;
  publisher?: string;
  source: string;
  rawName?: string;
  rawVersion?: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DiscoveryRunRecord {
  id: string;
  jobId: string;
  organizationId: string;
  status: DiscoveryJobStatus;
  startedAt: string;
  finishedAt?: string;
  hostsTargeted: number;
  hostsScanned: number;
  hostsDiscovered: number;
  assetsCreated: number;
  assetsUpdated: number;
  assetsUnmanaged: number;
  softwareDiscovered: number;
  errors: number;
  metrics: Record<string, unknown>;
}

export interface AuditRecord {
  id: string;
  organizationId: string;
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export class DiscoveryStore {
  scopes: NetworkScope[] = [];
  jobs: DiscoveryJob[] = [];
  runs: DiscoveryRunRecord[] = [];
  hosts: StoredDiscoveredHost[] = [];
  assets: StoredAsset[] = [];
  software: StoredSoftware[] = [];
  identities: Array<{
    id: string;
    organizationId: string;
    assetId: string;
    identityType: string;
    identityValue: string;
    source: string;
    confidence: string;
  }> = [];
  diffs: Array<{ id: string; organizationId: string; runId?: string; assetId?: string; changeType: string; detail: Record<string, unknown> }> = [];
  audits: AuditRecord[] = [];
  services: Array<{
    id: string;
    organizationId: string;
    assetId: string;
    port: number;
    protocol: string;
    service?: string;
    banner?: string;
    source: string;
  }> = [];
  provenance: Array<{
    id: string;
    organizationId: string;
    assetId: string;
    fieldName: string;
    fieldValue?: string;
    source: string;
  }> = [];
  catalog: Array<{ id: string; organizationId?: string; canonicalName: string; publisher?: string }> = [];
  aliases: Array<{ id: string; productId: string; aliasName: string }> = [];

  /** Control flags for job runner */
  jobFlags = new Map<string, { cancel?: boolean; pause?: boolean }>();

  now() {
    return new Date().toISOString();
  }

  audit(organizationId: string, action: string, opts?: Partial<AuditRecord>) {
    this.audits.push({
      id: randomUUID(),
      organizationId,
      action,
      detail: {},
      createdAt: this.now(),
      ...opts,
    });
  }

  createScope(input: Omit<NetworkScope, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): NetworkScope {
    const row: NetworkScope = {
      ...input,
      id: input.id || randomUUID(),
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.scopes.push(row);
    this.audit(row.organizationId, 'scope_created', { entityType: 'network_scope', entityId: row.id });
    return row;
  }

  approveScope(id: string, approvedBy: string): NetworkScope {
    const s = this.scopes.find((x) => x.id === id);
    if (!s) throw new Error('Scope not found');
    s.authorizationStatus = 'APPROVED';
    s.approvedBy = approvedBy;
    s.approvedAt = this.now();
    s.updatedAt = this.now();
    this.audit(s.organizationId, 'scope_approved', { entityType: 'network_scope', entityId: id, actorId: approvedBy });
    return s;
  }

  createJob(input: Partial<DiscoveryJob> & { organizationId: string; name: string }): DiscoveryJob {
    const row: DiscoveryJob = {
      id: input.id || randomUUID(),
      organizationId: input.organizationId,
      environmentId: (input.environmentId || 'LAB') as DiscoveryEnvironment,
      name: input.name,
      description: input.description,
      status: (input.status || 'DRAFT') as DiscoveryJobStatus,
      discoveryMode: (input.discoveryMode || 'ACTIVE') as DiscoveryMode,
      networkRanges: input.networkRanges || [],
      excludedRanges: input.excludedRanges || [],
      schedule: input.schedule || 'ON_DEMAND',
      scheduleCron: input.scheduleCron,
      maxConcurrency: input.maxConcurrency ?? 32,
      maxHosts: input.maxHosts ?? 1024,
      timeoutMs: input.timeoutMs ?? 3000,
      hostTimeoutMs: input.hostTimeoutMs ?? 2000,
      jobTimeoutMs: input.jobTimeoutMs ?? 3600000,
      rateLimitPerSec: input.rateLimitPerSec ?? 50,
      credentialReferenceId: input.credentialReferenceId,
      tcpPorts: input.tcpPorts || [22, 80, 443, 3389, 5985, 161],
      enableIcmp: input.enableIcmp ?? true,
      enableTcp: input.enableTcp ?? true,
      enableSnmp: input.enableSnmp ?? false,
      enableCredentialed: input.enableCredentialed ?? false,
      createdBy: input.createdBy,
      createdAt: this.now(),
      updatedAt: this.now(),
      progress: {},
      metrics: {},
    };
    this.jobs.push(row);
    this.audit(row.organizationId, 'discovery_job_created', { entityType: 'discovery_job', entityId: row.id });
    return row;
  }

  updateJob(id: string, patch: Partial<DiscoveryJob>): DiscoveryJob {
    const j = this.jobs.find((x) => x.id === id);
    if (!j) throw new Error('Job not found');
    Object.assign(j, patch, { updatedAt: this.now() });
    return j;
  }

  getJob(id: string) {
    return this.jobs.find((j) => j.id === id) || null;
  }

  upsertAsset(asset: StoredAsset): StoredAsset {
    const idx = this.assets.findIndex((a) => a.id === asset.id);
    if (idx >= 0) {
      this.assets[idx] = { ...this.assets[idx], ...asset };
      return this.assets[idx];
    }
    this.assets.push(asset);
    return asset;
  }

  findAssets(organizationId: string) {
    return this.assets.filter((a) => a.organizationId === organizationId);
  }

  upsertSoftware(rows: StoredSoftware[]) {
    for (const row of rows) {
      const existing = this.software.find(
        (s) => s.assetId === row.assetId && s.softwareName === row.softwareName && s.version === row.version,
      );
      if (existing) {
        existing.lastSeenAt = row.lastSeenAt;
        existing.source = row.source;
      } else {
        this.software.push(row);
      }
    }
  }
}

let singleton: DiscoveryStore | null = null;
let persistenceMode: 'memory' | 'postgres' = 'memory';

export function getDiscoveryPersistenceMode(): 'memory' | 'postgres' {
  return persistenceMode;
}

export function getDiscoveryStore(): DiscoveryStore {
  if (!singleton) singleton = new DiscoveryStore();
  return singleton;
}

export function resetDiscoveryStore(): DiscoveryStore {
  singleton = new DiscoveryStore();
  persistenceMode = 'memory';
  return singleton;
}

/**
 * Boot production/lab store.
 * - memory: unit tests only
 * - postgres: hydrate from ITAM_DISCOVERY_DATABASE_URL (required in production)
 */
export async function initDiscoveryStore(opts?: {
  mode?: 'memory' | 'postgres';
  applySchema?: boolean;
}): Promise<DiscoveryStore> {
  const {
    isPostgresPersistenceRequired,
    getItamDiscoveryDatabaseUrl,
    applyDiscoverySchema,
    hydrateDiscoveryStore,
  } = await import('./pg-persistence');

  const mode =
    opts?.mode
    || (process.env.ITAM_DISCOVERY_PERSISTENCE as 'memory' | 'postgres' | undefined)
    || (isPostgresPersistenceRequired() ? 'postgres' : 'memory');

  if (mode === 'postgres') {
    if (!getItamDiscoveryDatabaseUrl()) {
      throw new Error(
        'Production discovery persistence requires ITAM_DISCOVERY_DATABASE_URL (in-memory store forbidden)',
      );
    }
    if (opts?.applySchema !== false) {
      await applyDiscoverySchema();
    }
    const store = resetDiscoveryStore();
    persistenceMode = 'postgres';
    await hydrateDiscoveryStore(store);
    return store;
  }

  persistenceMode = 'memory';
  if (process.env.NODE_ENV === 'production' && process.env.ITAM_ALLOW_MEMORY_STORE !== '1') {
    throw new Error('In-memory DiscoveryStore is forbidden in production');
  }
  return resetDiscoveryStore();
}

export async function flushDiscoveryStoreDurable(store?: DiscoveryStore): Promise<void> {
  if (persistenceMode !== 'postgres') return;
  const { flushDiscoveryStore } = await import('./pg-persistence');
  await flushDiscoveryStore(store || getDiscoveryStore());
}
