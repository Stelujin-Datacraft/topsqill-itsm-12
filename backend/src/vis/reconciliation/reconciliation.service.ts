/**
 * Stage 8A/8B — Reconciliation and controlled repair.
 */
import { randomUUID } from 'crypto';
import type { RepairAction } from '../enterprise/types';
import type { VisStore } from '../store/vis.store';

export type ReconMode = 'INCREMENTAL' | 'FULL' | 'SOURCE_ONLY' | 'TARGET_ONLY' | 'BIDIRECTIONAL';

export type DiffKind =
  | 'MISSING_TARGET'
  | 'MISSING_SOURCE'
  | 'FIELD_MISMATCH'
  | 'STALE_RECORD'
  | 'DUPLICATE_TARGET'
  | 'UNEXPECTED_TARGET';

export interface ReconDiff {
  id: string;
  kind: DiffKind;
  matchKey: string;
  sourceRecord?: Record<string, unknown> | null;
  targetRecord?: Record<string, unknown> | null;
  field?: string;
  sourceValue?: unknown;
  targetValue?: unknown;
  suggestedAction: RepairAction;
}

export interface RepairPlanItem {
  diffId: string;
  action: RepairAction;
  matchKey: string;
  payload?: Record<string, unknown>;
}

export class ReconciliationService {
  constructor(private readonly store: VisStore) {}

  /**
   * Compare source vs target records using matching keys.
   * Prefer incremental when since watermark provided.
   */
  reconcile(opts: {
    integrationId: string;
    versionId?: string;
    mode?: ReconMode;
    sourceRecords: Record<string, unknown>[];
    targetRecords: Record<string, unknown>[];
    matchSourceFields: string[];
    matchTargetFields: string[];
    compareFields?: string[];
    since?: string;
  }) {
    const mode = opts.mode || (opts.since ? 'INCREMENTAL' : 'FULL');
    let sources = opts.sourceRecords;
    let targets = opts.targetRecords;

    if (mode === 'INCREMENTAL' && opts.since) {
      const sinceTs = Date.parse(opts.since);
      sources = sources.filter((r) => {
        const u = r.updatedAt || r.updated_at || r.sys_updated_on;
        return u ? Date.parse(String(u)) >= sinceTs : true;
      });
    }
    if (mode === 'SOURCE_ONLY') targets = [];
    if (mode === 'TARGET_ONLY') sources = [];

    const sourceMap = indexByKeys(sources, opts.matchSourceFields);
    const targetMap = indexByKeys(targets, opts.matchTargetFields);
    const targetKeyCounts = countKeys(targets, opts.matchTargetFields);
    const diffs: ReconDiff[] = [];
    const compareFields = opts.compareFields || [];

    for (const [key, src] of sourceMap) {
      const tgt = targetMap.get(key);
      if (!tgt) {
        diffs.push({
          id: randomUUID(),
          kind: 'MISSING_TARGET',
          matchKey: key,
          sourceRecord: src,
          targetRecord: null,
          suggestedAction: 'CREATE',
        });
        continue;
      }
      for (const field of compareFields) {
        const sv = src[field];
        // Map common source→target naming: allow field or alias
        const tv = tgt[field];
        if (normalize(sv) !== normalize(tv)) {
          diffs.push({
            id: randomUUID(),
            kind: 'FIELD_MISMATCH',
            matchKey: key,
            sourceRecord: src,
            targetRecord: tgt,
            field,
            sourceValue: sv,
            targetValue: tv,
            suggestedAction: 'UPDATE',
          });
        }
      }
      const srcUpdated = src.updatedAt || src.updated_at;
      const tgtUpdated = tgt.updatedAt || tgt.updated_at;
      if (srcUpdated && tgtUpdated && Date.parse(String(srcUpdated)) > Date.parse(String(tgtUpdated)) + 60_000) {
        diffs.push({
          id: randomUUID(),
          kind: 'STALE_RECORD',
          matchKey: key,
          sourceRecord: src,
          targetRecord: tgt,
          suggestedAction: 'UPDATE',
        });
      }
    }

    if (mode === 'BIDIRECTIONAL' || mode === 'FULL' || mode === 'TARGET_ONLY') {
      for (const [key, tgt] of targetMap) {
        if (!sourceMap.has(key)) {
          diffs.push({
            id: randomUUID(),
            kind: mode === 'TARGET_ONLY' ? 'UNEXPECTED_TARGET' : 'MISSING_SOURCE',
            matchKey: key,
            sourceRecord: null,
            targetRecord: tgt,
            suggestedAction: 'MANUAL_REVIEW',
          });
        }
      }
    }

    for (const [key, count] of targetKeyCounts) {
      if (count > 1) {
        diffs.push({
          id: randomUUID(),
          kind: 'DUPLICATE_TARGET',
          matchKey: key,
          suggestedAction: 'MANUAL_REVIEW',
        });
      }
    }

    const report = this.store.create('reconciliationReports', {
      integrationId: opts.integrationId,
      versionId: opts.versionId || null,
      mode,
      diffCount: diffs.length,
      diffs,
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
    });

    return { reportId: report.id, mode, diffs, summary: summarize(diffs) };
  }

