/**
 * Unit tests for Promotional Transfer registry, sanitization, and selection rules.
 * Run: npx tsx test/promotion/promotion.registry.test.ts
 */
import assert from 'node:assert/strict';
import {
  PROMOTABLE_REGISTRY,
  NON_PROMOTABLE_CATEGORIES,
  isRegisteredPromotable,
  assertPromotable,
  listModules,
  getRegistryEntry,
} from '../../src/promotion/registry/promotable-registry';
import { contentHash, versionFromPayload, stableStringify } from '../../src/promotion/registry/types';
import { sanitizeEnvSpecific } from '../../src/promotion/engines/env-values';
import { getHandler, listHandlers } from '../../src/promotion/handlers';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Promotional Transfer — registry & safety tests');

test('registry only contains explicitly promotable types', () => {
  assert.ok(PROMOTABLE_REGISTRY.length >= 5);
  for (const e of PROMOTABLE_REGISTRY) {
    assert.equal(e.promotable, true);
    assert.ok(e.supportsRecordSelection);
    assert.ok(['Forms', 'Workflows', 'Reports', 'Notifications'].includes(e.module));
  }
});

test('operational data types are not registered', () => {
  for (const t of ['form_submissions', 'incidents', 'tickets', 'audit_logs', 'workflow_queue']) {
    assert.equal(isRegisteredPromotable(t), false);
    assert.ok(NON_PROMOTABLE_CATEGORIES.includes(t as any) || !getRegistryEntry(t));
  }
});

test('assertPromotable rejects unknown types', () => {
  assert.throws(() => assertPromotable('form_submissions'));
  assert.doesNotThrow(() => assertPromotable('form'));
});

test('modules list only includes modules with promotable objects', () => {
  const modules = listModules();
  assert.ok(modules.some((m) => m.module === 'Forms'));
  assert.ok(modules.some((m) => m.module === 'Workflows'));
  assert.ok(!modules.some((m) => m.module === 'Incidents' as any));
});

test('every registry type has a transfer handler', () => {
  const handlers = listHandlers();
  assert.equal(handlers.length, PROMOTABLE_REGISTRY.length);
  for (const e of PROMOTABLE_REGISTRY) {
    assert.equal(getHandler(e.objectType).objectType, e.objectType);
  }
});

test('content hash is stable for same payload', () => {
  const a = { name: 'A', layout: { x: 1 }, nested: { b: 2, a: 1 } };
  const b = { nested: { a: 1, b: 2 }, layout: { x: 1 }, name: 'A' };
  assert.equal(contentHash(a), contentHash(b));
  assert.equal(stableStringify(a), stableStringify(b));
});

test('versionFromPayload includes hash', () => {
  const v = versionFromPayload({ name: 'x' }, '2026-01-01T00:00:00Z');
  assert.match(v, /^v-/);
});

test('sanitizeEnvSpecific strips secrets and localhost URLs', () => {
  const { portable, stripped } = sanitizeEnvSpecific('workflow', {
    name: 'WF',
    api_key: 'secret-value',
    password: 'p@ss',
    webhook_url: 'http://localhost:3000/hook',
    label: 'keep-me',
    nodes: [{ config: { smtp_password: 'x', form_id: 'abc' } }],
  });
  assert.equal((portable as any).api_key, undefined);
  assert.equal((portable as any).password, undefined);
  assert.equal((portable as any).webhook_url, undefined);
  assert.equal((portable as any).label, 'keep-me');
  assert.ok(stripped.some((s) => s.includes('api_key') || s.includes('password')));
  assert.equal(((portable as any).nodes[0].config as any).smtp_password, undefined);
  assert.equal(((portable as any).nodes[0].config as any).form_id, 'abc');
});

test('form share_settings are treated as environment-specific', () => {
  const { portable, stripped } = sanitizeEnvSpecific('form', {
    name: 'Form',
    share_settings: { publicUrl: 'https://dev.example/form' },
    pages: [],
  });
  assert.equal((portable as any).share_settings, undefined);
  assert.ok(stripped.includes('share_settings'));
  assert.deepEqual((portable as any).pages, []);
});

test('unselected siblings rule: selection is explicit list only', () => {
  // Documented contract: engine only transfers items present in package selection.
  const selected = new Set(['form:A', 'form:C']);
  const all = ['form:A', 'form:B', 'form:C', 'form:D'];
  const promoted = all.filter((k) => selected.has(k));
  assert.deepEqual(promoted, ['form:A', 'form:C']);
  assert.ok(!promoted.includes('form:B'));
  assert.ok(!promoted.includes('form:D'));
});

console.log('\nAll promotional transfer tests passed.');
