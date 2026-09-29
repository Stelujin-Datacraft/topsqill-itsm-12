/** SSRF / URL safety helpers for outbound connectors. */

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
]);

function isPrivateIp(hostname: string): boolean {
  if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(hostname)) return true;
  return false;
}

/**
 * Validate outbound URL. By default blocks private/loopback hosts unless
 * `allowPrivateNetwork` is explicitly true (admin policy).
 */
export function assertSafeOutboundUrl(
  rawUrl: string,
  opts?: { allowPrivateNetwork?: boolean },
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const host = url.hostname.toLowerCase();
  const privateBlocked = !opts?.allowPrivateNetwork
    && (BLOCKED_HOSTS.has(host) || isPrivateIp(host) || host.endsWith('.local'));
  if (privateBlocked) {
    throw new Error(`Outbound access to private/internal host is blocked: ${host}`);
  }
  return url;
}

const SECRET_KEYS =
  /(password|passwd|secret|token|api[_-]?key|authorization|client[_-]?secret|refresh[_-]?token|access[_-]?token)/i;

export function maskSecrets<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === 'string') {
    return (value.length > 8 ? `${value.slice(0, 2)}***${value.slice(-2)}` : '***') as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => maskSecrets(v)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '***REDACTED***' : maskSecrets(v);
    }
    return out as T;
  }
  return value;
}
