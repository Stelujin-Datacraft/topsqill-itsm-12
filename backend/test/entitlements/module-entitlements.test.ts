/**
 * Paid modules are enforced per organisation, from the user's profile, on every gated route.
 *
 *   npx tsx test/entitlements/module-entitlements.test.ts
 */
import 'reflect-metadata';
import assert from 'assert';
import { CanActivate, Controller, ExecutionContext, Get, Module, Post } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { EntitlementsService, buildOrgAccess, isMissingSchemaError, type EntitlementRow } from '../../src/entitlements/entitlements.service';
import { ModuleEntitlementGuard } from '../../src/entitlements/module-entitlement.guard';
import { RequiresModule } from '../../src/entitlements/requires-module.decorator';
import { entitlementLevel, levelAllows, limitFor, needForMethod } from '../../src/entitlements/module-catalog';
import { parseApplyPlan, parseLimits, parsePlan, parseSetEntitlement } from '../../src/entitlements/platform-validation';
import { SupabaseService } from '../../src/supabase/supabase.service';

const ORG_PAID = '00000000-0000-0000-0000-0000000000a1';
const ORG_EXPIRED = '00000000-0000-0000-0000-0000000000a2';
const ORG_NONE = '00000000-0000-0000-0000-0000000000a3';
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const state = {
  missingSchema: false,
  profiles: { alice: ORG_PAID, bob: ORG_EXPIRED, carol: ORG_NONE } as Record<string, string>,
  entitlements: [
    { organization_id: ORG_PAID, module_key: 'asset-discovery', source: 'add_on', status: 'active', starts_at: iso(-30), ends_at: null, grace_days: 14, limits: { discovery_jobs: 2 } },
    { organization_id: ORG_EXPIRED, module_key: 'asset-discovery', source: 'plan', status: 'active', starts_at: iso(-90), ends_at: iso(-30), grace_days: 7, limits: {} },
  ] as EntitlementRow[],
  usage: new Map<string, number>(),
  audit: [] as Record<string, unknown>[],
};

function fakeClient() {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const rows = () => {
        if (table === 'user_profiles') return Object.entries(state.profiles).map(([id, organization_id]) => ({ id, organization_id }));
        if (table === 'org_entitlements') return state.entitlements;
        if (table === 'platform_admins') return [];
        return [];
      };
      const result = () => {
        if (state.missingSchema && table === 'org_entitlements') {
          return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.org_entitlements'" } };
        }
        return { data: rows().filter((row: any) => filters.every(([col, val]) => row[col] === val)), error: null };
      };
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: unknown) => (filters.push([col, val]), builder),
        maybeSingle: async () => {
          const { data, error } = result();
          return { data: data ? data[0] ?? null : null, error };
        },
        then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve(result()).then(resolve, reject),
      };
      return builder;
    },
    async rpc(name: string, args: Record<string, any>) {
      if (name === 'consume_module_usage') {
        const key = `${args._org_id}:${args._module}:${args._metric}`;
        const used = state.usage.get(key) || 0;
        if (args._limit !== null && used + args._amount > args._limit) return { data: [{ allowed: false, used }], error: null };
        state.usage.set(key, used + args._amount);
        return { data: [{ allowed: true, used: used + args._amount }], error: null };
      }
      if (name === 'platform_log_entitlement_event') {
        state.audit.push(args);
        return { data: null, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
}

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.headers['x-test-user'];
    if (user) request.user = { id: user };
    return true;
  }
}

// Decorators are applied by hand: tsx compiles test/ without experimentalDecorators.
class DiscoveryController {
  list() {
    return { ok: true };
  }
  createJob() {
    return { ok: true };
  }
  scope() {
    return { ok: true };
  }
}
const method = (name: keyof DiscoveryController) =>
  [DiscoveryController.prototype, name, Object.getOwnPropertyDescriptor(DiscoveryController.prototype, name)!] as const;
Get('jobs')(...method('list'));
Post('jobs')(...method('createJob'));
RequiresModule('asset-discovery', { consume: 'discovery_jobs' })(...method('createJob'));
Post('scopes')(...method('scope'));
RequiresModule('asset-discovery')(DiscoveryController);
Controller('discovery')(DiscoveryController);

class OpenController {
  ping() {
    return { ok: true };
  }
}
Get('ping')(OpenController.prototype, 'ping', Object.getOwnPropertyDescriptor(OpenController.prototype, 'ping')!);
Controller('open')(OpenController);

class TestModule {}
Module({
  controllers: [DiscoveryController, OpenController],
  providers: [
    { provide: SupabaseService, useValue: { getServiceClient: fakeClient } },
    EntitlementsService,
    ModuleEntitlementGuard,
    { provide: APP_GUARD, useClass: TestAuthGuard },
    { provide: APP_GUARD, useExisting: ModuleEntitlementGuard },
  ],
})(TestModule);

