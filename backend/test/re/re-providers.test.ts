/**
 * Run: npx tsx test/re/re-providers.test.ts
 */
import assert from 'node:assert/strict';
import {
  normalizeGooglePayload,
  normalizeLinkedInPayload,
  normalizeMetaPayload,
  normalizePortalPayload,
  normalizeWebsitePayload,
} from '../../src/re/re-providers';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Real Estate — lead payload normalizers');

test('website payload', () => {
  const n = normalizeWebsitePayload({
    name: 'Asha',
    email: 'asha@example.com',
    phone: '+91111',
    message: '2BHK',
  });
  assert.equal(n.source, 'website');
  assert.equal(n.contactName, 'Asha');
  assert.equal(n.contactEmail, 'asha@example.com');
});

test('meta field_data', () => {
  const n = normalizeMetaPayload({
    field_data: [
      { name: 'full_name', values: ['Ravi'] },
      { name: 'email', values: ['ravi@x.com'] },
      { name: 'phone_number', values: ['999'] },
    ],
    leadgen_id: 'lg1',
  });
  assert.equal(n.source, 'meta_ads');
  assert.equal(n.contactName, 'Ravi');
  assert.equal(n.externalId, 'lg1');
});

test('google user_column_data', () => {
  const n = normalizeGooglePayload({
    user_column_data: [
      { column_id: 'FULL_NAME', string_value: 'Neha' },
      { column_id: 'EMAIL', string_value: 'neha@x.com' },
      { column_id: 'PHONE_NUMBER', string_value: '888' },
    ],
    lead_id: 'g1',
  });
  assert.equal(n.contactName, 'Neha');
  assert.equal(n.contactEmail, 'neha@x.com');
  assert.equal(n.externalId, 'g1');
});

test('linkedin answers', () => {
  const n = normalizeLinkedInPayload({
    answers: [
      { question: 'Full name', answer: 'Omar' },
      { question: 'Email', answer: 'omar@x.com' },
    ],
    id: 'li1',
  });
  assert.equal(n.contactName, 'Omar');
  assert.equal(n.externalId, 'li1');
});

test('portal email body scrape', () => {
  const n = normalizePortalPayload('portal_email', {
    subject: 'Enquiry',
    body: 'Buyer interested. Reach buyer@y.com or +91 98765 43210',
  });
  assert.equal(n.source, 'portal_email');
  assert.ok(n.contactEmail?.includes('@'));
  assert.ok(n.contactPhone);
});

console.log('All re-providers tests passed');
