/**
 * Stable logical key helpers for promotion readiness.
 *
 * Strategy (non-breaking):
 * - Prefer existing `reference_id` where present (forms, workflows, reports, dashboards).
 * - Prefer explicit `logical_key` when present.
 * - Otherwise derive a slug from name under a namespace prefix.
 * - Never assume environment UUIDs are stable across DEV/QA/PROD.
 */

const KEY_RE = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$/;

export function slugify(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 64) || 'unnamed';
}

export function isValidLogicalKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0 && key.length <= 200 && KEY_RE.test(key);
}

export function normalizeLogicalKey(key: string): string {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

/**
 * Resolve the best available logical key for a record.
 * Does not invent cross-env UUID equality.
 */
export function resolveLogicalKey(opts: {
  logicalKey?: string | null;
  referenceId?: string | null;
  name?: string | null;
  namespace?: string | null;
  kind?: string;
}): string {
  if (opts.logicalKey && isValidLogicalKey(normalizeLogicalKey(opts.logicalKey))) {
    return normalizeLogicalKey(opts.logicalKey);
  }
  if (opts.referenceId && isValidLogicalKey(normalizeLogicalKey(opts.referenceId))) {
    return normalizeLogicalKey(opts.referenceId);
  }
  const ns = opts.namespace ? slugify(opts.namespace) : null;
  const leaf = slugify(opts.name || opts.kind || 'item');
  const derived = ns ? `${ns}.${leaf}` : leaf;
  return normalizeLogicalKey(derived);
}

/** Compose hierarchical keys: project.form.field */
export function composeKey(...parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .map((p) => slugify(String(p)))
    .join('.');
}

/**
 * Rewrite UUID-looking references inside definitions to logical keys when a map is provided.
 * Unmapped UUIDs are reported as INVALID_REFERENCE candidates (caller decides).
 */
export function rewriteUuidRefs(
  definition: Record<string, unknown>,
  idToKey: Map<string, string>,
): { rewritten: Record<string, unknown>; unresolved: string[] } {
  const unresolved = new Set<string>();
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function walk(v: unknown): unknown {
    if (typeof v === 'string') {
      if (UUID_RE.test(v)) {
        const mapped = idToKey.get(v.toLowerCase()) || idToKey.get(v);
        if (mapped) return mapped;
        unresolved.add(v);
        return v;
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(val);
      }
      return out;
    }
    return v;
  }

  return {
    rewritten: walk(definition) as Record<string, unknown>,
    unresolved: [...unresolved],
  };
}