function pureChecks() {
  assert.equal(needForMethod('GET'), 'view');
  assert.equal(needForMethod('post'), 'use');
  assert.equal(needForMethod('DELETE'), 'use');
  assert.ok(levelAllows('full', 'use') && levelAllows('grace', 'use'));
  assert.ok(levelAllows('read_only', 'view') && !levelAllows('read_only', 'use'));
  assert.ok(!levelAllows('none', 'view'));

  const row = { status: 'active', starts_at: iso(-10), ends_at: iso(-3), grace_days: 7 };
  assert.equal(entitlementLevel(row), 'grace', 'inside the grace days');
  assert.equal(entitlementLevel({ ...row, grace_days: 1 }), 'read_only', 'grace over: read only, data kept');
  assert.equal(entitlementLevel({ ...row, ends_at: null }), 'full');
  assert.equal(entitlementLevel({ ...row, status: 'suspended', ends_at: null }), 'read_only');
  assert.equal(entitlementLevel({ ...row, starts_at: iso(2), ends_at: null }), 'none', 'not started yet');
  assert.equal(entitlementLevel(null), 'none');

  assert.equal(limitFor({ ai_requests: 100 }, 'ai_requests'), 100);
  assert.equal(limitFor({ ai_requests: 100 }, 'other'), null, 'absent metric is unlimited');
  assert.equal(limitFor({ ai_requests: -1 }, 'ai_requests'), null);

  const unenforced = buildOrgAccess(ORG_NONE, null);
  assert.equal(unenforced.enforced, false);
  assert.equal(unenforced.modules['ai-builder'].level, 'full', 'before the migration nothing is locked');
  assert.equal(buildOrgAccess(ORG_NONE, []).modules['ai-builder'].level, 'none');
  assert.ok(isMissingSchemaError({ code: '42P01' }));
  assert.ok(!isMissingSchemaError({ code: '23505', message: 'duplicate key' }));

  assert.throws(() => parseApplyPlan({ planKey: 'starter' }), /reason/);
  assert.throws(() => parseApplyPlan({ planKey: 'starter', status: 'paused', reason: 'test' }), /status/);
  assert.deepEqual(parseApplyPlan({ planKey: 'starter', reason: ' renewal ', graceDays: '7' }), {
    planKey: 'starter', status: 'active', periodEnd: null, graceDays: 7, reason: 'renewal',
  });
  assert.throws(() => parseSetEntitlement({ source: 'legacy', reason: 'x y z' }), /source/);
  assert.throws(() => parseSetEntitlement({ endsAt: 'soon', reason: 'add-on' }), /date/);
  assert.deepEqual(parseLimits({ ai_requests: '500', discovery_jobs: '' }), { ai_requests: 500 });
  assert.throws(() => parseLimits({ ai_requests: 1.5 }), /whole number/);
  assert.throws(() => parsePlan('pro', { name: 'Pro', modules: ['nope'], reason: 'new plan' }), /Unknown module/);
  assert.deepEqual(parsePlan('pro', { name: 'Pro', modules: ['ai-builder', 'ai-builder'], reason: 'new plan' }).modules, ['ai-builder']);
}

async function main() {
  console.log('module-entitlements');
  pureChecks();

  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address();
  const call = async (method: string, path: string, user?: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: user ? { 'x-test-user': user } : {} });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    assert.equal((await call('GET', '/open/ping', 'carol')).status, 200, 'ungated routes are untouched');
    assert.equal((await call('GET', '/discovery/jobs')).status, 401);

    assert.equal((await call('GET', '/discovery/jobs', 'alice')).status, 200);
    assert.equal((await call('POST', '/discovery/scopes', 'alice')).status, 201);
    assert.equal((await call('POST', '/discovery/jobs', 'alice')).status, 201);
    assert.equal((await call('POST', '/discovery/jobs', 'alice')).status, 201);
    const limited = await call('POST', '/discovery/jobs', 'alice');
    assert.equal(limited.status, 403, 'monthly limit of 2 jobs');
    assert.equal(limited.body.code, 'MODULE_LIMIT_REACHED');
    assert.equal(limited.body.limit, 2);

    assert.equal((await call('GET', '/discovery/jobs', 'bob')).status, 200, 'expired: results stay readable');
    const readOnly = await call('POST', '/discovery/scopes', 'bob');
    assert.equal(readOnly.status, 403);
    assert.equal(readOnly.body.code, 'MODULE_READ_ONLY');

    const none = await call('GET', '/discovery/jobs', 'carol');
    assert.equal(none.status, 403);
    assert.equal(none.body.code, 'MODULE_NOT_ENTITLED');
    assert.match(none.body.message, /Asset Discovery is not included/);

    const denials = state.audit.filter((entry) => entry._action === 'access_denied');
    assert.ok(denials.some((entry) => entry._org_id === ORG_NONE), 'denials are written to the audit log');
    const before = denials.length;
    await call('GET', '/discovery/jobs', 'carol');
    assert.equal(state.audit.filter((entry) => entry._action === 'access_denied').length, before, 'repeat denials are not flooded');

    const service = app.get(EntitlementsService);
    state.missingSchema = true;
    service.invalidate();
    assert.equal((await call('POST', '/discovery/scopes', 'carol')).status, 201, 'migration not applied yet: nothing is locked');
  } finally {
    await app.close();
  }

  console.log('module-entitlements checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
