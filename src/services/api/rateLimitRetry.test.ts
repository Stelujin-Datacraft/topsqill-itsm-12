/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/services/api/rateLimitRetry.test.ts
 */
import assert from 'node:assert/strict';
import { createRunOncePerKey } from '@/lib/runOncePerKey';
import { RATE_LIMIT_MAX_RETRIES, rateLimitRetryDelayMs } from '@/services/api/rateLimitRetry';

const within = (value: number | null, min: number, max: number) => {
  assert.ok(value !== null && value >= min && value <= max, `${value} not in [${min}, ${max}]`);
};

within(rateLimitRetryDelayMs('2', 0), 2000, 2250);
within(rateLimitRetryDelayMs(null, 0), 1000, 1250);
within(rateLimitRetryDelayMs(null, 2), 4000, 4250);
within(rateLimitRetryDelayMs('0', 0), 250, 500);
const now = Date.parse('2026-11-02T05:00:00Z');
within(rateLimitRetryDelayMs('Mon, 02 Nov 2026 05:00:03 GMT', 0, now), 3000, 3250);
assert.equal(rateLimitRetryDelayMs('60', 0), null, 'long waits surface the error instead of hanging the UI');
assert.equal(rateLimitRetryDelayMs('1', RATE_LIMIT_MAX_RETRIES), null);

const once = createRunOncePerKey<number>();
let runs = 0;
const task = async () => ({ value: ++runs });
const [a, b] = await Promise.all([once('p1', task), once('p1', task)]);
assert.equal(a, 1);
assert.equal(b, 1);
assert.equal(await once('p1', task), 1);
assert.equal(await once('p2', task), 2);

let attempts = 0;
const flaky = async () => ({ value: ++attempts, retry: attempts === 1 });
assert.equal(await once('p3', flaky), 1);
assert.equal(await once('p3', flaky), 2);
assert.equal(await once('p3', flaky), 2);

let throws = true;
await assert.rejects(once('p4', async () => {
  if (throws) throw new Error('offline');
  return { value: 7 };
}));
throws = false;
assert.equal(await once('p4', async () => ({ value: 7 })), 7);

console.log('rate limit retry checks passed');
