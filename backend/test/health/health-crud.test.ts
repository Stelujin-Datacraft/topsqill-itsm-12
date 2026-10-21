/**
 * Smoke-test the /health/crud payload shape (mocked deps).
 *
 *   npx tsx test/health/health-crud.test.ts
 */
import assert from 'assert';
import { HealthController } from '../../src/health.controller';

function makeJwt(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function main() {
  console.log('health-crud');

  {
    const config = {
      get: (key: string) => {
        const map: Record<string, string> = {
          ENVIRONMENT: 'development',
          SUPABASE_URL: 'https://abc.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key',
          SUPABASE_SERVICE_ROLE_KEY: makeJwt('service_role'),
        };
        return map[key];
      },
    };
    const supabase = { isServiceRoleKeyValid: () => true };
    const ctl = new HealthController(config as any, supabase as any);
    const body = ctl.crudPath();
    assert.equal(body.status, 'ok');
    assert.equal(body.supabaseHost, 'abc.supabase.co');
    assert.equal(body.serviceRoleJwtRole, 'service_role');
    assert.equal(body.serviceRoleKeyOk, true);
    assert.match(body.sharedMutationPath, /database/);
    console.log('  ✓ ok when service_role + anon + url set');
  }

  {
    const config = {
      get: (key: string) => {
        const map: Record<string, string> = {
          ENVIRONMENT: 'production',
          SUPABASE_URL: 'https://prod.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key',
          SUPABASE_SERVICE_ROLE_KEY: makeJwt('anon'),
        };
        return map[key];
      },
    };
    const supabase = { isServiceRoleKeyValid: () => false };
    const ctl = new HealthController(config as any, supabase as any);
    const body = ctl.crudPath();
    assert.equal(body.status, 'misconfigured');
    assert.equal(body.serviceRoleJwtRole, 'anon');
    assert.equal(body.serviceRoleKeyOk, false);
    assert.ok((body.hints as string[]).some((h) => /service_role/i.test(h)));
    console.log('  ✓ misconfigured when service key is anon');
  }

  console.log('All health-crud tests passed.');
}

main();
