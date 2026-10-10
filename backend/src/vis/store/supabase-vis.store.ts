/**
 * Supabase-backed VIS system of record.
 * Same collection contract as the previous Prisma store: typed tables for
 * domain records, vis_documents for mock forms/records, and vis_apply_transaction
 * for multi-row writes.
 */
import { randomUUID } from 'crypto';
import { getVisSupabase, type VisSupabaseClient, type VisSupabaseQuery } from './supabase-vis.client';
import {
  collectionSpec,
  isDocumentCollection,
  toColumn,
  toField,
  VIS_COLLECTIONS,
  type VisCollection,
  type VisCollectionSpec,
} from './vis-schema';
import type { VisRecord, VisStoreData } from './vis.store';

export const VIS_SCHEMA_MIGRATION = 'supabase/migrations/20261010120000_vis_supabase_persistence.sql';

export class VisPersistenceError extends Error {
  readonly operation: string;
  readonly details?: unknown;

  constructor(message: string, operation: string, details?: unknown) {
    super(message);
    this.name = 'VisPersistenceError';
    this.operation = operation;
    this.details = details;
  }
}

export interface VisListQuery {
  filters?: Record<string, string | number | boolean | null>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export interface VisTxOp {
  op: 'upsert' | 'delete';
  collection: VisCollection;
  row?: VisRecord;
  id?: string;
}

function fail(operation: string, error: { message?: string; code?: string } | null): void {
  if (!error) return;
  const code = error.code ? ` (${error.code})` : '';
  throw new VisPersistenceError(
    `VIS Supabase ${operation} failed: ${error.message || 'unknown error'}${code}. `
    + `Schema: ${VIS_SCHEMA_MIGRATION}. In-memory fallback is disabled.`,
    operation,
    error,
  );
}

function asIso(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeRecord(collection: VisCollection, record: VisRecord): VisRecord {
  const row: VisRecord = { ...record, id: record.id || randomUUID() };
  if (collection === 'events' && !row.eventId) row.eventId = row.id;
  if (collection === 'credentials' && !row.secretHandle) row.secretHandle = `ref-${row.id}`;
  if (collection === 'credentials' && !row.type) row.type = 'GENERIC';
  if (collection === 'connections' && !row.authType) row.authType = 'NONE';
  if (collection === 'connections' && !row.kind) row.kind = 'REST';
  return row;
}

export function recordToRow(collection: VisCollection, record: VisRecord): Record<string, unknown> {
  const spec = collectionSpec(collection);
  if (!spec) return { ...record };
  const allowed = new Set(spec.columns);
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    const column = toColumn(key);
    if (!allowed.has(column)) continue;
    row[column] = asIso(value);
  }
  if (!row.id) row.id = record.id;
  return row;
}

export function rowToRecord(row: Record<string, unknown> | null): VisRecord | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    out[toField(column)] = asIso(value);
  }
  return out as VisRecord;
}

function applyFilters(query: VisSupabaseQuery, spec: VisCollectionSpec, filters: Record<string, string | number | boolean | null>) {
  let next = query;
  for (const [field, value] of Object.entries(filters)) {
    const column = spec.columns.includes(field) ? field : toColumn(field);
    if (!spec.columns.includes(column)) {
      throw new VisPersistenceError(`Unknown filter "${field}" on ${spec.table}`, 'list');
    }
    next = value === null ? next.is(column, null) : next.eq(column, value);
  }
  return next;
}

export class SupabaseVisStore {
  private readonly client: VisSupabaseClient;
  private cache = new Map<string, Map<string, VisRecord>>();

  constructor(client?: VisSupabaseClient) {
    this.client = client || getVisSupabase();
  }

  async ready(): Promise<void> {
    const { error } = await this.client.from('vis_integrations').select('id').limit(1);
    if (error) {
      throw new VisPersistenceError(
        `VIS Supabase persistence is unavailable (${error.message || 'unknown error'}). `
        + `Apply ${VIS_SCHEMA_MIGRATION}. Refusing to fall back to in-memory storage.`,
        'ready',
        error,
      );
    }
  }

  async hydrate(): Promise<void> {
    await this.ready();
    const keys = [...Object.keys(VIS_COLLECTIONS), ...['mockForms', 'mockRecords']] as VisCollection[];
    for (const key of keys) {
      await this.listAsync(key);
    }
    await this.ensureMockSeed();
  }

