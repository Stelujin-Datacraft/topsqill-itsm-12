/**
 * Schema-aware ITAM field mapping — extends VIS mapping engine with asset synonyms.
 * AI may propose; runtime validates against discovered schema only.
 */
import {
  suggestFieldMappings,
  applyTransformation,
} from '../../vis/core/mapping/index';
import type { DiscoveredField, FieldMappingSpec, MappingConfidence } from '../../vis/core/types/index';
import type { FormFieldSchema, SyncValidationError } from './types';

const ITAM_SYNONYMS: Array<[RegExp, string[], number]> = [
  [/hostname|fqdn|displayname|assetname|devicename|servername/, ['hostname', 'device_name', 'asset_name', 'asset_name_hostname', 'display_name', 'name', 'fqdn'], 98],
  [/primaryip|ipaddress|^ip$|privateip|managementip/, ['primary_ip', 'primary_ip_address', 'ip_address', 'ip', 'management_ip', 'private_ip'], 97],
  [/macaddress|^mac$|hwaddress/, ['mac_address', 'mac', 'hardware_address'], 96],
  [/serialnumber|serial|servicetag/, ['serial_number', 'serial_number_service_tag', 'serial', 'service_tag'], 97],
  [/machineguid|biosuuid|uuid|cloudinstanceid|instanceid|resourceid|externalid/, ['machine_guid', 'bios_uuid', 'uuid', 'cloud_instance_id', 'external_id', 'instance_id', 'resource_id', 'device_unique_identifier'], 95],
  [/operatingsystem|^os$|osname|guestos/, ['operating_system', 'os', 'os_name', 'guest_os'], 94],
  [/osversion|os_version|version/, ['os_version', 'operating_system_version', 'version'], 90],
  [/manufacturer|vendor|make/, ['manufacturer', 'vendor', 'make'], 92],
  [/model|product|modelnumber/, ['model', 'model_number', 'product_model'], 90],
  [/assettype|devicetype|type/, ['asset_type', 'device_type', 'type', 'category'], 88],
  [/cpumodel|^cpu$|processor/, ['cpu', 'cpu_model', 'processor'], 88],
  [/memory|ramgb|^ram$/, ['memory', 'ram', 'ram_gb', 'memory_gb'], 88],
  [/environment|env/, ['environment', 'env'], 90],
  [/owner|managedby|assigneduser/, ['owner', 'managed_by', 'asset_owner', 'assigned_user_full_name'], 85],
  [/department|dept/, ['department', 'dept'], 86],
  [/cloudprovider|provider/, ['cloud_provider', 'provider'], 88],
  [/cloudregion|region|availabilityzone|zone/, ['cloud_region', 'region', 'zone'], 86],
  [/virtualizationhost|esxi|hypervisor|host/, ['virtualization_host', 'esxi_host', 'host'], 84],
];

/** Layout / non-data field types — never required for sync validation. */
export const NON_DATA_FIELD_TYPES = new Set([
  'header', 'description', 'section-break', 'horizontal-line', 'page-break', 'html', 'divider',
]);

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function scoreItamFieldPair(
  sourceName: string,
  target: DiscoveredField | FormFieldSchema,
): { percent: number; reason: string } {
  const sn = normalize(sourceName);
  const tn = normalize(target.name);
  const tl = normalize(target.label || '');
  const tk = normalize((target as FormFieldSchema).logicalKey || '');
  if (tk && sn === tk) return { percent: 100, reason: 'Exact logical_key match' };
  if (tk && sn === normalize(tk.split('.').pop() || '')) return { percent: 99, reason: 'logical_key leaf match' };
  if (sn === tn) return { percent: 99, reason: 'Exact field name match' };
  if (sn === tl) return { percent: 96, reason: 'Source matches target label' };
  for (const [re, targets, score] of ITAM_SYNONYMS) {
    if (re.test(sn) && targets.some((t) => normalize(t) === tn || tn.includes(normalize(t)) || normalize(t).includes(tn))) {
      return { percent: score, reason: `ITAM semantic match (${sourceName} ↔ ${target.name})` };
    }
  }
  if (tn.includes(sn) || sn.includes(tn)) return { percent: 80, reason: 'Partial name containment' };
  return { percent: 0, reason: '' };
}

