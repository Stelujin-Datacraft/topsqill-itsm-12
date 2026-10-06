/**
 * Unit tests for Promotional Transfer deployment access policy.
 * Run: npx tsx test/promotion/promotion.access.test.ts
 */
import assert from 'node:assert/strict';
import {
  assertPromotionalTransferAllowed,
  getPromotionAccessState,
  isPromotionalTransferEnabled,
  resolveAppEnvironment,
} from '../../src/promotion/promotion-access';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Promotional Transfer — deployment access policy');

test('ENVIRONMENT=development enables by default', () => {
  const env = { ENVIRONMENT: 'development', NODE_ENV: 'production' } as NodeJS.ProcessEnv;
  assert.equal(resolveAppEnvironment(env), 'development');
  assert.equal(isPromotionalTransferEnabled(env), true);
  assert.doesNotThrow(() => assertPromotionalTransferAllowed(env));
});

test('ENVIRONMENT=production disables by default', () => {
  const env = { ENVIRONMENT: 'production', NODE_ENV: 'production' } as NodeJS.ProcessEnv;
  assert.equal(resolveAppEnvironment(env), 'production');
  assert.equal(isPromotionalTransferEnabled(env), false);
  assert.throws(() => assertPromotionalTransferAllowed(env), /Development environment/);
});

test('PROMOTIONAL_TRANSFER_ENABLED=false disables even in development', () => {
  const env = {
    ENVIRONMENT: 'development',
    PROMOTIONAL_TRANSFER_ENABLED: 'false',
  } as NodeJS.ProcessEnv;
  assert.equal(isPromotionalTransferEnabled(env), false);
  assert.throws(() => assertPromotionalTransferAllowed(env), /disabled/);
});

test('PROMOTIONAL_TRANSFER_ENABLED=true does not override production environment gate', () => {
  // Explicit enable flag alone is not enough — runtime must be Development.
  const env = {
    ENVIRONMENT: 'production',
    PROMOTIONAL_TRANSFER_ENABLED: 'true',
  } as NodeJS.ProcessEnv;
  assert.equal(isPromotionalTransferEnabled(env), true);
  assert.throws(() => assertPromotionalTransferAllowed(env), /Development environment/);
});

test('NODE_ENV fallback when ENVIRONMENT unset', () => {
  assert.equal(resolveAppEnvironment({ NODE_ENV: 'development' } as NodeJS.ProcessEnv), 'development');
  assert.equal(resolveAppEnvironment({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), 'production');
});

test('rejects non Dev→Prod direction keys', () => {
  const env = {
    ENVIRONMENT: 'development',
    PROMOTIONAL_TRANSFER_ENABLED: 'true',
    PROMOTION_SOURCE_KEY: 'TopsqillITSM_Prod',
    PROMOTION_TARGET_KEY: 'TopsqillITSM_Dev',
  } as NodeJS.ProcessEnv;
  assert.throws(() => assertPromotionalTransferAllowed(env), /Invalid promotion direction/);
});

test('availability state reports reason in production', () => {
  const state = getPromotionAccessState({ ENVIRONMENT: 'production' } as NodeJS.ProcessEnv);
  assert.equal(state.enabled, false);
  assert.match(state.reason, /Production/);
});

console.log('\nAll promotional transfer access tests passed.');
