/** Shared helpers for Change Field Value AI/UI binding. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLikelyUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/** True when a stored "name" is missing or just a copy of the field id/UUID. */
export function isUnusableFieldLabel(label: unknown, fieldId?: unknown): boolean {
  const name = String(label ?? '').trim();
  if (!name) return true;
  if (fieldId && name === String(fieldId).trim()) return true;
  if (isLikelyUuid(name)) return true;
  return false;
}

export function pickReadableFieldLabel(
  preferred: unknown,
  fallbackLabel: unknown,
  fieldId?: unknown,
): string {
  if (!isUnusableFieldLabel(preferred, fieldId)) return String(preferred).trim();
  if (!isUnusableFieldLabel(fallbackLabel, fieldId)) return String(fallbackLabel).trim();
  return 'Field';
}

export function resolveOptionStaticValue(
  options: Array<{ id?: string; value?: string; label?: string }> | undefined,
  requested: unknown,
): { value: string; label: string } | undefined {
  if (requested === undefined || requested === null || requested === '') return undefined;
  const raw = String(requested).trim();
  if (!raw || !Array.isArray(options) || options.length === 0) return undefined;

  const lower = raw.toLowerCase();
  const match = options.find((o) =>
    String(o.value ?? '').toLowerCase() === lower
    || String(o.label ?? '').toLowerCase() === lower
    || String(o.id ?? '').toLowerCase() === lower,
  );
  if (!match) return undefined;
  return {
    value: String(match.value ?? match.label ?? ''),
    label: String(match.label ?? match.value ?? ''),
  };
}
