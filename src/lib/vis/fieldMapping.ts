/**
 * Lightweight field-mapping helpers for Integration Studio (browser client).
 * Mirrors backend/packages vis-core scoring so CrowdStrike device fields map
 * onto the user's discovered form — not a hardcoded Vulnerability template.
 */

export type MappingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type SimpleField = { name: string; label?: string; type?: string; required?: boolean; reference?: any };

export type SimpleMapping = {
  id: string;
  sourceField: string;
  targetField: string;
  confidence: MappingConfidence;
  confidencePercent: number;
  transformation?: string;
  reason?: string | null;
  enabled: boolean;
  required?: boolean;
  lookup?: any;
};

function normalize(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function percentToConfidence(p: number): MappingConfidence {
  if (p >= 90) return 'HIGH';
  if (p >= 70) return 'MEDIUM';
  return 'LOW';
}

/** Device / CrowdStrike-aware synonyms + common ITSM pairs. */
const SYNONYMS: Array<[RegExp, string[], number]> = [
  [/^id$|deviceid|assetid|externalid|hostid/, ['id', 'external_id', 'device_id', 'asset_id', 'host_id'], 99],
  [/^hostname$|host$|computername|devicename/, ['hostname', 'host_name', 'name', 'device_name', 'computer_name', 'title'], 96],
  [/^os$|operatingsystem|osname|platform/, ['os', 'operating_system', 'os_name', 'platform'], 94],
  [/^serialnumber$|serial$|serialno|sn$/, ['serial_number', 'serialnumber', 'serial', 'serial_no', 'asset_tag'], 94],
  [/status|state/, ['status', 'state'], 90],
  [/^id$|vulnerabilityid|vulnid|externalid/, ['vulnerability_id', 'external_id', 'id'], 88],
  [/severity|priority|criticality/, ['priority', 'severity'], 94],
  [/desc|summary|title|details/, ['description', 'summary', 'title'], 84],
  [/team|group|assignment|owner/, ['assignment_group', 'team', 'owner'], 81],
];

export const CROWDSTRIKE_DEVICE_SOURCE_FIELDS: SimpleField[] = [
  { name: 'id' },
  { name: 'hostname' },
  { name: 'os' },
  { name: 'serialNumber' },
  { name: 'status' },
];

export function scoreFieldPair(
  sourceName: string,
  target: SimpleField,
): { percent: number; reason: string } {
  const sn = normalize(sourceName);
  const tn = normalize(target.name);
  const tl = normalize(target.label || '');

  if (sn === tn) return { percent: 99, reason: 'Exact field name match.' };
  if (sn === tl || sourceName.toLowerCase() === String(target.label || '').toLowerCase()) {
    return { percent: 96, reason: 'Source name matches target label.' };
  }

  for (const [re, targets, score] of SYNONYMS) {
    if (re.test(sn) && targets.some((t) => normalize(t) === tn || tn.includes(normalize(t)))) {
      return { percent: score, reason: `Semantic synonym match (${sourceName} ↔ ${target.name}).` };
    }
  }

  if (tn.includes(sn) || sn.includes(tn)) {
    return { percent: 82, reason: 'Partial name containment match.' };
  }
  return { percent: 0, reason: '' };
}

export function suggestFieldMappings(input: {
  sourceFields: SimpleField[];
  targetFields: SimpleField[];
}): SimpleMapping[] {
  const usedTargets = new Set<string>();
  const out: SimpleMapping[] = [];

  for (const src of input.sourceFields) {
    let best: { target: SimpleField; percent: number; reason: string } | null = null;
    for (const target of input.targetFields) {
      if (usedTargets.has(target.name)) continue;
      const scored = scoreFieldPair(src.name, target);
      if (scored.percent <= 0) continue;
      if (!best || scored.percent > best.percent) {
        best = { target, percent: scored.percent, reason: scored.reason };
      }
    }
    if (best) {
      usedTargets.add(best.target.name);
      const confidence = percentToConfidence(best.percent);
      out.push({
        id: `map_${out.length}`,
        sourceField: src.name,
        targetField: best.target.name,
        confidence,
        confidencePercent: best.percent,
        enabled: confidence !== 'LOW',
        required: Boolean(best.target.required),
        reason: best.reason,
      });
    }
  }
  return out;
}

/** Pick a sensible matching key from discovered form fields. */
export function pickMatchingTargetField(targetFields: SimpleField[]): string {
  const names = targetFields.map((f) => f.name);
  const preferred = [
    'external_id',
    'id',
    'device_id',
    'asset_id',
    'hostname',
    'serial_number',
    'serialNumber',
    'name',
  ];
  for (const p of preferred) {
    const hit = names.find((n) => normalize(n) === normalize(p));
    if (hit) return hit;
  }
  const unique = targetFields.find((f: any) => f.unique);
  if (unique?.name) return unique.name;
  return names[0] || 'external_id';
}

export function sourceFieldsFromSample(sample: unknown): SimpleField[] {
  const row = Array.isArray(sample) ? sample[0] : sample;
  if (row && typeof row === 'object' && !Array.isArray(row)) {
    // Unwrap { devices: [...] } if someone passed the envelope
    if (Array.isArray((row as any).devices) && (row as any).devices[0]) {
      return Object.keys((row as any).devices[0])
        .filter((k) => typeof (row as any).devices[0][k] !== 'object')
        .map((name) => ({ name }));
    }
    return Object.keys(row as object)
      .filter((k) => typeof (row as any)[k] !== 'object')
      .map((name) => ({ name }));
  }
  return [];
}

export function isCrowdStrikeDesign(design: any, prompt?: string): boolean {
  const text = `${design?.name || ''} ${design?.summary || ''} ${prompt || ''} ${design?.sourceHints?.system || ''}`;
  return (
    design?.sourceHints?.system === 'CrowdStrike'
    || /crowdstrike|falcon|mockoon|device/i.test(text)
  );
}
