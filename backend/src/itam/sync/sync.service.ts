/**
 * Nest facade for ITAM → Existing Application Form Sync.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { getDiscoveryStore, flushDiscoveryStoreDurable, type DiscoveryStore } from '../discovery/store';
import type { ItamPrincipal } from '../discovery/discovery.service';
import { FormSyncEngine, type SyncStoreSlice } from './engine';
import { HttpExistingAppTarget, MockExistingAppTarget } from './target';
import type { SyncTargetConfig } from './types';

const ADMIN_ROLES = new Set(['admin', 'org_admin', 'itam_admin', 'owner', 'super_admin', 'ITAM_ADMIN', 'ORG_ADMIN']);

@Injectable()
export class ItamFormSyncService {
  private store: DiscoveryStore & SyncStoreSlice;
  /** Test/lab mock of existing application Form API */
  readonly mockTarget = new MockExistingAppTarget();

  constructor() {
    this.store = getDiscoveryStore() as DiscoveryStore & SyncStoreSlice;
    this.ensureSlice();
    this.mockTarget.seedItamAssetForm();
  }

  refreshStore() {
    this.store = getDiscoveryStore() as DiscoveryStore & SyncStoreSlice;
    this.ensureSlice();
  }

  private ensureSlice() {
    const s = this.store as any;
    if (!s.syncTargets) s.syncTargets = [];
    if (!s.syncMappings) s.syncMappings = [];
    if (!s.syncSchemaCache) s.syncSchemaCache = [];
    if (!s.syncRuns) s.syncRuns = [];
    if (!s.syncHistory) s.syncHistory = [];
    if (!s.syncProvenance) s.syncProvenance = [];
    if (!s.syncLinks) s.syncLinks = [];
  }

  private requireAdmin(principal: ItamPrincipal) {
    const ok = (principal.roles || []).some((r) => ADMIN_ROLES.has(String(r).toLowerCase()) || ADMIN_ROLES.has(String(r)));
    if (!ok && process.env.ITAM_DISCOVERY_REQUIRE_ADMIN !== '0') {
      throw new ForbiddenException('ITAM administrator role required');
    }
  }

  private async persist() {
    await flushDiscoveryStoreDurable(this.store);
  }

  private engine() {
    return new FormSyncEngine(this.store);
  }

  private resolveSecret = async (refId: string) => {
    const map = (globalThis as any).__ITAM_SECRET_MAP as Record<string, string> | undefined;
    if (map?.[refId]) return map[refId];
    try {
      const { createSecretProviderFromEnv } = await import('../../vis/security/secret-provider');
      return await createSecretProviderFromEnv().get(refId);
    } catch {
      return null;
    }
  };

  private async targetFor(config: SyncTargetConfig) {
    if (config.baseUrl === 'mock://existing-app' || process.env.ITAM_SYNC_USE_MOCK === '1') {
      return this.mockTarget;
    }
    const http = new HttpExistingAppTarget(config, { resolveSecret: this.resolveSecret });
    await http.connect();
    return http;
  }

  listTargets(principal: ItamPrincipal) {
    return this.store.syncTargets.filter((t) => t.organizationId === principal.organizationId);
  }

  createTarget(principal: ItamPrincipal, body: Partial<SyncTargetConfig> & { name: string; baseUrl: string; credentialReferenceId: string }) {
    this.requireAdmin(principal);
    if (/password|secret|token|apikey/i.test(JSON.stringify(body))) {
      throw new BadRequestException('Do not embed secrets — use credentialReferenceId');
    }
    const row = this.engine().createTarget({
      organizationId: principal.organizationId,
      name: body.name,
      baseUrl: body.baseUrl,
      credentialReferenceId: body.credentialReferenceId,
      formsPath: body.formsPath || '/api/forms',
      formFieldsPath: body.formFieldsPath || '/api/forms/{formId}/fields',
      recordsPath: body.recordsPath || '/api/forms/{formId}/records',
      recordByIdPath: body.recordByIdPath || '/api/forms/{formId}/records/{recordId}',
      searchPath: body.searchPath,
      targetFormId: body.targetFormId,
      enabled: true,
    });
    void this.persist();
    return row;
  }

  async discoverForms(principal: ItamPrincipal, targetId: string) {
    const config = this.store.syncTargets.find((t) => t.id === targetId && t.organizationId === principal.organizationId);
    if (!config) throw new NotFoundException('Target not found');
    const target = await this.targetFor(config);
    return target.discoverForms();
  }

  async getSchema(principal: ItamPrincipal, formId: string, targetId?: string) {
    const config = targetId
      ? this.store.syncTargets.find((t) => t.id === targetId && t.organizationId === principal.organizationId)
      : this.store.syncTargets.find((t) => t.organizationId === principal.organizationId && t.enabled);
    if (!config) throw new NotFoundException('Target not found');
    const target = await this.targetFor(config);
    const schema = await this.engine().refreshSchema(target, formId, principal.organizationId);
    void this.persist();
    return schema;
  }

  listMappings(principal: ItamPrincipal) {
    return this.store.syncMappings.filter((m) => m.organizationId === principal.organizationId);
  }

  async previewMappings(principal: ItamPrincipal, body: { targetId: string; formId: string; name?: string }) {
    this.requireAdmin(principal);
    const config = this.store.syncTargets.find((t) => t.id === body.targetId && t.organizationId === principal.organizationId);
    if (!config) throw new NotFoundException('Target not found');
    const target = await this.targetFor(config);
    const schema = await this.engine().getSchemaCached(target, body.formId, principal.organizationId, true);
    const sampleAsset = this.store.findAssets(principal.organizationId)[0];
    const sourceFields = sampleAsset
      ? Object.keys({
        hostname: 1, primaryIp: 1, ipAddress: 1, macAddress: 1, serialNumber: 1,
        machineGuid: 1, biosUuid: 1, cloudInstanceId: 1, externalId: 1,
        manufacturer: 1, model: 1, assetType: 1, environment: 1, operatingSystem: 1, osVersion: 1,
      })
      : ['hostname', 'primaryIp', 'serialNumber', 'externalId', 'macAddress', 'cloudInstanceId'];
    const mappings = this.engine().proposeMappings(schema, sourceFields);
    const row = this.engine().upsertMapping({
      organizationId: principal.organizationId,
      name: body.name || `Mapping ${body.formId}`,
      targetFormId: body.formId,
      mappings,
      mappingSource: 'DETERMINISTIC',
      confidence: mappings.every((m) => m.confidence === 'HIGH') ? 'HIGH' : 'MEDIUM',
      status: 'DRAFT',
    });
    void this.persist();
    return { schema, mapping: row, requiresApproval: row.status !== 'APPROVED' };
  }

  approveMapping(principal: ItamPrincipal, mappingId: string) {
    this.requireAdmin(principal);
    const row = this.engine().approveMapping(principal.organizationId, mappingId, principal.userId);
    void this.persist();
    return row;
  }

  async previewSync(principal: ItamPrincipal, body: { targetId: string; mappingId: string; assetIds?: string[] }) {
    this.requireAdmin(principal);
    const config = this.store.syncTargets.find((t) => t.id === body.targetId && t.organizationId === principal.organizationId);
    if (!config) throw new NotFoundException('Target not found');
    const target = await this.targetFor(config);
    // Ensure dry-run never writes even on mock
    const prevGuard = this.mockTarget.dryRunGuard;
    this.mockTarget.dryRunGuard = true;
    const writesBefore = this.mockTarget.writeCount;
    try {
      const run = await this.engine().runSync({
        organizationId: principal.organizationId,
        targetConfigId: body.targetId,
        mappingId: body.mappingId,
        mode: 'DRY_RUN',
        target,
        actorId: principal.userId,
        assetIds: body.assetIds,
      });
      if (this.mockTarget.writeCount !== writesBefore) {
        throw new Error('DRY_RUN produced writes — abort');
      }
      void this.persist();
      return run;
    } finally {
      this.mockTarget.dryRunGuard = prevGuard;
    }
  }

  async executeSync(principal: ItamPrincipal, body: { targetId: string; mappingId: string; assetIds?: string[] }) {
    this.requireAdmin(principal);
    const config = this.store.syncTargets.find((t) => t.id === body.targetId && t.organizationId === principal.organizationId);
    if (!config) throw new NotFoundException('Target not found');
    const target = await this.targetFor(config);
    this.mockTarget.dryRunGuard = false;
    const run = await this.engine().runSync({
      organizationId: principal.organizationId,
      targetConfigId: body.targetId,
      mappingId: body.mappingId,
      mode: 'EXECUTE',
      target,
      actorId: principal.userId,
      assetIds: body.assetIds,
    });
    void this.persist();
    return run;
  }

  listRuns(principal: ItamPrincipal) {
    return this.store.syncRuns.filter((r) => r.organizationId === principal.organizationId).slice().reverse();
  }

  getRun(principal: ItamPrincipal, id: string) {
    const r = this.store.syncRuns.find((x) => x.id === id && x.organizationId === principal.organizationId);
    if (!r) throw new NotFoundException('Sync run not found');
    return r;
  }

  history(principal: ItamPrincipal, assetExternalId: string) {
    return this.store.syncHistory.filter(
      (h) => h.organizationId === principal.organizationId && h.externalId === assetExternalId,
    );
  }

  provenance(principal: ItamPrincipal, assetExternalId: string) {
    return this.store.syncProvenance.filter(
      (p) => p.organizationId === principal.organizationId && p.externalId === assetExternalId,
    );
  }

  metrics(principal: ItamPrincipal) {
    const runs = this.store.syncRuns.filter((r) => r.organizationId === principal.organizationId);
    const items = runs.flatMap((r) => r.items);
    return {
      sync_success_total: items.filter((i) => i.status === 'SUCCESS').length,
      sync_failure_total: items.filter((i) => ['API_ERROR', 'VALIDATION_FAILED', 'AUTHENTICATION_FAILED'].includes(i.status)).length,
      sync_create_total: items.filter((i) => i.operation === 'CREATE').length,
      sync_update_total: items.filter((i) => i.operation === 'UPDATE').length,
      sync_no_change_total: items.filter((i) => i.operation === 'NO_CHANGE').length,
      sync_validation_failure_total: items.filter((i) => i.status === 'VALIDATION_FAILED').length,
      sync_ambiguous_total: items.filter((i) => i.status === 'AMBIGUOUS_MATCH').length,
      sync_api_error_total: items.filter((i) => i.status === 'API_ERROR').length,
      sync_runs_total: runs.length,
    };
  }

  getStore() {
    return this.store;
  }
}
