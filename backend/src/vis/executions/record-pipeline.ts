/**
 * Deterministic record pipeline — NO AI calls at execution time.
 * SOURCE → normalize → transform → map → reference lookup → validate → match → target
 */
import { applyTransformation } from '../core/mapping/index';
import type { ExecutionPlan, FieldMappingSpec } from '../core/types/index';
import { ReferenceCache } from './reference-cache';
import { classifyThrown } from './execution-errors';

export interface PipelineResult {
  ok: boolean;
  action?: 'CREATE' | 'UPDATE' | 'SKIP';
  targetPayload?: Record<string, unknown>;
  matchingKey?: string;
  existingTargetId?: string | null;
  error?: { code: string; message: string; retryable: boolean };
  latencyMs: number;
}

export interface TargetAdapter {
  findByKeys(keys: Record<string, unknown>): Promise<{ id: string } | null>;
  create(payload: Record<string, unknown>): Promise<{ id: string; status?: number }>;
  update(id: string, payload: Record<string, unknown>): Promise<{ id: string; status?: number }>;
  lookupReference?(hint: string, matchBy: string, value: string): Promise<string | null>;
}

export function buildIdempotencyKey(
  integrationId: string,
  sourceSystem: string,
  sourceRecordId: string,
): string {
  return `${integrationId}::${sourceSystem}::${sourceRecordId}`;
}

export function mapRecord(
  source: Record<string, unknown>,
  mappings: FieldMappingSpec[],
): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const m of mappings) {
    if (m.enabled === false) continue;
    if (!(m.sourceField in source) && m.defaultValue === undefined) {
      throw Object.assign(new Error(`Source field '${m.sourceField}' does not exist`), {
        code: 'MAPPING_ERROR',
      });
    }
    const raw = m.sourceField in source ? source[m.sourceField] : m.defaultValue;
    target[m.targetField] = applyTransformation(raw, m.transformation);
  }
  return target;
}

export function matchingKeyFrom(
  source: Record<string, unknown>,
  mapped: Record<string, unknown>,
  plan: ExecutionPlan,
): { sourceKey: string; targetQuery: Record<string, unknown> } {
  const srcFields = plan.matchingStrategy.sourceFields;
  const tgtFields = plan.matchingStrategy.targetFields;
  const sourceParts = srcFields.map((f) => String(source[f] ?? mapped[f] ?? ''));
  const targetQuery: Record<string, unknown> = {};
  tgtFields.forEach((f, i) => {
    targetQuery[f] = mapped[f] ?? source[srcFields[i]] ?? sourceParts[i];
  });
  return { sourceKey: sourceParts.join('||'), targetQuery };
}

export async function processRecord(input: {
  source: Record<string, unknown>;
  plan: ExecutionPlan;
  target: TargetAdapter;
  referenceCache: ReferenceCache;
  correlationId: string;
  knownExistingIds?: Map<string, string>;
}): Promise<PipelineResult> {
  const started = Date.now();
  try {
    let mapped = mapRecord(input.source, input.plan.mappings);

    // Reference lookups (cached)
    for (const m of input.plan.mappings) {
      if (!m.lookup || m.enabled === false) continue;
      const raw = String(input.source[m.lookup.sourceField || m.sourceField] ?? '');
      const cacheKey = `${m.targetField}::${m.lookup.matchBy || 'name'}::${raw}`;
      let resolved = input.referenceCache.get(cacheKey);
      if (!resolved && input.target.lookupReference) {
        resolved =
          (await input.target.lookupReference(
            m.lookup.formHint || m.targetField,
            m.lookup.matchBy || 'name',
            raw,
          )) || undefined;
        if (resolved) input.referenceCache.set(cacheKey, resolved);
      }
      if (resolved) mapped[m.targetField] = resolved;
      // If multiple/no match — leave as-is and let validation/target decide; do not auto-pick
    }

    const { sourceKey, targetQuery } = matchingKeyFrom(input.source, mapped, input.plan);
    let existingId = input.knownExistingIds?.get(sourceKey) || null;
    if (!existingId) {
      const found = await input.target.findByKeys(targetQuery);
      existingId = found?.id || null;
    }

    if (existingId) {
      if (input.plan.matchingStrategy.ifFound === 'UPDATE') {
        const updated = await input.target.update(existingId, mapped);
        return {
          ok: true,
          action: 'UPDATE',
          targetPayload: mapped,
          matchingKey: sourceKey,
          existingTargetId: updated.id,
          latencyMs: Date.now() - started,
        };
      }
      return {
        ok: true,
        action: 'SKIP',
        matchingKey: sourceKey,
        existingTargetId: existingId,
        latencyMs: Date.now() - started,
      };
    }

    const created = await input.target.create(mapped);
    return {
      ok: true,
      action: 'CREATE',
      targetPayload: mapped,
      matchingKey: sourceKey,
      existingTargetId: created.id,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    const classified = classifyThrown(err, input.correlationId);
    return {
      ok: false,
      error: {
        code: (err as any)?.code || classified.code,
        message: classified.message,
        retryable: classified.retryable,
      },
      latencyMs: Date.now() - started,
    };
  }
}

/** Bulk existence: map source keys → target ids when adapter supports batch. */
export async function bulkFindExisting(
  records: Record<string, unknown>[],
  plan: ExecutionPlan,
  findMany: (queries: Record<string, unknown>[]) => Promise<Array<{ key: string; id: string }>>,
): Promise<Map<string, string>> {
  const queries = records.map((source) => {
    const mapped = mapRecord(source, plan.mappings);
    return matchingKeyFrom(source, mapped, plan);
  });
  const found = await findMany(queries.map((q) => q.targetQuery));
  const map = new Map<string, string>();
  for (const f of found) map.set(f.key, f.id);
  // Also index by our constructed sourceKey when findMany returns matching keys
  queries.forEach((q, i) => {
    const hit = found.find((f) => f.key === q.sourceKey || f.key === String(Object.values(q.targetQuery)[0]));
    if (hit) map.set(q.sourceKey, hit.id);
  });
  return map;
}
