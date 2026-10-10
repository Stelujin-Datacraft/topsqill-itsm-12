/**
 * VisStore — in-memory working set with a durable Supabase backend.
 *
 * Production (NODE_ENV=production or VIS_PERSISTENCE=supabase):
 *   The existing Supabase project is the system of record. Memory is a write-through cache.
 *   Call hydrate() at boot; await flushDurable() after critical ops.
 *   Missing schema does not fall back to file storage.
 *
 * Tests / local without Supabase:
 *   VIS_STORE_MEMORY=1 or VIS_PERSISTENCE=file|memory — file or memory only.
 *   VIS_DATABASE_URL is not used.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { visPersistenceMode } from './vis-persistence-mode';
import { SupabaseVisStore, type VisTxOp } from './supabase-vis.store';

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

function useSupabase(): boolean {
  return visPersistenceMode() === 'supabase';
}

export class VisStore {
  private data: VisStoreData;
  private readonly filePath: string;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistDeferred = false;
  private readonly supabaseMode: boolean;
  private pending: Promise<unknown>[] = [];
  private supabaseStore: SupabaseVisStore | null = null;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(filePath?: string) {
    this.filePath = filePath || process.env.VIS_STORE_PATH || defaultPath();
    this.supabaseMode = useSupabase();
    if (this.supabaseMode) {
      this.data = structuredClone(EMPTY);
      this.supabaseStore = new SupabaseVisStore();
    } else {
      this.data = this.load();
      this.ensureMockSeed();
    }
  }

  get isSupabaseBacked() {
    return this.supabaseMode;
  }

  /** @deprecated Prisma has been removed. True when Supabase persistence is active. */
  get isPrismaBacked() {
    return this.supabaseMode;
  }

  /** Load the system of record from Supabase into the memory cache. */
  async hydrate(): Promise<void> {
    if (!this.supabaseStore) return;
    await this.supabaseStore.hydrate();
    const snap = this.supabaseStore.snapshot();
    this.data = { ...structuredClone(EMPTY), ...snap };
    if (!this.data.mockForms.length) this.ensureMockSeed();
  }

  /** @deprecated Use hydrate(). */
  async hydrateFromPrisma(): Promise<void> {
    await this.hydrate();
  }

  /** Await all pending durable writes. */
  async flushDurable(): Promise<void> {
    const batch = [...this.pending];
    this.pending = [];
    await Promise.all(batch);
  }

  /** Multi-step transaction against Supabase (durable mode). File mode is sequential. */
  async transaction<T>(fn: (tx: {
    create: typeof VisStore.prototype.create;
    update: typeof VisStore.prototype.update;
    get: typeof VisStore.prototype.get;
  }) => Promise<T>): Promise<T> {
    if (!this.supabaseStore) {
      return fn({
        create: this.create.bind(this),
        update: this.update.bind(this),
        get: this.get.bind(this),
      });
    }
    await this.flushDurable();
    const snapshot = structuredClone(this.data);
    const ops: VisTxOp[] = [];
    const api = {
      create: (collection: keyof VisStoreData, record: Omit<VisRecord, 'id'> & { id?: string }) => {
        const row: VisRecord = { id: record.id || randomUUID(), ...record };
        (this.data[collection] as VisRecord[]).push(row);
        ops.push({ op: 'upsert', collection, row });
        return row;
      },
      update: (collection: keyof VisStoreData, id: string, patch: Record<string, unknown>) => {
        const list = this.data[collection] as VisRecord[];
        const idx = list.findIndex((r) => r.id === id);
        if (idx < 0) return null;
        list[idx] = { ...list[idx], ...patch, id };
        ops.push({ op: 'upsert', collection, row: list[idx] });
        return list[idx];
      },
      get: (collection: keyof VisStoreData, id: string) => {
        return (this.data[collection] as VisRecord[]).find((r) => r.id === id) || null;
      },
    };
    try {
      const result = await fn(api as any);
      await this.supabaseStore.applyTransaction(ops);
      return result;
    } catch (error) {
      this.data = snapshot;
      throw error;
    }
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
    if (this.supabaseMode) return;
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
    if (this.supabaseMode) return;
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
    if (this.supabaseMode) return;
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
    if (this.supabaseMode && this.supabaseStore) {
      const store = this.supabaseStore;
      const op = () => store.createAsync(collection, row).catch((err) => {
        console.error(`[VisStore] durable create failed for ${String(collection)}:`, err instanceof Error ? err.message : err);
        const list = this.data[collection] as VisRecord[];
        (this.data as any)[collection] = list.filter((item) => item.id !== row.id);
        throw err;
      });
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
    const previous = list[idx];
    list[idx] = { ...list[idx], ...patch, id };
    if (this.supabaseMode && this.supabaseStore) {
      const store = this.supabaseStore;
      const op = () => store.updateAsync(collection, id, patch).catch((err) => {
        console.error(`[VisStore] durable update failed for ${String(collection)}:`, err instanceof Error ? err.message : err);
        const current = this.data[collection] as VisRecord[];
        const currentIndex = current.findIndex((item) => item.id === id);
        if (currentIndex >= 0) current[currentIndex] = previous;
        throw err;
      });
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
    const removed = list.find((r) => r.id === id);
    const next = list.filter((r) => r.id !== id);
    if (!removed || next.length === list.length) return false;
    (this.data as any)[collection] = next;
    if (this.supabaseMode && this.supabaseStore) {
      const store = this.supabaseStore;
      const op = () => store.removeAsync(collection, id).catch((err) => {
        console.error(`[VisStore] durable delete failed for ${String(collection)}:`, err instanceof Error ? err.message : err);
        (this.data[collection] as VisRecord[]).push(removed);
        throw err;
      });
      this.writeChain = this.writeChain.then(op, op);
      this.pending.push(this.writeChain);
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
    if (!this.supabaseMode) this.persist();
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

export function clearVisStoreForTests(): void {
  singleton = null;
}

export async function resetVisStoreSupabaseForTests(): Promise<VisStore> {
  process.env.VIS_PERSISTENCE = 'supabase';
  delete process.env.VIS_STORE_MEMORY;
  singleton = new VisStore();
  await singleton.hydrate();
  return singleton;
}

/** @deprecated Use resetVisStoreSupabaseForTests(). */
export const resetVisStorePrismaForTests = resetVisStoreSupabaseForTests;