  buildRepairPlan(reportId: string, overrides?: Record<string, RepairAction>): RepairPlanItem[] {
    const report = this.store.get('reconciliationReports', reportId);
    if (!report) throw Object.assign(new Error('Report not found'), { status: 404 });
    const diffs = (report.diffs as ReconDiff[]) || [];
    return diffs.map((d) => ({
      diffId: d.id,
      action: (overrides?.[d.id] || d.suggestedAction) as RepairAction,
      matchKey: d.matchKey,
      payload: d.sourceRecord || undefined,
    }));
  }

  /**
   * Execute repair plan. Mass DELETE requires explicit allowMassDelete.
   * Each repair is tracked as an auditable execution-like record.
   */
  executeRepair(opts: {
    reportId: string;
    plan: RepairPlanItem[];
    allowMassDelete?: boolean;
    actorId?: string;
    applyCreate?: (payload: Record<string, unknown>) => Promise<void> | void;
    applyUpdate?: (matchKey: string, payload: Record<string, unknown>) => Promise<void> | void;
    applyDelete?: (matchKey: string) => Promise<void> | void;
  }) {
    const report = this.store.get('reconciliationReports', opts.reportId);
    if (!report) throw Object.assign(new Error('Report not found'), { status: 404 });

    const deletes = opts.plan.filter((p) => p.action === 'DELETE');
    if (deletes.length > 5 && !opts.allowMassDelete) {
      throw Object.assign(
        new Error('Mass deletion requires explicit allowMassDelete / policy authorization'),
        { status: 403 },
      );
    }

    const results: Array<{ diffId: string; action: RepairAction; status: string; error?: string }> = [];

    for (const item of opts.plan) {
      try {
        if (item.action === 'IGNORE' || item.action === 'MANUAL_REVIEW') {
          results.push({ diffId: item.diffId, action: item.action, status: 'SKIPPED' });
          continue;
        }
        if (item.action === 'CREATE' && item.payload) {
          opts.applyCreate?.(item.payload);
        } else if (item.action === 'UPDATE' && item.payload) {
          opts.applyUpdate?.(item.matchKey, item.payload);
        } else if (item.action === 'DELETE') {
          opts.applyDelete?.(item.matchKey);
        }
        results.push({ diffId: item.diffId, action: item.action, status: 'APPLIED' });
      } catch (e: any) {
        results.push({
          diffId: item.diffId,
          action: item.action,
          status: 'FAILED',
          error: e?.message || 'repair failed',
        });
      }
    }

    const repairReport = this.store.create('repairReports', {
      reportId: opts.reportId,
      integrationId: report.integrationId,
      versionId: report.versionId || null,
      actorId: opts.actorId || null,
      items: results,
      createdAt: new Date().toISOString(),
      status: results.some((r) => r.status === 'FAILED') ? 'PARTIAL' : 'COMPLETED',
    });

    // Auditable execution reference
    const execution = this.store.create('executions', {
      integrationId: report.integrationId,
      integrationVersion: report.versionId || null,
      status: repairReport.status === 'COMPLETED' ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      trigger: 'RECONCILIATION_REPAIR',
      repairReportId: repairReport.id,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    return { repairReportId: repairReport.id, executionId: execution.id, results };
  }

  getReport(id: string) {
    return this.store.get('reconciliationReports', id);
  }

  getRepairReport(id: string) {
    return this.store.get('repairReports', id);
  }
}

function indexByKeys(records: Record<string, unknown>[], fields: string[]) {
  const map = new Map<string, Record<string, unknown>>();
  for (const r of records) {
    const key = fields.map((f) => String(r[f] ?? '')).join('|');
    if (!key || key === fields.map(() => '').join('|')) continue;
    map.set(key, r);
  }
  return map;
}

function countKeys(records: Record<string, unknown>[], fields: string[]) {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = fields.map((f) => String(r[f] ?? '')).join('|');
    if (!key || key === fields.map(() => '').join('|')) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function normalize(v: unknown) {
  if (v == null) return '';
  return String(v).trim().toLowerCase();
}

function summarize(diffs: ReconDiff[]) {
  const byKind: Record<string, number> = {};
  for (const d of diffs) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
  return byKind;
}
