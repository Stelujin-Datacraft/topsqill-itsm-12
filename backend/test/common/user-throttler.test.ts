/**
 * Rate limits are per signed-in user, and per real client IP behind a trusted proxy.
 *
 *   npx tsx test/common/user-throttler.test.ts
 */
import 'reflect-metadata';
import assert from 'assert';
import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  DEFAULT_THROTTLE_LIMIT,
  DEFAULT_THROTTLE_TTL_MS,
  DEFAULT_TRUST_PROXY,
  throttleSettings,
  throttleTracker,
  trustProxySetting,
  UserThrottlerGuard,
} from '../../src/common/guards/user-throttler.guard';
import { SupabaseService } from '../../src/supabase/supabase.service';

const LIMIT = 3;
const verifiedTokens: Record<string, { id: string }> = {
  'Bearer alice-token': { id: 'alice' },
  'Bearer bob-token': { id: 'bob' },
};

// Decorators are applied by hand: tsx compiles test/ without experimentalDecorators.
class PingController {
  ping() {
    return { ok: true };
  }
}
Get('ping')(PingController.prototype, 'ping', Object.getOwnPropertyDescriptor(PingController.prototype, 'ping')!);
Controller()(PingController);

class TestModule {}
Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: LIMIT }])],
  controllers: [PingController],
  providers: [
    {
      provide: SupabaseService,
      useValue: { getCachedUserForToken: (header?: string) => (header ? verifiedTokens[header] ?? null : null) },
    },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})(TestModule);

async function main() {
  console.log('user-throttler');

  assert.deepEqual(throttleSettings(() => undefined), { ttl: DEFAULT_THROTTLE_TTL_MS, limit: DEFAULT_THROTTLE_LIMIT });
  assert.deepEqual(throttleSettings((key) => ({ THROTTLE_LIMIT: '50', THROTTLE_TTL_MS: '1000' })[key]), { ttl: 1000, limit: 50 });
  assert.deepEqual(throttleSettings(() => 'junk'), { ttl: DEFAULT_THROTTLE_TTL_MS, limit: DEFAULT_THROTTLE_LIMIT });
  assert.equal(trustProxySetting(undefined), DEFAULT_TRUST_PROXY);
  assert.equal(trustProxySetting('false'), false);
  assert.equal(trustProxySetting('2'), 2);
  assert.equal(throttleTracker({ ip: '10.0.0.1' }, 'u1'), 'user:u1');
  assert.equal(throttleTracker({ ip: '10.0.0.1' }), 'ip:10.0.0.1');

  const app = await NestFactory.create(TestModule, { logger: false });
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxySetting(undefined));
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address();
  const ping = (headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${port}/ping`, { headers }).then((res) => ({
      status: res.status,
      retryAfter: res.headers.get('retry-after'),
    }));

  try {
    // Everyone arrives through the same proxy (loopback here); users must not share a budget.
    for (let i = 0; i < LIMIT; i++) assert.equal((await ping({ authorization: 'Bearer alice-token' })).status, 200);
    const blocked = await ping({ authorization: 'Bearer alice-token' });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.retryAfter) > 0, 'Retry-After tells the client how long to wait');
    assert.equal((await ping({ authorization: 'Bearer bob-token' })).status, 200);

    // Signed-out traffic is keyed on the client IP forwarded by the trusted proxy.
    for (let i = 0; i < LIMIT; i++) assert.equal((await ping({ 'x-forwarded-for': '203.0.113.7' })).status, 200);
    assert.equal((await ping({ 'x-forwarded-for': '203.0.113.7' })).status, 429);
    assert.equal((await ping({ 'x-forwarded-for': '198.51.100.9' })).status, 200);

    // An unverified token does not get its own bucket; it counts against the IP.
    assert.equal((await ping({ authorization: 'Bearer forged', 'x-forwarded-for': '203.0.113.7' })).status, 429);
  } finally {
    await app.close();
  }

  console.log('user-throttler checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
