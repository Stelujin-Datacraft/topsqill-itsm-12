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

/** Union of string principals / ids (case-insensitive, first-seen casing kept). */
export function mergeStringLists(prodList: unknown, devList: unknown): string[] {
  const prod = Array.isArray(prodList) ? prodList.map((x) => String(x)) : [];
  const dev = Array.isArray(devList) ? devList.map((x) => String(x)) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [...prod, ...dev]) {
    const key = norm(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

/**
 * Form-level permissions `{ view, submit, edit }` — union each principal list.
 * Keeps Prod-only grants; adds Dev principals. Unknown shapes fall through to Dev.
 */
export function mergeFormPermissions(prodPerms: unknown, devPerms: unknown): unknown {
  const prod = parsePermissionsObject(prodPerms);
  const dev = parsePermissionsObject(devPerms);
  if (!dev && !prod) return devPerms ?? prodPerms ?? { view: [], submit: [], edit: [] };
  if (!prod) return dev;
  if (!dev) return prod;
  const keys = Array.from(new Set([...Object.keys(prod), ...Object.keys(dev)]));
  const out: JsonRecord = {};
  for (const k of keys) {
    out[k] = mergeStringLists(prod[k], dev[k]);
  }
  return out;
}

function parsePermissionsObject(value: unknown): JsonRecord | null {
  if (value == null) return null;
  let v: unknown = value;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as JsonRecord;
}

/** Page identity: id preferred, else name. */
export function pageStableKey(page: JsonRecord): string {
  const id = norm(page.id);
  if (id) return `id:${id}`;
  const name = norm(page.name);
  return name ? `name:${name}` : '';
}

/**
 * Merge form pages. Matched pages: Dev name/order win; `fields` arrays are unioned
 * (caller must remap Dev field UUIDs → Prod ids first). Prod-only pages kept.
 */
export function mergePages(prodPages: unknown, devPages: unknown): JsonRecord[] {
  const prod = parseJsonArray(prodPages);
  const dev = parseJsonArray(devPages);
  if (!dev.length) return prod.map((p) => ({ ...p, fields: Array.isArray(p.fields) ? [...(p.fields as unknown[])] : [] }));
  if (!prod.length) return dev.map((p) => ({ ...p, fields: Array.isArray(p.fields) ? [...(p.fields as unknown[])] : [] }));

  const result: JsonRecord[] = [];
  const usedDev = new Set<number>();

  for (const p of prod) {
    const key = pageStableKey(p);
    if (!key) {
      result.push({ ...p });
      continue;
    }
    const di = dev.findIndex((d, i) => !usedDev.has(i) && pageStableKey(d) === key);
    if (di >= 0) {
      usedDev.add(di);
      const d = dev[di];
      result.push({
        ...p,
        ...d,
        id: p.id ?? d.id,
        fields: mergeStringLists(p.fields, d.fields),
      });
    } else {
      result.push({
        ...p,
        fields: Array.isArray(p.fields) ? [...(p.fields as unknown[])].map(String) : [],
      });
    }
  }

  for (let i = 0; i < dev.length; i++) {
    if (usedDev.has(i)) continue;
    const d = dev[i];
    result.push({
      ...d,
      fields: Array.isArray(d.fields) ? [...(d.fields as unknown[])].map(String) : [],
    });
  }

  return result;
}

/**
 * Remap page.fields Dev UUIDs → Prod UUIDs. Unmapped ids are dropped (avoid dangling refs).
 * Ids already present as Prod values are kept as-is.
 */
export function remapPageFieldIds(pages: unknown, devToProdFieldId: Map<string, string>): JsonRecord[] {
  const prodIds = new Set(devToProdFieldId.values());
  return parseJsonArray(pages).map((page) => {
    const fields = Array.isArray(page.fields) ? page.fields.map(String) : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const fid of fields) {
      const mapped = devToProdFieldId.get(fid);
      const next = mapped || (prodIds.has(fid) ? fid : null);
      if (!next || seen.has(next)) continue;
      seen.add(next);
      out.push(next);
    }
    return { ...page, fields: out };
  });
}

/** Union status transition map: from-status → unique to-status list. */
export function mergeTransitionRules(prod: unknown, dev: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (src: unknown) => {
    if (!src || typeof src !== 'object' || Array.isArray(src)) return;
    for (const [from, tos] of Object.entries(src as Record<string, unknown>)) {
      const key = String(from);
      out[key] = mergeStringLists(out[key] || [], tos);
    }
  };
  add(prod);
  add(dev);
  return out;
}

function keyedObjectListMerge(
  prodList: unknown,
  devList: unknown,
  keyFn: (row: JsonRecord) => string,
): JsonRecord[] {
  const prod = parseJsonArray(prodList);
  const dev = parseJsonArray(devList);
  if (!dev.length) return prod.map((r) => ({ ...r }));
  if (!prod.length) return dev.map((r) => ({ ...r }));
  const result: JsonRecord[] = [];
  const usedDev = new Set<number>();
  for (const p of prod) {
    const key = keyFn(p);
    if (!key) {
      result.push({ ...p });
      continue;
    }
    const di = dev.findIndex((d, i) => !usedDev.has(i) && keyFn(d) === key);
    if (di >= 0) {
      usedDev.add(di);
      result.push({ ...p, ...dev[di], id: p.id ?? dev[di].id });
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
 * Deep-merge field `custom_config`.
 * - Scalars: Dev wins
 * - `transitionRules`: union to-statuses per from-status
 * - `filters` / `dynamicFieldMappings` / `conditions`: upsert by `id`
 * - string arrays (e.g. displayColumns): union
 */
export function mergeCustomConfig(prodConfig: unknown, devConfig: unknown): unknown {
  const prod = parsePermissionsObject(prodConfig) || {};
  const dev = parsePermissionsObject(devConfig) || {};
  if (!Object.keys(dev).length) return Object.keys(prod).length ? { ...prod } : prodConfig ?? null;
  if (!Object.keys(prod).length) return { ...dev };

  const out: JsonRecord = { ...prod, ...dev };

  if (prod.transitionRules != null || dev.transitionRules != null) {
    out.transitionRules = mergeTransitionRules(prod.transitionRules, dev.transitionRules);
  }

  for (const listKey of ['filters', 'dynamicFieldMappings', 'conditions', 'matrixRows', 'matrixColumns'] as const) {
    if (prod[listKey] != null || dev[listKey] != null) {
      out[listKey] = keyedObjectListMerge(prod[listKey], dev[listKey], (row) => {
        const id = norm(row.id);
        if (id) return `id:${id}`;
        // fallback structural key
        return norm([row.field, row.parentFieldId, row.childFieldId, row.operator, row.value].filter(Boolean).join('::'));
      });
    }
  }

  for (const arrKey of [
    'displayColumns',
    'tableDisplayFields',
    'columnFilters',
    'allowedCountries',
    'preferred',
    'approverRoles',
    'lookupFields',
    'onlyShow',
    'defaultSelected',
  ] as const) {
    if (Array.isArray(prod[arrKey]) || Array.isArray(dev[arrKey])) {
      out[arrKey] = mergeStringLists(prod[arrKey], dev[arrKey]);
    }
  }

  return out;
}

/**
 * Merge a Dev field payload onto an existing Prod field row.
 * Scalars/config come from Dev; options / custom_config / permissions dig-merged.
 */
export function mergeFormFieldPayload(prodField: JsonRecord, devField: JsonRecord): JsonRecord {
  const { _dev_field_id: _d, id: _id, form_id: _fid, created_at: _c, ...rest } = devField;
  const out: JsonRecord = { ...rest };

  if (fieldHasMergeableOptions(devField) || fieldHasMergeableOptions(prodField)) {
    out.options = mergeFieldOptions(prodField.options, devField.options);
  }

  if (prodField.custom_config != null || rest.custom_config != null) {
    out.custom_config = mergeCustomConfig(prodField.custom_config, rest.custom_config);
  }

  if (prodField.permissions != null || rest.permissions != null) {
    out.permissions = mergeFormPermissions(prodField.permissions, rest.permissions);
  }

  // `validation` may be a rule array or a single constraint object
  if (Array.isArray(prodField.validation) || Array.isArray(rest.validation)) {
    out.validation = keyedObjectListMerge(prodField.validation, rest.validation, (row) => {
      const id = norm(row.id);
      if (id) return `id:${id}`;
      return `rule:${norm(row.rule ?? row.type)}`;
    });
  }

  return out;
}

/**
 * Upsert list of mapping objects by a stable key function.
 * Used for data_feed field_mappings / matching_rules and ITAM mappings.
 */
export function mergeKeyedRecords(
  prodList: unknown,
  devList: unknown,
  keyFn: (row: JsonRecord) => string,
): JsonRecord[] {
  return keyedObjectListMerge(prodList, devList, keyFn);
}

/** Prefer name pair, else id pair — safe across envs when labels were stored. */
export function fieldMappingStableKey(row: JsonRecord): string {
  const sn = norm(row.sourceFieldName ?? row.source_field_name);
  const tn = norm(row.targetFieldName ?? row.target_field_name);
  if (sn || tn) return `name:${sn}=>${tn}`;
  const si = norm(row.sourceFieldId ?? row.source_field_id ?? row.sourceField);
  const ti = norm(row.targetFieldId ?? row.target_field_id ?? row.targetField);
  if (si || ti) return `id:${si}=>${ti}`;
  const id = norm(row.id);
  return id ? `id:${id}` : '';
}

export function matchingRuleStableKey(row: JsonRecord): string {
  const sn = norm(row.sourceFieldName ?? row.source_field_name);
  const tn = norm(row.targetFieldName ?? row.target_field_name);
  if (sn || tn) return `name:${sn}=>${tn}`;
  const si = norm(row.sourceFieldId ?? row.source_field_id);
  const ti = norm(row.targetFieldId ?? row.target_field_id);
  if (si || ti) return `id:${si}=>${ti}`;
  return norm(row.id) ? `id:${norm(row.id)}` : '';
}

export function itamMappingStableKey(row: JsonRecord): string {
  const s = norm(row.sourceField ?? row.source_field ?? row.sourceFieldName);
  const t = norm(row.targetField ?? row.target_field ?? row.targetFieldName);
  if (s || t) return `${s}=>${t}`;
  return norm(row.id) ? `id:${norm(row.id)}` : '';
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
