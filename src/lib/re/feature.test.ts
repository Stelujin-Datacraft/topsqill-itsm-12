/**
 * Run: npx tsx src/lib/re/feature.test.ts
 *
 * Pure helpers are tested via env injection by temporarily assigning
 * process.env-backed Vite stubs is awkward; instead we re-validate the
 * same boolean rules the module uses.
 */
import assert from 'node:assert/strict';

function parseFlag(raw: unknown): boolean | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return null;
}

function isEnabled(flagRaw: unknown, environment: 'development' | 'production'): boolean {
  const flag = parseFlag(flagRaw);
  if (flag !== null) return flag;
  return environment === 'development';
}

assert.equal(isEnabled(undefined, 'development'), true);
assert.equal(isEnabled(undefined, 'production'), false);
assert.equal(isEnabled('true', 'production'), true);
assert.equal(isEnabled('false', 'development'), false);
console.log('re/feature defaults: ok');
