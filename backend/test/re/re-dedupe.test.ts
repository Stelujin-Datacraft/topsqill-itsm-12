/**
 * Run: npx tsx test/re/re-dedupe.test.ts
 */
import assert from 'node:assert/strict';
import {
  findExactDedupeMatch,
  findPossibleDuplicates,
  mergeEmptyFields,
  shouldRestartFollowUp,
} from '../../src/re/re-dedupe';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Real Estate — dedupe matcher');

const now = new Date('2026-10-27T12:00:00Z');

test('matches by phone within window', () => {
  const hit = findExactDedupeMatch(
    [
      {
        id: 'a',
        phone_e164: '+919876543210',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ],
    { phoneE164: '+919876543210', windowDays: 90, now },
  );
  assert.equal(hit?.id, 'a');
});

test('matches by email', () => {
  const hit = findExactDedupeMatch(
    [{ id: 'b', email_normalized: 'x@y.com', updated_at: '2026-10-01T00:00:00Z' }],
    { emailNormalized: 'x@y.com', windowDays: 90, now },
  );
  assert.equal(hit?.id, 'b');
});

test('ignores outside window', () => {
  const hit = findExactDedupeMatch(
    [{ id: 'c', phone_e164: '+919876543210', updated_at: '2025-01-01T00:00:00Z' }],
    { phoneE164: '+919876543210', windowDays: 90, now },
  );
  assert.equal(hit, null);
});

test('possible duplicates by name+locality', () => {
  const possibles = findPossibleDuplicates(
    [
      {
        id: '1',
        name_normalized: 'priya shah',
        custom_answers: { locality: 'andheri' },
      },
      {
        id: '2',
        name_normalized: 'ravi mehta',
        custom_answers: { locality: 'powai' },
      },
    ],
    'priya shah',
    'andheri',
  );
  assert.equal(possibles.length, 1);
  assert.equal(possibles[0].id, '1');
});

test('mergeEmptyFields only fills blanks', () => {
  const patch = mergeEmptyFields(
    { contact_name: 'A', contact_email: null as string | null },
    { contact_name: 'B', contact_email: 'b@x.com' },
    ['contact_name', 'contact_email'],
  );
  assert.deepEqual(patch, { contact_email: 'b@x.com' });
});

test('follow-up restart only for new', () => {
  assert.equal(shouldRestartFollowUp('new'), true);
  assert.equal(shouldRestartFollowUp('qualified'), false);
});

console.log('All re-dedupe tests passed');
