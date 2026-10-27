/**
 * Unit tests for Real Estate Lead Gen deployment access policy.
 * Run: npx tsx test/re/re-access.test.ts
 */
import assert from 'node:assert/strict';
import {
  getReAccessState,
  isReLeadgenEnabled,
  resolveReEnvironment,
} from '../../src/re/re-access';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Real Estate Lead Gen — deployment access policy');

test('ENVIRONMENT=development enables by default', () => {
  const env = { ENVIRONMENT: 'development', NODE_ENV: 'production' } as NodeJS.ProcessEnv;
  assert.equal(resolveReEnvironment(env), 'development');
  assert.equal(isReLeadgenEnabled(env), true);
  assert.equal(getReAccessState(env).enabled, true);
});

test('ENVIRONMENT=production disables by default (fail closed)', () => {
  const env = { ENVIRONMENT: 'production' } as NodeJS.ProcessEnv;
  assert.equal(resolveReEnvironment(env), 'production');
  assert.equal(isReLeadgenEnabled(env), false);
  assert.equal(getReAccessState(env).enabled, false);
});

test('RE_LEADGEN_ENABLED=true enables on production', () => {
  const env = {
    ENVIRONMENT: 'production',
    RE_LEADGEN_ENABLED: 'true',
  } as NodeJS.ProcessEnv;
  assert.equal(isReLeadgenEnabled(env), true);
});

test('RE_LEADGEN_ENABLED=false disables on development', () => {
  const env = {
    ENVIRONMENT: 'development',
    RE_LEADGEN_ENABLED: 'false',
  } as NodeJS.ProcessEnv;
  assert.equal(isReLeadgenEnabled(env), false);
});

console.log('All re-access tests passed');
