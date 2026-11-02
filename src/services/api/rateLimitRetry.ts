export const RATE_LIMIT_MAX_RETRIES = 3;
const MAX_WAIT_MS = 15_000;

/**
 * How long to wait before retrying a 429, or null to give up.
 * Uses the server's Retry-After (seconds or HTTP date) and otherwise backs off 1s, 2s, 4s.
 */
export function rateLimitRetryDelayMs(
  retryAfter: string | null,
  attempt: number,
  now: number = Date.now(),
): number | null {
  if (attempt >= RATE_LIMIT_MAX_RETRIES) return null;
  const header = (retryAfter || '').trim();
  let waitMs = 1000 * 2 ** attempt;
  if (/^\d+(\.\d+)?$/.test(header)) {
    waitMs = Number(header) * 1000;
  } else if (header) {
    const at = Date.parse(header);
    if (!Number.isNaN(at)) waitMs = at - now;
  }
  if (waitMs > MAX_WAIT_MS) return null;
  const jitter = Math.floor(Math.random() * 250);
  return Math.max(250, waitMs) + jitter;
}
