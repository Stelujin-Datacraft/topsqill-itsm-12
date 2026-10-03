/**
 * Webhook security — HMAC / API key / Bearer.
 * Secrets loaded via credentialRefId only; never logged.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export type WebhookAuthType = 'HMAC' | 'API_KEY' | 'BEARER' | 'BASIC' | 'NONE';

export interface WebhookSecurityConfig {
  authType: WebhookAuthType;
  /** Resolve secret via credential reference — never embed plaintext. */
  credentialRefId?: string | null;
  signatureHeader?: string;
  timestampHeader?: string;
  algorithm?: 'sha256' | 'sha1';
  maxSkewSeconds?: number;
}

export interface WebhookSecurityResult {
  ok: boolean;
  code?: string;
  message?: string;
}

function secureCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export class WebhookSecurityService {
  constructor(
    private readonly resolveSecret: (credentialRefId: string) => Promise<string | null>,
  ) {}

  async verify(
    config: WebhookSecurityConfig,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<WebhookSecurityResult> {
    const auth = config.authType || 'NONE';
    if (auth === 'NONE') return { ok: true };

    const h = normalizeHeaders(headers);

    if (auth === 'API_KEY') {
      const expected = config.credentialRefId
        ? await this.resolveSecret(config.credentialRefId)
        : null;
      if (!expected) {
        return { ok: false, code: 'AUTHENTICATION_ERROR', message: 'API key not configured' };
      }
      const provided = h['x-api-key'] || h['api-key'] || '';
      if (!secureCompare(provided, expected)) {
        return { ok: false, code: 'AUTHENTICATION_ERROR', message: 'Invalid API key' };
      }
      return { ok: true };
    }

    if (auth === 'BEARER') {
      const expected = config.credentialRefId
        ? await this.resolveSecret(config.credentialRefId)
        : null;
      if (!expected) {
        return { ok: false, code: 'AUTHENTICATION_ERROR', message: 'Bearer token not configured' };
      }
      const authHeader = h.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!secureCompare(token, expected)) {
        return { ok: false, code: 'AUTHENTICATION_ERROR', message: 'Invalid bearer token' };
      }
      return { ok: true };
    }

    if (auth === 'HMAC') {
      const secret = config.credentialRefId
        ? await this.resolveSecret(config.credentialRefId)
        : null;
      if (!secret) {
        return { ok: false, code: 'AUTHENTICATION_ERROR', message: 'HMAC secret not configured' };
      }
      const sigHeader = (config.signatureHeader || 'x-signature').toLowerCase();
      const tsHeader = (config.timestampHeader || 'x-timestamp').toLowerCase();
      const provided = (h[sigHeader] || '').replace(/^sha256=/i, '');
      const ts = h[tsHeader];
      const maxSkew = config.maxSkewSeconds ?? 300;
      if (ts) {
        const skew = Math.abs(Date.now() - Number(ts) * (String(ts).length <= 10 ? 1000 : 1));
        if (Number.isFinite(Number(ts)) && skew > maxSkew * 1000) {
          return {
            ok: false,
            code: 'AUTHENTICATION_ERROR',
            message: 'Timestamp outside allowed skew (replay protection)',
          };
        }
      }
      const algo = config.algorithm || 'sha256';
      const payload = ts ? `${ts}.${rawBody}` : rawBody;
      const expected = createHmac(algo, secret).update(payload).digest('hex');
      if (!secureCompare(provided, expected)) {
        return { ok: false, code: 'AUTHENTICATION_ERROR', message: 'Invalid HMAC signature' };
      }
      return { ok: true };
    }

    if (auth === 'BASIC') {
      const expected = config.credentialRefId
        ? await this.resolveSecret(config.credentialRefId)
        : null;
      if (!expected) {
        return { ok: false, code: 'AUTHENTICATION_ERROR', message: 'Basic auth not configured' };
      }
      const authHeader = h.authorization || '';
      const b64 = authHeader.replace(/^Basic\s+/i, '');
      if (
        !secureCompare(b64, Buffer.from(expected).toString('base64'))
        && !secureCompare(b64, expected)
      ) {
        return { ok: false, code: 'AUTHENTICATION_ERROR', message: 'Invalid basic auth' };
      }
      return { ok: true };
    }

    return { ok: false, code: 'CONFIGURATION_ERROR', message: `Unsupported auth type ${auth}` };
  }
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

/** Helper for tests / mock providers to sign payloads. */
export function signHmac(secret: string, body: string, timestamp?: string): string {
  const payload = timestamp ? `${timestamp}.${body}` : body;
  return createHmac('sha256', secret).update(payload).digest('hex');
}
