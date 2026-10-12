/**
 * VIS Supabase persistence — unit tests with mocked Supabase client.
 * Also verifies production startup no longer requires VIS_DATABASE_URL,
 * and that application logical IDs (e.g. form-vulnerability) are not
 * written into the UUID primary key column.
 *
 * Run: npm run test:vis:supabase
 */
import assert from 'assert';
import { createClient } from '@supabase/supabase-js';
import {
  mapVisDocumentRow,
  SupabaseVisStore,
} from '../../src/vis/store/supabase-vis.store';
import { resetVisSupabaseClientForTests } from '../../src/vis/store/vis-supabase-client';
import { VisStore, resetVisStoreForTests } from '../../src/vis/store/vis.store';

type Row = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createMockSupabase() {
  const docs = new Map<string, Row>();
  const secrets = new Map<string, Row>();

  function docsKey(row: Row) {
    return `${row.collection}::${row.logical_id}`;
  }

  function from(table: string) {
    const store = table === 'vis_secret_blobs' ? secrets : docs;
    let filters: Array<(r: Row) => boolean> = [];
    let orderAsc = true;
    let limitN: number | null = null;
    let wantSingle = false;
    let op: 'select' | 'upsert' | 'update' | 'delete' = 'select';
    let patch: Row = {};
    let upsertRows: Row[] = [];
    let upsertOnConflict: string | null = null;

    const api: any = {
      select(_cols?: string) {
        // Trailing .select() after update/delete should not reset the mutation op
        if (op === 'select') op = 'select';
        return api;
      },
      upsert(row: Row | Row[], opts?: { onConflict?: string }) {
        op = 'upsert';
        upsertRows = Array.isArray(row) ? row : [row];
        upsertOnConflict = opts?.onConflict || null;
        return api;
      },
      update(row: Row) {
        op = 'update';
        patch = row;
        return api;
      },
      delete() {
        op = 'delete';
        return api;
      },
      eq(col: string, val: unknown) {
        if (col === 'payload->>id') {
          filters.push((r) => {
            const p = r.payload as Record<string, unknown> | undefined;
            return p != null && String(p.id) === String(val);
          });
        } else {
          filters.push((r) => r[col] === val);
        }
        return api;
      },
      is(col: string, val: null) {
        filters.push((r) => r[col] == null);
        return api;
      },
      order(_col: string, opts?: { ascending?: boolean }) {
        orderAsc = opts?.ascending !== false;
        return api;
      },
      limit(n: number) {
        limitN = n;
        return api;
      },
      maybeSingle() {
        wantSingle = true;
        return {
          then(resolve: (v: any) => unknown, reject?: (e: any) => unknown) {
            return execute().then(resolve, reject);
          },
        };
      },
      then(resolve: (v: any) => unknown, reject?: (e: any) => unknown) {
        return execute().then(resolve, reject);
      },
    };

    async function execute() {
      try {
        if (op === 'upsert') {
          const out: Row[] = [];
          for (const row of upsertRows) {
            if (table === 'vis_secret_blobs') {
              const key = String(row.ref_id);
              const merged = {
                ...row,
                created_at: row.created_at || new Date().toISOString(),
              };
              store.set(key, merged);
              out.push(merged);
              continue;
            }

            // Simulate Postgres: generate UUID PK when omitted; conflict on collection,logical_id
            const conflictCols = (upsertOnConflict || 'id').split(',').map((s) => s.trim());
            let existing: Row | undefined;
            if (conflictCols.includes('logical_id') && conflictCols.includes('collection')) {
              existing = [...store.values()].find(
                (r) => r.collection === row.collection && r.logical_id === row.logical_id,
              );
            } else if (row.id != null) {
              existing = store.get(String(row.id));
            }

            const id = existing?.id || row.id || cryptoRandomUuid();
            const key = String(id);
            // Drop any previous key if logical_id conflict replaced a different uuid (shouldn't)
            if (existing && String(existing.id) !== key) store.delete(String(existing.id));
            const merged: Row = {
              ...existing,
              ...row,
              id,
              created_at: existing?.created_at || row.created_at || new Date().toISOString(),
            };
            store.set(key, merged);
            out.push(merged);
          }
          return { data: out, error: null };
        }

        let rows = [...store.values()].filter((r) => filters.every((f) => f(r)));
        if (op === 'update') {
          const next: Row[] = [];
          for (const r of rows) {
            const key = table === 'vis_secret_blobs' ? String(r.ref_id) : String(r.id);
            const merged = { ...r, ...patch };
            store.set(key, merged);
            next.push(merged);
          }
          return { data: next, error: null };
        }
        if (op === 'delete') {
          for (const r of rows) {
            const key = table === 'vis_secret_blobs' ? String(r.ref_id) : String(r.id);
            store.delete(key);
          }
          return { data: rows, error: null };
        }

        rows = rows.sort((a, b) => {
          const av = String(a.created_at || '');
          const bv = String(b.created_at || '');
          return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        if (limitN != null) rows = rows.slice(0, limitN);
        if (wantSingle) return { data: rows[0] || null, error: null };
        return { data: rows, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e?.message || String(e) } };
      }
    }

    return api;
  }

  return {
    client: { from } as unknown as ReturnType<typeof createClient>,
    docs,
    secrets,
    docsKey,
  };
}

function cryptoRandomUuid() {
  // Node 18+; mirror Postgres gen_random_uuid for the mock
  return require('crypto').randomUUID() as string;
}

function section(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((e) => {
      console.error(`  ✗ ${name}:`, e?.message || e);
      throw e;
    });
}

async function main() {
  console.log('VIS Supabase persistence (mocked)');

  await section('mapVisDocumentRow prefers logical_id over UUID PK', () => {
    const mapped = mapVisDocumentRow({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      logical_id: 'form-vulnerability',
      payload: { id: 'form-vulnerability', name: 'Vulnerability' },
    });
    assert.equal(mapped.id, 'form-vulnerability');
    assert.equal(mapped.name, 'Vulnerability');

    const legacy = mapVisDocumentRow({
      id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      logical_id: null,
      payload: { id: 'form-vulnerability', name: 'Legacy' },
    });
    assert.equal(legacy.id, 'form-vulnerability');

    const uuidOnly = mapVisDocumentRow({
      id: 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      payload: { name: 'No payload id' },
    });
    assert.equal(uuidOnly.id, 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  });

  await section('production boot does not require VIS_DATABASE_URL', () => {
    const prev = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.VIS_DATABASE_URL;
      delete process.env.VIS_PERSISTENCE;
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
        + Buffer.from(JSON.stringify({ role: 'service_role', ref: 'example' })).toString('base64url')
        + '.sig';
      resetVisSupabaseClientForTests();
      // Constructing VisStore should not throw for missing VIS_DATABASE_URL
      const store = new VisStore();
      assert.equal(store.isDurableBacked, true);
    } finally {
      process.env = prev as any;
      resetVisSupabaseClientForTests();
    }
  });

  await section('production without Supabase credentials fails closed', () => {
    const prev = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.VIS_DATABASE_URL;
      delete process.env.VIS_PERSISTENCE;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.VIS_STORE_MEMORY;
      delete process.env.VIS_ALLOW_FILE_STORE;
      resetVisSupabaseClientForTests();
      assert.throws(() => new VisStore(), /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
    } finally {
      process.env = prev as any;
      resetVisSupabaseClientForTests();
    }
  });

  await section('CRUD create/read/update/delete + list filter', async () => {
    const mock = createMockSupabase();
    const store = new SupabaseVisStore(mock.client);

    const created = await store.createAsync('integrations', {
      id: 'int-1',
      name: 'Demo Integration',
      status: 'DRAFT',
      environment: 'DEV',
    });
    assert.equal(created.id, 'int-1');

    const got = await store.getAsync('integrations', 'int-1');
    assert.equal(got?.name, 'Demo Integration');

    const updated = await store.updateAsync('integrations', 'int-1', { status: 'ACTIVE' });
    assert.equal(updated?.status, 'ACTIVE');

    const listed = await store.listAsync('integrations');
    assert.equal(listed.length, 1);
    assert.equal(listed[0].status, 'ACTIVE');
    assert.equal(listed[0].id, 'int-1');

    // Soft-delete
    const removed = await store.removeAsync('integrations', 'int-1');
    assert.equal(removed, true);
    const after = await store.listAsync('integrations');
    assert.equal(after.length, 0);
  });

  await section('logical id form-vulnerability vs UUID database id', async () => {
    const mock = createMockSupabase();
    const store = new SupabaseVisStore(mock.client);

    const created = await store.createAsync('mockForms', {
      id: 'form-vulnerability',
      name: 'Vulnerability',
      description: 'Internal Vulnerability tracking form',
    });
    assert.equal(created.id, 'form-vulnerability');

    // Exactly one row; PK is a UUID, logical_id / payload.id keep the app id
    assert.equal(mock.docs.size, 1);
    const row = [...mock.docs.values()][0];
    assert.ok(UUID_RE.test(String(row.id)), `expected UUID PK, got ${row.id}`);
    assert.notEqual(String(row.id), 'form-vulnerability');
    assert.equal(row.logical_id, 'form-vulnerability');
    assert.equal((row.payload as any).id, 'form-vulnerability');

    const got = await store.getAsync('mockForms', 'form-vulnerability');
    assert.equal(got?.id, 'form-vulnerability');
    assert.equal(got?.name, 'Vulnerability');

    const listed = await store.listAsync('mockForms');
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'form-vulnerability');
  });

  await section('ensureMockSeed writes form-vulnerability without UUID collision', async () => {
    const mock = createMockSupabase();
    const store = new SupabaseVisStore(mock.client);
    await store.ready();

    const forms = await store.listAsync('mockForms');
    assert.equal(forms.length, 1);
    assert.equal(forms[0].id, 'form-vulnerability');

    const row = [...mock.docs.values()].find((r) => r.collection === 'mockForms');
    assert.ok(row);
    assert.ok(UUID_RE.test(String(row!.id)));
    assert.equal(row!.logical_id, 'form-vulnerability');
  });

  await section('repeated writes upsert same (collection, logical_id) and restore soft-delete', async () => {
    const mock = createMockSupabase();
    const store = new SupabaseVisStore(mock.client);

    await store.createAsync('mockForms', {
      id: 'form-vulnerability',
      name: 'Vulnerability',
      version: 1,
    });
    const firstPk = String([...mock.docs.values()][0].id);

    await store.createAsync('mockForms', {
      id: 'form-vulnerability',
      name: 'Vulnerability Updated',
      version: 2,
    });
    assert.equal(mock.docs.size, 1, 'must not create a duplicate row');
    assert.equal(String([...mock.docs.values()][0].id), firstPk, 'UUID PK must be stable');
    assert.equal((await store.getAsync('mockForms', 'form-vulnerability'))?.name, 'Vulnerability Updated');

    await store.removeAsync('mockForms', 'form-vulnerability');
    assert.equal((await store.listAsync('mockForms')).length, 0);

    await store.createAsync('mockForms', {
      id: 'form-vulnerability',
      name: 'Vulnerability Restored',
    });
    assert.equal(mock.docs.size, 1);
    const restored = [...mock.docs.values()][0];
    assert.equal(restored.deleted_at, null);
    assert.equal(String(restored.id), firstPk);
    assert.equal((await store.getAsync('mockForms', 'form-vulnerability'))?.name, 'Vulnerability Restored');
  });

  await section('existing-row compatibility via payload.id when logical_id missing', async () => {
    const mock = createMockSupabase();
    // Pre-migration style row: UUID PK, no logical_id column value, payload.id set
    const legacyUuid = 'dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    mock.docs.set(legacyUuid, {
      id: legacyUuid,
      collection: 'mockForms',
      logical_id: null,
      payload: { id: 'form-vulnerability', name: 'Legacy Seed' },
      created_at: new Date().toISOString(),
      deleted_at: null,
    });

    const store = new SupabaseVisStore(mock.client);
    const got = await store.getAsync('mockForms', 'form-vulnerability');
    assert.equal(got?.id, 'form-vulnerability');
    assert.equal(got?.name, 'Legacy Seed');

    const listed = await store.listAsync('mockForms');
    assert.equal(listed.some((r) => r.id === 'form-vulnerability'), true);
  });

  await section('error path surfaces Supabase failures', async () => {
    const broken = {
      from() {
        return {
          select() {
            return this;
          },
          limit() {
            return Promise.resolve({ data: null, error: { message: 'relation does not exist' } });
          },
        };
      },
    } as any;
    const store = new SupabaseVisStore(broken);
    await assert.rejects(() => store.ready(), /relation does not exist|readiness check failed/);
  });

  await section('memory mode still works without Supabase', () => {
    const prev = { ...process.env };
    try {
      process.env.NODE_ENV = 'development';
      process.env.VIS_STORE_MEMORY = '1';
      process.env.VIS_PERSISTENCE = 'memory';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      resetVisSupabaseClientForTests();
      const store = resetVisStoreForTests();
      assert.equal(store.isDurableBacked, false);
      const row = store.create('alerts', { ruleId: 'r1', message: 'x', severity: 'low' });
      assert.ok(store.get('alerts', row.id));
    } finally {
      process.env = prev as any;
    }
  });

  console.log('\nAll VIS Supabase persistence tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
