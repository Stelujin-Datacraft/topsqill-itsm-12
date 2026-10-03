/**
 * Discovery pipeline engine — scoped, bounded, cancellable.
 * Final SoR is existing ITAM assets (via DiscoveryStore in tests / service layer in Nest).
 */
import { randomUUID } from 'crypto';
import type { DiscoveredHostEvidence, DiscoveryJob, DiscoveryProviderContext, INetworkDiscoveryProvider } from './types';
import { buildAuthorizedTargets, assertIpInAuthorizedScopes } from './scope';
import { classifyDeviceType, correlateDiscoveredHost } from './correlation';
import type { DiscoveryStore, StoredAsset } from './store';
import { resolveSoftwareProduct, ensureBuiltinCatalog } from './software-normalize';
import {
  MockNetworkDiscoveryProvider,
  TcpDiscoveryProvider,
  SnmpDiscoveryProvider,
  WindowsInventoryProvider,
  LinuxInventoryProvider,
} from './providers';

export interface EngineMetrics {
  hostsPerSec: number;
  durationMs: number;
  hostDiscoveryLatencyMs: number;
  credentialedInventoryLatencyMs: number;
  workerUtilization: number;
}

export class DiscoveryEngine {
  private providers: INetworkDiscoveryProvider[] = [];

  constructor(
    private readonly store: DiscoveryStore,
    providers?: INetworkDiscoveryProvider[],
  ) {
    this.providers = providers || [];
  }

  use(provider: INetworkDiscoveryProvider) {
    this.providers.push(provider);
    return this;
  }

  async validateJob(job: DiscoveryJob): Promise<{ ok: boolean; estimatedHosts: number; errors: string[]; warnings: string[] }> {
    const approvedIncludes = this.store.scopes.filter(
      (s) =>
        s.organizationId === job.organizationId
        && s.enabled
        && s.scopeKind === 'INCLUDE'
        && s.authorizationStatus === 'APPROVED'
        && (s.environment === job.environmentId || job.environmentId === 'LAB'),
    );
    const includes = job.networkRanges.length
      ? job.networkRanges
      : approvedIncludes.map((s) => s.cidr);
    const excludes = [
      ...job.excludedRanges,
      ...this.store.scopes
        .filter((s) => s.organizationId === job.organizationId && s.scopeKind === 'EXCLUDE' && s.enabled)
        .map((s) => s.cidr),
    ];

    if (job.environmentId === 'PROD' && process.env.ITAM_ALLOW_PROD_DISCOVERY !== '1') {
      return { ok: false, estimatedHosts: 0, errors: ['PROD discovery requires ITAM_ALLOW_PROD_DISCOVERY=1'], warnings: [] };
    }

    // Every include CIDR must be covered by an approved scope (or job ranges explicitly matching approved)
    for (const cidr of includes) {
      const covered = this.store.scopes.some(
        (s) =>
          s.organizationId === job.organizationId
          && s.scopeKind === 'INCLUDE'
          && s.authorizationStatus === 'APPROVED'
          && s.enabled
          && s.cidr === cidr,
      );
      if (!covered) {
        return {
          ok: false,
          estimatedHosts: 0,
          errors: [`CIDR ${cidr} is not an APPROVED network scope — refuse to scan`],
          warnings: [],
        };
      }
    }

    const built = buildAuthorizedTargets({
      includeCidrs: includes,
      excludeCidrs: excludes,
      maxHosts: job.maxHosts,
      requirePrivate: job.environmentId !== 'LAB' ? true : true,
    });
    return built;
  }

