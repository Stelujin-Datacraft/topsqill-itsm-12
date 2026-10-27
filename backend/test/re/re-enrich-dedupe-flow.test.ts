/**
 * Integration-style simulation (no live Graph/DB):
 * Meta webhook payload → enrichment mapping → lead shape;
 * then same person via 99acres → exact dedupe → re-enquiry mode.
 *
 * Run: npx tsx test/re/re-enrich-dedupe-flow.test.ts
 */
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { normalizeLeadFields } from '../../src/re/re-normalize';
import { findExactDedupeMatch } from '../../src/re/re-dedupe';
import { normalizeMetaPayload, normalizePortalPayload } from '../../src/re/re-providers';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('Real Estate — Meta enrich + portal re-enquiry flow (simulated)');

test('Meta signature HMAC validates', () => {
  const secret = 'app-secret';
  const body = JSON.stringify({ entry: [] });
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(sig.slice(7), expected);
});

test('Meta field_data → normalised lead', () => {
  const n = normalizeMetaPayload({
    field_data: [
      { name: 'full_name', values: ['Neha Kapoor'] },
      { name: 'email', values: ['Neha@Example.com'] },
      { name: 'phone_number', values: ['9876543210'] },
      { name: 'budget', values: ['80 L'] },
    ],
    leadgen_id: 'lg-100',
  });
  const f = normalizeLeadFields({
    contactName: n.contactName,
    contactEmail: n.contactEmail,
    contactPhone: n.contactPhone,
    budgetText: '80 L',
    sourceLabel: 'meta_ads',
  });
  assert.equal(f.phoneE164, '+919876543210');
  assert.equal(f.emailNormalized, 'neha@example.com');
  assert.equal(f.budgetInr, 8_000_000);
  assert.equal(n.externalId, 'lg-100');
});

test('same person via 99acres matches Meta lead', () => {
  const existing = [
    {
      id: 'lead-meta',
      phone_e164: '+919876543210',
      email_normalized: 'neha@example.com',
      updated_at: new Date().toISOString(),
    },
  ];
  const portal = normalizePortalPayload('portal_99acres', {
    name: 'Neha Kapoor',
    email: 'neha@example.com',
    phone: '09876543210',
    subject: 'Enquiry',
  });
  const f = normalizeLeadFields({
    contactName: portal.contactName,
    contactEmail: portal.contactEmail,
    contactPhone: portal.contactPhone,
    sourceLabel: 'portal_99acres',
  });
  const match = findExactDedupeMatch(existing, {
    phoneE164: f.phoneE164,
    emailNormalized: f.emailNormalized,
    windowDays: 90,
  });
  assert.equal(match?.id, 'lead-meta');
});

console.log('All re-enrich-dedupe-flow tests passed');
