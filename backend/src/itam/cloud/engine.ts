/**
 * Phase B cloud discovery engine — correlates into existing DiscoveryStore assets.
 */
import { randomUUID } from 'crypto';
import type { DiscoveryStore, StoredAsset } from '../discovery/store';
import { correlateDiscoveredHost, type ExistingAssetIdentity } from '../discovery/correlation';
import type { ICloudAssetDiscoveryProvider, DiscoveredHostEvidence } from '../discovery/types';
import type {
  CloudAccount,
  CloudChange,
  CloudDiscoveryJob,
  CloudProviderConnection,
  CloudResource,
  CloudResourceDraft,
  IVirtualizationDiscoveryProvider,
} from './types';
import { cloudSource } from './types';

export class CloudDiscoveryEngine {
  constructor(private readonly store: DiscoveryStore & CloudStoreSlice) {}

  createProvider(input: Omit<CloudProviderConnection, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string }): CloudProviderConnection {
    if (!input.credentialReferenceId) throw new Error('credentialReferenceId required');
    if (/password|secretKey|private_key|clientSecret/i.test(JSON.stringify(input.config || {}))) {
      throw new Error('Do not embed secrets in provider config — use credentialReferenceId');
    }
    const row: CloudProviderConnection = {
      ...input,
      id: input.id || randomUUID(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: input.config || {},
    };
    this.store.cloudProviders.push(row);
    this.store.audit(row.organizationId, 'cloud_provider_created', {
      entityType: 'cloud_provider',
      entityId: row.id,
      detail: { providerType: row.providerType, name: row.name },
    });
    return row;
  }

  createJob(input: Partial<CloudDiscoveryJob> & { organizationId: string; providerId: string; name: string }): CloudDiscoveryJob {
    const row: CloudDiscoveryJob = {
      id: input.id || randomUUID(),
      organizationId: input.organizationId,
      providerId: input.providerId,
      name: input.name,
      status: 'DRAFT',
      schedule: input.schedule || 'ON_DEMAND',
      scheduleCron: input.scheduleCron,
      credentialReferenceId: input.credentialReferenceId,
      progress: {},
      metrics: {},
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.cloudJobs.push(row);
    return row;
  }

  async runJob(
    jobId: string,
    providerImpl: ICloudAssetDiscoveryProvider | IVirtualizationDiscoveryProvider,
    opts?: { actorId?: string; resolveSecret?: (r: string) => Promise<string | null> },
  ): Promise<{ resourcesDiscovered: number; assetsCreated: number; assetsUpdated: number }> {
    const job = this.store.cloudJobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Cloud job not found');
    const conn = this.store.cloudProviders.find((p) => p.id === job.providerId);
    if (!conn || conn.organizationId !== job.organizationId) throw new Error('Provider not found');
    if (!conn.enabled) throw new Error('Provider disabled');

    job.status = 'RUNNING';
    job.updatedAt = new Date().toISOString();
    this.store.audit(job.organizationId, 'cloud_discovery_started', {
      actorId: opts?.actorId,
      entityType: 'cloud_discovery_job',
      entityId: job.id,
      detail: { providerType: conn.providerType },
    });

    const ctx = {
      organizationId: job.organizationId,
      jobId: job.id,
      runId: randomUUID(),
      correlationId: randomUUID(),
      hostTimeoutMs: 5000,
      credentialReferenceId: job.credentialReferenceId || conn.credentialReferenceId,
      allowPrivateNetwork: true,
      resolveSecret: opts?.resolveSecret,
    };

    let drafts: CloudResourceDraft[] = [];
    let accounts: Array<Record<string, unknown>> = [];
    let relationships: Array<Record<string, unknown>> = [];

    try {
      if ('discoverAssets' in providerImpl || 'cloud' in providerImpl) {
        const cloud = providerImpl as ICloudAssetDiscoveryProvider;
        const auth = cloud.authenticate ? await cloud.authenticate(ctx) : { ok: true };
        if (!auth.ok) {
          job.status = 'FAILED';
          job.lastError = auth.error || 'authentication failed';
          conn.status = 'ERROR';
          conn.lastError = job.lastError;
          // Do not retry auth failures
          return { resourcesDiscovered: 0, assetsCreated: 0, assetsUpdated: 0 };
        }
        conn.status = 'READY';
        conn.lastTestedAt = new Date().toISOString();
        accounts = (cloud.discoverAccounts ? await cloud.discoverAccounts(ctx) : []) || [];
        const evidence = cloud.discoverAssets
          ? await cloud.discoverAssets(ctx)
          : cloud.discover
            ? await cloud.discover(ctx)
            : [];
        relationships = (cloud.discoverRelationships ? await cloud.discoverRelationships(ctx) : []) || [];
        drafts = evidence.map((e) => evidenceToDraft(e, conn.providerType));
        // Also pull network objects as logical resources (not always assets)
        const nets = cloud.discoverNetworks ? await cloud.discoverNetworks(ctx) : [];
        for (const n of nets) {
          const d = networkRecordToDraft(n, conn.providerType);
          if (d && !drafts.some((x) => x.resourceId === d.resourceId)) {
            drafts.push(d);
          }
        }
      } else {
        const vm = providerImpl as IVirtualizationDiscoveryProvider;
        const inv = await vm.discoverInventory?.(ctx);
        accounts = inv?.accounts || [];
        drafts = inv?.resources || [];
        relationships = inv?.relationships || [];
      }
    } catch (e: any) {
      job.status = 'FAILED';
      job.lastError = e?.message || 'cloud discovery failed';
      throw e;
    }

    const now = new Date().toISOString();
    for (const a of accounts) {
      const key = String(a.accountId || a.subscriptionId || a.projectId || a.vcenter || 'default');
      let acc = this.store.cloudAccounts.find(
        (x) => x.organizationId === job.organizationId && x.providerId === conn.id && x.accountKey === key,
      );
      if (!acc) {
        acc = {
          id: randomUUID(),
          organizationId: job.organizationId,
          providerId: conn.id,
          accountKey: key,
          displayName: String(a.alias || a.displayName || key),
          regionScope: [],
          metadata: a,
          firstSeenAt: now,
          lastSeenAt: now,
        };
        this.store.cloudAccounts.push(acc);
      } else {
        acc.lastSeenAt = now;
        acc.metadata = a;
      }
    }

    let assetsCreated = 0;
    let assetsUpdated = 0;
    const existingIds: ExistingAssetIdentity[] = this.store.findAssets(job.organizationId).map((a) => ({
      assetId: a.id,
      serialNumber: a.serialNumber,
      macAddress: a.macAddress,
      hostname: a.hostname,
      ipAddress: a.ipAddress,
      biosUuid: a.biosUuid,
      machineGuid: a.machineGuid,
      cloudInstanceId: a.cloudInstanceId,
      agentKey: this.store.identities.find((i) => i.assetId === a.id && i.identityType === 'agentId')?.identityValue,
      discoveryLifecycle: a.discoveryLifecycle,
    }));

    const seenResourceIds = new Set<string>();

    for (const draft of drafts) {
      seenResourceIds.add(draft.resourceId);
      const prev = this.store.cloudResources.find(
        (r) => r.organizationId === job.organizationId && r.providerType === conn.providerType && r.resourceId === draft.resourceId,
      );

      let assetId = prev?.assetId;
      const isCompute = isComputeResource(draft.resourceType) || Boolean(draft.cloudInstanceId || draft.hostname || draft.ipAddress);

      if (isCompute) {
        const evidence: DiscoveredHostEvidence = {
          cloudInstanceId: draft.cloudInstanceId || draft.resourceId,
          hostname: draft.hostname || draft.name,
          ipAddress: draft.ipAddress,
          macAddress: draft.macAddress,
          osName: draft.osName,
          serialNumber: draft.serialNumber,
          machineGuid: draft.machineGuid,
          discoveryMethods: [conn.providerType],
          services: [],
          software: [],
          tags: draft.tags,
          fieldProvenance: { cloudInstanceId: cloudSource(conn.providerType) },
          raw: draft.raw,
        };
        const corr = correlateDiscoveredHost(evidence, existingIds, cloudSource(conn.providerType));
        if (corr.matchedAssetId) {
          assetId = corr.matchedAssetId;
          const asset = this.store.assets.find((a) => a.id === assetId)!;
          mergeCloudIntoAsset(asset, evidence, cloudSource(conn.providerType));
          assetsUpdated += 1;
        } else if (isCompute) {
          assetId = randomUUID();
          const asset: StoredAsset = {
            id: assetId,
            organizationId: job.organizationId,
            displayName: draft.name || draft.hostname || draft.resourceId,
            hostname: draft.hostname || draft.name,
            assetType: 'virtual_machine',
            ipAddress: draft.ipAddress,
            macAddress: draft.macAddress,
            serialNumber: draft.serialNumber,
            machineGuid: draft.machineGuid,
            cloudInstanceId: draft.cloudInstanceId || draft.resourceId,
            status: 'active',
            discoveryLifecycle: 'DISCOVERED',
            discoveryConfidence: 'MEDIUM',
            primaryDiscoverySource: cloudSource(conn.providerType),
            firstSeenAt: now,
            lastSeenAt: now,
            tags: draft.tags || {},
            customFields: { cloudResourceType: draft.resourceType, region: draft.region },
          };
          this.store.upsertAsset(asset);
          existingIds.push({
            assetId,
            cloudInstanceId: asset.cloudInstanceId,
            hostname: asset.hostname,
            ipAddress: asset.ipAddress,
            macAddress: asset.macAddress,
            serialNumber: asset.serialNumber,
            machineGuid: asset.machineGuid,
            discoveryLifecycle: asset.discoveryLifecycle,
          });
          if (asset.cloudInstanceId) {
            this.store.identities.push({
              id: randomUUID(),
              organizationId: job.organizationId,
              assetId,
              identityType: 'cloudInstanceId',
              identityValue: asset.cloudInstanceId.toLowerCase(),
              source: cloudSource(conn.providerType),
              confidence: 'HIGH',
            });
          }
          assetsCreated += 1;
        }
      }

      if (prev) {
        const changed =
          prev.status !== draft.status
          || JSON.stringify(prev.tags) !== JSON.stringify(draft.tags || {})
          || JSON.stringify(prev.networkInfo) !== JSON.stringify(draft.networkInfo || {});
        if (changed) {
          const changeType =
            prev.status !== draft.status
              ? 'STATE_CHANGED'
              : JSON.stringify(prev.tags) !== JSON.stringify(draft.tags || {})
                ? 'TAG_CHANGED'
                : 'NETWORK_CHANGED';
          this.recordChange(job.organizationId, conn.id, prev.id, changeType as any, { before: prev.status, after: draft.status });
        }
        prev.lastSeenAt = now;
        prev.status = draft.status;
        prev.tags = draft.tags || {};
        prev.networkInfo = draft.networkInfo || {};
        prev.assetId = assetId || prev.assetId;
        prev.name = draft.name || prev.name;
        prev.raw = draft.raw || prev.raw;
      } else {
        const row: CloudResource = {
          id: randomUUID(),
          organizationId: job.organizationId,
          providerId: conn.id,
          accountId: this.store.cloudAccounts.find((a) => a.providerId === conn.id)?.id,
          assetId,
          providerType: conn.providerType,
          resourceId: draft.resourceId,
          resourceArn: draft.resourceArn,
          resourceType: draft.resourceType,
          name: draft.name,
          region: draft.region,
          zone: draft.zone,
          status: draft.status,
          tags: draft.tags || {},
          networkInfo: draft.networkInfo || {},
          raw: draft.raw || {},
          firstSeenAt: now,
          lastSeenAt: now,
        };
        this.store.cloudResources.push(row);
        this.recordChange(job.organizationId, conn.id, row.id, 'NEW_RESOURCE', { resourceType: row.resourceType });
      }
    }

    // Removed detection (resources previously seen for this provider but missing now)
    for (const r of this.store.cloudResources.filter((x) => x.providerId === conn.id && x.organizationId === job.organizationId)) {
      if (!seenResourceIds.has(r.resourceId) && drafts.length > 0) {
        this.recordChange(job.organizationId, conn.id, r.id, 'RESOURCE_REMOVED', { resourceId: r.resourceId });
      }
    }

    // Stash relationships for topology phase
    (job.metrics as any).relationships = relationships.length;
    job.status = 'COMPLETED';
    job.lastRunAt = now;
    job.updatedAt = now;
    job.progress = { resourcesDiscovered: drafts.length, assetsCreated, assetsUpdated };
    job.metrics = { ...job.metrics, resourcesDiscovered: drafts.length, assetsCreated, assetsUpdated };
    this.store.audit(job.organizationId, 'cloud_discovery_completed', {
      entityType: 'cloud_discovery_job',
      entityId: job.id,
      detail: { resourcesDiscovered: drafts.length, assetsCreated, assetsUpdated },
    });

    return { resourcesDiscovered: drafts.length, assetsCreated, assetsUpdated };
  }

  private recordChange(
    organizationId: string,
    providerId: string,
    resourceId: string,
    changeType: CloudChange['changeType'],
    detail: Record<string, unknown>,
  ) {
    this.store.cloudChanges.push({
      id: randomUUID(),
      organizationId,
      providerId,
      resourceId,
      changeType,
      detail,
      createdAt: new Date().toISOString(),
    });
  }
}

export interface CloudStoreSlice {
  cloudProviders: CloudProviderConnection[];
  cloudAccounts: CloudAccount[];
  cloudResources: CloudResource[];
  cloudJobs: CloudDiscoveryJob[];
  cloudChanges: CloudChange[];
}

function isComputeResource(t: string): boolean {
  return /ec2|instance|virtualmachine|\bvm\b|compute|gke|aks|ecs|eks|lambda|appservice|cloud.?run|rds|sql/i.test(t);
}

function evidenceToDraft(e: DiscoveredHostEvidence, providerType: CloudProviderConnection['providerType']): CloudResourceDraft {
  return {
    resourceId: e.cloudInstanceId || e.hostname || e.ipAddress || randomUUID(),
    resourceType: String(e.raw?.resourceType || 'compute'),
    resourceArn: e.raw?.arn as string | undefined,
    name: e.hostname,
    hostname: e.hostname,
    ipAddress: e.ipAddress,
    macAddress: e.macAddress,
    osName: e.osName,
    serialNumber: e.serialNumber,
    machineGuid: e.machineGuid,
    cloudInstanceId: e.cloudInstanceId,
    region: e.raw?.region as string | undefined,
    zone: e.raw?.zone as string | undefined,
    tags: e.tags,
    networkInfo: (e.raw?.networkInfo as Record<string, unknown>) || {},
    raw: e.raw,
    source: cloudSource(providerType),
  };
}

/** Normalize provider network records into CloudResourceDraft without unsafe casts. */
function networkRecordToDraft(
  n: Record<string, unknown>,
  providerType: CloudProviderConnection['providerType'],
): CloudResourceDraft | null {
  const resourceId = n.resourceId != null ? String(n.resourceId) : '';
  if (!resourceId) return null;
  const tagsRaw = n.tags;
  const tags =
    tagsRaw && typeof tagsRaw === 'object' && !Array.isArray(tagsRaw)
      ? Object.fromEntries(
          Object.entries(tagsRaw as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
        )
      : undefined;
  return {
    resourceId,
    resourceArn: n.resourceArn != null ? String(n.resourceArn) : undefined,
    resourceType: n.resourceType != null ? String(n.resourceType) : 'network',
    name: n.name != null ? String(n.name) : undefined,
    region: n.region != null ? String(n.region) : undefined,
    zone: n.zone != null ? String(n.zone) : undefined,
    status: n.status != null ? String(n.status) : undefined,
    tags,
    networkInfo:
      n.networkInfo && typeof n.networkInfo === 'object' && !Array.isArray(n.networkInfo)
        ? (n.networkInfo as Record<string, unknown>)
        : {},
    hostname: n.hostname != null ? String(n.hostname) : undefined,
    ipAddress: n.ipAddress != null ? String(n.ipAddress) : undefined,
    macAddress: n.macAddress != null ? String(n.macAddress) : undefined,
    osName: n.osName != null ? String(n.osName) : undefined,
    serialNumber: n.serialNumber != null ? String(n.serialNumber) : undefined,
    machineGuid: n.machineGuid != null ? String(n.machineGuid) : undefined,
    cloudInstanceId: n.cloudInstanceId != null ? String(n.cloudInstanceId) : undefined,
    raw: n.raw && typeof n.raw === 'object' && !Array.isArray(n.raw)
      ? (n.raw as Record<string, unknown>)
      : n,
    source: cloudSource(providerType),
  };
}

function mergeCloudIntoAsset(asset: StoredAsset, evidence: DiscoveredHostEvidence, source: string) {
  asset.cloudInstanceId = evidence.cloudInstanceId || asset.cloudInstanceId;
  asset.hostname = evidence.hostname || asset.hostname;
  asset.ipAddress = evidence.ipAddress || asset.ipAddress;
  asset.macAddress = evidence.macAddress || asset.macAddress;
  asset.serialNumber = evidence.serialNumber || asset.serialNumber;
  asset.machineGuid = evidence.machineGuid || asset.machineGuid;
  asset.tags = { ...(asset.tags || {}), ...(evidence.tags || {}) };
  asset.lastSeenAt = new Date().toISOString();
  if (!asset.primaryDiscoverySource || asset.primaryDiscoverySource === 'NETWORK_DISCOVERY') {
    // Prefer AGENT if already set
    if (asset.primaryDiscoverySource !== 'AGENT') asset.primaryDiscoverySource = source;
  }
  asset.customFields = {
    ...(asset.customFields || {}),
    provenance: {
      ...((asset.customFields?.provenance as object) || {}),
      cloudInstanceId: source,
      ipAddress: evidence.ipAddress ? source : undefined,
    },
  };
}
