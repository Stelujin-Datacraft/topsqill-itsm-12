/**
 * Deep merge helpers for promotional form transfer (ChildApplyMode = merge).
 *
 * Digs into choice-field options and field/form rules (+ multi-actions)
 * so Merge appends/unions nested values instead of replacing whole arrays.
 * Replace mode never uses these — callers leave payload as package-only.
 */

export type JsonRecord = Record<string, unknown>;

/** Normalize JSON that may be stored as a string or already parsed. */
export function parseJsonArray(value: unknown): JsonRecord[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? (parsed.filter((x) => x && typeof x === 'object') as JsonRecord[]) : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value.filter((x) => x && typeof x === 'object') as JsonRecord[];
  }
  return [];
}

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

/** Stable key for a dropdown/radio/multiselect option (value, else label/name). */
export function optionStableKey(opt: unknown): string {
  if (opt == null) return '';
  if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
    return norm(opt);
  }
  if (typeof opt === 'object') {
    const rec = opt as JsonRecord;
    return norm(rec.value ?? rec.label ?? rec.name ?? rec.id);
  }
  return '';
}

/**
 * Union options: keep Prod-only, append Dev-only, Dev wins on matching key.
 * Preserves Prod order for existing keys; appends new Dev options at the end.
 */
export function mergeFieldOptions(prodOptions: unknown, devOptions: unknown): unknown[] {
  const prod = Array.isArray(prodOptions) ? prodOptions : [];
  const dev = Array.isArray(devOptions) ? [...devOptions] : [];
  if (!dev.length) return prod.length ? [...prod] : [];
  if (!prod.length) return [...dev];

  const result: unknown[] = [];
  const usedDev = new Set<number>();
  const prodKeys = new Map<string, number>(); // key -> first prod index kept

  for (const p of prod) {
    const key = optionStableKey(p);
    if (!key) {
      result.push(p);
      continue;
    }
    const di = dev.findIndex((d, i) => !usedDev.has(i) && optionStableKey(d) === key);
    if (di >= 0) {
      usedDev.add(di);
      result.push(dev[di]); // Dev wins on match
      prodKeys.set(key, result.length - 1);
    } else {
      result.push(p);
      if (!prodKeys.has(key)) prodKeys.set(key, result.length - 1);
    }
  }

  for (let i = 0; i < dev.length; i++) {
    if (usedDev.has(i)) continue;
    const key = optionStableKey(dev[i]);
    if (key && prodKeys.has(key)) continue; // already merged
    result.push(dev[i]);
  }

  return result;
}

/** Field types that commonly carry selectable option lists. */
export const CHOICE_FIELD_TYPES = new Set([
  'select',
  'multi-select',
  'radio',
  'checkbox',
  'tags',
  'dynamic-dropdown',
  'toggle-switch',
]);

export function fieldHasMergeableOptions(field: JsonRecord): boolean {
  const type = norm(field.field_type ?? field.type);
  if (CHOICE_FIELD_TYPES.has(type)) return true;
  return Array.isArray(field.options) && field.options.length > 0;
}

/**
 * Merge a Dev field payload onto an existing Prod field row.
 * Scalars/config come from Dev; options are union-merged when present.
 */
export function mergeFormFieldPayload(prodField: JsonRecord, devField: JsonRecord): JsonRecord {
  const { _dev_field_id: _d, id: _id, form_id: _fid, created_at: _c, ...rest } = devField;
  const out: JsonRecord = { ...rest };

  if (fieldHasMergeableOptions(devField) || fieldHasMergeableOptions(prodField)) {
    out.options = mergeFieldOptions(prodField.options, devField.options);
  }

  return out;
}

/** Stable key for a field or form rule (name preferred; else action+target; else id). */
export function ruleStableKey(rule: JsonRecord): string {
  const name = norm(rule.name);
  if (name) return `name:${name}`;
  const action = norm(rule.action);
  const target = norm(rule.targetFieldId ?? rule.target_field_id);
  if (action || target) return `act:${action}::${target}`;
  const id = norm(rule.id);
  return id ? `id:${id}` : '';
}

