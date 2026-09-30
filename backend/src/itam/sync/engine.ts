/**
 * ITAM Form Sync engine — correlate → map → validate → dry-run/execute via Existing App API.
 */
import { createHash, randomUUID } from 'crypto';
import type { DiscoveryStore } from '../discovery/store';
import { normalizeStoredAsset, idempotencyKey } from './normalize';
import { applyMappings, suggestItamMappings, validateAgainstSchema, mappingRequiresApproval } from './mapping';
import type { ExistingAppTarget } from './target';
import type {
  CorrelationLink,
  FieldProvenanceRow,
  FormSchemaSnapshot,
  NormalizedAsset,
  SyncHistoryRow,
  SyncItemResult,
  SyncMappingDefinition,
  SyncRun,
  SyncTargetConfig,
} from './types';

export interface SyncStoreSlice {
  syncTargets: SyncTargetConfig[];
  syncMappings: SyncMappingDefinition[];
  syncSchemaCache: FormSchemaSnapshot[];
  syncRuns: SyncRun[];
  syncHistory: SyncHistoryRow[];
  syncProvenance: FieldProvenanceRow[];
  syncLinks: CorrelationLink[];
}

const SCHEMA_TTL_MS = 5 * 60 * 1000;

/** Convert name-keyed mapped payload to Form API body using live field IDs. */
export function toFormApiPayload(
  mapped: Record<string, unknown>,
  schema: FormSchemaSnapshot,
): Record<string, unknown> {
  const byName = new Map(schema.fields.map((f) => [f.name, f]));
  const data: Record<string, unknown> = {};
  let usedIds = 0;
  for (const [k, v] of Object.entries(mapped)) {
    const f = byName.get(k);
    if (f?.id) {
      data[f.id] = v;
      usedIds += 1;
    } else {
      data[k] = v;
    }
  }
  // TopSqill Form API: { data: {fieldId: value}, validate: true }
  if (usedIds > 0) return { data, validate: true };
  return mapped;
}

/** Normalize Form API submission_data (field IDs) back to schema field names. */
export function normalizeRecordData(
  data: Record<string, unknown>,
  schema: FormSchemaSnapshot,
): Record<string, unknown> {
  const byId = new Map(schema.fields.filter((f) => f.id).map((f) => [String(f.id), f.name]));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data || {})) {
    out[byId.get(k) || k] = v;
  }
  return out;
}

export class FormSyncEngine {
  constructor(private readonly store: DiscoveryStore & SyncStoreSlice) {}

