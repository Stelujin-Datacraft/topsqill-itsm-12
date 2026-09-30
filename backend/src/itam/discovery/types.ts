/**
 * ITAM Network Discovery — types.
 * Authorized enterprise networks only. No exploitation.
 */
export type DiscoveryJobStatus =
  | 'DRAFT' | 'VALIDATING' | 'READY' | 'RUNNING' | 'PAUSING' | 'PAUSED'
  | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export type DiscoveryMode = 'PASSIVE' | 'ACTIVE' | 'CREDENTIALED' | 'AGENT' | 'HYBRID';

export type DiscoveredAssetStatus =
  | 'DISCOVERED' | 'UNVERIFIED' | 'VERIFIED' | 'MANAGED' | 'IGNORED' | 'RETIRED';

export type DiscoveryConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type InventorySource =
  | 'AGENT' | 'NETWORK_DISCOVERY' | 'CREDENTIALED' | 'MANAGEMENT_API'
  | 'SNMP' | 'MANUAL' | 'DNS' | 'DHCP' | 'ARP';

export type DeviceType =
  | 'WORKSTATION' | 'SERVER' | 'LAPTOP' | 'DESKTOP' | 'NETWORK_DEVICE'
  | 'PRINTER' | 'ROUTER' | 'SWITCH' | 'FIREWALL' | 'ACCESS_POINT'
  | 'STORAGE' | 'VIRTUAL_MACHINE' | 'CONTAINER_HOST' | 'IOT' | 'UNKNOWN';

export type DiscoveryEnvironment = 'LAB' | 'TEST' | 'UAT' | 'PROD';

export interface NetworkScope {
  id: string;
  organizationId: string;
  environment: DiscoveryEnvironment;
  name: string;
  description?: string;
  cidr: string;
  scopeKind: 'INCLUDE' | 'EXCLUDE';
  authorizationStatus: 'PENDING' | 'APPROVED' | 'REVOKED' | 'EXPIRED';
  enabled: boolean;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryJob {
  id: string;
  organizationId: string;
  environmentId: DiscoveryEnvironment;
  name: string;
  description?: string;
  status: DiscoveryJobStatus;
  discoveryMode: DiscoveryMode;
  networkRanges: string[];
  excludedRanges: string[];
  schedule: string;
  scheduleCron?: string;
  maxConcurrency: number;
  maxHosts: number;
  timeoutMs: number;
  hostTimeoutMs: number;
  jobTimeoutMs: number;
  rateLimitPerSec: number;
  credentialReferenceId?: string;
  tcpPorts: number[];
  enableIcmp: boolean;
  enableTcp: boolean;
  enableSnmp: boolean;
  enableCredentialed: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastError?: string;
  progress: Record<string, unknown>;
  metrics: Record<string, unknown>;
}

export interface ObservedService {
  port: number;
  protocol: 'tcp' | 'udp';
  service?: string;
  banner?: string;
}

export interface ObservedSoftware {
  rawName: string;
  rawVersion?: string;
  publisher?: string;
  source: InventorySource;
}

export interface DiscoveredHostEvidence {
  ipAddress?: string;
  macAddress?: string;
  hostname?: string;
  dnsName?: string;
  deviceType?: DeviceType;
  osName?: string;
  osFamily?: string;
  osVersion?: string;
  osArch?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  biosUuid?: string;
  machineGuid?: string;
  responseTimeMs?: number;
  discoveryMethods: string[];
  services: ObservedService[];
  software: ObservedSoftware[];
  fieldProvenance: Record<string, InventorySource>;
  raw?: Record<string, unknown>;
}

export interface AssetIdentitySignal {
  type:
    | 'agentId' | 'machineGuid' | 'serialNumber' | 'biosUuid'
    | 'cloudInstanceId' | 'macAddress' | 'hostname' | 'ipAddress'
    | 'sshHostKey';
  value: string;
  source: InventorySource;
  weight: number;
}

export interface CorrelationResult {
  matchedAssetId: string | null;
  confidence: DiscoveryConfidence;
  signals: AssetIdentitySignal[];
  action: 'UPDATE' | 'CREATE_UNMANAGED' | 'MERGE';
}

export interface DiscoveryRunProgress {
  hostsTargeted: number;
  hostsScanned: number;
  hostsDiscovered: number;
  assetsCreated: number;
  assetsUpdated: number;
  assetsUnmanaged: number;
  softwareDiscovered: number;
  errors: number;
  cancelled: boolean;
  paused: boolean;
}

export interface DiscoveryProviderContext {
  organizationId: string;
  jobId: string;
  runId: string;
  correlationId: string;
  hostTimeoutMs: number;
  /** SecretProvider reference only — never plaintext secrets */
  credentialReferenceId?: string;
  allowPrivateNetwork: boolean;
  /** Resolve secrets without logging */
  resolveSecret?: (refId: string) => Promise<string | null>;
}

export interface INetworkDiscoveryProvider {
  readonly name: string;
  readonly kind: string;
  discoverHosts?(
    targets: string[],
    ctx: DiscoveryProviderContext,
  ): Promise<DiscoveredHostEvidence[]>;
  discoverServices?(
    host: DiscoveredHostEvidence,
    ports: number[],
    ctx: DiscoveryProviderContext,
  ): Promise<ObservedService[]>;
  collectInventory?(
    host: DiscoveredHostEvidence,
    ctx: DiscoveryProviderContext,
  ): Promise<Partial<DiscoveredHostEvidence>>;
}

export interface ICloudAssetDiscoveryProvider {
  readonly name: string;
  readonly cloud: 'AWS' | 'AZURE' | 'GCP' | 'OTHER';
  discover?(ctx: DiscoveryProviderContext): Promise<DiscoveredHostEvidence[]>;
}

/** Source priority for conflict resolution (highest first). */
export const SOURCE_PRIORITY: InventorySource[] = [
  'AGENT',
  'CREDENTIALED',
  'MANAGEMENT_API',
  'SNMP',
  'NETWORK_DISCOVERY',
  'DNS',
  'DHCP',
  'ARP',
  'MANUAL',
];

export function sourceRank(source: InventorySource): number {
  const i = SOURCE_PRIORITY.indexOf(source);
  return i < 0 ? SOURCE_PRIORITY.length : i;
}
