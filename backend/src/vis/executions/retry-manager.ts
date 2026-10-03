/**
 * Retry with fixed / exponential backoff + jitter.
 */
import type { RetryPolicy } from '../core/types/index';

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function computeBackoffMs(
  attempt: number,
  policy: { type: RetryPolicy; initialDelayMs: number; maxDelayMs: number },
): number {
  if (policy.type === 'NONE') return 0;
  if (policy.type === 'FIXED') {
    return policy.initialDelayMs;
  }
  const exp = policy.initialDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(exp, policy.maxDelayMs);
  const jitter = capped * (0.2 * Math.random());
  return Math.floor(capped + jitter);
}

export async function withRetries<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    type: RetryPolicy;
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    shouldRetry: (err: unknown, attempt: number) => boolean;
    onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= opts.maxAttempts || !opts.shouldRetry(err, attempt)) throw err;
      const delay = computeBackoffMs(attempt, opts);
      opts.onRetry?.(err, attempt, delay);
      if (delay > 0) await sleep(delay);
    }
  }
  throw lastErr;
}
