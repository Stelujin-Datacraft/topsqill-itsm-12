/**
 * Supabase-backed VisStore durability (replaces Prisma).
 * Collections persist as JSON documents in `vis_documents`.
 * Secrets persist in `vis_secret_blobs` via SecretProvider.
 *
 * Uses the shared Supabase project (service-role, server-only).
 *
 * Document addressing:
 *   * `vis_documents.id` — PostgreSQL UUID primary key (DB-generated)
 *   * `vis_documents.logical_id` — application id (e.g. `form-vulnerability`)
 *   * `payload.id` — same logical id for JSON consumers / cache keys
 */
import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getVisSupabase } from './vis-supabase-client';
import type { VisRecord, VisStoreData } from './vis.store';

type Collection = keyof VisStoreData;

const ALL_COLLECTIONS: Collection[] = [
  'connections',
  'credentials',
  'integrations',
  'versions',
  'schemaCache',
  'executions',
  'logs',
  'audits',
  'deadLetters',
  'events',
  'eventEndpoints',
  'eventSubscriptions',
  'eventDeadLetters',
  'eventCheckpoints',
  'mockForms',
  'mockRecords',
  'codegenArtifacts',
  'promotions',
  'changeHistory',
  'approvals',
  'metrics',
  'traces',
  'alerts',
  'reconciliationReports',
  'repairReports',
  'driftFindings',
  'impactAnalyses',
  'connectors',
  'connectorInstalls',
  'connectorUpgrades',
  'aiRecommendations',
  'generatedTests',
  'generatedDocs',
  'healingActions',
];

type VisDocumentRow = {
  id?: string;
  logical_id?: string | null;
  payload?: unknown;
};

/** Prefer logical_id, then payload.id, then UUID text — never require UUID == app id. */
export function mapVisDocumentRow(row: VisDocumentRow): VisRecord {
  const payloadId =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? String((row.payload as Record<string, unknown>).id || '')
      : '';
  const logical =
    (row.logical_id && String(row.logical_id))
    || payloadId
    || (row.id ? String(row.id) : '');
  if (row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)) {
    return { ...(row.payload as Record<string, unknown>), id: logical } as VisRecord;
  }
  return { id: logical };
}

export class SupabaseVisStore {
  private readonly sb: SupabaseClient;
  private readonly cache = new Map<string, Map<string, VisRecord>>();

  constructor(client?: SupabaseClient) {
    this.sb = client || getVisSupabase();
  }

  async ready() {
    const { error } = await this.sb.from('vis_documents').select('id, logical_id').limit(1);
    if (error) {
      throw new Error(
        `VIS Supabase readiness check failed (${error.message}). `
          + 'Apply reviewable migrations supabase/migrations/*_vis_supabase_persistence.sql '
          + 'and *_vis_documents_logical_id.sql to the Dev Supabase project before starting production.',
      );
    }
    await this.ensureMockSeed();
  }

  /** Best-effort multi-step sequence (PostgREST has no multi-table TX from the client). */
  async transaction<T>(fn: (store: SupabaseVisStoreTx) => Promise<T>): Promise<T> {
    const inner = new SupabaseVisStoreTx(this);
    return fn(inner);
  }

  create<K extends Collection>(collection: K, record: Omit<VisRecord, 'id'> & { id?: string }): VisRecord {
    const row: VisRecord = { id: record.id || randomUUID(), ...record };
    void this.createAsync(collection, row);
    return row;
  }

  async createAsync<K extends Collection>(collection: K, record: VisRecord): Promise<VisRecord> {
    const logicalId = String(record.id || randomUUID());
    const row: VisRecord = { ...record, id: logicalId };
    if (collection === 'events' && !row.eventId) row.eventId = row.id;
    if (collection === 'credentials' && !row.secretHandle) row.secretHandle = `ref-${row.id}`;
    if (collection === 'credentials' && !row.type) row.type = 'GENERIC';
    if (collection === 'connections' && !row.authType) row.authType = 'NONE';
    if (collection === 'connections' && !row.kind) row.kind = 'REST';

    // Let Postgres generate the UUID PK. Upsert on (collection, logical_id) so
    // repeated seeds / soft-deleted restores do not create duplicates.
    const { error } = await this.sb.from('vis_documents').upsert(
      {
        collection,
        logical_id: logicalId,
        payload: row,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'collection,logical_id' },
    );
    if (error) throw new Error(`VIS create ${collection} failed: ${error.message}`);
    this.cacheSet(collection, row);
    return row;
  }

  update<K extends Collection>(collection: K, id: string, patch: Record<string, unknown>): VisRecord | null {
    void this.updateAsync(collection, id, patch);
    return { id, ...patch } as VisRecord;
  }

  async updateAsync<K extends Collection>(collection: K, id: string, patch: Record<string, unknown>): Promise<VisRecord | null> {
    const existing = await this.getAsync(collection, id);
    if (!existing) return null;
    const payload = { ...existing, ...patch, id };
    const { error } = await this.sb
      .from('vis_documents')
      .update({
        logical_id: id,
        payload,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      })
      .eq('logical_id', id)
      .eq('collection', collection)
      .is('deleted_at', null);
    if (error) throw new Error(`VIS update ${collection}/${id} failed: ${error.message}`);
    this.cacheSet(collection, payload);
    return payload;
  }

