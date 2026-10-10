/**
 * VIS Supabase persistence — unit tests with mocked Supabase client.
 * Also verifies production startup no longer requires VIS_DATABASE_URL.
 *
 * Run: npm run test:vis:supabase
 */
import assert from 'assert';
import { createClient } from '@supabase/supabase-js';
import { SupabaseVisStore } from '../../src/vis/store/supabase-vis.store';
import { resetVisSupabaseClientForTests } from '../../src/vis/store/vis-supabase-client';
import { VisStore, resetVisStoreForTests } from '../../src/vis/store/vis.store';

type Row = Record<string, unknown>;

function createMockSupabase() {
  const docs = new Map<string, Row>();
  const secrets = new Map<string, Row>();

  function from(table: string) {
    const store = table === 'vis_secret_blobs' ? secrets : docs;
    let filters: Array<(r: Row) => boolean> = [];
    let orderAsc = true;
    let limitN: number | null = null;
    let wantSingle = false;
    let op: 'select' | 'upsert' | 'update' | 'delete' = 'select';
    let patch: Row = {};
    let upsertRows: Row[] = [];

    const api: any = {
      select(_cols?: string) {
        // Trailing .select() after update/delete should not reset the mutation op
        if (op === 'select') op = 'select';
        return api;
      },
      upsert(row: Row | Row[], _opts?: unknown) {
        op = 'upsert';
        upsertRows = Array.isArray(row) ? row : [row];
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
        filters.push((r) => r[col] === val);
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
          for (const row of upsertRows) {
            const key = table === 'vis_secret_blobs' ? String(row.ref_id) : String(row.id);
            store.set(key, {
              ...row,
              created_at: row.created_at || new Date().toISOString(),
            });
          }
          return { data: upsertRows, error: null };
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
  };
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

    // Soft-delete
    const removed = await store.removeAsync('integrations', 'int-1');
    assert.equal(removed, true);
    const after = await store.listAsync('integrations');
    assert.equal(after.length, 0);
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
