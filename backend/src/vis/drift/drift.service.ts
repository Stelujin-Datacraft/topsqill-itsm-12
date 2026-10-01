/**
 * Stage 9A/9B — Schema/API drift detection and impact analysis.
 */
import { randomUUID } from 'crypto';
import type { DriftFinding, DriftSeverity } from '../enterprise/types';
import type { VisStore } from '../store/vis.store';
import type { DiscoveredField, FieldMappingSpec } from '../core/types/index';

export interface SchemaSnapshot {
  fields: Array<{ name: string; type?: string; required?: boolean; choices?: string[] }>;
  endpoints?: Array<{ path: string; method: string }>;
  auth?: string;
  pagination?: string;
}

export class DriftDetectionService {
  constructor(private readonly store: VisStore) {}

  detectSchemaDrift(opts: {
    connectionId: string;
    formId?: string;
    previous: SchemaSnapshot;
    current: SchemaSnapshot;
    source?: string;
  }): { findings: DriftFinding[]; maxSeverity: DriftSeverity | null } {
    const findings: DriftFinding[] = [];
    const prevMap = new Map(opts.previous.fields.map((f) => [f.name, f]));
    const currMap = new Map(opts.current.fields.map((f) => [f.name, f]));
    const now = new Date().toISOString();
    const source = opts.source || 'schema';

    for (const [name, curr] of currMap) {
      if (!prevMap.has(name)) {
        findings.push(finding('FIELD_ADDED', 'NON_BREAKING', source, now, { field: name, to: curr }));
      }
    }
    for (const [name, prev] of prevMap) {
      if (!currMap.has(name)) {
        findings.push(finding('FIELD_REMOVED', 'BREAKING', source, now, { field: name, from: prev }));
        continue;
      }
      const curr = currMap.get(name)!;
      if (prev.type && curr.type && prev.type !== curr.type) {
        findings.push(finding('TYPE_CHANGED', 'BREAKING', source, now, { field: name, from: prev.type, to: curr.type }));
      }
      if (Boolean(prev.required) !== Boolean(curr.required)) {
        const sev: DriftSeverity = curr.required && !prev.required ? 'POTENTIALLY_BREAKING' : 'NON_BREAKING';
        findings.push(finding('REQUIRED_CHANGED', sev, source, now, {
          field: name,
          from: prev.required,
          to: curr.required,
        }));
      }
      if (prev.choices && curr.choices) {
        const removed = prev.choices.filter((c) => !curr.choices!.includes(c));
        const added = curr.choices.filter((c) => !prev.choices!.includes(c));
        if (removed.length || added.length) {
          findings.push(finding('ENUM_CHANGED', removed.length ? 'BREAKING' : 'NON_BREAKING', source, now, {
            field: name,
            from: prev.choices,
            to: curr.choices,
          }));
        }
      }
    }

    // Heuristic rename detection: same type, similar name
    const removed = findings.filter((f) => f.kind === 'FIELD_REMOVED').map((f) => f.field!);
    const added = findings.filter((f) => f.kind === 'FIELD_ADDED').map((f) => f.field!);
    for (const r of removed) {
      for (const a of added) {
        if (similar(r, a)) {
          findings.push(finding('FIELD_RENAMED', 'POTENTIALLY_BREAKING', source, now, {
            field: r,
            from: r,
            to: a,
          }));
        }
      }
    }

    // Endpoint drift
    const prevEps = new Set((opts.previous.endpoints || []).map((e) => `${e.method}:${e.path}`));
    const currEps = new Set((opts.current.endpoints || []).map((e) => `${e.method}:${e.path}`));
    for (const ep of prevEps) {
      if (!currEps.has(ep)) {
        findings.push(finding('ENDPOINT_REMOVED', 'BREAKING', source, now, { from: ep }));
      }
    }
    if (opts.previous.auth && opts.current.auth && opts.previous.auth !== opts.current.auth) {
      findings.push(finding('AUTHENTICATION_CHANGED', 'BREAKING', source, now, {
        from: opts.previous.auth,
        to: opts.current.auth,
      }));
    }
    if (opts.previous.pagination && opts.current.pagination && opts.previous.pagination !== opts.current.pagination) {
      findings.push(finding('PAGINATION_CHANGED', 'POTENTIALLY_BREAKING', source, now, {
        from: opts.previous.pagination,
        to: opts.current.pagination,
      }));
    }

    const maxSeverity = maxSev(findings);
    const row = this.store.create('driftFindings', {
      connectionId: opts.connectionId,
      formId: opts.formId || null,
      findings,
      maxSeverity,
      detectedAt: now,
      acknowledged: false,
    });

    return { findings: findings.map((f) => ({ ...f, id: f.id || randomUUID() })), maxSeverity, reportId: row.id } as any;
  }

