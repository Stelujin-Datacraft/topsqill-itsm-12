/**
 * Unit tests for SUPABASE_SERVICE_ROLE_KEY role inspection.
 *
 *   npx tsx test/supabase/supabase-key-role.test.ts
 */
import assert from 'assert';
import {
  isMisconfiguredServiceRoleKey,
  misconfiguredServiceRoleMessage,
  parseSupabaseApiKeyRole,
} from '../../src/supabase/supabase-key-role';

function makeJwt(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role, ref: 'test' })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function main() {
  console.log('supabase-key-role');

  {
    const parsed = parseSupabaseApiKeyRole(makeJwt('service_role'));
    assert.equal(parsed.isJwt, true);
    assert.equal(parsed.role, 'service_role');
    assert.equal(isMisconfiguredServiceRoleKey(makeJwt('service_role')), false);
    console.log('  ✓ service_role key accepted');
  }

  {
    const anon = makeJwt('anon');
    const parsed = parseSupabaseApiKeyRole(anon);
    assert.equal(parsed.role, 'anon');
    assert.equal(isMisconfiguredServiceRoleKey(anon), true);
    assert.match(misconfiguredServiceRoleMessage('anon'), /expected service_role/);
    console.log('  ✓ anon key flagged as misconfigured');
  }

  {
    assert.equal(isMisconfiguredServiceRoleKey('YOUR_DEV_SERVICE_ROLE_KEY'), false);
    assert.equal(isMisconfiguredServiceRoleKey(''), false);
    assert.equal(isMisconfiguredServiceRoleKey(null), false);
    console.log('  ✓ placeholders / empty not classified as misconfigured JWT');
  }

  console.log('All supabase-key-role tests passed.');
}

main();
