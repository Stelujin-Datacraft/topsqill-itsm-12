/**
 * Phase C — Passive observation correlation into ITAM assets.
 */
import { randomUUID } from 'crypto';
import type { DiscoveryStore, StoredAsset } from '../discovery/store';
import { correlateDiscoveredHost, type ExistingAssetIdentity } from '../discovery/correlation';
import { ipInCidr } from '../discovery/scope';
import type {
  IpHistoryRow,
  MacHistoryRow,
  NetworkObservation,
  PassiveEvent,
  PassiveObservationInput,
  TelemetrySource,
  TelemetrySourceType,
} from './types';
import { telemetryToInventorySource } from './types';

export interface PassiveStoreSlice {
  telemetrySources: TelemetrySource[];
  networkObservations: NetworkObservation[];
  ipHistory: IpHistoryRow[];
  macHistory: MacHistoryRow[];
  passiveEvents: PassiveEvent[];
}

function ipInCidrs(ip: string, cidrs: string[]): boolean {
  if (!cidrs.length) return true;
  return cidrs.some((c) => {
    try { return ipInCidr(ip, c); } catch { return false; }
  });
}

export class PassiveIntelligenceEngine {
  constructor(private readonly store: DiscoveryStore & PassiveStoreSlice) {}

  createSource(input: Omit<TelemetrySource, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): TelemetrySource {
    const row: TelemetrySource = {
      ...input,
      id: input.id || randomUUID(),
      authorizedScopes: input.authorizedScopes || [],
      config: input.config || {},
      enabled: input.enabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.telemetrySources.push(row);
    this.store.audit(row.organizationId, 'telemetry_source_created', {
      entityType: 'telemetry_source',
      entityId: row.id,
      detail: { sourceType: row.sourceType, name: row.name },
    });
    return row;
  }

  ingest(
    organizationId: string,
    sourceType: TelemetrySourceType,
    observations: PassiveObservationInput[],
    opts?: { sourceId?: string; actorId?: string },
  ): { accepted: number; correlated: number; created: number; rejected: number } {
    const source = opts?.sourceId
      ? this.store.telemetrySources.find((s) => s.id === opts.sourceId && s.organizationId === organizationId)
      : this.store.telemetrySources.find((s) => s.organizationId === organizationId && s.sourceType === sourceType && s.enabled);

    if (opts?.sourceId && !source) throw new Error('Telemetry source not found');
    if (source && !source.enabled) throw new Error('Telemetry source disabled');

    const scopes = source?.authorizedScopes || [];
    let accepted = 0;
    let correlated = 0;
    let created = 0;
    let rejected = 0;
    const invSource = telemetryToInventorySource(sourceType);
    const now = new Date().toISOString();

    const existing: ExistingAssetIdentity[] = this.store.findAssets(organizationId).map((a) => ({
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

    for (const obs of observations) {
      if (obs.ipAddress && scopes.length && !ipInCidrs(obs.ipAddress, scopes)) {
        rejected += 1;
        continue;
      }

      // Dedupe identical observation within same second+source
      const dup = this.store.networkObservations.find(
        (o) =>
          o.organizationId === organizationId
          && o.sourceType === sourceType
          && o.ipAddress === obs.ipAddress
          && o.macAddress === obs.macAddress
          && o.hostname === obs.hostname
          && Math.abs(new Date(o.observedAt).getTime() - new Date(obs.observedAt || now).getTime()) < 1000,
      );
      if (dup) {
        accepted += 1;
        continue;
      }

      const evidence = {
        ipAddress: obs.ipAddress,
        macAddress: obs.macAddress,
        hostname: obs.hostname,
        discoveryMethods: [sourceType],
        services: [],
        software: [],
        fieldProvenance: {
          ...(obs.ipAddress ? { ipAddress: invSource } : {}),
          ...(obs.macAddress ? { macAddress: invSource } : {}),
          ...(obs.hostname ? { hostname: invSource } : {}),
        },
      };

      const corr = correlateDiscoveredHost(evidence as any, existing, invSource);
      let assetId = corr.matchedAssetId || undefined;

      if (!assetId && (obs.macAddress || (obs.hostname && obs.ipAddress))) {
        // Only create unmanaged when we have MAC or hostname+IP — not IP-only
        if (obs.macAddress || obs.hostname) {
          assetId = randomUUID();
          const asset: StoredAsset = {
            id: assetId,
            organizationId,
            displayName: obs.hostname || obs.macAddress || obs.ipAddress || assetId,
            hostname: obs.hostname,
            ipAddress: obs.ipAddress,
            macAddress: obs.macAddress,
            assetType: 'workstation',
            status: 'active',
            discoveryLifecycle: 'DISCOVERED',
            discoveryConfidence: corr.confidence,
            primaryDiscoverySource: invSource,
            firstSeenAt: now,
            lastSeenAt: now,
          };
          this.store.upsertAsset(asset);
          existing.push({
            assetId,
            macAddress: asset.macAddress,
            hostname: asset.hostname,
            ipAddress: asset.ipAddress,
            discoveryLifecycle: asset.discoveryLifecycle,
          });
          created += 1;
        }
      } else if (assetId) {
        const asset = this.store.assets.find((a) => a.id === assetId)!;
        const prevIp = asset.ipAddress;
        const prevMac = asset.macAddress;
        const prevHost = asset.hostname;
        if (obs.ipAddress && prevIp && obs.ipAddress !== prevIp) {
          this.emit(organizationId, assetId, 'IP_CHANGED', { from: prevIp, to: obs.ipAddress, source: sourceType });
        }
        if (obs.macAddress && prevMac && obs.macAddress.toLowerCase() !== prevMac.toLowerCase()) {
          this.emit(organizationId, assetId, 'MAC_CHANGED', { from: prevMac, to: obs.macAddress, source: sourceType });
        }
        if (obs.hostname && prevHost && obs.hostname.toLowerCase() !== prevHost.toLowerCase()) {
          this.emit(organizationId, assetId, 'HOSTNAME_CHANGED', { from: prevHost, to: obs.hostname, source: sourceType });
        }
        if (obs.ipAddress) asset.ipAddress = obs.ipAddress;
        if (obs.macAddress) asset.macAddress = obs.macAddress;
        if (obs.hostname) asset.hostname = obs.hostname;
        asset.lastSeenAt = now;
        this.emit(organizationId, assetId, 'ASSET_SEEN', { source: sourceType });
        correlated += 1;
      }

      if (assetId && obs.ipAddress) this.upsertIpHistory(organizationId, assetId, obs.ipAddress, invSource);
      if (assetId && obs.macAddress) this.upsertMacHistory(organizationId, assetId, obs.macAddress, invSource);

      const row: NetworkObservation = {
        id: randomUUID(),
        organizationId,
        sourceId: source?.id,
        sourceType,
        assetId,
        ipAddress: obs.ipAddress,
        macAddress: obs.macAddress,
        hostname: obs.hostname,
        vlan: obs.vlan,
        interfaceName: obs.interfaceName,
        switchId: obs.switchId,
        ssid: obs.ssid,
        recordType: obs.recordType,
        leaseStart: obs.leaseStart,
        leaseEnd: obs.leaseEnd,
        observedAt: obs.observedAt || now,
        raw: obs.raw || {},
        createdAt: now,
      };
      this.store.networkObservations.push(row);
      this.emit(organizationId, assetId, 'NEW_NETWORK_OBSERVATION', { sourceType, observationId: row.id });
      accepted += 1;
    }

    this.store.audit(organizationId, 'telemetry_imported', {
      actorId: opts?.actorId,
      detail: { sourceType, accepted, correlated, created, rejected },
    });

    return { accepted, correlated, created, rejected };
  }

  private upsertIpHistory(organizationId: string, assetId: string, ip: string, source: string) {
    const now = new Date().toISOString();
    const existing = this.store.ipHistory.find(
      (h) => h.organizationId === organizationId && h.assetId === assetId && h.ipAddress === ip && h.source === source,
    );
    if (existing) existing.lastSeenAt = now;
    else {
      this.store.ipHistory.push({
        id: randomUUID(),
        organizationId,
        assetId,
        ipAddress: ip,
        source,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
  }

  private upsertMacHistory(organizationId: string, assetId: string, mac: string, source: string) {
    const now = new Date().toISOString();
    const normalized = mac.toLowerCase();
    const existing = this.store.macHistory.find(
      (h) => h.organizationId === organizationId && h.assetId === assetId && h.macAddress === normalized && h.source === source,
    );
    if (existing) existing.lastSeenAt = now;
    else {
      this.store.macHistory.push({
        id: randomUUID(),
        organizationId,
        assetId,
        macAddress: normalized,
        source,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
  }

  private emit(organizationId: string, assetId: string | undefined, eventType: PassiveEvent['eventType'], detail: Record<string, unknown>) {
    this.store.passiveEvents.push({
      id: randomUUID(),
      organizationId,
      assetId,
      eventType,
      detail,
      createdAt: new Date().toISOString(),
    });
  }
}