  /**
   * Identify affected integrations/mappings/transforms without silently modifying prod.
   */
  analyzeImpact(opts: {
    findings: DriftFinding[];
    integrations: Array<{
      id: string;
      name: string;
      environment?: string;
      versionId?: string;
      mappings: FieldMappingSpec[];
      sourceFields?: DiscoveredField[];
      targetFields?: DiscoveredField[];
    }>;
  }) {
    const affected: Array<{
      integrationId: string;
      name: string;
      environment?: string;
      versionId?: string;
      affectedMappings: string[];
      affectedTransformations: string[];
      findings: DriftFinding[];
      severity: DriftSeverity;
    }> = [];

    for (const integ of opts.integrations) {
      const mappedFields = new Set(
        integ.mappings.flatMap((m) => [m.sourceField, m.targetField].filter(Boolean)),
      );
      const hitFindings = opts.findings.filter((f) => f.field && mappedFields.has(f.field));
      if (!hitFindings.length) continue;
      const affectedMappings = integ.mappings
        .filter((m) => hitFindings.some((f) => f.field === m.sourceField || f.field === m.targetField))
        .map((m) => `${m.sourceField}→${m.targetField}`);
      const affectedTransformations = integ.mappings
        .filter((m) => m.transformation && hitFindings.some((f) => f.field === m.sourceField || f.field === m.targetField))
        .map((m) => String(m.transformation));

      affected.push({
        integrationId: integ.id,
        name: integ.name,
        environment: integ.environment,
        versionId: integ.versionId,
        affectedMappings,
        affectedTransformations,
        findings: hitFindings,
        severity: maxSev(hitFindings) || 'NON_BREAKING',
      });
    }

    const impact = this.store.create('impactAnalyses', {
      findingCount: opts.findings.length,
      affectedCount: affected.length,
      affected,
      createdAt: new Date().toISOString(),
      // AI may propose rename remaps — never auto-apply to production
      aiProposals: proposeRemaps(opts.findings),
      requiresApproval: true,
    });

    return { impactId: impact.id, affected, aiProposals: impact.aiProposals };
  }

  /** Periodic API contract check — endpoint availability / method / auth markers. */
  checkApiContract(opts: {
    connectionId: string;
    expected: Array<{ path: string; method: string; available: boolean }>;
    actual: Array<{ path: string; method: string; available: boolean }>;
  }) {
    const findings: DriftFinding[] = [];
    const now = new Date().toISOString();
    const actualMap = new Map(opts.actual.map((e) => [`${e.method}:${e.path}`, e]));
    for (const exp of opts.expected) {
      const key = `${exp.method}:${exp.path}`;
      const act = actualMap.get(key);
      if (!act || !act.available) {
        findings.push(finding('ENDPOINT_CHANGED', 'BREAKING', 'api-contract', now, { from: key, to: 'unavailable' }));
      }
    }
    return this.detectSchemaDrift({
      connectionId: opts.connectionId,
      previous: { fields: [], endpoints: opts.expected.map((e) => ({ path: e.path, method: e.method })) },
      current: {
        fields: [],
        endpoints: opts.actual.filter((e) => e.available).map((e) => ({ path: e.path, method: e.method })),
      },
      source: 'api-contract',
    });
  }
}

function finding(
  kind: string,
  severity: DriftSeverity,
  source: string,
  detectedAt: string,
  extra: Partial<DriftFinding>,
): DriftFinding {
  return { id: randomUUID(), kind, severity, source, detectedAt, ...extra };
}

function maxSev(findings: DriftFinding[]): DriftSeverity | null {
  if (!findings.length) return null;
  if (findings.some((f) => f.severity === 'BREAKING')) return 'BREAKING';
  if (findings.some((f) => f.severity === 'POTENTIALLY_BREAKING')) return 'POTENTIALLY_BREAKING';
  return 'NON_BREAKING';
}

function similar(a: string, b: string) {
  const na = a.toLowerCase().replace(/[_-]/g, '');
  const nb = b.toLowerCase().replace(/[_-]/g, '');
  return na.includes(nb) || nb.includes(na) || levenshtein(na, nb) <= 2;
}

function levenshtein(a: string, b: string) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

function proposeRemaps(findings: DriftFinding[]) {
  return findings
    .filter((f) => f.kind === 'FIELD_RENAMED' && f.from && f.to)
    .map((f) => ({
      type: 'MAPPING_REMAP',
      from: f.from,
      to: f.to,
      note: 'AI proposal only — production changes require approval',
      requiresApproval: true,
    }));
}
