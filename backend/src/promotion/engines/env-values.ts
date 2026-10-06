/**
 * Environment-specific value handling.
 * Portable configuration may transfer; secrets / env URLs / connection info must not
 * blindly overwrite Production.
 */

const SECRET_KEY_RE =
  /(password|secret|api[_-]?key|token|credential|private[_-]?key|smtp[_-]?pass|connection[_-]?string)/i;
const URL_KEY_RE = /(webhook[_-]?url|callback[_-]?url|endpoint[_-]?url|base[_-]?url|host)$/i;

export function sanitizeEnvSpecific(
  objectType: string,
  portable: Record<string, unknown>,
): { portable: Record<string, unknown>; stripped: string[] } {
  const stripped: string[] = [];
  const cleaned = deepSanitize(portable, '', stripped, objectType);
  return { portable: cleaned as Record<string, unknown>, stripped };
}

function deepSanitize(value: unknown, path: string, stripped: string[], objectType: string): unknown {
  if (Array.isArray(value)) {
    return value.map((v, i) => deepSanitize(v, `${path}[${i}]`, stripped, objectType));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    if (SECRET_KEY_RE.test(k)) {
      stripped.push(p);
      // Do not copy secret from Dev — leave undefined so Prod value is preserved on merge
      continue;
    }
    if (URL_KEY_RE.test(k) && typeof v === 'string' && /localhost|127\.0\.0\.1|\.dev\b|staging/i.test(v)) {
      stripped.push(p);
      continue;
    }
    // Share settings often contain environment URLs
    if (k === 'share_settings' && objectType === 'form') {
      stripped.push(p);
      continue;
    }
    out[k] = deepSanitize(v, p, stripped, objectType);
  }
  return out;
}

/**
 * When updating an existing Prod object, merge so stripped env-specific keys
 * keep their Production values.
 */
export function mergePreservingProdSecrets(
  incoming: Record<string, unknown>,
  existingProd: Record<string, unknown> | null | undefined,
  strippedPaths: string[],
): Record<string, unknown> {
  if (!existingProd || !strippedPaths.length) return incoming;
  const result = { ...incoming };
  for (const path of strippedPaths) {
    const prodVal = getByPath(existingProd, path);
    if (prodVal !== undefined) {
      setByPath(result, path, prodVal);
    }
  }
  return result;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}
