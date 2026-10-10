/**
 * VisStore — in-memory working set with durable backends.
 *
 * Production (default when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set):
 *   Supabase (`vis_documents` / `vis_secret_blobs`) is the system of record.
 *   Memory is a write-through cache. Call hydrateFromDurable() at boot;
 *   await flushDurable() after critical ops.
 *
 * Tests / local without DB:
 *   VIS_STORE_MEMORY=1 or VIS_PERSISTENCE=file|memory — file or memory only.
 *   Never silently falls back to file/memory in production.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { isVisSupabasePersistenceEnabled } from './vis-supabase-client';

export type VisRecord = Record<string, unknown> & { id: string };

export interface VisStoreData {
  connections: VisRecord[];
  credentials: VisRecord[];
  integrations: VisRecord[];
  versions: VisRecord[];
  schemaCache: VisRecord[];
  executions: VisRecord[];
  logs: VisRecord[];
  audits: VisRecord[];
  deadLetters: VisRecord[];
  events: VisRecord[];
  eventEndpoints: VisRecord[];
  eventSubscriptions: VisRecord[];
  eventDeadLetters: VisRecord[];
  eventCheckpoints: VisRecord[];
  mockForms: VisRecord[];
  mockRecords: VisRecord[];
  codegenArtifacts: VisRecord[];
  promotions: VisRecord[];
  changeHistory: VisRecord[];
  approvals: VisRecord[];
  metrics: VisRecord[];
  traces: VisRecord[];
  alerts: VisRecord[];
  reconciliationReports: VisRecord[];
  repairReports: VisRecord[];
  driftFindings: VisRecord[];
  impactAnalyses: VisRecord[];
  connectors: VisRecord[];
  connectorInstalls: VisRecord[];
  connectorUpgrades: VisRecord[];
  aiRecommendations: VisRecord[];
  generatedTests: VisRecord[];
  generatedDocs: VisRecord[];
  healingActions: VisRecord[];
}

const EMPTY: VisStoreData = {
  connections: [],
  credentials: [],
  integrations: [],
  versions: [],
  schemaCache: [],
  executions: [],
  logs: [],
  audits: [],
  deadLetters: [],
  events: [],
  eventEndpoints: [],
  eventSubscriptions: [],
  eventDeadLetters: [],
  eventCheckpoints: [],
  mockForms: [],
  mockRecords: [],
  codegenArtifacts: [],
  promotions: [],
  changeHistory: [],
  approvals: [],
  metrics: [],
  traces: [],
  alerts: [],
  reconciliationReports: [],
  repairReports: [],
  driftFindings: [],
  impactAnalyses: [],
  connectors: [],
  connectorInstalls: [],
  connectorUpgrades: [],
  aiRecommendations: [],
  generatedTests: [],
  generatedDocs: [],
  healingActions: [],
};

function defaultPath(): string {
  const fromRoot = resolve(process.cwd(), 'backend/.vis-data/store.json');
  const local = resolve(process.cwd(), '.vis-data/store.json');
  if (existsSync(resolve(process.cwd(), 'backend/package.json'))) return fromRoot;
  return local;
}

function useDurableSupabase(): boolean {
  if (process.env.VIS_PERSISTENCE === 'file' || process.env.VIS_PERSISTENCE === 'memory') {
    if (process.env.NODE_ENV === 'production' && process.env.VIS_ALLOW_FILE_STORE !== '1') {
      throw new Error(
        'File/memory VisStore is forbidden in production. '
          + 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (and optionally VIS_PERSISTENCE=supabase).',
      );
    }
    return false;
  }
  if (process.env.VIS_STORE_MEMORY === '1' && process.env.VIS_PERSISTENCE !== 'supabase' && process.env.VIS_PERSISTENCE !== 'prisma') {
    if (process.env.NODE_ENV === 'production' && process.env.VIS_ALLOW_FILE_STORE !== '1') {
      throw new Error('VIS_STORE_MEMORY is forbidden in production without VIS_ALLOW_FILE_STORE=1');
    }
    return false;
  }
  if (isVisSupabasePersistenceEnabled()) return true;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production for VIS persistence. '
        + 'VIS no longer requires VIS_DATABASE_URL / Prisma.',
    );
  }
  return false;
}

export class VisStore {
  private data: VisStoreData;
  private readonly filePath: string;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistDeferred = false;
  private readonly durableMode: boolean;
  private pending: Promise<unknown>[] = [];
  private durableStore: import('./supabase-vis.store').SupabaseVisStore | null = null;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(filePath?: string) {
    this.filePath = filePath || process.env.VIS_STORE_PATH || defaultPath();
    this.durableMode = useDurableSupabase();
    if (this.durableMode) {
      this.data = structuredClone(EMPTY);
      // Lazy import so memory/file tests do not load Supabase client
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SupabaseVisStore } = require('./supabase-vis.store') as typeof import('./supabase-vis.store');
      this.durableStore = new SupabaseVisStore();
    } else {
      this.data = this.load();
      this.ensureMockSeed();
    }
  }

  /** @deprecated Prefer isDurableBacked — kept for existing readiness reports. */
  get isPrismaBacked() {
    return this.durableMode;
  }

  get isDurableBacked() {
    return this.durableMode;
  }

  /** Load SoR from Supabase into memory cache (required at boot in durable mode). */
  async hydrateFromDurable(): Promise<void> {
    if (!this.durableStore) return;
    await this.durableStore.ready();
    await this.durableStore.hydrate();
    const snap = this.durableStore.snapshot();
    this.data = { ...structuredClone(EMPTY), ...snap };
    if (!this.data.mockForms.length) this.ensureMockSeed();
  }

  /** @deprecated Alias for hydrateFromDurable (Prisma removed). */
  async hydrateFromPrisma(): Promise<void> {
    return this.hydrateFromDurable();
  }

  /** Await all pending durable writes. */
  async flushDurable(): Promise<void> {
    const batch = [...this.pending];
    this.pending = [];
    await Promise.all(batch);
  }

  /** Multi-step sequence against durable store (best-effort; PostgREST has no multi-table TX). */
  async transaction<T>(fn: (tx: {
    create: typeof VisStore.prototype.create;
    update: typeof VisStore.prototype.update;
    get: typeof VisStore.prototype.get;
  }) => Promise<T>): Promise<T> {
    if (!this.durableStore) {
      return fn({
        create: this.create.bind(this),
        update: this.update.bind(this),
        get: this.get.bind(this),
      });
    }
    await this.flushDurable();
    return this.durableStore.transaction(async (tx) => {
      const api = {
        create: (collection: keyof VisStoreData, record: Omit<VisRecord, 'id'> & { id?: string }) => {
          const row: VisRecord = { id: record.id || randomUUID(), ...record };
          (this.data[collection] as VisRecord[]).push(row);
          void tx.create(collection, row);
          return row;
        },
        update: (collection: keyof VisStoreData, id: string, patch: Record<string, unknown>) => {
          const list = this.data[collection] as VisRecord[];
          const idx = list.findIndex((r) => r.id === id);
          if (idx < 0) return null;
          list[idx] = { ...list[idx], ...patch, id };
          void tx.update(collection, id, patch);
          return list[idx];
        },
        get: (collection: keyof VisStoreData, id: string) => {
          return (this.data[collection] as VisRecord[]).find((r) => r.id === id) || null;
        },
      };
      return fn(api as any);
    });
  }

  private load(): VisStoreData {
    try {
      if (process.env.VIS_STORE_MEMORY === '1') return structuredClone(EMPTY);
      if (existsSync(this.filePath)) {
        return { ...EMPTY, ...JSON.parse(readFileSync(this.filePath, 'utf8')) };
      }
    } catch {
      /* fresh */
    }
    return structuredClone(EMPTY);
  }

  persist(): void {
    if (this.durableMode) return;
    if (process.env.VIS_STORE_MEMORY === '1') return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistDeferred = false;
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  private schedulePersist(): void {
    if (this.durableMode) return;
    if (process.env.VIS_STORE_MEMORY === '1') return;
    this.persistDeferred = true;
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      if (this.persistDeferred) this.persistFast();
    }, 500);
    if (typeof this.persistTimer === 'object' && 'unref' in this.persistTimer) {
      (this.persistTimer as NodeJS.Timeout).unref?.();
    }
  }

  persistFast(): void {
    if (this.durableMode) return;
    if (process.env.VIS_STORE_MEMORY === '1') return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistDeferred = false;
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data), 'utf8');
  }

  snapshot(): VisStoreData {
    return this.data;
  }

  create<K extends keyof VisStoreData>(collection: K, record: Omit<VisRecord, 'id'> & { id?: string }): VisRecord {
    const row: VisRecord = { id: record.id || randomUUID(), ...record };
    (this.data[collection] as VisRecord[]).push(row);
    if (this.durableMode && this.durableStore) {
      const store = this.durableStore;
      const op = () => store.createAsync(collection, row);
      this.writeChain = this.writeChain.then(op, op);
      this.pending.push(this.writeChain);
    } else if (
      collection === 'logs'
      || collection === 'mockRecords'
      || collection === 'deadLetters'
      || collection === 'executions'
      || collection === 'events'
      || collection === 'eventDeadLetters'
      || collection === 'metrics'
      || collection === 'traces'
      || collection === 'healingActions'
    ) {
      this.schedulePersist();
    } else {
      this.persist();
    }
    return row;
  }

  update<K extends keyof VisStoreData>(collection: K, id: string, patch: Record<string, unknown>): VisRecord | null {
    const list = this.data[collection] as VisRecord[];
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, id };
    if (this.durableMode && this.durableStore) {
      const store = this.durableStore;
      const op = () => store.updateAsync(collection, id, patch);
      this.writeChain = this.writeChain.then(op, op);
      this.pending.push(this.writeChain);
    } else if (
      collection === 'logs'
      || collection === 'mockRecords'
      || collection === 'deadLetters'
      || collection === 'executions'
      || collection === 'events'
      || collection === 'eventDeadLetters'
      || collection === 'metrics'
      || collection === 'traces'
      || collection === 'healingActions'
    ) {
      this.schedulePersist();
    } else {
      this.persist();
    }
    return list[idx];
  }

  get<K extends keyof VisStoreData>(collection: K, id: string): VisRecord | null {
    return (this.data[collection] as VisRecord[]).find((r) => r.id === id) || null;
  }

  list<K extends keyof VisStoreData>(collection: K): VisRecord[] {
    return [...(this.data[collection] as VisRecord[])];
  }

  remove<K extends keyof VisStoreData>(collection: K, id: string): boolean {
    const list = this.data[collection] as VisRecord[];
    const next = list.filter((r) => r.id !== id);
    if (next.length === list.length) return false;
    (this.data as any)[collection] = next;
    if (this.durableMode && this.durableStore) {
      this.pending.push(this.durableStore.removeAsync(collection, id).catch(() => undefined));
    } else {
      this.persist();
    }
    return true;
  }

  private ensureMockSeed(): void {
    if (this.data.mockForms.length) return;
    this.data.mockForms.push({
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
    });
    this.data.mockForms.push({
      id: 'form-security-incident',
      name: 'Security Incident',
      description: 'Mock Security Incident form',
      fields: [
        { name: 'incident_id', label: 'Incident ID', type: 'text', required: true, unique: true },
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'severity', label: 'Severity', type: 'select', required: true },
      ],
    });
    if (!this.durableMode) this.persist();
  }
}

let singleton: VisStore | null = null;
export function getVisStore(): VisStore {
  if (!singleton) singleton = new VisStore();
  return singleton;
}

export function resetVisStoreForTests(filePath?: string): VisStore {
  singleton = new VisStore(filePath || process.env.VIS_STORE_PATH);
  return singleton;
}

/** Reset singleton into durable Supabase mode and hydrate (tests / boot helpers). */
export async function resetVisStoreDurableForTests(): Promise<VisStore> {
  process.env.VIS_PERSISTENCE = 'supabase';
  singleton = new VisStore();
  await singleton.hydrateFromDurable();
  return singleton;
}

/** @deprecated Use resetVisStoreDurableForTests */
export async function resetVisStorePrismaForTests(): Promise<VisStore> {
  return resetVisStoreDurableForTests();
}
