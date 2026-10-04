/**
 * Mapping engine — confidence, transforms, dry-run, validation.
 * Pure functions; no I/O. Used by VisAssistant / VisService / client engine.
 */
import type {
  DesignValidationIssue,
  DesignValidationReport,
  DiscoveredField,
  DryRunRecordPreview,
  DryRunResult,
  FieldMappingSpec,
  MappingConfidence,
  MatchingStrategy,
  SchemaDiffResult,
  SchemaFieldDiff,
} from '../types/index';

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function confidenceToPercent(c?: MappingConfidence | null): number {
  if (c === 'HIGH') return 95;
  if (c === 'MEDIUM') return 78;
  if (c === 'LOW') return 45;
  return 60;
}

export function percentToConfidence(p: number): MappingConfidence {
  if (p >= 90) return 'HIGH';
  if (p >= 70) return 'MEDIUM';
  return 'LOW';
}

const SYNONYMS: Array<[RegExp, string[], number]> = [
  // CrowdStrike / device inventory (prefer real form fields over Vulnerability template)
  [/^id$|deviceid|assetid|externalid|hostid/, ['id', 'external_id', 'device_id', 'asset_id', 'host_id'], 99],
  [/^hostname$|host$|computername|devicename/, ['hostname', 'host_name', 'name', 'device_name', 'computer_name', 'title'], 96],
  [/^os$|operatingsystem|osname|platform/, ['os', 'operating_system', 'os_name', 'platform'], 94],
  [/^serialnumber$|serial$|serialno|sn$/, ['serial_number', 'serialnumber', 'serial', 'serial_no', 'asset_tag'], 94],
  [/status|state/, ['status', 'state'], 90],
  // Vulnerability / ITSM (lower priority than exact device matches above)
  [/^id$|vulnerabilityid|vulnid|externalid/, ['vulnerability_id', 'external_id', 'id'], 88],
  [/severity|priority|criticality/, ['priority', 'severity'], 94],
  [/desc|summary|title|details/, ['description', 'summary', 'title'], 84],
  [/team|group|assignment|owner/, ['assignment_group', 'team', 'owner'], 81],
  [/cvss|score/, ['priority', 'cvss_score', 'score'], 72],
];

export function scoreFieldPair(
  sourceName: string,
  target: DiscoveredField,
): { percent: number; reason: string } {
  const sn = normalize(sourceName);
  const tn = normalize(target.name);
  const tl = normalize(target.label || '');

  if (sn === tn) {
    return { percent: 99, reason: 'Exact field name match.' };
  }
  if (sn === tl || sourceName.toLowerCase() === (target.label || '').toLowerCase()) {
    return { percent: 96, reason: 'Source name matches target label.' };
  }

  for (const [re, targets, score] of SYNONYMS) {
    if (re.test(sn) && targets.some((t) => normalize(t) === tn || tn.includes(normalize(t)))) {
      return {
        percent: score,
        reason: `Semantic synonym match (${sourceName} ↔ ${target.name}).`,
      };
    }
  }

  if (tn.includes(sn) || sn.includes(tn)) {
    return { percent: 82, reason: 'Partial name containment match.' };
  }

  return { percent: 0, reason: '' };
}

export function suggestFieldMappings(input: {
  sourceFields: Array<{ name: string; label?: string; type?: string }>;
  targetFields: DiscoveredField[];
  existing?: FieldMappingSpec[];
}): FieldMappingSpec[] {
  const usedTargets = new Set<string>();
  const out: FieldMappingSpec[] = [];

  for (const src of input.sourceFields) {
    let best: { target: DiscoveredField; percent: number; reason: string } | null = null;
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
        lookup:
          /reference/i.test(best.target.type) || best.target.reference
            ? {
                formHint: best.target.reference?.formId || best.target.name,
                matchBy: (best.target.reference?.matchBy || ['name'])[0],
                sourceField: src.name,
              }
            : null,
      });
    }
  }

  return applyTransformSuggestions(out, input.targetFields);
}

