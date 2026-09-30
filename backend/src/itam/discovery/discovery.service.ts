/**
 * Nest service facade for ITAM network discovery.
 * Reuses DiscoveryStore/Engine; does not replace agent ingest.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DiscoveryStore,
  getDiscoveryStore,
  type StoredAsset,
} from './store';
import { DiscoveryEngine } from './engine';
import { MockNetworkDiscoveryProvider } from './providers';
import { buildAuthorizedTargets, cidrHostCount, parseCidr } from './scope';
import type { DiscoveryEnvironment, DiscoveryJob, DiscoveryMode, NetworkScope } from './types';

const ADMIN_ROLES = new Set(['admin', 'org_admin', 'itam_admin', 'owner', 'super_admin', 'ITAM_ADMIN', 'ORG_ADMIN']);

export interface ItamPrincipal {
  userId: string;
  organizationId: string;
  roles: string[];
}

@Injectable()
export class ItamDiscoveryService {
  private readonly store: DiscoveryStore;
  private readonly engines = new Map<string, DiscoveryEngine>();
  /** Optional lab mock provider shared for demo/tests via Nest */
  readonly mockProvider = new MockNetworkDiscoveryProvider();

  constructor() {
    this.store = getDiscoveryStore();
  }

  private assertAdmin(principal: ItamPrincipal) {
    if (!principal?.organizationId) throw new ForbiddenException('organization required');
    const ok = (principal.roles || []).some((r) => ADMIN_ROLES.has(String(r).toLowerCase()) || ADMIN_ROLES.has(String(r)));
    if (!ok && process.env.ITAM_DISCOVERY_REQUIRE_ADMIN !== '0') {
      // Allow if explicit ITAM_DISCOVERY_REQUIRE_ADMIN=0 for local demo; default fail-closed for sensitive ops checked below
    }
    return ok;
  }

  private requireAdmin(principal: ItamPrincipal) {
    if (!this.assertAdmin(principal) && process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('ITAM administrator role required');
    }
    if (!this.assertAdmin(principal) && process.env.ITAM_DISCOVERY_REQUIRE_ADMIN !== '0') {
      throw new ForbiddenException('ITAM administrator role required');
    }
  }

  private engineFor(orgId: string): DiscoveryEngine {
    let e = this.engines.get(orgId);
    if (!e) {
      e = new DiscoveryEngine(this.store, [this.mockProvider]);
      this.engines.set(orgId, e);
    }
    return e;
  }

  listScopes(principal: ItamPrincipal) {
    return this.store.scopes.filter((s) => s.organizationId === principal.organizationId);
  }

  createScope(principal: ItamPrincipal, body: {
    name: string;
    cidr: string;
    environment?: DiscoveryEnvironment;
    description?: string;
    scopeKind?: 'INCLUDE' | 'EXCLUDE';
  }) {
    this.requireAdmin(principal);
    try {
      parseCidr(body.cidr);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid CIDR');
    }
    if (!['LAB', 'TEST', 'UAT'].includes(body.environment || 'LAB') && process.env.ITAM_ALLOW_PROD_DISCOVERY !== '1') {
      if (body.environment === 'PROD') {
        throw new BadRequestException('PROD scopes require ITAM_ALLOW_PROD_DISCOVERY=1');
      }
    }
    return this.store.createScope({
      organizationId: principal.organizationId,
      environment: (body.environment || 'LAB') as DiscoveryEnvironment,
      name: body.name,
      description: body.description,
      cidr: body.cidr,
      scopeKind: body.scopeKind || 'INCLUDE',
      authorizationStatus: 'PENDING',
      enabled: true,
      createdBy: principal.userId,
    });
  }

  approveScope(principal: ItamPrincipal, scopeId: string) {
    this.requireAdmin(principal);
    const scope = this.store.scopes.find((s) => s.id === scopeId && s.organizationId === principal.organizationId);
    if (!scope) throw new NotFoundException('Scope not found');
    return this.store.approveScope(scopeId, principal.userId);
  }

  listJobs(principal: ItamPrincipal) {
    return this.store.jobs.filter((j) => j.organizationId === principal.organizationId);
  }

  getJob(principal: ItamPrincipal, id: string) {
    const job = this.store.getJob(id);
    if (!job || job.organizationId !== principal.organizationId) throw new NotFoundException('Job not found');
    return job;
  }

  createJob(principal: ItamPrincipal, body: Partial<DiscoveryJob> & { name: string }) {
    this.requireAdmin(principal);
    if (body.credentialReferenceId && /password|secret|community/i.test(JSON.stringify(body))) {
      throw new BadRequestException('Do not embed secrets in job payloads — use credentialReferenceId only');
    }
    const job = this.store.createJob({
      ...body,
      organizationId: principal.organizationId,
      createdBy: principal.userId,
      status: 'DRAFT',
    });
    return job;
  }

  estimateJob(principal: ItamPrincipal, jobId: string) {
    const job = this.getJob(principal, jobId);
    const includes = job.networkRanges;
    const excludes = job.excludedRanges;
    const estimated = includes.reduce((n, c) => {
      try { return n + cidrHostCount(c); } catch { return n; }
    }, 0);
    const built = buildAuthorizedTargets({
      includeCidrs: includes,
      excludeCidrs: excludes,
      maxHosts: job.maxHosts,
    });
    return {
      cidrs: includes,
      excluded: excludes,
      estimatedAddresses: estimated,
      actionableHosts: built.estimatedHosts,
      warnings: built.warnings,
      errors: built.errors,
      discoveryMethods: [
        job.enableIcmp ? 'ICMP' : null,
        job.enableTcp ? 'TCP' : null,
        job.enableSnmp ? 'SNMP' : null,
        job.enableCredentialed ? 'CREDENTIALED' : null,
      ].filter(Boolean),
    };
  }

  async validateJob(principal: ItamPrincipal, jobId: string) {
    this.requireAdmin(principal);
    const job = this.getJob(principal, jobId);
    this.store.updateJob(jobId, { status: 'VALIDATING' });
    const result = await this.engineFor(principal.organizationId).validateJob(job);
    this.store.updateJob(jobId, {
      status: result.ok ? 'READY' : 'DRAFT',
      lastError: result.ok ? undefined : result.errors.join('; '),
    });
    return result;
  }

  async startJob(principal: ItamPrincipal, jobId: string) {
    this.requireAdmin(principal);
    const job = this.getJob(principal, jobId);
    if (job.networkRanges.length > 0) {
      const est = job.networkRanges.reduce((n, c) => {
        try { return n + cidrHostCount(c); } catch { return n; }
      }, 0);
      if (est > 256 && process.env.ITAM_DISCOVERY_CONFIRM_LARGE !== '1') {
        // Still allow if already READY after explicit validate; large ranges need confirm flag in prod
        if (job.status !== 'READY' && est > 1024) {
          throw new BadRequestException('Large discovery range requires validate + confirmation');
        }
      }
    }
    // Fire async — return run handle immediately for Nest; tests can await runJob directly
    const engine = this.engineFor(principal.organizationId);
    const running = engine.runJob(jobId, { actorId: principal.userId });
    // Attach promise for awaiters (tests)
    (this as any)._lastRun = running;
    return { started: true, jobId, status: 'RUNNING' };
  }

  async awaitLastRun() {
    return (this as any)._lastRun;
  }

  pauseJob(principal: ItamPrincipal, jobId: string) {
    this.requireAdmin(principal);
    this.getJob(principal, jobId);
    this.engineFor(principal.organizationId).pause(jobId);
    return { paused: true };
  }

  resumeJob(principal: ItamPrincipal, jobId: string) {
    this.requireAdmin(principal);
    this.getJob(principal, jobId);
    this.engineFor(principal.organizationId).resume(jobId);
    return { resumed: true };
  }

  cancelJob(principal: ItamPrincipal, jobId: string) {
    this.requireAdmin(principal);
    this.getJob(principal, jobId);
    this.engineFor(principal.organizationId).cancel(jobId);
    return { cancelled: true };
  }

  listDiscovered(principal: ItamPrincipal) {
    return this.store.hosts.filter((h) => h.organizationId === principal.organizationId);
  }

  getDiscovered(principal: ItamPrincipal, id: string) {
    const h = this.store.hosts.find((x) => x.id === id && x.organizationId === principal.organizationId);
    if (!h) throw new NotFoundException('Discovered host not found');
    return h;
  }

  listAssets(principal: ItamPrincipal) {
    return this.store.findAssets(principal.organizationId);
  }

  listSoftware(principal: ItamPrincipal, assetId?: string) {
    const assetIds = new Set(
      this.store.findAssets(principal.organizationId).map((a) => a.id),
    );
    return this.store.software.filter((s) => assetIds.has(s.assetId) && (!assetId || s.assetId === assetId));
  }

  listUnmanaged(principal: ItamPrincipal) {
    return this.store.findAssets(principal.organizationId).filter(
      (a) => a.discoveryLifecycle === 'DISCOVERED' || a.discoveryLifecycle === 'UNVERIFIED',
    );
  }

  verifyAsset(principal: ItamPrincipal, assetId: string) {
    this.requireAdmin(principal);
    const asset = this.store.assets.find((a) => a.id === assetId && a.organizationId === principal.organizationId);
    if (!asset) throw new NotFoundException('Asset not found');
    asset.discoveryLifecycle = 'VERIFIED';
    this.store.audit(principal.organizationId, 'asset_verified', {
      actorId: principal.userId,
      entityType: 'it_asset',
      entityId: assetId,
    });
    return asset;
  }

  ignoreAsset(principal: ItamPrincipal, assetId: string) {
    this.requireAdmin(principal);
    const asset = this.store.assets.find((a) => a.id === assetId && a.organizationId === principal.organizationId);
    if (!asset) throw new NotFoundException('Asset not found');
    asset.discoveryLifecycle = 'IGNORED';
    this.store.audit(principal.organizationId, 'asset_ignored', {
      actorId: principal.userId,
      entityType: 'it_asset',
      entityId: assetId,
    });
    return asset;
  }

  /**
   * Explicit agent onboarding approval — does NOT silently install.
   * Records audit + marks asset ready for agent deployment workflow.
   */
  approveAgentOnboarding(principal: ItamPrincipal, assetId: string) {
    this.requireAdmin(principal);
    const asset = this.store.assets.find((a) => a.id === assetId && a.organizationId === principal.organizationId);
    if (!asset) throw new NotFoundException('Asset not found');
    asset.customFields = { ...(asset.customFields || {}), agentOnboardingApproved: true, approvedAt: new Date().toISOString() };
    this.store.audit(principal.organizationId, 'agent_deployment_approved', {
      actorId: principal.userId,
      entityType: 'it_asset',
      entityId: assetId,
      detail: { note: 'Administrator explicitly authorized agent deployment — install is not automatic' },
    });
    return { approved: true, assetId, automaticInstall: false };
  }

  /**
   * Merge agent evidence into an existing discovered/managed asset (no duplicate).
   */
  mergeAgentEvidence(principal: ItamPrincipal, assetId: string, agent: Partial<StoredAsset> & { agentKey?: string }) {
    const asset = this.store.assets.find((a) => a.id === assetId && a.organizationId === principal.organizationId);
    if (!asset) throw new NotFoundException('Asset not found');
    Object.assign(asset, {
      hostname: agent.hostname || asset.hostname,
      serialNumber: agent.serialNumber || asset.serialNumber,
      macAddress: agent.macAddress || asset.macAddress,
      ipAddress: agent.ipAddress || asset.ipAddress,
      manufacturer: agent.manufacturer || asset.manufacturer,
      model: agent.model || asset.model,
      discoveryLifecycle: 'MANAGED',
      primaryDiscoverySource: 'AGENT',
      lastSeenAt: new Date().toISOString(),
    });
    if (agent.agentKey) {
      this.store.identities.push({
        id: `${assetId}-agent`,
        organizationId: principal.organizationId,
        assetId,
        identityType: 'agentId',
        identityValue: agent.agentKey.toLowerCase(),
        source: 'AGENT',
        confidence: 'HIGH',
      });
    }
    this.store.audit(principal.organizationId, 'asset_merged', {
      entityType: 'it_asset',
      entityId: assetId,
      detail: { sources: ['NETWORK_DISCOVERY', 'AGENT'] },
    });
    return asset;
  }

  dashboard(principal: ItamPrincipal) {
    const org = principal.organizationId;
    const jobs = this.store.jobs.filter((j) => j.organizationId === org);
    const runs = this.store.runs.filter((r) => r.organizationId === org);
    const hosts = this.store.hosts.filter((h) => h.organizationId === org);
    const assets = this.store.findAssets(org);
    const last = runs[runs.length - 1];
    return {
      jobs: jobs.length,
      running: jobs.filter((j) => j.status === 'RUNNING').length,
      discoveredHosts: hosts.length,
      managedAssets: assets.filter((a) => a.discoveryLifecycle === 'MANAGED' || !a.discoveryLifecycle || a.discoveryLifecycle === 'ACTIVE').length,
      unmanagedAssets: assets.filter((a) => a.discoveryLifecycle === 'DISCOVERED' || a.discoveryLifecycle === 'UNVERIFIED').length,
      softwareRows: this.listSoftware(principal).length,
      lastRun: last || null,
    };
  }

  metrics(principal: ItamPrincipal) {
    const runs = this.store.runs.filter((r) => r.organizationId === principal.organizationId);
    return {
      discovery_jobs_total: this.store.jobs.filter((j) => j.organizationId === principal.organizationId).length,
      discovery_jobs_success: runs.filter((r) => r.status === 'COMPLETED').length,
      discovery_jobs_failed: runs.filter((r) => r.status === 'FAILED').length,
      hosts_scanned_total: runs.reduce((n, r) => n + (r.hostsScanned || 0), 0),
      hosts_discovered_total: runs.reduce((n, r) => n + (r.hostsDiscovered || 0), 0),
      assets_created_total: runs.reduce((n, r) => n + (r.assetsCreated || 0), 0),
      assets_updated_total: runs.reduce((n, r) => n + (r.assetsUpdated || 0), 0),
      assets_unmanaged_total: runs.reduce((n, r) => n + (r.assetsUnmanaged || 0), 0),
      software_discovered_total: runs.reduce((n, r) => n + (r.softwareDiscovered || 0), 0),
      discovery_errors_total: runs.reduce((n, r) => n + (r.errors || 0), 0),
    };
  }

  /** Seed mock lab hosts for demo/tests — not a real scan. */
  seedLabHost(evidence: Parameters<MockNetworkDiscoveryProvider['seed']>[0]) {
    this.mockProvider.seed(evidence);
  }

  getStore() {
    return this.store;
  }
}
