/**
 * Nest facade for ITAM Phases B–D (cloud, passive, topology).
 * Reuses DiscoveryStore SoR + RBAC patterns from Phase A.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { getDiscoveryStore, flushDiscoveryStoreDurable, type DiscoveryStore } from '../discovery/store';
import type { ItamPrincipal } from '../discovery/discovery.service';
import { CloudDiscoveryEngine } from './engine';
import {
  MockAwsDiscoveryProvider,
  MockAzureDiscoveryProvider,
  MockGcpDiscoveryProvider,
  MockVmwareDiscoveryProvider,
  AwsSdkDiscoveryProvider,
  AzureSdkDiscoveryProvider,
  GcpSdkDiscoveryProvider,
  VmwareApiDiscoveryProvider,
} from './providers';
import type { CloudProviderType } from './types';
import { PassiveIntelligenceEngine } from '../passive/engine';
import type { PassiveObservationInput, TelemetrySourceType } from '../passive/types';
import {
  MockDhcpTelemetryProvider,
  MockArpTelemetryProvider,
  MockDnsTelemetryProvider,
  MockSwitchMacProvider,
  MockWirelessControllerProvider,
} from '../passive/types';
import { TopologyEngine } from '../topology/engine';

const ADMIN_ROLES = new Set(['admin', 'org_admin', 'itam_admin', 'owner', 'super_admin', 'ITAM_ADMIN', 'ORG_ADMIN']);

@Injectable()
export class ItamCloudService {
  private store: DiscoveryStore;
  readonly mockAws = new MockAwsDiscoveryProvider();
  readonly mockAzure = new MockAzureDiscoveryProvider();
  readonly mockGcp = new MockGcpDiscoveryProvider();
  readonly mockVmware = new MockVmwareDiscoveryProvider();
  readonly dhcp = new MockDhcpTelemetryProvider();
  readonly arp = new MockArpTelemetryProvider();
  readonly dns = new MockDnsTelemetryProvider();
  readonly switchMac = new MockSwitchMacProvider();
  readonly wireless = new MockWirelessControllerProvider();

  constructor() {
    this.store = getDiscoveryStore();
  }

  refreshStore() {
    this.store = getDiscoveryStore();
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

  cloudEngine() {
    return new CloudDiscoveryEngine(this.store as any);
  }

  passiveEngine() {
    return new PassiveIntelligenceEngine(this.store as any);
  }

  topologyEngine() {
    return new TopologyEngine(this.store as any);
  }

  // ── Cloud providers ────────────────────────────────────────────────────
  listCloudProviders(principal: ItamPrincipal) {
    return this.store.cloudProviders.filter((p) => p.organizationId === principal.organizationId);
  }

  createCloudProvider(principal: ItamPrincipal, body: {
    providerType: CloudProviderType;
    name: string;
    credentialReferenceId: string;
    environment?: string;
    config?: Record<string, unknown>;
  }) {
    this.requireAdmin(principal);
    if (!body.credentialReferenceId) throw new BadRequestException('credentialReferenceId required');
    const row = this.cloudEngine().createProvider({
      organizationId: principal.organizationId,
      providerType: body.providerType,
      name: body.name,
      environment: (body.environment || 'LAB') as any,
      credentialReferenceId: body.credentialReferenceId,
      config: body.config || {},
      enabled: true,
      createdBy: principal.userId,
    });
    void this.persist();
    return row;
  }

  listCloudResources(principal: ItamPrincipal) {
    return this.store.cloudResources.filter((r) => r.organizationId === principal.organizationId);
  }

  listCloudJobs(principal: ItamPrincipal) {
    return this.store.cloudJobs.filter((j) => j.organizationId === principal.organizationId);
  }

  getCloudJob(principal: ItamPrincipal, id: string) {
    const j = this.store.cloudJobs.find((x) => x.id === id && x.organizationId === principal.organizationId);
    if (!j) throw new NotFoundException('Cloud job not found');
    return j;
  }

  createCloudJob(principal: ItamPrincipal, body: { providerId: string; name: string; schedule?: string; credentialReferenceId?: string }) {
    this.requireAdmin(principal);
    const provider = this.store.cloudProviders.find(
      (p) => p.id === body.providerId && p.organizationId === principal.organizationId,
    );
    if (!provider) throw new NotFoundException('Provider not found');
    const job = this.cloudEngine().createJob({
      organizationId: principal.organizationId,
      providerId: body.providerId,
      name: body.name,
      schedule: (body.schedule as any) || 'ON_DEMAND',
      credentialReferenceId: body.credentialReferenceId || provider.credentialReferenceId,
      createdBy: principal.userId,
    });
    void this.persist();
    return job;
  }

  async startCloudJob(principal: ItamPrincipal, jobId: string) {
    this.requireAdmin(principal);
    const job = this.getCloudJob(principal, jobId);
    const provider = this.store.cloudProviders.find((p) => p.id === job.providerId)!;
    const impl = this.providerImpl(provider.providerType);
    const result = await this.cloudEngine().runJob(jobId, impl as any, {
      actorId: principal.userId,
      resolveSecret: this.resolveSecret,
    });
    await this.persist();
    return { started: true, ...result, job };
  }

  cancelCloudJob(principal: ItamPrincipal, jobId: string) {
    this.requireAdmin(principal);
    const job = this.getCloudJob(principal, jobId);
    job.status = 'CANCELLED';
    job.updatedAt = new Date().toISOString();
    this.store.audit(principal.organizationId, 'discovery_cancelled', {
      actorId: principal.userId,
      entityType: 'cloud_discovery_job',
      entityId: jobId,
    });
    void this.persist();
    return { cancelled: true };
  }

  // VMware aliases
  listVmwareProviders(principal: ItamPrincipal) {
    return this.listCloudProviders(principal).filter((p) => p.providerType === 'VMWARE');
  }

  createVmwareProvider(principal: ItamPrincipal, body: { name: string; credentialReferenceId: string; config?: Record<string, unknown> }) {
    return this.createCloudProvider(principal, { ...body, providerType: 'VMWARE' });
  }

  listVmwareResources(principal: ItamPrincipal) {
    return this.listCloudResources(principal).filter((r) => r.providerType === 'VMWARE');
  }

  private providerImpl(type: CloudProviderType) {
    if (type === 'AWS') return process.env.ITAM_AWS_LIVE === '1' ? new AwsSdkDiscoveryProvider() : this.mockAws;
    if (type === 'AZURE') return process.env.ITAM_AZURE_LIVE === '1' ? new AzureSdkDiscoveryProvider() : this.mockAzure;
    if (type === 'GCP') return process.env.ITAM_GCP_LIVE === '1' ? new GcpSdkDiscoveryProvider() : this.mockGcp;
    if (type === 'VMWARE') return process.env.ITAM_VMWARE_LIVE === '1' ? new VmwareApiDiscoveryProvider() : this.mockVmware;
    return this.mockAws;
  }

  // ── Passive ─────────────────────────────────────────────────────────────
  listTelemetrySources(principal: ItamPrincipal) {
    return this.store.telemetrySources.filter((s) => s.organizationId === principal.organizationId);
  }

  createTelemetrySource(principal: ItamPrincipal, body: {
    sourceType: TelemetrySourceType;
    name: string;
    authorizedScopes?: string[];
    credentialReferenceId?: string;
    config?: Record<string, unknown>;
  }) {
    this.requireAdmin(principal);
    const row = this.passiveEngine().createSource({
      organizationId: principal.organizationId,
      sourceType: body.sourceType,
      name: body.name,
      authorizedScopes: body.authorizedScopes || [],
      credentialReferenceId: body.credentialReferenceId,
      enabled: true,
      config: body.config || {},
      createdBy: principal.userId,
    });
    void this.persist();
    return row;
  }

  ingestObservations(
    principal: ItamPrincipal,
    sourceType: TelemetrySourceType,
    observations: PassiveObservationInput[],
    sourceId?: string,
  ) {
    this.requireAdmin(principal);
    const result = this.passiveEngine().ingest(principal.organizationId, sourceType, observations, {
      sourceId,
      actorId: principal.userId,
    });
    void this.persist();
    return result;
  }

  listObservations(principal: ItamPrincipal) {
    return this.store.networkObservations
      .filter((o) => o.organizationId === principal.organizationId)
      .slice(-500)
      .reverse();
  }

  ipHistory(principal: ItamPrincipal, assetId: string) {
    const asset = this.store.assets.find((a) => a.id === assetId && a.organizationId === principal.organizationId);
    if (!asset) throw new NotFoundException('Asset not found');
    return this.store.ipHistory.filter((h) => h.assetId === assetId);
  }

  macHistory(principal: ItamPrincipal, assetId: string) {
    const asset = this.store.assets.find((a) => a.id === assetId && a.organizationId === principal.organizationId);
    if (!asset) throw new NotFoundException('Asset not found');
    return this.store.macHistory.filter((h) => h.assetId === assetId);
  }

  listDhcp(principal: ItamPrincipal) {
    return this.listObservations(principal).filter((o) => o.sourceType === 'DHCP');
  }

  listDns(principal: ItamPrincipal) {
    return this.listObservations(principal).filter((o) => o.sourceType === 'DNS');
  }

  listSwitches(principal: ItamPrincipal) {
    return this.listObservations(principal).filter((o) => o.sourceType === 'SWITCH_MAC');
  }

  // ── Topology ───────────────────────────────────────────────────────────
  topologySummary(principal: ItamPrincipal) {
    const org = principal.organizationId;
    return {
      nodes: this.store.topologyNodes.filter((n) => n.organizationId === org).length,
      edges: this.store.topologyEdges.filter((e) => e.organizationId === org).length,
      history: this.store.topologyHistory.filter((h) => h.organizationId === org).length,
    };
  }

  topologyGraph(principal: ItamPrincipal, opts?: { includeLowConfidence?: boolean; maxNodes?: number }) {
    const org = principal.organizationId;
    const nodes = this.store.topologyNodes.filter((n) => n.organizationId === org).slice(0, opts?.maxNodes || 200);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = this.store.topologyEdges.filter((e) => {
      if (e.organizationId !== org) return false;
      if (!opts?.includeLowConfidence && e.confidence === 'LOW') return false;
      return nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId);
    });
    return { nodes, edges };
  }

  topologyNeighbors(principal: ItamPrincipal, nodeId: string, query: Record<string, string>) {
    const node = this.store.topologyNodes.find((n) => n.id === nodeId && n.organizationId === principal.organizationId);
    if (!node) throw new NotFoundException('Topology node not found');
    return this.topologyEngine().neighbors(principal.organizationId, nodeId, {
      depth: Number(query.depth || 1),
      maxNodes: Number(query.maxNodes || 100),
      includeLowConfidence: query.includeLowConfidence === '1',
      minConfidence: (query.minConfidence as any) || undefined,
    });
  }

  topologyForAsset(principal: ItamPrincipal, assetId: string) {
    const asset = this.store.assets.find((a) => a.id === assetId && a.organizationId === principal.organizationId);
    if (!asset) throw new NotFoundException('Asset not found');
    const node = this.store.topologyNodes.find((n) => n.organizationId === principal.organizationId && n.assetId === assetId);
    if (!node) return { nodes: [], edges: [], assetId };
    return { ...this.topologyEngine().neighbors(principal.organizationId, node.id, { depth: 2, maxNodes: 100 }), assetId };
  }

  topologyPath(principal: ItamPrincipal, fromId: string, toId: string) {
    return this.topologyEngine().path(principal.organizationId, fromId, toId, { includeLowConfidence: false });
  }

  metrics(principal: ItamPrincipal) {
    const org = principal.organizationId;
    return {
      cloud_discovery_jobs_total: this.store.cloudJobs.filter((j) => j.organizationId === org).length,
      cloud_resources_discovered_total: this.store.cloudResources.filter((r) => r.organizationId === org).length,
      vmware_resources_discovered_total: this.store.cloudResources.filter((r) => r.organizationId === org && r.providerType === 'VMWARE').length,
      network_observations_total: this.store.networkObservations.filter((o) => o.organizationId === org).length,
      topology_edges_created_total: this.store.topologyEdges.filter((e) => e.organizationId === org).length,
      topology_edges_removed_total: this.store.topologyHistory.filter((h) => h.organizationId === org && h.changeType === 'LINK_REMOVED').length,
      correlation_success_total: this.store.cloudResources.filter((r) => r.organizationId === org && r.assetId).length,
      discovery_errors_total: this.store.cloudJobs.filter((j) => j.organizationId === org && j.status === 'FAILED').length,
    };
  }

  getStore() {
    return this.store;
  }
}