export function applyTransformSuggestions(
  mappings: FieldMappingSpec[],
  targetFields?: DiscoveredField[],
): FieldMappingSpec[] {
  return mappings.map((m) => {
    const src = m.sourceField.toLowerCase();
    const tgt = m.targetField.toLowerCase();
    const targetMeta = targetFields?.find((t) => t.name === m.targetField);

    if ((src.includes('severity') || src === 'priority') && tgt.includes('priority')) {
      return {
        ...m,
        transformation: m.transformation || 'Critical→1;High→2;Medium→3;Low→4',
        reason:
          m.reason
          || 'Both fields represent severity. Target uses numeric priority, so a value transformation is required.',
      };
    }

    if (src.includes('status') && tgt.includes('status')) {
      return {
        ...m,
        transformation: m.transformation || 'OPEN→Open;IN_PROGRESS→In Progress;CLOSED→Closed',
        reason: m.reason || 'Normalize status casing/labels for the target choice list.',
      };
    }

    if (targetMeta && /integer|number|decimal/i.test(targetMeta.type) && !m.transformation) {
      return {
        ...m,
        transformation: m.transformation || 'CAST:String→Integer',
        reason: m.reason || `Target field ${m.targetField} is numeric; cast from string if needed.`,
      };
    }

    if (targetMeta && (/reference/i.test(targetMeta.type) || targetMeta.reference) && !m.lookup) {
      return {
        ...m,
        lookup: {
          formHint: targetMeta.reference?.formId || m.targetField,
          matchBy: (targetMeta.reference?.matchBy || ['name'])[0],
          sourceField: m.sourceField,
        },
        reason:
          m.reason
          || `Target ${m.targetField} is a reference — resolve via lookup on name = source.${m.sourceField}.`,
        confidence: m.confidence === 'HIGH' ? 'MEDIUM' : m.confidence,
        confidencePercent: Math.min(m.confidencePercent || 81, 81),
      };
    }

    return m;
  });
}

/** Apply a simple transformation string to a source value. */
export function applyTransformation(value: unknown, transformation?: string | null): unknown {
  if (!transformation || value == null) return value;
  const raw = String(value);

  if (transformation.startsWith('CAST:String→Integer') || transformation === 'CAST:String→Integer') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : value;
  }

  if (/true|false/i.test(raw) && /Yes|No/.test(transformation)) {
    return /true/i.test(raw) ? 'Yes' : 'No';
  }

  // Map pairs: A→B;C→D
  const pairs = transformation
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [from, to] = p.split('→').map((s) => s.trim());
      return { from, to };
    })
    .filter((p) => p.from && p.to != null);

  for (const pair of pairs) {
    if (pair.from.toLowerCase() === raw.toLowerCase()) return pair.to;
  }

  // ISO datetime → US locale-ish
  if (transformation.includes('09/29') || /datetime|date/i.test(transformation)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const yyyy = d.getUTCFullYear();
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mi = String(d.getUTCMinutes()).padStart(2, '0');
      return `${mm}/${dd}/${yyyy} ${hh}:${mi}`;
    }
  }

  return value;
}

export function runDryRun(input: {
  sourceRecords: Record<string, unknown>[];
  mappings: FieldMappingSpec[];
  targetFields?: DiscoveredField[];
}): DryRunResult {
  const enabled = input.mappings.filter((m) => m.enabled !== false);
  const mappingIssues = validateMappings({
    mappings: enabled,
    sourceFields: Object.keys(input.sourceRecords[0] || {}).map((name) => ({ name })),
    targetFields: input.targetFields || [],
  }).issues;

  const previews: DryRunRecordPreview[] = input.sourceRecords.map((source) => {
    const target: Record<string, unknown> = {};
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const m of enabled) {
      if (!(m.sourceField in source)) {
        errors.push(`Source field '${m.sourceField}' does not exist on sample record.`);
        continue;
      }
      try {
        target[m.targetField] = applyTransformation(source[m.sourceField], m.transformation);
      } catch (e: any) {
        errors.push(`Transform failed for ${m.sourceField}: ${e?.message || e}`);
      }
      if (m.lookup) {
        warnings.push(
          `Reference lookup for ${m.targetField}: find where ${m.lookup.matchBy || 'name'} = source.${m.lookup.sourceField || m.sourceField} (not resolved in dry run).`,
        );
      }
    }

    return { source, target, warnings, errors };
  });

  return {
    dryRun: true,
    sampleSize: input.sourceRecords.length,
    previews,
    mappingIssues,
  };
}

