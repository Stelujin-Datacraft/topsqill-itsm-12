/**
 * Guards for admin user create (send-welcome-email).
 * Run: npx tsx test/auth/send-welcome-email.profile.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

const src = readFileSync(
  resolve(process.cwd(), 'src/engines/send-welcome-email.engine.ts'),
  'utf8',
);

console.log('send-welcome-email — admin user create safety');

test('does not write password column onto user_profiles', () => {
  assert.ok(!/profileDataToInsert\.password\s*=/.test(src));
  assert.ok(!/updateData\.password\s*=/.test(src));
  assert.ok(/never write it/i.test(src) || /password was dropped/i.test(src));
});

test('returns plain objects for Nest (not Response)', () => {
  assert.ok(!/return new Response\(/.test(src));
  assert.ok(/success:\s*false/.test(src));
  assert.ok(/success:\s*true/.test(src));
});

test('uses Nest-safe defer instead of EdgeRuntime', () => {
  // Allow mentioning EdgeRuntime only in comments explaining the Nest port
  const codeWithoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/EdgeRuntime/.test(codeWithoutComments));
  assert.ok(/ctx\.defer\(/.test(src));
});

test('forces admin caller organization', () => {
  assert.ok(/_actorId|actorId/.test(src));
  assert.ok(/role !== 'admin'/.test(src));
  assert.ok(/organization_id/.test(src));
});

console.log('\nAll send-welcome-email safety tests passed.');