/** Stable key for a multi-action item on a field rule. */
export function actionStableKey(action: JsonRecord): string {
  const id = norm(action.id);
  if (id) return `id:${id}`;
  return `act:${norm(action.action)}::${norm(action.targetFieldId ?? action.target_field_id)}`;
}

/**
 * Merge action lists: Prod-only kept, Dev-only appended, Dev wins on key match.
 */
export function mergeRuleActions(prodActions: unknown, devActions: unknown): JsonRecord[] {
  const prod = parseJsonArray(prodActions);
  const dev = parseJsonArray(devActions);
  if (!dev.length) return prod.map((a) => ({ ...a }));
  if (!prod.length) return dev.map((a) => ({ ...a }));

  const result: JsonRecord[] = [];
  const usedDev = new Set<number>();

  for (const p of prod) {
    const key = actionStableKey(p);
    if (!key) {
      result.push({ ...p });
      continue;
    }
    const di = dev.findIndex((d, i) => !usedDev.has(i) && actionStableKey(d) === key);
    if (di >= 0) {
      usedDev.add(di);
      result.push({ ...p, ...dev[di] }); // Dev wins fields
    } else {
      result.push({ ...p });
    }
  }

  for (let i = 0; i < dev.length; i++) {
    if (usedDev.has(i)) continue;
    result.push({ ...dev[i] });
  }

  return result;
}

/**
 * Merge field_rules or form_rules arrays.
 * Matched rules: Dev overwrites rule body; actions array is deep-merged when present.
 * Prod-only rules are preserved; Dev-only rules are appended.
 */
export function mergeRules(prodRules: unknown, devRules: unknown): JsonRecord[] {
  const prod = parseJsonArray(prodRules);
  const dev = parseJsonArray(devRules);
  if (!dev.length) return prod.map((r) => ({ ...r }));
  if (!prod.length) return dev.map((r) => ({ ...r }));

  const result: JsonRecord[] = [];
  const usedDev = new Set<number>();

  for (const p of prod) {
    const key = ruleStableKey(p);
    if (!key) {
      result.push({ ...p });
      continue;
    }
    const di = dev.findIndex((d, i) => !usedDev.has(i) && ruleStableKey(d) === key);
    if (di >= 0) {
      usedDev.add(di);
      const d = dev[di];
      const merged: JsonRecord = { ...p, ...d };
      // Preserve Prod id when Dev id differs (cross-env UUIDs)
      if (p.id != null && d.id != null && String(p.id) !== String(d.id)) {
        merged.id = p.id;
      }
      if (Array.isArray(p.actions) || Array.isArray(d.actions)) {
        merged.actions = mergeRuleActions(p.actions, d.actions);
      }
      result.push(merged);
    } else {
      result.push({ ...p });
    }
  }

  for (let i = 0; i < dev.length; i++) {
    if (usedDev.has(i)) continue;
    result.push({ ...dev[i] });
  }

  return result;
}

/** Human-readable option labels for mapping reports. */
export function listOptionLabels(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => {
      if (o == null) return '';
      if (typeof o === 'string' || typeof o === 'number') return String(o);
      if (typeof o === 'object') {
        const rec = o as JsonRecord;
        return String(rec.value ?? rec.label ?? rec.name ?? '');
      }
      return '';
    })
    .filter((v) => v.trim().length > 0);
}

export function listRuleSummaries(rules: unknown): Array<{ key: string; label: string; actions: string[] }> {
  return parseJsonArray(rules).map((r) => {
    const key = ruleStableKey(r) || `anon:${norm(r.id) || 'unknown'}`;
    const name = String(r.name || r.action || 'Unnamed rule');
    const actions: string[] = [];
    if (Array.isArray(r.actions) && r.actions.length) {
      for (const a of parseJsonArray(r.actions)) {
        const act = String(a.action || '');
        const tgt = String(a.targetFieldId || a.target_field_id || '');
        actions.push(tgt ? `${act}→${tgt}` : act || actionStableKey(a));
      }
    } else if (r.action) {
      const tgt = String(r.targetFieldId || r.target_field_id || '');
      actions.push(tgt ? `${r.action}→${tgt}` : String(r.action));
    }
    return { key, label: name, actions };
  });
}