export function suggestItamMappings(input: {
  sourceFields: Array<{ name: string; label?: string; type?: string }>;
  targetFields: FormFieldSchema[];
  existing?: FieldMappingSpec[];
}): FieldMappingSpec[] {
  const discovered: DiscoveredField[] = input.targetFields.map((f) => ({
    name: f.name,
    label: f.label,
    type: f.type as any,
    required: f.required,
  }));

  const usedTargets = new Set<string>();
  const out: FieldMappingSpec[] = [];
  const existingBySource = new Map((input.existing || []).map((m) => [m.sourceField, m]));

  // Pass 1: exact name matches (normalized)
  for (const src of input.sourceFields) {
    if (existingBySource.has(src.name)) {
      const m = existingBySource.get(src.name)!;
      out.push(m);
      usedTargets.add(m.targetField);
      continue;
    }
    const sn = normalize(src.name);
    const exact = input.targetFields.find((t) => !usedTargets.has(t.name) && !t.readOnly && normalize(t.name) === sn);
    if (exact) {
      usedTargets.add(exact.name);
      out.push({
        sourceField: src.name,
        targetField: exact.name,
        confidence: 'HIGH',
        enabled: true,
        reasoning: 'Exact field name match',
      });
    }
  }

  // Pass 2: semantic ITAM synonyms
  for (const src of input.sourceFields) {
    if (out.some((m) => m.sourceField === src.name)) continue;
    let best: { field: FormFieldSchema; percent: number; reason: string } | null = null;
    for (const t of input.targetFields) {
      if (usedTargets.has(t.name) || t.readOnly) continue;
      const scored = scoreItamFieldPair(src.name, t);
      if (scored.percent > 0 && (!best || scored.percent > best.percent)) {
        best = { field: t, percent: scored.percent, reason: scored.reason };
      }
    }
    if (best && best.percent >= 70) {
      usedTargets.add(best.field.name);
      out.push({
        sourceField: src.name,
        targetField: best.field.name,
        confidence: percentToConfidence(best.percent),
        enabled: true,
        reasoning: best.reason,
      });
    }
  }

  // Pass 3: VIS generic suggestions for leftovers
  const mappedSources = new Set(out.map((m) => m.sourceField));
  const leftover = suggestFieldMappings({
    sourceFields: input.sourceFields.filter((s) => !mappedSources.has(s.name)),
    targetFields: discovered.filter((t) => !usedTargets.has(t.name)),
  });
  for (const m of leftover) {
    if (!usedTargets.has(m.targetField)) {
      out.push(m);
      usedTargets.add(m.targetField);
    }
  }
  return out;
}

export function applyMappings(
  source: Record<string, unknown>,
  mappings: FieldMappingSpec[],
): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const m of mappings) {
    if (m.enabled === false) continue;
    if (!(m.sourceField in source) && m.defaultValue === undefined) continue;
    const raw = m.sourceField in source ? source[m.sourceField] : m.defaultValue;
    if (raw === undefined || raw === null || raw === '') {
      if (m.defaultValue !== undefined) target[m.targetField] = applyTransformation(m.defaultValue, m.transformation);
      continue;
    }
    target[m.targetField] = applyTransformation(raw, m.transformation);
  }
  return target;
}

export function validateAgainstSchema(
  payload: Record<string, unknown>,
  schema: FormFieldSchema[],
): SyncValidationError[] {
  const errors: SyncValidationError[] = [];
  const byName = new Map(schema.map((f) => [f.name, f]));

  for (const f of schema) {
    if (f.readOnly) continue;
    if (NON_DATA_FIELD_TYPES.has(String(f.type || '').toLowerCase())) continue;
    const val = payload[f.name];
    if (f.required && (val === undefined || val === null || val === '')) {
      errors.push({
        targetField: f.name,
        expectedType: f.type,
        reason: `Required field '${f.name}' is missing`,
      });
      continue;
    }
    if (val === undefined || val === null) continue;
    const valueType = Array.isArray(val) ? 'array' : typeof val;
    const expected = (f.type || 'text').toLowerCase();
    if (/number|integer|float|decimal/.test(expected) && typeof val !== 'number' && Number.isNaN(Number(val))) {
      errors.push({
        targetField: f.name,
        valueType,
        expectedType: expected,
        reason: `Expected number for '${f.name}'`,
      });
    }
    if (/bool/.test(expected) && typeof val !== 'boolean' && !['true', 'false', '0', '1'].includes(String(val).toLowerCase())) {
      errors.push({
        targetField: f.name,
        valueType,
        expectedType: expected,
        reason: `Expected boolean for '${f.name}'`,
      });
    }
    if (f.allowedValues?.length && !f.allowedValues.map(String).includes(String(val))) {
      errors.push({
        targetField: f.name,
        valueType,
        expectedType: `enum(${f.allowedValues.join('|')})`,
        reason: `Value not in allowed set for '${f.name}'`,
      });
    }
    if (f.maxLength && String(val).length > f.maxLength) {
      errors.push({
        targetField: f.name,
        reason: `Value exceeds maxLength ${f.maxLength} for '${f.name}'`,
      });
    }
  }

  for (const key of Object.keys(payload)) {
    if (!byName.has(key)) {
      errors.push({
        targetField: key,
        reason: `Target field '${key}' does not exist in discovered schema`,
      });
    }
  }
  return errors;
}

export function mappingRequiresApproval(mappings: FieldMappingSpec[]): boolean {
  return mappings.some((m) => m.confidence === 'LOW' || !m.confidence);
}

// re-export helper used above without circular import issues
function percentToConfidence(p: number): MappingConfidence {
  if (p >= 90) return 'HIGH';
  if (p >= 70) return 'MEDIUM';
  return 'LOW';
}
