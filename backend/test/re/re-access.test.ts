/**
 * Unit tests for Real Estate Lead Gen deployment access policy.
 * Run: npx tsx test/re/re-access.test.ts
 */
import assert from 'node:assert/strict';
import {
  getReAccessState,
  isReDedupeEnabled,
  isReLeadgenEnabled,
  isReMetaEnrichEnabled,
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

test('META_ENRICH and DEDUPE default on in development', () => {
  const env = { ENVIRONMENT: 'development' } as NodeJS.ProcessEnv;
  assert.equal(isReMetaEnrichEnabled(env), true);
  assert.equal(isReDedupeEnabled(env), true);
  assert.equal(getReAccessState(env).metaEnrichEnabled, true);
  assert.equal(getReAccessState(env).dedupeEnabled, true);
});

test('META_ENRICH and DEDUPE fail closed on production', () => {
  const env = { ENVIRONMENT: 'production', RE_LEADGEN_ENABLED: 'true' } as NodeJS.ProcessEnv;
  assert.equal(isReMetaEnrichEnabled(env), false);
  assert.equal(isReDedupeEnabled(env), false);
});

test('META_ENRICH can be enabled on production explicitly', () => {
  const env = {
    ENVIRONMENT: 'production',
    RE_LEADGEN_ENABLED: 'true',
    RE_LEADGEN_META_ENRICH: 'true',
    RE_LEADGEN_DEDUPE: 'true',
  } as NodeJS.ProcessEnv;
  assert.equal(isReMetaEnrichEnabled(env), true);
  assert.equal(isReDedupeEnabled(env), true);
});

console.log('All re-access tests passed');
