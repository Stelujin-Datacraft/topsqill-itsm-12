/**
 * Stable form field logical keys.
 * Physical UUID remains the API/DB id; logical_key is portable identity.
 */
import { normalizeLogicalKey, slugify, isValidLogicalKey } from './logical-keys';

export function fieldKeyFromConfig(customConfig: unknown, label: string): string | null {
  const cfg = (customConfig && typeof customConfig === 'object'
    ? (customConfig as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const candidates = [cfg.fieldKey, cfg.field_key, cfg.name, cfg.key, label]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (!candidates.length) return null;
  const leaf = slugify(candidates[0]);
  return leaf || null;
}

export function composeFieldLogicalKey(formKey: string | null | undefined, leaf: string): string {
  const cleanLeaf = normalizeLogicalKey(leaf);
  if (formKey && isValidLogicalKey(normalizeLogicalKey(formKey))) {
    const fk = normalizeLogicalKey(formKey);
    if (cleanLeaf.startsWith(`${fk}.`)) return cleanLeaf;
    return normalizeLogicalKey(`${fk}.${cleanLeaf}`);
  }
  return cleanLeaf;
}

export interface FieldKeyBackfillRow {
  id: string;
  formId: string | null;
  label: string;
  logicalKey: string | null;
  customConfig: unknown;
  formLogicalKey?: string | null;
  formReferenceId?: string | null;
}

export interface FieldKeyBackfillResult {
  updated: Array<{ id: string; logicalKey: string }>;
  conflicts: Array<{ logicalKey: string; fieldIds: string[] }>;
  skipped: string[];
}

/**
 * Plan deterministic field-key backfill without inventing random keys.
 * Conflicts (same form + same key, different fields) are reported, not auto-resolved.
 */
export function planFieldKeyBackfill(rows: FieldKeyBackfillRow[]): FieldKeyBackfillResult {
  const updated: FieldKeyBackfillResult['updated'] = [];
  const skipped: string[] = [];
  const byFormKey = new Map<string, string[]>(); // formId::key -> field ids proposing it

  for (const row of rows) {
    if (row.logicalKey && isValidLogicalKey(normalizeLogicalKey(row.logicalKey))) {
      skipped.push(row.id);
      continue;
    }
    const leaf = fieldKeyFromConfig(row.customConfig, row.label);
    if (!leaf) {
      skipped.push(row.id);
      continue;
    }
    const formKey = row.formLogicalKey || row.formReferenceId || null;
    const logicalKey = composeFieldLogicalKey(formKey, leaf);
    if (!isValidLogicalKey(logicalKey)) {
      skipped.push(row.id);
      continue;
    }
    const scope = `${row.formId || 'none'}::${logicalKey}`;
    const list = byFormKey.get(scope) || [];
    list.push(row.id);
    byFormKey.set(scope, list);
    updated.push({ id: row.id, logicalKey });
  }

  const conflicts: FieldKeyBackfillResult['conflicts'] = [];
  const conflictIds = new Set<string>();
  for (const [scope, ids] of byFormKey) {
    const unique = [...new Set(ids)];
    if (unique.length > 1) {
      conflicts.push({ logicalKey: scope.split('::')[1], fieldIds: unique });
      unique.forEach((id) => conflictIds.add(id));
    }
  }

  return {
    updated: updated.filter((u) => !conflictIds.has(u.id)),
    conflicts,
    skipped,
  };
}
