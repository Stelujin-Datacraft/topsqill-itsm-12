/**
 * Multi-module package normalization tests.
 * Run: npx tsx test/promotion/promotion.multi-module.test.ts
 */
import assert from 'node:assert/strict';
import { normalizePackageModules, parseModulesQuery } from '../../src/promotion/package-modules';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Promotional Transfer — multi-module packages');

test('single module via module field', () => {
  const r = normalizePackageModules({ module: 'Forms' });
  assert.deepEqual(r.modules, ['Forms']);
  assert.equal(r.moduleLabel, 'Forms');
});

test('multiple modules via modules array', () => {
  const r = normalizePackageModules({ modules: ['Forms', 'Workflows', 'Reports'] });
  assert.deepEqual(r.modules, ['Forms', 'Workflows', 'Reports']);
  assert.equal(r.moduleLabel, 'Forms + Workflows + Reports');
});

test('dedupes and ignores invalid modules', () => {
  const r = normalizePackageModules({ modules: ['Forms', 'Forms', 'NotAModule', 'Workflows'] });
  assert.deepEqual(r.modules, ['Forms', 'Workflows']);
  assert.equal(r.moduleLabel, 'Forms + Workflows');
});

test('comma-separated modules query string', () => {
  const r = normalizePackageModules({ modules: 'Forms, Workflows' });
  assert.deepEqual(r.modules, ['Forms', 'Workflows']);
});

test('rejects empty selection', () => {
  assert.throws(() => normalizePackageModules({}), /at least one valid/);
});

test('parseModulesQuery returns null when unset', () => {
  assert.equal(parseModulesQuery(undefined, undefined), null);
});

test('parseModulesQuery parses modules param', () => {
  assert.deepEqual(parseModulesQuery(undefined, 'Forms,Reports'), ['Forms', 'Reports']);
});

console.log('\nAll multi-module package tests passed.');
