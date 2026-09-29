/**
 * Secret hygiene helpers for VIS pilot / CI.
 * Never print secret values — only fingerprints / booleans.
 */
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { resolve } from 'path';

const SECRET_KEY_PATTERN =
  /\b(password|passwd|client_secret|access_token|refresh_token|api[_-]?key|private_key|service_role)\b/i;

const SECRET_VALUE_PATTERN =
  /(password|client_secret|access_token|refresh_token|api[_-]?key|private_key)\s*[:=]\s*["'][^"']{8,}["']/i;

const HIGH_CONFIDENCE_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[A-Za-z0-9]{16,}/,
  /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/,
];

/** Patterns allowed in tests / examples (not real customer secrets). */
const ALLOWLIST =
  /CHANGE_ME|dev-only-not-for-prod|must-not-leak|should-redact|test-token|placeholder|credentialReferenceId|VIS_TOKEN_|\[REDACTED\]|\*\*\*|readiness-gate-key|pilot-test-secret|local-oidc-secret/;

export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function containsSecretLikeValue(payload: unknown, path = ''): string[] {
  const hits: string[] = [];
  if (payload == null) return hits;
  if (typeof payload === 'string') {
    if (HIGH_CONFIDENCE_PATTERNS.some((p) => p.test(payload)) && !ALLOWLIST.test(payload)) {
      hits.push(path || '<string>');
    }
    return hits;
  }
  if (Array.isArray(payload)) {
    payload.forEach((v, i) => hits.push(...containsSecretLikeValue(v, `${path}[${i}]`)));
    return hits;
  }
  if (typeof payload === 'object') {
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k;
      if (SECRET_KEY_PATTERN.test(k) && typeof v === 'string' && v.length > 4 && !ALLOWLIST.test(v) && v !== '***REDACTED***') {
        // Key named like a secret with a non-redacted string value
        if (!/Reference|Env|Ref$/i.test(k)) hits.push(p);
      }
      hits.push(...containsSecretLikeValue(v, p));
    }
  }
  return hits;
}

export function assertNoSecretsInPayload(payload: unknown, label: string) {
  const hits = containsSecretLikeValue(payload);
  if (hits.length) {
    throw new Error(`Secret hygiene failed for ${label}: paths=${hits.slice(0, 10).join(',')}`);
  }
}

export interface RepoSecretScanResult {
  ok: boolean;
  findings: string[];
  scannedVia: string;
}

/**
 * Heuristic repo secret scan (same spirit as scripts/security/scan.sh).
 * Excludes node_modules/dist/.git.
 */
export function scanRepositoryForSecrets(repoRoot: string): RepoSecretScanResult {
  const root = resolve(repoRoot);
  try {
    const out = execSync(
      `rg -n --hidden -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/.git/**' -g '!**/generated/**' -g '!**/.vis-data/**' `
        + `-e 'AKIA[0-9A-Z]{16}' `
        + `-e 'sk_live_[A-Za-z0-9]{16,}' `
        + `-e '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----' `
        + `-e 'password\\\\s*[:=]\\\\s*["'\\\''"][^"'\\\''"]{8,}["'\\\''"]' `
        + `"${root}" || true`,
      { encoding: 'utf8', maxBuffer: 5_000_000, shell: '/bin/bash' },
    );
    const findings = out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !ALLOWLIST.test(l))
      // Local docker password literals should not remain in source; flag them
      .filter((l) => !l.includes('scanRepositoryForSecrets'));
    return { ok: findings.length === 0, findings: findings.slice(0, 50), scannedVia: 'rg-heuristic' };
  } catch (e: any) {
    return { ok: false, findings: [e?.message || String(e)], scannedVia: 'rg-heuristic-error' };
  }
}

export function scanTextForEmbeddedSecrets(text: string): string[] {
  const hits: string[] = [];
  if (SECRET_VALUE_PATTERN.test(text) && !ALLOWLIST.test(text)) hits.push('secret_assignment');
  for (const p of HIGH_CONFIDENCE_PATTERNS) {
    if (p.test(text) && !ALLOWLIST.test(text)) hits.push(p.source);
  }
  // Catch committed DB URLs with embedded passwords
  if (/postgresql:\/\/[^:]+:[^@\s]+@/i.test(text) && !/:\*\*\*@|:CHANGE_ME@|:\$\{/.test(text)) {
    if (!ALLOWLIST.test(text)) hits.push('postgresql_url_with_password');
  }
  return hits;
}
