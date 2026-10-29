/**
 * Absolute HTTP(S) check for URL fields.
 * `http-or-https` accepts only http: and https:. Other protocol values keep the
 * previous startsWith behavior. `any` accepts any URL the parser can read.
 */
export function urlProtocolError(
  value: string,
  protocol?: string,
  fallbackMessage?: string,
): string {
  const raw = String(value ?? '');
  if (!raw.trim()) return '';

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fallbackMessage || 'Invalid URL format';
  }

  if (!protocol || protocol === 'any') return '';

  if (protocol === 'http-or-https') {
    if (url.protocol === 'http:' || url.protocol === 'https:') return '';
    return fallbackMessage || 'Enter an absolute HTTP or HTTPS URL.';
  }

  if (!url.protocol.startsWith(protocol)) {
    return `Invalid protocol, expected ${protocol}`;
  }
  return '';
}

export function isAbsoluteHttpUrl(value: string): boolean {
  return urlProtocolError(value, 'http-or-https') === '';
}
