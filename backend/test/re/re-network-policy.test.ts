/**
 * Network policy / visibility helpers (lightweight).
 * Run: npx tsx test/re/re-network-policy.test.ts
 */
import assert from 'node:assert/strict';
import { isReLeadgenEnabled, isReNetworkEnabled } from '../../src/re/re-access';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Real Estate Network — flag coupling');

test('network cannot enable without leadgen master', () => {
  const env = {
    ENVIRONMENT: 'development',
    RE_LEADGEN_ENABLED: 'false',
    RE_NETWORK_ENABLED: 'true',
  } as NodeJS.ProcessEnv;
  assert.equal(isReLeadgenEnabled(env), false);
  assert.equal(isReNetworkEnabled(env), false);
});

test('network follows leadgen + own flag', () => {
  const env = {
    ENVIRONMENT: 'production',
    RE_LEADGEN_ENABLED: 'true',
    RE_NETWORK_ENABLED: 'true',
  } as NodeJS.ProcessEnv;
  assert.equal(isReNetworkEnabled(env), true);
});

console.log('All re-network-policy tests passed');