export function validateMappings(input: {
  mappings: FieldMappingSpec[];
  sourceFields: Array<{ name: string }>;
  targetFields: DiscoveredField[];
}): DesignValidationReport {
  const issues: DesignValidationIssue[] = [];
  const sourceNames = new Set(input.sourceFields.map((s) => s.name));
  const targetByName = new Map(input.targetFields.map((t) => [t.name, t]));
  const mappedTargets = new Set(
    input.mappings.filter((m) => m.enabled !== false).map((m) => m.targetField),
  );

  for (const t of input.targetFields) {
    if (t.required && !mappedTargets.has(t.name)) {
      issues.push({
        severity: 'ERROR',
        code: 'REQUIRED_UNMAPPED',
        message: `Required target field '${t.name}' has no mapping.`,
        field: t.name,
      });
    }
  }

  for (const m of input.mappings) {
    if (m.enabled === false) continue;
    if (sourceNames.size > 0 && !sourceNames.has(m.sourceField)) {
      issues.push({
        severity: 'ERROR',
        code: 'SOURCE_MISSING',
        message: `Source field '${m.sourceField}' does not exist.`,
        field: m.sourceField,
      });
    }
    const target = targetByName.get(m.targetField);
    if (input.targetFields.length > 0 && !target) {
      issues.push({
        severity: 'ERROR',
        code: 'TARGET_MISSING',
        message: `Target field '${m.targetField}' does not exist in discovered schema.`,
        field: m.targetField,
      });
    }
    if (m.confidence === 'LOW' || (m.confidencePercent != null && m.confidencePercent < 70)) {
      issues.push({
        severity: 'WARNING',
        code: 'LOW_CONFIDENCE',
        message: `'${m.sourceField}' → '${m.targetField}' mapping has low confidence.`,
        field: m.targetField,
      });
    }
    if (m.lookup) {
      issues.push({
        severity: 'WARNING',
        code: 'REFERENCE_LOOKUP',
        message: `Reference field '${m.targetField}' requires lookup configuration (do not auto-select when multiple matches exist).`,
        field: m.targetField,
      });
    }
  }

  if (issues.filter((i) => i.severity === 'ERROR').length === 0) {
    issues.unshift({
      severity: 'PASS',
      code: 'MAPPINGS_OK',
      message: 'Required fields mapped and source fields resolved.',
    });
  }

  return {
    ok: issues.every((i) => i.severity !== 'ERROR'),
    issues,
  };
}

