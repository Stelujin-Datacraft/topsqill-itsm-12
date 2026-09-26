/**
 * Run: npx tsx src/lib/ai/suggestApiKey.test.ts
 */
import {
  mergeApiKeySuggestion,
  normalizeApiKeyPermissions,
  suggestApiKeyFromPrompt,
} from './suggestApiKey';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const readOnly = suggestApiKeyFromPrompt(
  'Read-only key for Salesforce to pull submissions and reports',
);
assert(readOnly.permissions.submissions.includes('read'), 'submissions read');
assert(!readOnly.permissions.submissions.includes('create'), 'no create on read-only');
assert(readOnly.permissions.reports.includes('read'), 'reports read');
assert(readOnly.rateLimit >= 60, 'rate limit set');

const writeKey = suggestApiKeyFromPrompt(
  'Create submissions and trigger workflows, rate limit 100 req/min, expire in 30 days, IP 10.0.0.5',
);
assert(writeKey.permissions.submissions.includes('create'), 'create submissions');
assert(writeKey.permissions.workflows.includes('trigger'), 'trigger workflows');
assert(writeKey.rateLimit === 100, 'parsed rate limit');
assert(writeKey.expiresInDays === '30', 'parsed expiry');
assert(writeKey.allowedIps.includes('10.0.0.5'), 'parsed IP');

const normalized = normalizeApiKeyPermissions({
  forms: ['read', 'hack'],
  submissions: 'nope',
  workflows: ['trigger'],
});
assert(JSON.stringify(normalized.forms) === JSON.stringify(['read']), 'strip invalid actions');
assert(normalized.workflows.includes('trigger'), 'keep trigger');

const merged = mergeApiKeySuggestion('read only forms', {
  name: 'Forms Reader',
  permissions: { forms: ['read'], submissions: [], workflows: [], reports: [], users: [] },
  rateLimit: 200,
});
assert(merged.name === 'Forms Reader', 'AI name wins');
assert(merged.rateLimit === 200, 'AI rate limit wins');

console.log('All suggestApiKey tests passed.');
