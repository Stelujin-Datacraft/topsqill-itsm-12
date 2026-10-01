/**
 * Secret scrubbing for promotion packages.
 * Secrets must NEVER enter packages, git, logs, or queue payloads.
 */

const SECRET_KEY_PATTERN =
  /(password|secret|token|api[_-]?key|client[_-]?secret|private[_-]?key|access[_-]?key|refresh[_-]?token|credential|authorization|bearer)/i;

const SECRET_VALUE_HINT =
  /^(sk_|pk_|ghp_|xox[baprs]-|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export function looksLikeSecretValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < 8) return false;
  return SECRET_VALUE_HINT.test(value);
}

/**
 * Deep-clone and strip secrets. Replaces secret fields with null and
 * preserves credentialReferenceId / credential_reference_id slots.
 */
export function scrubSecrets<T>(input: T): T {
  return scrubInner(input, '') as T;
}

function scrubInner(value: unknown, path: string): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v, i) => scrubInner(v, `${path}[${i}]`));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      // Keep reference slots — never the resolved secret material
      if (
        lower === 'credentialreferenceid' ||
        lower === 'credential_reference_id' ||
        lower === 'secretprovider' ||
        lower === 'secret_provider'
      ) {
        out[k] = typeof v === 'string' ? v : v == null ? null : String(v);
        continue;
      }
      // credentials / oauth / secrets blobs — replace with empty object (never export values)
      if (lower === 'credentials' || lower === 'oauth' || lower === 'secrets') {
        out[k] = {};
        continue;
      }
      if (isSecretKey(k)) {
        out[k] = null;
        continue;
      }
      out[k] = scrubInner(v, path ? `${path}.${k}` : k);
    }
    return out;
  }
  return value;
}

/** Assert package JSON contains no residual secret material (best-effort). */
export function assertNoSecrets(payload: unknown, path = 'package'): string[] {
  const violations: string[] = [];
  walk(payload, path, violations);
  return violations;
}

function walk(value: unknown, path: string, violations: string[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, violations));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = `${path}.${k}`;
      if (
        k.toLowerCase() === 'credentialreferenceid' ||
        k.toLowerCase() === 'credential_reference_id'
      ) {
        continue;
      }
      if (isSecretKey(k) && v != null && v !== '' && !(typeof v === 'object' && Object.keys(v as object).length === 0)) {
        violations.push(`${next}: secret key must be null/empty in packages`);
      }
      if (typeof v === 'string' && looksLikeSecretValue(v) && isSecretKey(k)) {
        violations.push(`${next}: secret-like value`);
      }
      walk(v, next, violations);
    }
  }
}
