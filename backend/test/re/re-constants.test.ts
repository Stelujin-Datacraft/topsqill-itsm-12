/**
 * Run: npx tsx test/re/re-constants.test.ts
 */
import assert from 'node:assert/strict';
import {
  RE_LEAD_STATUSES,
  RE_LISTING_STATUSES,
  RE_PROFILE_TYPES,
  isOneOf,
} from '../../src/re/re.constants';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Real Estate — status/type allowlists');

test('accepts valid lead status', () => {
  assert.equal(isOneOf('qualified', RE_LEAD_STATUSES), true);
});

test('rejects invalid lead status', () => {
  assert.equal(isOneOf('hot-lead', RE_LEAD_STATUSES), false);
});

test('accepts valid profile type', () => {
  assert.equal(isOneOf('dealer', RE_PROFILE_TYPES), true);
});

test('accepts valid listing status', () => {
  assert.equal(isOneOf('under_offer', RE_LISTING_STATUSES), true);
});

console.log('All re-constants tests passed');