  async createAsync(collection: VisCollection, record: VisRecord): Promise<VisRecord> {
    const row = normalizeRecord(collection, record);
    if (isDocumentCollection(collection)) {
      const now = new Date().toISOString();
      const { error } = await this.client.from('vis_documents').insert({
        id: row.id,
        collection,
        payload: row,
        created_at: now,
        updated_at: now,
      }).select('id').single();
      fail(`insert vis_documents/${collection}`, error);
      this.cacheSet(collection, row);
      return row;
    }
    const spec = collectionSpec(collection)!;
    const { error } = await this.client.from(spec.table).insert(recordToRow(collection, row)).select('id').single();
    fail(`insert ${spec.table}`, error);
    this.cacheSet(collection, row);
    return row;
  }

  async updateAsync(collection: VisCollection, id: string, patch: Record<string, unknown>): Promise<VisRecord | null> {
    if (isDocumentCollection(collection)) {
      const { data, error } = await this.client
        .from('vis_documents')
        .select('*')
        .eq('id', id)
        .eq('collection', collection)
        .is('deleted_at', null)
        .maybeSingle();
      fail(`read vis_documents/${collection}`, error);
      if (!data) return null;
      const payload = { ...((data.payload || {}) as Record<string, unknown>), ...patch, id };
      const { error: updateError } = await this.client
        .from('vis_documents')
        .update({ payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('collection', collection)
        .select('id')
        .maybeSingle();
      fail(`update vis_documents/${collection}`, updateError);
      const record = payload as VisRecord;
      this.cacheSet(collection, record);
      return record;
    }
    const spec = collectionSpec(collection)!;
    const existing = await this.getAsync(collection, id);
    if (!existing) return null;
    const merged = normalizeRecord(collection, { ...existing, ...patch, id });
    const { data, error } = await this.client
      .from(spec.table)
      .update(recordToRow(collection, merged))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    fail(`update ${spec.table}`, error);
    const record = rowToRecord(data) || merged;
    this.cacheSet(collection, record);
    return record;
  }

  async getAsync(collection: VisCollection, id: string): Promise<VisRecord | null> {
    if (isDocumentCollection(collection)) {
      const { data, error } = await this.client
        .from('vis_documents')
        .select('*')
        .eq('id', id)
        .eq('collection', collection)
        .is('deleted_at', null)
        .maybeSingle();
      fail(`read vis_documents/${collection}`, error);
      if (!data) return null;
      const payload = { ...((data.payload || {}) as Record<string, unknown>), id: (data.payload as any)?.id || data.id };
      const record = payload as VisRecord;
      this.cacheSet(collection, record);
      return record;
    }
    const spec = collectionSpec(collection)!;
    const { data, error } = await this.client.from(spec.table).select('*').eq('id', id).maybeSingle();
    fail(`read ${spec.table}`, error);
    const record = rowToRecord(data);
    if (record) this.cacheSet(collection, record);
    return record;
  }

  async listAsync(collection: VisCollection, query?: VisListQuery): Promise<VisRecord[]> {
    const records = isDocumentCollection(collection)
      ? await this.listDocuments(collection, query)
      : await this.listTyped(collectionSpec(collection)!, query);
    if (!query) this.cacheReplace(collection, records);
    return records;
  }

  async removeAsync(collection: VisCollection, id: string): Promise<boolean> {
    if (isDocumentCollection(collection)) {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('vis_documents')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', id)
        .eq('collection', collection)
        .is('deleted_at', null)
        .select('id');
      fail(`delete vis_documents/${collection}`, error);
      const removed = Array.isArray(data) && data.length > 0;
      if (removed) this.cacheDelete(collection, id);
      return removed;
    }
    const spec = collectionSpec(collection)!;
    const { data, error } = await this.client.from(spec.table).delete().eq('id', id).select('id');
    fail(`delete ${spec.table}`, error);
    const removed = Array.isArray(data) && data.length > 0;
    if (removed) this.cacheDelete(collection, id);
    return removed;
  }

  /**
   * Apply buffered writes in one database transaction via vis_apply_transaction.
   * The SQL function commits all ops or none.
   */
  async applyTransaction(ops: VisTxOp[]): Promise<void> {
    if (!ops.length) return;
    const payload = ops.map((op) => this.toRpcOp(op));
    const { error } = await this.client.rpc('vis_apply_transaction', { ops: payload });
    fail('transaction', error);
    for (const op of ops) {
      if (op.op === 'delete' && op.id) this.cacheDelete(op.collection, op.id);
      else if (op.row) this.cacheSet(op.collection, op.row);
    }
  }

  snapshot(): VisStoreData {
    const empty = {} as VisStoreData;
    const keys = [...Object.keys(VIS_COLLECTIONS), ...['mockForms', 'mockRecords']] as VisCollection[];
    for (const key of keys) {
      (empty as any)[key] = this.cacheList(key);
    }
    return empty;
  }

  private toRpcOp(op: VisTxOp): Record<string, unknown> {
    if (op.op === 'delete') {
      return {
        op: 'delete',
        table: isDocumentCollection(op.collection) ? 'vis_documents' : collectionSpec(op.collection)!.table,
        collection: op.collection,
        id: op.id,
      };
    }
    const row = normalizeRecord(op.collection, op.row as VisRecord);
    if (isDocumentCollection(op.collection)) {
      const now = new Date().toISOString();
      return {
        op: 'upsert',
        table: 'vis_documents',
        collection: op.collection,
        id: row.id,
        row: {
          id: row.id,
          collection: op.collection,
          payload: row,
          updated_at: now,
        },
      };
    }
    return {
      op: 'upsert',
      table: collectionSpec(op.collection)!.table,
      id: row.id,
      row: recordToRow(op.collection, row),
    };
  }

  private async listTyped(spec: VisCollectionSpec, query?: VisListQuery): Promise<VisRecord[]> {
    let request = this.client.from(spec.table).select('*');
    if (query?.filters) request = applyFilters(request, spec, query.filters);
    const orderField = query?.orderBy?.column || spec.orderBy;
    const orderColumn = spec.columns.includes(orderField) ? orderField : toColumn(orderField);
    if (!spec.columns.includes(orderColumn)) {
      throw new VisPersistenceError(`Unknown sort column "${orderField}" on ${spec.table}`, 'list');
    }
    const ascending = query?.orderBy ? query.orderBy.ascending !== false : true;
    request = request.order(orderColumn, { ascending });
    if (query?.limit != null || query?.offset != null) {
      const from = query.offset ?? 0;
      const limit = query.limit ?? 1000;
      request = request.range(from, from + Math.max(limit, 1) - 1);
    }
    const { data, error } = await request;
    fail(`list ${spec.table}`, error);
    return ((data || []) as Record<string, unknown>[]).map((row) => rowToRecord(row)!).filter(Boolean);
  }

  private async listDocuments(collection: VisCollection, query?: VisListQuery): Promise<VisRecord[]> {
    let request = this.client
      .from('vis_documents')
      .select('*')
      .eq('collection', collection)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    const { data, error } = await request;
    fail(`list vis_documents/${collection}`, error);
    let records = ((data || []) as Array<Record<string, unknown>>).map((row) => {
      const payload = { ...((row.payload || {}) as Record<string, unknown>) };
      payload.id = payload.id || row.id;
      return payload as VisRecord;
    });
    if (query?.filters) {
      records = records.filter((record) => Object.entries(query.filters || {}).every(([key, value]) => record[key] === value));
    }
    if (query?.orderBy) {
      const column = query.orderBy.column;
      const direction = query.orderBy.ascending === false ? -1 : 1;
      records = [...records].sort((left, right) => {
        const a = left[column];
        const b = right[column];
        if (a === b) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return (a < b ? -1 : 1) * direction;
      });
    }
    if (query?.limit != null || query?.offset != null) {
      const from = query.offset ?? 0;
      const to = query.limit != null ? from + query.limit : undefined;
      records = records.slice(from, to);
    }
    return records;
  }

  private async ensureMockSeed(): Promise<void> {
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

  private bucket(collection: string) {
    if (!this.cache.has(collection)) this.cache.set(collection, new Map());
    return this.cache.get(collection)!;
  }

  private cacheSet(collection: string, row: VisRecord) {
    this.bucket(collection).set(row.id, row);
  }

  private cacheList(collection: string) {
    return [...this.bucket(collection).values()];
  }

  private cacheReplace(collection: string, rows: VisRecord[]) {
    const bucket = new Map<string, VisRecord>();
    for (const row of rows) bucket.set(row.id, row);
    this.cache.set(collection, bucket);
  }

  private cacheDelete(collection: string, id: string) {
    this.bucket(collection).delete(id);
  }
}