  createTarget(input: Omit<SyncTargetConfig, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SyncTargetConfig {
    if (!input.credentialReferenceId) throw new Error('credentialReferenceId required');
    if (!input.baseUrl) throw new Error('baseUrl required');
    const row: SyncTargetConfig = {
      ...input,
      id: input.id || randomUUID(),
      formsPath: input.formsPath || '/api/forms',
      formFieldsPath: input.formFieldsPath || '/api/forms/{formId}/fields',
      recordsPath: input.recordsPath || '/api/forms/{formId}/records',
      recordByIdPath: input.recordByIdPath || '/api/forms/{formId}/records/{recordId}',
      enabled: input.enabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.syncTargets.push(row);
    this.store.audit(row.organizationId, 'sync_target_created', {
      entityType: 'sync_target',
      entityId: row.id,
      detail: { name: row.name, baseUrl: row.baseUrl },
    });
    return row;
  }

  upsertMapping(input: {
    organizationId: string;
    name: string;
    targetFormId: string;
    mappings: SyncMappingDefinition['mappings'];
    matchingSourceFields?: string[];
    matchingTargetFields?: string[];
    mappingSource?: SyncMappingDefinition['mappingSource'];
    confidence?: SyncMappingDefinition['confidence'];
    reasoning?: string;
    status?: SyncMappingDefinition['status'];
    id?: string;
  }): SyncMappingDefinition {
    const existing = input.id
      ? this.store.syncMappings.find((m) => m.id === input.id)
      : this.store.syncMappings.find(
        (m) => m.organizationId === input.organizationId && m.targetFormId === input.targetFormId && m.name === input.name,
      );
    if (existing) {
      existing.version += 1;
      existing.mappings = input.mappings;
      existing.matchingSourceFields = input.matchingSourceFields || existing.matchingSourceFields;
      existing.matchingTargetFields = input.matchingTargetFields || existing.matchingTargetFields;
      existing.mappingSource = input.mappingSource || existing.mappingSource;
      existing.confidence = input.confidence;
      existing.reasoning = input.reasoning;
      existing.status = input.status || existing.status;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
    const row: SyncMappingDefinition = {
      id: input.id || randomUUID(),
      organizationId: input.organizationId,
      name: input.name,
      targetFormId: input.targetFormId,
      version: 1,
      status: input.status || (mappingRequiresApproval(input.mappings) ? 'DRAFT' : 'DRAFT'),
      mappings: input.mappings,
      matchingSourceFields: input.matchingSourceFields || ['externalId', 'serialNumber', 'machineGuid', 'cloudInstanceId'],
      matchingTargetFields: input.matchingTargetFields || ['external_id', 'serial_number', 'machine_guid', 'cloud_instance_id'],
      mappingSource: input.mappingSource || 'DETERMINISTIC',
      confidence: input.confidence,
      reasoning: input.reasoning,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.syncMappings.push(row);
    return row;
  }

  approveMapping(organizationId: string, mappingId: string, actorId: string): SyncMappingDefinition {
    const m = this.store.syncMappings.find((x) => x.id === mappingId && x.organizationId === organizationId);
    if (!m) throw new Error('Mapping not found');
    m.status = 'APPROVED';
    m.approvedBy = actorId;
    m.approvedAt = new Date().toISOString();
    m.updatedAt = m.approvedAt;
    this.store.audit(organizationId, 'sync_mapping_approved', {
      actorId,
      entityType: 'sync_mapping',
      entityId: mappingId,
      detail: { version: m.version, formId: m.targetFormId },
    });
    return m;
  }

  async refreshSchema(target: ExistingAppTarget, formId: string, organizationId: string): Promise<FormSchemaSnapshot> {
    const snap = await target.getFormSchema(formId);
    const idx = this.store.syncSchemaCache.findIndex((s) => s.formId === formId);
    const prev = idx >= 0 ? this.store.syncSchemaCache[idx] : null;
    if (prev && prev.hash !== snap.hash) {
      for (const m of this.store.syncMappings.filter((x) => x.organizationId === organizationId && x.targetFormId === formId)) {
        m.status = 'STALE';
        m.updatedAt = new Date().toISOString();
      }
      this.store.audit(organizationId, 'sync_schema_changed', {
        entityType: 'form_schema',
        entityId: formId,
        detail: { previousHash: prev.hash, newHash: snap.hash },
      });
    }
    if (idx >= 0) this.store.syncSchemaCache[idx] = snap;
    else this.store.syncSchemaCache.push(snap);
    return snap;
  }

  async getSchemaCached(
    target: ExistingAppTarget,
    formId: string,
    organizationId: string,
    force = false,
  ): Promise<FormSchemaSnapshot> {
    const cached = this.store.syncSchemaCache.find((s) => s.formId === formId);
    if (!force && cached && Date.now() - new Date(cached.fetchedAt).getTime() < SCHEMA_TTL_MS) {
      return cached;
    }
    return this.refreshSchema(target, formId, organizationId);
  }

  proposeMappings(schema: FormSchemaSnapshot, sampleSourceFields: string[]): SyncMappingDefinition['mappings'] {
    return suggestItamMappings({
      sourceFields: sampleSourceFields.map((name) => ({ name })),
      targetFields: schema.fields,
    });
  }

  async runSync(input: {
    organizationId: string;
    targetConfigId: string;
    mappingId: string;
    mode: 'DRY_RUN' | 'EXECUTE';
    target: ExistingAppTarget;
    actorId?: string;
    assetIds?: string[];
  }): Promise<SyncRun> {
    const config = this.store.syncTargets.find(
      (t) => t.id === input.targetConfigId && t.organizationId === input.organizationId,
    );
    if (!config || !config.enabled) throw new Error('Sync target not found or disabled');
    const mapping = this.store.syncMappings.find(
      (m) => m.id === input.mappingId && m.organizationId === input.organizationId,
    );
    if (!mapping) throw new Error('Mapping not found');
    if (input.mode === 'EXECUTE' && mapping.status !== 'APPROVED') {
      throw new Error('Mapping must be APPROVED before execute');
    }
    const formId = mapping.targetFormId || config.targetFormId;
    if (!formId) throw new Error('targetFormId required');

    const run: SyncRun = {
      id: randomUUID(),
      organizationId: input.organizationId,
      targetConfigId: config.id,
      mappingId: mapping.id,
      mappingVersion: mapping.version,
      mode: input.mode,
      status: 'RUNNING',
      correlationId: randomUUID(),
      executionId: randomUUID(),
      totals: { discovered: 0, created: 0, updated: 0, noChange: 0, ambiguous: 0, failed: 0, blocked: 0 },
      items: [],
      startedAt: new Date().toISOString(),
    };
    this.store.syncRuns.push(run);
    this.store.audit(input.organizationId, input.mode === 'DRY_RUN' ? 'sync_dry_run_started' : 'sync_execute_started', {
      actorId: input.actorId,
      entityType: 'sync_run',
      entityId: run.id,
      detail: { formId, mappingVersion: mapping.version },
    });

    let schema: FormSchemaSnapshot;
    try {
      schema = await this.getSchemaCached(input.target, formId, input.organizationId);
      run.schemaVersion = schema.version;
    } catch (e: any) {
      run.status = 'CONFIGURATION_REQUIRED';
      run.error = e?.message || 'schema discovery failed';
      run.finishedAt = new Date().toISOString();
      return run;
    }

    // Invalidate if mapping references missing fields
    const fieldNames = new Set(schema.fields.map((f) => f.name));
    const stale = mapping.mappings.filter((m) => m.enabled !== false && !fieldNames.has(m.targetField));
    if (stale.length) {
      mapping.status = 'STALE';
      if (input.mode === 'EXECUTE') {
        run.status = 'SCHEMA_CHANGED';
        run.error = `Mapping targets missing fields: ${stale.map((s) => s.targetField).join(', ')}`;
        run.finishedAt = new Date().toISOString();
        return run;
      }
    }

    const assets = this.store.findAssets(input.organizationId).filter(
      (a) => !input.assetIds || input.assetIds.includes(a.id),
    );
    run.totals.discovered = assets.length;

    for (const asset of assets) {
      const software = this.store.software.filter((s) => s.assetId === asset.id).map((s) => s.softwareName);
      const normalized = normalizeStoredAsset(asset, {
        discoverySource: asset.primaryDiscoverySource,
        softwareNames: software,
      });
      const item = await this.syncOne({
        normalized,
        mapping,
        schema,
        formId,
        mode: input.mode,
        target: input.target,
        run,
      });
      run.items.push(item);
      if (item.status === 'SUCCESS' && item.operation === 'CREATE') run.totals.created += 1;
      else if (item.status === 'SUCCESS' && item.operation === 'UPDATE') run.totals.updated += 1;
      else if (item.status === 'NO_CHANGE' || item.operation === 'NO_CHANGE' || item.operation === 'WOULD_UPDATE' && false) {
        /* handled below */
      }
      if (item.operation === 'NO_CHANGE' || item.operation === 'WOULD_UPDATE' && item.status === 'DRY_RUN' && false) {
        // noop
      }
      if (item.status === 'NO_CHANGE' || item.operation === 'NO_CHANGE') run.totals.noChange += 1;
      if (item.operation === 'WOULD_CREATE' || item.operation === 'WOULD_UPDATE') {
        if (item.operation === 'WOULD_CREATE') run.totals.created += 1;
        if (item.operation === 'WOULD_UPDATE') run.totals.updated += 1;
      }
      if (item.status === 'AMBIGUOUS_MATCH') run.totals.ambiguous += 1;
      if (item.status === 'BLOCKED' || item.status === 'CONFIGURATION_REQUIRED') run.totals.blocked += 1;
      if (['VALIDATION_FAILED', 'API_ERROR', 'AUTHENTICATION_FAILED', 'RATE_LIMITED', 'REFERENCE_RESOLUTION_FAILED'].includes(item.status)) {
        run.totals.failed += 1;
      }
    }

    // Fix double-counting for dry-run would_* as created/updated already counted; noChange for dry SUCCESS NO_CHANGE
    run.status = 'COMPLETED';
    run.finishedAt = new Date().toISOString();
    run.durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
    this.store.audit(input.organizationId, input.mode === 'DRY_RUN' ? 'sync_dry_run_completed' : 'sync_execute_completed', {
      actorId: input.actorId,
      entityType: 'sync_run',
      entityId: run.id,
      detail: { ...run.totals, durationMs: run.durationMs },
    });
    return run;
  }

  private async syncOne(input: {
    normalized: NormalizedAsset;
    mapping: SyncMappingDefinition;
    schema: FormSchemaSnapshot;
    formId: string;
    mode: 'DRY_RUN' | 'EXECUTE';
    target: ExistingAppTarget;
    run: SyncRun;
  }): Promise<SyncItemResult> {
    const { normalized, mapping, schema, formId, mode, target, run } = input;
    const mapped = applyMappings(normalized.fields, mapping.mappings);
    // Always populate stable external_id from normalized identity when schema requires it
    if (schema.fields.some((f) => f.name === 'external_id') && (mapped.external_id == null || mapped.external_id === '')) {
      mapped.external_id = normalized.externalId;
    }
    const validationErrors = validateAgainstSchema(mapped, schema.fields);
    if (validationErrors.length) {
      return {
        externalId: normalized.externalId,
        operation: 'BLOCKED',
        status: 'VALIDATION_FAILED',
        validationErrors,
        mappedPayload: mapped,
      };
    }

    // Correlation: existing link first, then search by identity keys
    const link = this.store.syncLinks.find(
      (l) =>
        l.organizationId === normalized.tenantId
        && l.targetFormId === formId
        && l.externalId === normalized.externalId,
    );

    const candidates: Array<{ id: string; score: number; keys: string[] }> = [];
    if (link) {
      candidates.push({ id: link.targetRecordId, score: 100, keys: ['link'] });
    }

    const searchKeys: Array<[string, string | undefined]> = [
      ['external_id', String(mapped.external_id || normalized.externalId)],
      ['serial_number', String(mapped.serial_number || normalized.serialNumber || '')],
      ['serial_number_service_tag', String(mapped.serial_number_service_tag || mapped.serial_number || normalized.serialNumber || '')],
      ['machine_guid', String(mapped.machine_guid || normalized.machineGuid || '')],
      ['cloud_instance_id', String(mapped.cloud_instance_id || normalized.cloudInstanceId || '')],
      ['mac_address', String(mapped.mac_address || normalized.macAddresses[0] || '')],
      ['device_name', String(mapped.device_name || mapped.asset_name || mapped.asset_name_hostname || normalized.hostname || '')],
      ['asset_name', String(mapped.asset_name || mapped.asset_name_hostname || normalized.hostname || '')],
      ['asset_name_hostname', String(mapped.asset_name_hostname || mapped.asset_name || normalized.hostname || '')],
      ['primary_ip', String(mapped.primary_ip || mapped.primary_ip_address || normalized.ipAddresses[0] || '')],
      ['primary_ip_address', String(mapped.primary_ip_address || mapped.primary_ip || normalized.ipAddresses[0] || '')],
    ];

    for (const [field, value] of searchKeys) {
      if (!value) continue;
      // Skip IP-only as sole permanent identity later
      try {
        const schemaField = schema.fields.find((f) => f.name === field);
        const query = schemaField?.id
          ? { [`filter[${schemaField.id}]`]: value }
          : { [field]: value };
        const found = await target.searchRecords(formId, query);
        for (const f of found) {
          const weight =
            field === 'external_id' || field === 'machine_guid' || field === 'serial_number' || field === 'cloud_instance_id'
              ? 90
              : field === 'mac_address'
                ? 50
                : field === 'device_name' || field === 'asset_name'
                  ? 30
                  : 10;
          const existing = candidates.find((c) => c.id === f.id);
          if (existing) {
            existing.score += weight;
            existing.keys.push(field);
          } else {
            candidates.push({ id: f.id, score: weight, keys: [field] });
          }
        }
      } catch {
        // search optional
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const strong = candidates.filter((c) => c.score >= 50 && !(c.keys.length === 1 && c.keys[0] === 'primary_ip'));
    if (candidates.length > 1 && strong.length > 1 && strong[0].score === strong[1].score) {
      return {
        externalId: normalized.externalId,
        operation: 'AMBIGUOUS_MATCH',
        status: 'AMBIGUOUS_MATCH',
        matchCandidates: candidates.slice(0, 5),
        mappedPayload: mapped,
      };
    }

    // IP-only match → treat as new unmanaged create candidate (weak)
    const best = strong[0] || null;
    if (candidates[0] && candidates[0].keys.length === 1 && candidates[0].keys[0] === 'primary_ip' && !best) {
      // ignore IP-only
    }

    if (best) {
      const existing = await target.getRecord(formId, best.id);
      if (!existing) {
        // stale link
      } else {
        const existingNamed = normalizeRecordData(existing.data, schema);
        const changed = diffFields(existingNamed, mapped);
        if (!changed.length) {
          this.history(normalized, formId, best.id, 'NO_CHANGE', 'NO_CHANGE', [], mapping, schema, run);
          return {
            externalId: normalized.externalId,
            operation: mode === 'DRY_RUN' ? 'NO_CHANGE' : 'NO_CHANGE',
            status: 'NO_CHANGE',
            targetRecordId: best.id,
            mappedPayload: mapped,
            changedFields: [],
          };
        }
        if (mode === 'DRY_RUN') {
          return {
            externalId: normalized.externalId,
            operation: 'WOULD_UPDATE',
            status: 'DRY_RUN',
            targetRecordId: best.id,
            mappedPayload: mapped,
            changedFields: changed,
          };
        }
        try {
          const updated = await target.updateRecord(formId, best.id, toFormApiPayload(mapped, schema));
          this.upsertLink(normalized, formId, updated.id, 'UPDATE');
          this.recordProvenance(normalized, formId, updated.id, mapped, mapping, schema);
          this.history(normalized, formId, updated.id, 'UPDATE', 'SUCCESS', changed, mapping, schema, run);
          return {
            externalId: normalized.externalId,
            operation: 'UPDATE',
            status: 'SUCCESS',
            targetRecordId: updated.id,
            mappedPayload: mapped,
            changedFields: changed,
          };
        } catch (e: any) {
          return {
            externalId: normalized.externalId,
            operation: 'UPDATE',
            status: (e?.category as any) || 'API_ERROR',
            error: redactSecrets(e?.message || 'update failed'),
            errorCategory: e?.category || 'API_ERROR',
            mappedPayload: mapped,
          };
        }
      }
    }

    // CREATE
    if (mode === 'DRY_RUN') {
      return {
        externalId: normalized.externalId,
        operation: 'WOULD_CREATE',
        status: 'DRY_RUN',
        mappedPayload: mapped,
      };
    }
    try {
      const created = await target.createRecord(formId, toFormApiPayload(mapped, schema));
      this.upsertLink(normalized, formId, created.id, 'CREATE');
      this.recordProvenance(normalized, formId, created.id, mapped, mapping, schema);
      this.history(normalized, formId, created.id, 'CREATE', 'SUCCESS', Object.keys(mapped), mapping, schema, run);
      return {
        externalId: normalized.externalId,
        operation: 'CREATE',
        status: 'SUCCESS',
        targetRecordId: created.id,
        mappedPayload: mapped,
        changedFields: Object.keys(mapped),
        provenance: {
          idempotencyKey: idempotencyKey({
            tenantId: normalized.tenantId,
            formId,
            externalId: normalized.externalId,
            mappingVersion: mapping.version,
          }),
        },
      };
    } catch (e: any) {
      return {
        externalId: normalized.externalId,
        operation: 'CREATE',
        status: (e?.category as any) || 'API_ERROR',
        error: redactSecrets(e?.message || 'create failed'),
        errorCategory: e?.category || 'API_ERROR',
        mappedPayload: mapped,
      };
    }
  }

  /** Convert name-keyed mapped payload to TopSqill Form API `{ data: {fieldId: value} }`. */
  private upsertLink(normalized: NormalizedAsset, formId: string, recordId: string, op: string) {
    const existing = this.store.syncLinks.find(
      (l) => l.organizationId === normalized.tenantId && l.targetFormId === formId && l.externalId === normalized.externalId,
    );
    const keys: Record<string, string> = {};
    if (normalized.serialNumber) keys.serialNumber = normalized.serialNumber;
    if (normalized.machineGuid) keys.machineGuid = normalized.machineGuid;
    if (normalized.cloudInstanceId) keys.cloudInstanceId = normalized.cloudInstanceId;
    if (normalized.macAddresses[0]) keys.macAddress = normalized.macAddresses[0];
    if (existing) {
      existing.targetRecordId = recordId;
      existing.lastSyncedAt = new Date().toISOString();
      existing.lastOperation = op;
      existing.identityKeys = keys;
    } else {
      this.store.syncLinks.push({
        id: randomUUID(),
        organizationId: normalized.tenantId,
        externalId: normalized.externalId,
        targetFormId: formId,
        targetRecordId: recordId,
        identityKeys: keys,
        lastSyncedAt: new Date().toISOString(),
        lastOperation: op,
      });
    }
  }

  private recordProvenance(
    normalized: NormalizedAsset,
    formId: string,
    recordId: string,
    mapped: Record<string, unknown>,
    mapping: SyncMappingDefinition,
    schema: FormSchemaSnapshot,
  ) {
    const now = new Date().toISOString();
    for (const [targetField, value] of Object.entries(mapped)) {
      const mapSpec = mapping.mappings.find((m) => m.targetField === targetField);
      this.store.syncProvenance.push({
        id: randomUUID(),
        organizationId: normalized.tenantId,
        externalId: normalized.externalId,
        targetRecordId: recordId,
        targetField,
        value: value == null ? undefined : String(value),
        sourceProvider: normalized.discoverySource,
        sourceField: mapSpec?.sourceField,
        mappingId: mapping.id,
        mappingVersion: mapping.version,
        syncedAt: now,
      });
    }
  }

  private history(
    normalized: NormalizedAsset,
    formId: string,
    recordId: string | undefined,
    operation: string,
    status: string,
    changedFields: string[],
    mapping: SyncMappingDefinition,
    schema: FormSchemaSnapshot,
    run: SyncRun,
  ) {
    this.store.syncHistory.push({
      id: randomUUID(),
      organizationId: normalized.tenantId,
      externalId: normalized.externalId,
      targetFormId: formId,
      targetRecordId: recordId,
      operation,
      status,
      changedFields,
      mappingVersion: mapping.version,
      schemaVersion: schema.version,
      executionId: run.executionId,
      detail: {},
      createdAt: new Date().toISOString(),
    });
  }
}

function diffFields(existing: Record<string, unknown>, incoming: Record<string, unknown>): string[] {
  const changed: string[] = [];
  for (const [k, v] of Object.entries(incoming)) {
    if (String(existing[k] ?? '') !== String(v ?? '')) changed.push(k);
  }
  return changed;
}

function redactSecrets(msg: string): string {
  return String(msg || '')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/password[=:]\s*\S+/gi, 'password=***')
    .replace(/secret[=:]\s*\S+/gi, 'secret=***')
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA***');
}

export function metricsHash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 8);
}