  async runJob(jobId: string, opts?: { actorId?: string }): Promise<{ runId: string; metrics: EngineMetrics }> {
    const job = this.store.getJob(jobId);
    if (!job) throw new Error('Job not found');
    const validation = await this.validateJob(job);
    if (!validation.ok) {
      this.store.updateJob(jobId, { status: 'FAILED', lastError: validation.errors.join('; ') });
      throw new Error(validation.errors.join('; '));
    }

    const runId = randomUUID();
    const started = Date.now();
    this.store.runs.push({
      id: runId,
      jobId,
      organizationId: job.organizationId,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      hostsTargeted: validation.targets.length,
      hostsScanned: 0,
      hostsDiscovered: 0,
      assetsCreated: 0,
      assetsUpdated: 0,
      assetsUnmanaged: 0,
      softwareDiscovered: 0,
      errors: 0,
      metrics: {},
    });
    this.store.updateJob(jobId, {
      status: 'RUNNING',
      lastRunAt: new Date().toISOString(),
      progress: { hostsTargeted: validation.targets.length, hostsScanned: 0 },
    });
    this.store.audit(job.organizationId, 'discovery_started', {
      actorId: opts?.actorId,
      entityType: 'discovery_job',
      entityId: jobId,
      detail: { runId, hosts: validation.targets.length },
    });
    this.store.jobFlags.set(jobId, {});

    ensureBuiltinCatalog(this.store, job.organizationId);

    const ctx: DiscoveryProviderContext = {
      organizationId: job.organizationId,
      jobId,
      runId,
      correlationId: `disc-${runId.slice(0, 8)}`,
      hostTimeoutMs: job.hostTimeoutMs,
      credentialReferenceId: job.credentialReferenceId,
      allowPrivateNetwork: true,
      resolveSecret: async (ref) => {
        // Never log. Tests may inject via env map.
        const map = (globalThis as any).__ITAM_SECRET_MAP as Record<string, string> | undefined;
        return map?.[ref] || null;
      },
    };

    const providers = this.providers.length
      ? this.providers
      : [
          new MockNetworkDiscoveryProvider(),
          new TcpDiscoveryProvider(job.networkRanges, job.excludedRanges),
          new SnmpDiscoveryProvider(),
          new WindowsInventoryProvider(),
          new LinuxInventoryProvider(),
        ];

    const hostProviders = providers.filter((p) => typeof p.discoverHosts === 'function');
    const serviceProviders = providers.filter((p) => typeof p.discoverServices === 'function');
    const inventoryProviders = providers.filter((p) => typeof p.collectInventory === 'function');

    let hostsScanned = 0;
    let hostsDiscovered = 0;
    let assetsCreated = 0;
    let assetsUpdated = 0;
    let assetsUnmanaged = 0;
    let softwareDiscovered = 0;
    let errors = 0;
    let hostDiscoveryLatencyTotal = 0;
    let credLatencyTotal = 0;
    let credSamples = 0;

    const concurrency = Math.max(1, Math.min(job.maxConcurrency, 64));
    const queue = [...validation.targets];
    const rateDelay = job.rateLimitPerSec > 0 ? Math.floor(1000 / job.rateLimitPerSec) : 0;

    const processOne = async (ip: string) => {
      const flags = this.store.jobFlags.get(jobId) || {};
      if (flags.cancel) return;
      while (flags.pause) {
        await sleep(50);
        if (this.store.jobFlags.get(jobId)?.cancel) return;
      }

      try {
        assertIpInAuthorizedScopes(ip, job.networkRanges, job.excludedRanges);
      } catch {
        errors++;
        return;
      }

      const t0 = Date.now();
      let evidence: DiscoveredHostEvidence | null = null;
      for (const p of hostProviders) {
        const found = await p.discoverHosts!([ip], ctx);
        if (found.length) {
          evidence = found[0];
          break;
        }
      }
      hostDiscoveryLatencyTotal += Date.now() - t0;
      hostsScanned++;

      if (!evidence) {
        this.patchRun(runId, { hostsScanned });
        this.store.updateJob(jobId, { progress: { hostsTargeted: validation.targets.length, hostsScanned, hostsDiscovered } });
        return;
      }

      // Service discovery
      if (job.enableTcp) {
        for (const p of serviceProviders) {
          const services = await p.discoverServices!(evidence, job.tcpPorts, ctx);
          evidence.services = [...(evidence.services || []), ...services];
          if (services.length) {
            evidence.discoveryMethods = [...new Set([...(evidence.discoveryMethods || []), p.kind])];
          }
        }
      }

      // Credentialed / SNMP inventory
      if (job.enableCredentialed || job.enableSnmp) {
        const c0 = Date.now();
        for (const p of inventoryProviders) {
          if (!job.enableSnmp && p.kind === 'SNMP') continue;
          if (!job.enableCredentialed && (p.kind === 'WINRM' || p.kind === 'SSH')) continue;
          const inv = await p.collectInventory!(evidence, ctx);
          evidence = {
            ...evidence,
            ...inv,
            discoveryMethods: [...new Set([...(evidence.discoveryMethods || []), ...(inv.discoveryMethods || [])])],
            software: [...(evidence.software || []), ...(inv.software || [])],
            services: [...(evidence.services || []), ...(inv.services || [])],
            fieldProvenance: { ...evidence.fieldProvenance, ...(inv.fieldProvenance || {}) },
          };
        }
        credLatencyTotal += Date.now() - c0;
        credSamples++;
      }

      evidence.deviceType = classifyDeviceType(evidence) as any;
      hostsDiscovered++;

      const existing = this.store.findAssets(job.organizationId).map((a) => ({
        assetId: a.id,
        serialNumber: a.serialNumber,
        macAddress: a.macAddress,
        hostname: a.hostname,
        ipAddress: a.ipAddress,
        biosUuid: a.biosUuid,
        machineGuid: a.machineGuid,
        discoveryLifecycle: a.discoveryLifecycle,
      }));
      const corr = correlateDiscoveredHost(evidence, existing);

      const now = new Date().toISOString();
      let assetId = corr.matchedAssetId;

      if (assetId) {
        const prev = this.store.assets.find((a) => a.id === assetId)!;
        const patch: StoredAsset = {
          ...prev,
          hostname: prefer(prev.hostname, evidence.hostname, prev.primaryDiscoverySource as any, evidence.fieldProvenance?.hostname as any) || prev.hostname,
          ipAddress: evidence.ipAddress || prev.ipAddress,
          macAddress: evidence.macAddress || prev.macAddress,
          serialNumber: evidence.serialNumber || prev.serialNumber,
          manufacturer: evidence.manufacturer || prev.manufacturer,
          model: evidence.model || prev.model,
          biosUuid: evidence.biosUuid || prev.biosUuid,
          machineGuid: evidence.machineGuid || prev.machineGuid,
          assetType: evidence.deviceType?.toLowerCase() || prev.assetType,
          discoveryConfidence: corr.confidence,
          primaryDiscoverySource: 'NETWORK_DISCOVERY',
          lastSeenAt: now,
          firstSeenAt: prev.firstSeenAt || now,
        };
        // Detect changes
        if (prev.hostname && evidence.hostname && prev.hostname !== evidence.hostname) {
          this.store.diffs.push({
            id: randomUUID(),
            organizationId: job.organizationId,
            runId,
            assetId,
            changeType: 'ASSET_CHANGED',
            detail: { field: 'hostname', from: prev.hostname, to: evidence.hostname },
          });
        }
        this.store.upsertAsset(patch);
        assetsUpdated++;
      } else {
        assetId = randomUUID();
        const created: StoredAsset = {
          id: assetId,
          organizationId: job.organizationId,
          displayName: evidence.hostname || evidence.ipAddress || `Discovered ${assetId.slice(0, 8)}`,
          hostname: evidence.hostname,
          assetType: (evidence.deviceType || 'UNKNOWN').toLowerCase(),
          manufacturer: evidence.manufacturer,
          model: evidence.model,
          serialNumber: evidence.serialNumber,
          ipAddress: evidence.ipAddress,
          macAddress: evidence.macAddress,
          biosUuid: evidence.biosUuid,
          machineGuid: evidence.machineGuid,
          status: 'active',
          discoveryLifecycle: 'DISCOVERED',
          discoveryConfidence: corr.confidence,
          primaryDiscoverySource: 'NETWORK_DISCOVERY',
          firstSeenAt: now,
          lastSeenAt: now,
        };
        this.store.upsertAsset(created);
        assetsCreated++;
        assetsUnmanaged++;
        this.store.diffs.push({
          id: randomUUID(),
          organizationId: job.organizationId,
          runId,
          assetId,
          changeType: 'NEW_ASSET',
          detail: { ip: evidence.ipAddress, confidence: corr.confidence },
        });
        this.store.audit(job.organizationId, 'asset_discovered', {
          entityType: 'it_asset',
          entityId: assetId,
          detail: { ip: evidence.ipAddress, confidence: corr.confidence },
        });
      }

      // Identities
      for (const sig of corr.signals) {
        if (!this.store.identities.some(
          (i) => i.organizationId === job.organizationId && i.identityType === sig.type && i.identityValue === sig.value,
        )) {
          this.store.identities.push({
            id: randomUUID(),
            organizationId: job.organizationId,
            assetId: assetId!,
            identityType: sig.type,
            identityValue: sig.value,
            source: sig.source,
            confidence: corr.confidence,
          });
        }
      }

      // Services
      for (const svc of evidence.services || []) {
        const existingSvc = this.store.services.find(
          (s) => s.assetId === assetId && s.port === svc.port && s.protocol === svc.protocol,
        );
        if (!existingSvc) {
          this.store.services.push({
            id: randomUUID(),
            organizationId: job.organizationId,
            assetId: assetId!,
            port: svc.port,
            protocol: svc.protocol,
            service: svc.service,
            banner: svc.banner,
            source: 'NETWORK_DISCOVERY',
          });
        }
      }

      // Software
      const swRows = [];
      for (const sw of evidence.software || []) {
        const resolved = resolveSoftwareProduct(this.store, sw.rawName, job.organizationId);
        const prev = this.store.software.find(
          (s) => s.assetId === assetId && s.softwareName === resolved.canonicalName,
        );
        if (prev && prev.version && sw.rawVersion && prev.version !== sw.rawVersion) {
          this.store.diffs.push({
            id: randomUUID(),
            organizationId: job.organizationId,
            runId,
            assetId,
            changeType: 'SOFTWARE_VERSION_CHANGED',
            detail: { name: resolved.canonicalName, from: prev.version, to: sw.rawVersion },
          });
        } else if (!prev) {
          this.store.diffs.push({
            id: randomUUID(),
            organizationId: job.organizationId,
            runId,
            assetId,
            changeType: 'SOFTWARE_ADDED',
            detail: { name: resolved.canonicalName, version: sw.rawVersion },
          });
        }
        swRows.push({
          id: randomUUID(),
          assetId: assetId!,
          softwareName: resolved.canonicalName,
          version: sw.rawVersion,
          publisher: sw.publisher || resolved.publisher,
          source: sw.source || 'NETWORK_DISCOVERY',
          rawName: sw.rawName,
          rawVersion: sw.rawVersion,
          firstSeenAt: prev?.firstSeenAt || now,
          lastSeenAt: now,
        });
        softwareDiscovered++;
      }
      this.store.upsertSoftware(swRows);

      // Provenance
      for (const [field, source] of Object.entries(evidence.fieldProvenance || {})) {
        const val = (evidence as any)[field];
        const existingP = this.store.provenance.find((p) => p.assetId === assetId && p.fieldName === field);
        if (existingP) {
          existingP.fieldValue = val != null ? String(val) : existingP.fieldValue;
          existingP.source = String(source);
        } else {
          this.store.provenance.push({
            id: randomUUID(),
            organizationId: job.organizationId,
            assetId: assetId!,
            fieldName: field,
            fieldValue: val != null ? String(val) : undefined,
            source: String(source),
          });
        }
      }

      this.store.hosts.push({
        id: randomUUID(),
        organizationId: job.organizationId,
        jobId,
        runId,
        assetId,
        status: corr.matchedAssetId ? 'MANAGED' : 'DISCOVERED',
        confidence: corr.confidence,
        ipAddress: evidence.ipAddress,
        macAddress: evidence.macAddress,
        hostname: evidence.hostname,
        dnsName: evidence.dnsName,
        deviceType: evidence.deviceType || 'UNKNOWN',
        osName: evidence.osName,
        osFamily: evidence.osFamily,
        osVersion: evidence.osVersion,
        manufacturer: evidence.manufacturer,
        model: evidence.model,
        serialNumber: evidence.serialNumber,
        biosUuid: evidence.biosUuid,
        machineGuid: evidence.machineGuid,
        responseTimeMs: evidence.responseTimeMs,
        discoveryMethods: evidence.discoveryMethods || [],
        services: evidence.services || [],
        software: evidence.software || [],
        fieldProvenance: evidence.fieldProvenance || {},
        rawEvidence: evidence.raw || {},
        firstSeenAt: now,
        lastSeenAt: now,
      });

      this.patchRun(runId, {
        hostsScanned,
        hostsDiscovered,
        assetsCreated,
        assetsUpdated,
        assetsUnmanaged,
        softwareDiscovered,
        errors,
      });
      this.store.updateJob(jobId, {
        progress: {
          hostsTargeted: validation.targets.length,
          hostsScanned,
          hostsDiscovered,
          assetsCreated,
          assetsUpdated,
        },
      });

      if (rateDelay) await sleep(rateDelay);
    };

    // Bounded worker pool — do not spawn one process per IP
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        if (this.store.jobFlags.get(jobId)?.cancel) break;
        const ip = queue.shift();
        if (!ip) break;
        try {
          await processOne(ip);
        } catch {
          errors++;
        }
      }
    });
    await Promise.all(workers);

    const cancelled = Boolean(this.store.jobFlags.get(jobId)?.cancel);
    const durationMs = Date.now() - started;
    const metrics: EngineMetrics = {
      hostsPerSec: durationMs > 0 ? Number(((hostsScanned / durationMs) * 1000).toFixed(2)) : 0,
      durationMs,
      hostDiscoveryLatencyMs: hostsScanned ? Math.round(hostDiscoveryLatencyTotal / hostsScanned) : 0,
      credentialedInventoryLatencyMs: credSamples ? Math.round(credLatencyTotal / credSamples) : 0,
      workerUtilization: concurrency,
    };

    const finalStatus = cancelled ? 'CANCELLED' : errors && hostsDiscovered ? 'PARTIAL' : errors && !hostsDiscovered ? 'FAILED' : 'COMPLETED';
    this.patchRun(runId, {
      status: finalStatus,
      finishedAt: new Date().toISOString(),
      hostsScanned,
      hostsDiscovered,
      assetsCreated,
      assetsUpdated,
      assetsUnmanaged,
      softwareDiscovered,
      errors,
      metrics,
    } as any);
    this.store.updateJob(jobId, {
      status: finalStatus,
      metrics: metrics as any,
      lastError: finalStatus === 'FAILED' ? 'Discovery completed with errors' : undefined,
    });
    this.store.audit(job.organizationId, cancelled ? 'discovery_cancelled' : 'discovery_completed', {
      entityType: 'discovery_job',
      entityId: jobId,
      detail: { runId, ...metrics, hostsDiscovered },
    });

    return { runId, metrics };
  }

  pause(jobId: string) {
    const f = this.store.jobFlags.get(jobId) || {};
    f.pause = true;
    this.store.jobFlags.set(jobId, f);
    this.store.updateJob(jobId, { status: 'PAUSED' });
    const job = this.store.getJob(jobId);
    if (job) this.store.audit(job.organizationId, 'discovery_paused', { entityType: 'discovery_job', entityId: jobId });
  }

  resume(jobId: string) {
    const f = this.store.jobFlags.get(jobId) || {};
    f.pause = false;
    this.store.jobFlags.set(jobId, f);
    this.store.updateJob(jobId, { status: 'RUNNING' });
  }

  cancel(jobId: string) {
    const f = this.store.jobFlags.get(jobId) || {};
    f.cancel = true;
    f.pause = false;
    this.store.jobFlags.set(jobId, f);
    this.store.updateJob(jobId, { status: 'CANCELLED' });
    const job = this.store.getJob(jobId);
    if (job) this.store.audit(job.organizationId, 'discovery_stopped', { entityType: 'discovery_job', entityId: jobId });
  }

  private patchRun(runId: string, patch: Record<string, unknown>) {
    const run = this.store.runs.find((r) => r.id === runId);
    if (!run) return;
    Object.assign(run, patch);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function prefer(
  current: string | undefined,
  incoming: string | undefined,
  currentSource?: string,
  incomingSource?: string,
): string | undefined {
  if (!incoming) return current;
  if (!current) return incoming;
  // Higher-authority sources win — AGENT > CREDENTIALED > SNMP > NETWORK
  const rank = (s?: string) =>
    ({ AGENT: 0, CREDENTIALED: 1, MANAGEMENT_API: 2, SNMP: 3, NETWORK_DISCOVERY: 4, DNS: 5 } as any)[s || ''] ?? 9;
  return rank(incomingSource) <= rank(currentSource) ? incoming : current;
}