  get<K extends Collection>(collection: K, id: string): VisRecord | null {
    return this.cacheGet(collection, id);
  }

  async getAsync<K extends Collection>(collection: K, id: string): Promise<VisRecord | null> {
    const { data, error } = await this.sb
      .from('vis_documents')
      .select('id, logical_id, payload')
      .eq('logical_id', id)
      .eq('collection', collection)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(`VIS get ${collection}/${id} failed: ${error.message}`);
    if (!data) {
      // Compatibility: rows created before logical_id migration may only have payload.id
      // or (incorrectly) used a UUID as both PK and app id. Try payload->>'id' via filter.
      return this.getAsyncLegacyFallback(collection, id);
    }
    const mapped = mapVisDocumentRow(data as VisDocumentRow);
    this.cacheSet(collection, mapped);
    return mapped;
  }

  /**
   * Read path for pre-migration rows where logical_id may be missing from the
   * client schema cache or only present inside payload.id.
   */
  private async getAsyncLegacyFallback<K extends Collection>(
    collection: K,
    id: string,
  ): Promise<VisRecord | null> {
    const { data, error } = await this.sb
      .from('vis_documents')
      .select('id, logical_id, payload')
      .eq('collection', collection)
      .eq('payload->>id' as 'payload', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(`VIS get ${collection}/${id} failed: ${error.message}`);
    if (!data) return null;
    const mapped = mapVisDocumentRow(data as VisDocumentRow);
    // Prefer requested logical id for cache keys even if column was blank
    const withId = { ...mapped, id } as VisRecord;
    this.cacheSet(collection, withId);
    return withId;
  }

  list<K extends Collection>(collection: K): VisRecord[] {
    return this.cacheList(collection);
  }

  async listAsync<K extends Collection>(collection: K): Promise<VisRecord[]> {
    const { data, error } = await this.sb
      .from('vis_documents')
      .select('id, logical_id, payload')
      .eq('collection', collection)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`VIS list ${collection} failed: ${error.message}`);
    const mapped = (data || []).map((r) => mapVisDocumentRow(r as VisDocumentRow));
    this.cacheReplace(collection, mapped);
    return mapped;
  }

  remove<K extends Collection>(collection: K, id: string): boolean {
    void this.removeAsync(collection, id);
    this.cacheDelete(collection, id);
    return true;
  }

  async removeAsync<K extends Collection>(collection: K, id: string): Promise<boolean> {
    const { data, error } = await this.sb
      .from('vis_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('logical_id', id)
      .eq('collection', collection)
      .is('deleted_at', null)
      .select('id');
    if (error) throw new Error(`VIS remove ${collection}/${id} failed: ${error.message}`);
    this.cacheDelete(collection, id);
    return (data?.length || 0) > 0;
  }

  persist() {
    /* durable on each write */
  }

  persistFast() {
    /* no-op */
  }

  snapshot(): VisStoreData {
    const empty = {} as VisStoreData;
    for (const k of ALL_COLLECTIONS) {
      (empty as any)[k] = this.cacheList(k);
    }
    return empty;
  }

  async hydrate() {
    for (const k of ALL_COLLECTIONS) {
      await this.listAsync(k);
    }
  }

  // ── secrets (vis_secret_blobs) ─────────────────────────────────────────

  async putSecret(refId: string, ciphertext: string, provider: string) {
    const { error } = await this.sb.from('vis_secret_blobs').upsert(
      {
        ref_id: refId,
        ciphertext,
        provider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ref_id' },
    );
    if (error) throw new Error(`VIS secret put failed: ${error.message}`);
  }

  async getSecret(refId: string): Promise<{ ciphertext: string } | null> {
    const { data, error } = await this.sb
      .from('vis_secret_blobs')
      .select('ciphertext')
      .eq('ref_id', refId)
      .maybeSingle();
    if (error) throw new Error(`VIS secret get failed: ${error.message}`);
    return data ? { ciphertext: data.ciphertext as string } : null;
  }

  async deleteSecret(refId: string) {
    const { error } = await this.sb.from('vis_secret_blobs').delete().eq('ref_id', refId);
    if (error) throw new Error(`VIS secret delete failed: ${error.message}`);
  }

  async rotateSecret(refId: string, ciphertext: string, provider: string) {
    await this.putSecret(refId, ciphertext, provider);
    const { error } = await this.sb
      .from('vis_secret_blobs')
      .update({ rotated_at: new Date().toISOString() })
      .eq('ref_id', refId);
    if (error) throw new Error(`VIS secret rotate failed: ${error.message}`);
  }

  // ── cache ──────────────────────────────────────────────────────────────

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

export class SupabaseVisStoreTx {
  constructor(private readonly store: SupabaseVisStore) {}

  async create(collection: Collection, record: VisRecord) {
    return this.store.createAsync(collection, record);
  }

  async update(collection: Collection, id: string, patch: Record<string, unknown>) {
    return this.store.updateAsync(collection, id, patch);
  }

  async get(collection: Collection, id: string) {
    return this.store.getAsync(collection, id);
  }
}
