/**
 * DatabaseService update/delete mutation safety (mocked Supabase client).
 * Confirms we never put `limit` on PATCH/DELETE URLs (PostgREST PGRST109) and
 * that oversized filtered mutations are rejected before write.
 *
 *   npx tsx test/database/database.mutation-limit.test.ts
 */
import assert from 'assert';
import { BadRequestException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { DatabaseService } from '../../src/database/database.service';
import { MAX_MUTATION_ROWS } from '../../src/common/constants/database.constants';

type Call = { method: string; url: string; prefer: string };

function makeCapturingClient(opts: {
  count?: number;
  mutateData?: unknown;
  mutateError?: { message: string } | null;
  countError?: { message: string } | null;
}) {
  const calls: Call[] = [];
  const real = createClient('http://127.0.0.1', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.x');

  const wrap = (builder: any) => {
    const handler: ProxyHandler<any> = {
      get(target, prop, receiver) {
        if (prop === 'then') {
          // Thenable: execute as the service awaits the builder
          return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
            const method = String(target.method || '').toUpperCase();
            const url = target.url?.toString?.() || '';
            const prefer = String(target.headers?.get?.('Prefer') || target.headers?.Prefer || '');
            calls.push({ method, url, prefer });

            if (method === 'HEAD' || (method === 'GET' && /Prefer=.*count/.test(prefer) === false && target.headers)) {
              // head count requests use GET with Prefer count + Accept
            }

            const isCount =
              method === 'HEAD' ||
              (method === 'GET' && String(prefer).includes('count=exact'));

            if (isCount || (method === 'GET' && target.headers?.get?.('Prefer')?.includes?.('count='))) {
              const err = opts.countError || null;
              return Promise.resolve({
                data: null,
                error: err,
                count: err ? null : (opts.count ?? 0),
              }).then(resolve, reject);
            }

            if (method === 'PATCH' || method === 'POST' || method === 'DELETE') {
              const err = opts.mutateError || null;
              return Promise.resolve({
                data: err ? null : (opts.mutateData ?? []),
                error: err,
                count: null,
              }).then(resolve, reject);
            }

            return Promise.resolve({ data: null, error: null, count: null }).then(resolve, reject);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return (...args: unknown[]) => {
            const result = value.apply(target, args);
            // Chainable builders stay proxied
            if (result && typeof result === 'object' && result.url) {
              return wrap(result);
            }
            return result;
          };
        }
        return value;
      },
    };
    return new Proxy(builder, handler);
  };

  return {
    calls,
    client: {
      from: (table: string) => wrap(real.from(table)),
    },
  };
}

const AUTH = 'Bearer test-user-jwt';

function makeService(client: unknown) {
  const supabaseService = {
    getServiceClient: () => client,
    getClientForUser: (_auth?: string) => client,
  };
  return new DatabaseService(supabaseService as any);
}

async function main() {
  console.log('database.mutation-limit');

  // ── Cause confirmation via installed client ─────────────────────────────
  {
    const c = createClient('http://127.0.0.1', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.x');
    const builder: any = c.from('forms').update({ name: 'x' }).eq('id', '1').select('id').limit(1001);
    const url = builder.url.toString();
    assert.match(url, /limit=1001/, 'installed client puts limit on mutation URL');
    assert.doesNotMatch(url, /order=/, 'mutation limit URL has no order (PGRST109 trigger)');
    console.log('  ✓ cause: postgrest-js .limit() on update sets limit without order');
  }

  // ── Update success (filtered) ───────────────────────────────────────────
  {
    const { client, calls } = makeCapturingClient({
      count: 1,
      mutateData: [{ id: 'row-1', name: 'updated' }],
    });
    const svc = makeService(client);
    const result = await svc.update({
      table: 'forms',
      data: { name: 'updated' },
      filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: 'row-1' }],
      returning: 'id,name',
    }, AUTH);
    assert.deepEqual(result, { data: [{ id: 'row-1', name: 'updated' }], error: null });
    const patch = calls.find((c) => c.method === 'PATCH');
    assert.ok(patch, 'PATCH issued');
    assert.doesNotMatch(patch!.url, /[?&]limit=/, 'PATCH must not include limit');
    assert.match(patch!.url, /id=eq\.row-1/, 'PATCH keeps filter');
    console.log('  ✓ update success with filters; no limit on PATCH');
  }

  // ── Delete success (filtered) ───────────────────────────────────────────
  {
    const { client, calls } = makeCapturingClient({
      count: 1,
      mutateData: [{ id: 'row-2' }],
    });
    const svc = makeService(client);
    const result = await svc.delete({
      table: 'forms',
      filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: 'row-2' }],
    }, AUTH);
    assert.deepEqual(result, { data: [{ id: 'row-2' }], error: null });
    const del = calls.find((c) => c.method === 'DELETE');
    assert.ok(del, 'DELETE issued');
    assert.doesNotMatch(del!.url, /[?&]limit=/, 'DELETE must not include limit');
    console.log('  ✓ delete success with filters; no limit on DELETE');
  }

  // ── Reject missing user JWT on mutations ────────────────────────────────
  {
    const { UnauthorizedException } = await import('@nestjs/common');
    const { client } = makeCapturingClient({ count: 0 });
    const svc = makeService(client);
    for (const label of ['insert', 'update', 'delete', 'upsert'] as const) {
      let blocked = false;
      try {
        if (label === 'insert') {
          await svc.insert({ table: 'forms', data: { name: 'x' } });
        } else if (label === 'update') {
          await svc.update({
            table: 'forms',
            data: { name: 'x' },
            filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: '1' }],
          });
        } else if (label === 'delete') {
          await svc.delete({
            table: 'forms',
            filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: '1' }],
          });
        } else {
          await svc.upsert({ table: 'forms', data: { name: 'x' } });
        }
      } catch (e) {
        blocked =
          e instanceof UnauthorizedException && /No authorization header/i.test(e.message);
      }
      assert.equal(blocked, true, `${label} without Authorization must 401`);
    }
    console.log('  ✓ insert/update/delete/upsert require user JWT');
  }

  // ── Reject missing filters ──────────────────────────────────────────────
  {
    const { client } = makeCapturingClient({ count: 0 });
    const svc = makeService(client);
    let blocked = false;
    try {
      await svc.update({ table: 'forms', data: { name: 'x' }, filters: [] }, AUTH);
    } catch (e) {
      blocked = e instanceof BadRequestException && /Filters are required/i.test(e.message);
    }
    assert.equal(blocked, true);
    console.log('  ✓ update without filters rejected');
  }
  {
    const { client } = makeCapturingClient({ count: 0 });
    const svc = makeService(client);
    let blocked = false;
    try {
      await svc.delete({ table: 'forms', filters: [] }, AUTH);
    } catch (e) {
      blocked = e instanceof BadRequestException && /Filters are required/i.test(e.message);
    }
    assert.equal(blocked, true);
    console.log('  ✓ delete without filters rejected');
  }

  // ── Reject > MAX_MUTATION_ROWS before write ─────────────────────────────
  {
    const { client, calls } = makeCapturingClient({ count: MAX_MUTATION_ROWS + 1 });
    const svc = makeService(client);
    let blocked = false;
    try {
      await svc.update({
        table: 'forms',
        data: { status: 'x' },
        filters: [{ kind: 'filter', column: 'organization_id', operator: 'eq', value: 'org-1' }],
      }, AUTH);
    } catch (e) {
      blocked =
        e instanceof BadRequestException &&
        new RegExp(`more than ${MAX_MUTATION_ROWS} rows`, 'i').test(e.message);
    }
    assert.equal(blocked, true);
    assert.equal(calls.some((c) => c.method === 'PATCH'), false, 'must not PATCH when over limit');
    console.log('  ✓ update >1000 matching rows rejected before PATCH');
  }
  {
    const { client, calls } = makeCapturingClient({ count: MAX_MUTATION_ROWS + 5 });
    const svc = makeService(client);
    let blocked = false;
    try {
      await svc.delete({
        table: 'forms',
        filters: [{ kind: 'filter', column: 'organization_id', operator: 'eq', value: 'org-1' }],
      }, AUTH);
    } catch (e) {
      blocked =
        e instanceof BadRequestException &&
        new RegExp(`more than ${MAX_MUTATION_ROWS} rows`, 'i').test(e.message);
    }
    assert.equal(blocked, true);
    assert.equal(calls.some((c) => c.method === 'DELETE'), false, 'must not DELETE when over limit');
    console.log('  ✓ delete >1000 matching rows rejected before DELETE');
  }

  // ── Mutation error surfaces as BadRequestException ──────────────────────
  {
    const { client } = makeCapturingClient({
      count: 1,
      mutateError: { message: 'RLS blocked' },
    });
    const svc = makeService(client);
    let blocked = false;
    try {
      await svc.update({
        table: 'forms',
        data: { name: 'x' },
        filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: '1' }],
      }, AUTH);
    } catch (e) {
      blocked = e instanceof BadRequestException && /RLS blocked/i.test(e.message);
    }
    assert.equal(blocked, true);
    console.log('  ✓ update error from PostgREST propagated');
  }
  {
    const { client } = makeCapturingClient({
      count: 1,
      mutateError: { message: 'permission denied' },
    });
    const svc = makeService(client);
    let blocked = false;
    try {
      await svc.delete({
        table: 'forms',
        filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: '1' }],
      }, AUTH);
    } catch (e) {
      blocked = e instanceof BadRequestException && /permission denied/i.test(e.message);
    }
    assert.equal(blocked, true);
    console.log('  ✓ delete error from PostgREST propagated');
  }

  // ── Boundary: exactly MAX_MUTATION_ROWS allowed ─────────────────────────
  {
    const { client, calls } = makeCapturingClient({
      count: MAX_MUTATION_ROWS,
      mutateData: [{ id: 'ok' }],
    });
    const svc = makeService(client);
    const result = await svc.update({
      table: 'forms',
      data: { name: 'bulk' },
      filters: [{ kind: 'filter', column: 'organization_id', operator: 'eq', value: 'org-1' }],
    }, AUTH);
    assert.equal(result.error, null);
    assert.equal(calls.some((c) => c.method === 'PATCH'), true);
    console.log(`  ✓ update with exactly ${MAX_MUTATION_ROWS} rows allowed`);
  }

  // ── Zero-row mutation must not look like success (RLS / missing id) ─────
  {
    const { client } = makeCapturingClient({
      count: 0,
      mutateData: [],
    });
    const svc = makeService(client);
    let blocked = false;
    try {
      await svc.delete({
        table: 'forms',
        filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: 'missing' }],
      }, AUTH);
    } catch (e) {
      blocked =
        e instanceof BadRequestException && /No rows were deleted/i.test(e.message);
    }
    assert.equal(blocked, true);
    console.log('  ✓ delete with zero returned rows rejected');
  }
  {
    const { client } = makeCapturingClient({
      count: 0,
      mutateData: [],
    });
    const svc = makeService(client);
    let blocked = false;
    try {
      await svc.update({
        table: 'forms',
        data: { name: 'x' },
        filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: 'missing' }],
      }, AUTH);
    } catch (e) {
      blocked =
        e instanceof BadRequestException && /No rows were updated/i.test(e.message);
    }
    assert.equal(blocked, true);
    console.log('  ✓ update with zero returned rows rejected');
  }

  console.log('All database.mutation-limit tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
