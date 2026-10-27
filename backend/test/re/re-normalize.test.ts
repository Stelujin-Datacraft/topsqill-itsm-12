/**
 * Run: npx tsx test/re/re-normalize.test.ts
 */
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  normalizeLeadFields,
  normalizeName,
  normalizePhoneE164,
  parseBudgetInr,
} from '../../src/re/re-normalize';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Real Estate — normalisation');

const phoneCases: Array<[string, string | null, boolean]> = [
  ['9876543210', '+919876543210', false],
  ['09876543210', '+919876543210', false],
  ['+91 98765 43210', '+919876543210', false],
  ['+91-98765-43210', '+919876543210', false],
  ['00919876543210', '+919876543210', false],
  ['919876543210', '+919876543210', false],
  ['91 9876543210', '+919876543210', false],
  ['(022) 1234 5678', '+912212345678', false],
  ['+1 415 555 2671', '+14155552671', false],
  ['123', null, true],
  ['', null, false],
  ['0000000000', null, true],
  ['+91 09876543210', '+919876543210', false],
  ['98765-43210', '+919876543210', false],
  ['  9876543210  ', '+919876543210', false],
  ['0091-9876543210', '+919876543210', false],
  ['++919876543210', '+919876543210', false],
  ['91-09876543210', '+919876543210', false],
  ['8 0 0 0 0 0 0 0 0 0', '+918000000000', false],
  ['abcdefghij', null, true],
];

for (const [raw, expected, invalid] of phoneCases) {
  test(`phone: ${JSON.stringify(raw)}`, () => {
    const r = normalizePhoneE164(raw, '+91');
    assert.equal(r.e164, expected, `e164 for ${raw}`);
    assert.equal(r.invalid, invalid, `invalid for ${raw}`);
  });
}

const budgetCases: Array<[string, number | null]> = [
  ['1.5 Cr', 15_000_000],
  ['2 crore', 20_000_000],
  ['80 L', 8_000_000],
  ['80 lakh', 8_000_000],
  ['90 lakhs', 9_000_000],
  ['50 lac', 5_000_000],
  ['₹1,20,00,000', 12_000_000],
  ['1200000', 1_200_000],
  ['1 Cr', 10_000_000],
  ['0.5 Cr', 5_000_000],
  ['25 L', 2_500_000],
  ['around 90 lakh only', 9_000_000],
  ['budget 2.25 crore', 22_500_000],
  ['₹80,00,000', 8_000_000],
  ['3 crores', 30_000_000],
  ['1.25 Cr', 12_500_000],
  ['75L', 7_500_000],
  ['not a budget', null],
  ['', null],
  ['₹ 45,00,000', 4_500_000],
];

for (const [raw, expected] of budgetCases) {
  test(`budget: ${JSON.stringify(raw)}`, () => {
    const r = parseBudgetInr(raw);
    assert.equal(r.budgetInr, expected, `budget for ${raw}`);
  });
}

test('email trim/lowercase', () => {
  const r = normalizeEmail('  Foo.Bar@Example.COM ');
  assert.equal(r.normalized, 'foo.bar@example.com');
  assert.equal(r.invalid, false);
});

test('email invalid', () => {
  const r = normalizeEmail('not-an-email');
  assert.equal(r.invalid, true);
});

test('name title-case + unknown fallback', () => {
  assert.equal(normalizeName('priya SHAH').display, 'Priya Shah');
  assert.ok(normalizeName('', 'meta_ads').display.includes('Unknown'));
});

test('normalizeLeadFields aggregate', () => {
  const f = normalizeLeadFields({
    contactName: 'asha verma',
    contactEmail: 'Asha@X.com',
    contactPhone: '9876543210',
    budgetText: '80 L',
    sourceLabel: 'website',
  });
  assert.equal(f.contactName, 'Asha Verma');
  assert.equal(f.phoneE164, '+919876543210');
  assert.equal(f.emailNormalized, 'asha@x.com');
  assert.equal(f.budgetInr, 8_000_000);
});

console.log('All re-normalize tests passed');
