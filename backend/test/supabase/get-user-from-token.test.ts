/**
 * Ensures Bearer extraction matches Nest Authorization headers.
 *
 *   npx tsx test/supabase/get-user-from-token.test.ts
 */
import assert from 'assert';

function extractAccessToken(authHeader: string): string | null {
  const raw = String(authHeader || '').trim();
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  if (match) {
    const token = match[1].trim();
    return token || null;
  }
  if (/^Bearer$/i.test(raw)) return null;
  return raw;
}

function main() {
  console.log('get-user-from-token extract');
  assert.equal(extractAccessToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractAccessToken('bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractAccessToken('abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractAccessToken(''), null);
  assert.equal(extractAccessToken('Bearer   '), null);
  console.log('  ✓ Bearer extraction');
  console.log('All get-user-from-token tests passed.');
}

main();