export function diffSchemas(
  previous: DiscoveredField[] | null | undefined,
  next: DiscoveredField[],
): SchemaDiffResult {
  const prev = previous || [];
  const prevMap = new Map(prev.map((f) => [f.name, f]));
  const nextMap = new Map(next.map((f) => [f.name, f]));
  const details: SchemaFieldDiff[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const changedFields: string[] = [];
  const newlyRequired: string[] = [];

  for (const f of next) {
    const before = prevMap.get(f.name);
    if (!before) {
      added.push(f.name);
      details.push({ name: f.name, change: 'ADDED', after: f });
      if (f.required) {
        newlyRequired.push(f.name);
        details.push({ name: f.name, change: 'NEW_REQUIRED', after: f });
      }
      continue;
    }
    const typeChanged = (before.type || '') !== (f.type || '');
    const reqChanged = Boolean(before.required) !== Boolean(f.required);
    if (typeChanged || reqChanged) {
      changedFields.push(f.name);
      details.push({ name: f.name, change: 'CHANGED', before, after: f });
      if (!before.required && f.required) {
        newlyRequired.push(f.name);
        details.push({ name: f.name, change: 'NEW_REQUIRED', before, after: f });
      }
    }
  }

  for (const f of prev) {
    if (!nextMap.has(f.name)) {
      removed.push(f.name);
      details.push({ name: f.name, change: 'REMOVED', before: f });
    }
  }

  const changed = added.length + removed.length + changedFields.length > 0;
  return {
    changed,
    added,
    removed,
    changedFields,
    newlyRequired,
    details,
    message: changed ? 'Target form schema has changed.' : undefined,
  };
}

export function defaultMatchingStrategy(mappings: FieldMappingSpec[]): MatchingStrategy {
  const idMap =
    mappings.find((m) => /vulnerability_id|external_id/i.test(m.targetField))
    || mappings.find((m) => /id$/i.test(m.sourceField));
  if (idMap) {
    return {
      mode: 'SINGLE',
      sourceFields: [idMap.sourceField],
      targetFields: [idMap.targetField],
      ifFound: 'UPDATE',
      ifNotFound: 'CREATE',
    };
  }
  return {
    mode: 'SINGLE',
    sourceFields: mappings[0] ? [mappings[0].sourceField] : ['id'],
    targetFields: mappings[0] ? [mappings[0].targetField] : ['external_id'],
    ifFound: 'UPDATE',
    ifNotFound: 'CREATE',
  };
}

export function applyNaturalLanguageMappingEdit(
  mappings: FieldMappingSpec[],
  instruction: string,
  context?: {
    sourceFields?: Array<{ name: string }>;
    targetFields?: DiscoveredField[];
  },
): FieldMappingSpec[] {
  const text = instruction.toLowerCase().trim();
  let next = mappings.map((m) => ({ ...m }));

  // "Don't map the status field" / "remove status" / "unmap status"
  const removeMatch =
    text.match(/(?:don'?t|do not)\s+map\s+(?:the\s+)?([a-z0-9_]+)/i)
    || text.match(/(?:remove|skip|unmap)\s+(?:the\s+)?([a-z0-9_]+)/i);
  if (removeMatch) {
    const field = removeMatch[1];
    return next.map((m) =>
      m.sourceField.toLowerCase() === field || m.targetField.toLowerCase() === field
        ? { ...m, enabled: false, reason: `Disabled by instruction: ${instruction}` }
        : m,
    );
  }

  // "Map X to Y" / "map CVSS score to priority"
  const mapMatch = text.match(/map\s+([a-z0-9_ \-]+?)\s+to\s+([a-z0-9_ \-]+)/i);
  if (mapMatch) {
    const srcHint = normalize(mapMatch[1]);
    const tgtHint = normalize(mapMatch[2]);
    const source =
      context?.sourceFields?.find((s) => normalize(s.name).includes(srcHint) || srcHint.includes(normalize(s.name)))
      || { name: mapMatch[1].trim().replace(/\s+/g, '_') };
    const target =
      context?.targetFields?.find((t) => normalize(t.name).includes(tgtHint) || tgtHint.includes(normalize(t.name)))
      || ({ name: mapMatch[2].trim().replace(/\s+/g, '_'), label: mapMatch[2], type: 'text' } as DiscoveredField);

    next = next.filter(
      (m) => m.targetField !== target.name && m.sourceField !== source.name,
    );
    next.push({
      id: `map_nl_${next.length}`,
      sourceField: source.name,
      targetField: target.name,
      confidence: 'MEDIUM',
      confidencePercent: 85,
      enabled: true,
      reason: `Added from natural-language instruction: "${instruction}"`,
      transformation:
        /severity|cvss|score/.test(srcHint) && /priority/.test(tgtHint)
          ? 'Critical→1;High→2;Medium→3;Low→4'
          : null,
    });
    return applyTransformSuggestions(next, context?.targetFields);
  }

  // "Use severity to calculate priority"
  if (/use\s+severity.*priority|severity.*calculate.*priority/.test(text)) {
    const existing = next.find(
      (m) => m.sourceField.toLowerCase().includes('severity') && m.targetField.toLowerCase().includes('priority'),
    );
    if (existing) {
      return next.map((m) =>
        m.id === existing.id
          ? {
              ...m,
              transformation: 'Critical→1;High→2;Medium→3;Low→4',
              enabled: true,
              reason: 'Use severity to calculate priority (NL instruction).',
            }
          : m,
      );
    }
    next.push({
      id: `map_nl_${next.length}`,
      sourceField: 'severity',
      targetField: 'priority',
      confidence: 'HIGH',
      confidencePercent: 94,
      enabled: true,
      transformation: 'Critical→1;High→2;Medium→3;Low→4',
      reason: 'Use severity to calculate priority (NL instruction).',
    });
  }

  return next;
}

export function filterMappingsByConfidence(
  mappings: FieldMappingSpec[],
  filter: 'ALL' | 'HIGH' | 'NEEDS_REVIEW',
): FieldMappingSpec[] {
  if (filter === 'HIGH') {
    return mappings.filter((m) => m.confidence === 'HIGH' || (m.confidencePercent || 0) >= 90);
  }
  if (filter === 'NEEDS_REVIEW') {
    return mappings.filter(
      (m) => m.confidence === 'LOW' || m.confidence === 'MEDIUM' || (m.confidencePercent || 100) < 90,
    );
  }
  return mappings;
}
