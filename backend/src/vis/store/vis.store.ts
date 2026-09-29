/**
 * File-backed in-memory store for Phase 1.
 * Prisma schema is the long-term contract; this store enables MVP without DB migrate.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { randomUUID } from 'crypto';

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
  /** Mock internal app forms/records (demo only) */
  mockForms: VisRecord[];
  mockRecords: VisRecord[];
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
  mockForms: [],
  mockRecords: [],
};

function defaultPath(): string {
  // Prefer cwd/backend/.vis-data when started from repo root; else cwd/.vis-data
  const fromRoot = resolve(process.cwd(), 'backend/.vis-data/store.json');
  const local = resolve(process.cwd(), '.vis-data/store.json');
  if (existsSync(resolve(process.cwd(), 'backend/package.json'))) return fromRoot;
  return local;
}

export class VisStore {
  private data: VisStoreData;
  private readonly filePath: string;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistDeferred = false;

  constructor(filePath?: string) {
    this.filePath = filePath || process.env.VIS_STORE_PATH || defaultPath();
    this.data = this.load();
    this.ensureMockSeed();
  }

  private load(): VisStoreData {
    try {
      if (existsSync(this.filePath)) {
        return { ...EMPTY, ...JSON.parse(readFileSync(this.filePath, 'utf8')) };
      }
    } catch {
      /* fresh */
    }
    return structuredClone(EMPTY);
  }

  /** Immediate flush to disk. */
  persist(): void {
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

  /** Coalesce high-frequency writes (execution workers) into one flush. */
  private schedulePersist(): void {
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

  /** Persist without pretty-print for speed during large executions. */
  persistFast(): void {
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
    // Hot paths (logs, mockRecords, deadLetters) debounce; others flush immediately
    if (collection === 'logs' || collection === 'mockRecords' || collection === 'deadLetters' || collection === 'executions') {
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
    if (collection === 'logs' || collection === 'mockRecords' || collection === 'deadLetters' || collection === 'executions') {
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
    this.persist();
    return true;
  }

  private ensureMockSeed(): void {
    if (this.data.mockForms.length) return;
    const vulnFormId = 'form-vulnerability';
    this.data.mockForms.push({
      id: vulnFormId,
      name: 'Vulnerability',
      description: 'Internal Vulnerability tracking form (mock external app)',
      fields: [
        { name: 'vulnerability_id', label: 'Vulnerability ID', type: 'text', required: true, unique: true },
        { name: 'priority', label: 'Priority', type: 'select', required: true, choices: [
          { value: '1', label: '1 - Critical' },
          { value: '2', label: '2 - High' },
          { value: '3', label: '3 - Medium' },
          { value: '4', label: '4 - Low' },
        ]},
        { name: 'description', label: 'Description', type: 'textarea', required: true },
        { name: 'assignment_group', label: 'Assignment Group', type: 'reference', required: false },
        { name: 'status', label: 'Status', type: 'select', required: true, choices: [
          { value: 'Open', label: 'Open' },
          { value: 'In Progress', label: 'In Progress' },
          { value: 'Closed', label: 'Closed' },
        ]},
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
    // Demo source vulnerabilities live in mocks service, not here.
    this.persist();
  }
}

let singleton: VisStore | null = null;
export function getVisStore(): VisStore {
  if (!singleton) singleton = new VisStore();
  return singleton;
}

/** Test helper — reset persistence singleton. */
export function resetVisStoreForTests(filePath?: string): VisStore {
  singleton = new VisStore(filePath || process.env.VIS_STORE_PATH);
  return singleton;
}
