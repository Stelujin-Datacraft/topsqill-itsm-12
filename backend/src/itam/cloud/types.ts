/**
 * Phase B — Cloud + Virtualization discovery types.
 * Reuses ITAM asset SoR; no second inventory.
 */
import type { DiscoveryConfidence, DiscoveryEnvironment, InventorySource } from '../discovery/types';

export type CloudProviderType = 'AWS' | 'AZURE' | 'GCP' | 'VMWARE' | 'OTHER';

export type CloudChangeType =
  | 'NEW_RESOURCE'
  | 'RESOURCE_CHANGED'
  | 'RESOURCE_REMOVED'
  | 'TAG_CHANGED'
  | 'NETWORK_CHANGED'
  | 'STATE_CHANGED';

export interface CloudProviderConnection {
  id: string;
  organizationId: string;
  providerType: CloudProviderType;
  name: string;
  environment: DiscoveryEnvironment;
  /** SecretProvider reference only */
  credentialReferenceId: string;
  config: Record<string, unknown>;
  status: 'PENDING' | 'READY' | 'ERROR' | 'DISABLED';
  lastError?: string;
  lastTestedAt?: string;
  enabled: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudAccount {
  id: string;
  organizationId: string;
  providerId: string;
  accountKey: string;
  displayName?: string;
  regionScope: string[];
  metadata: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface CloudResource {
  id: string;
  organizationId: string;
  providerId: string;
  accountId?: string;
  assetId?: string;
  providerType: CloudProviderType;
  resourceId: string;
  resourceArn?: string;
  resourceType: string;
  name?: string;
  region?: string;
  zone?: string;
  status?: string;
  tags: Record<string, string>;
  networkInfo: Record<string, unknown>;
  raw: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface CloudDiscoveryJob {
  id: string;
  organizationId: string;
  providerId: string;
  name: string;
  status: string;
  schedule: 'ON_DEMAND' | 'HOURLY' | 'DAILY' | 'CUSTOM';
  scheduleCron?: string;
  credentialReferenceId?: string;
  progress: Record<string, unknown>;
  metrics: Record<string, unknown>;
  lastError?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}

export interface CloudChange {
  id: string;
  organizationId: string;
  providerId?: string;
  resourceId?: string;
  changeType: CloudChangeType;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface IVirtualizationDiscoveryProvider {
  readonly name: string;
  authenticate?(ctx: { organizationId: string; credentialReferenceId?: string; resolveSecret?: (r: string) => Promise<string | null> }): Promise<{ ok: boolean; error?: string }>;
  discoverInventory?(ctx: { organizationId: string; credentialReferenceId?: string; resolveSecret?: (r: string) => Promise<string | null> }): Promise<{
    accounts: Array<Record<string, unknown>>;
    resources: CloudResourceDraft[];
    relationships: Array<Record<string, unknown>>;
  }>;
  disconnect?(): Promise<void>;
}

export interface CloudResourceDraft {
  resourceId: string;
  resourceArn?: string;
  resourceType: string;
  name?: string;
  region?: string;
  zone?: string;
  status?: string;
  tags?: Record<string, string>;
  networkInfo?: Record<string, unknown>;
  hostname?: string;
  ipAddress?: string;
  macAddress?: string;
  osName?: string;
  serialNumber?: string;
  machineGuid?: string;
  cloudInstanceId?: string;
  raw?: Record<string, unknown>;
  source: InventorySource;
}

export function cloudSource(provider: CloudProviderType): InventorySource {
  if (provider === 'AWS') return 'CLOUD_AWS';
  if (provider === 'AZURE') return 'CLOUD_AZURE';
  if (provider === 'GCP') return 'CLOUD_GCP';
  if (provider === 'VMWARE') return 'VMWARE';
  return 'MANAGEMENT_API';
}

export type TopologyConfidence = DiscoveryConfidence;
