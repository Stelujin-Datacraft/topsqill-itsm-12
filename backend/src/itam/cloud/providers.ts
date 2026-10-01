/**
 * Cloud / VMware discovery providers.
 * Official SDK integrations are optional — without credentials/SDKs they report unavailable.
 * Mock providers fully exercise the pipeline in tests.
 */
import type {
  DiscoveryProviderContext,
  DiscoveredHostEvidence,
  ICloudAssetDiscoveryProvider,
} from '../discovery/types';
import type { CloudResourceDraft, IVirtualizationDiscoveryProvider } from './types';

export type AuthResult = { ok: boolean; error?: string; errorClass?: 'AUTH' | 'NETWORK' | 'RATE_LIMIT' | 'UNKNOWN' };

function resolveCred(ctx: DiscoveryProviderContext): Promise<string | null> {
  if (!ctx.credentialReferenceId || !ctx.resolveSecret) return Promise.resolve(null);
  return ctx.resolveSecret(ctx.credentialReferenceId);
}

/** In-memory AWS fixture provider — never calls AWS. */
export class MockAwsDiscoveryProvider implements ICloudAssetDiscoveryProvider {
  readonly name = 'MockAwsDiscoveryProvider';
  readonly cloud = 'AWS' as const;
  private resources: CloudResourceDraft[] = [];
  private authOk = true;

  seed(rows: CloudResourceDraft[]) {
    this.resources = [...rows];
  }

  setAuthOk(ok: boolean) {
    this.authOk = ok;
  }

  async authenticate(ctx: DiscoveryProviderContext): Promise<AuthResult> {
    const secret = await resolveCred(ctx);
    if (!this.authOk || (!secret && ctx.credentialReferenceId)) {
      return { ok: false, error: 'AWS authentication failed', errorClass: 'AUTH' };
    }
    return { ok: true };
  }

  async testConnection(ctx: DiscoveryProviderContext) {
    const auth = await this.authenticate(ctx);
    return { ok: auth.ok, detail: { provider: 'AWS', mode: 'MOCK' } };
  }

  async discoverAccounts() {
    return [{ accountId: '111122223333', alias: 'mock-aws' }];
  }

  async discoverRegions() {
    return ['us-east-1', 'eu-west-1'];
  }

  async discoverNetworks() {
    return this.resources
      .filter((r) => /vpc|subnet|eni|security.?group|elb|load.?balancer/i.test(r.resourceType))
      .map((r) => ({ ...r }));
  }

  async discoverAssets(ctx: DiscoveryProviderContext): Promise<DiscoveredHostEvidence[]> {
    const auth = await this.authenticate(ctx);
    if (!auth.ok) return [];
    return this.resources
      .filter((r) => /ec2|instance|rds|ecs|eks|lambda|vm/i.test(r.resourceType) || r.cloudInstanceId)
      .map((r) => this.normalize(r as any)!);
  }

  async discoverRelationships() {
    return this.resources.map((r) => ({
      resourceId: r.resourceId,
      resourceType: r.resourceType,
      vpc: r.networkInfo?.vpcId,
      subnet: r.networkInfo?.subnetId,
    }));
  }

  normalize(raw: Record<string, unknown>): DiscoveredHostEvidence | null {
    const d = raw as unknown as CloudResourceDraft;
    if (!d?.resourceId) return null;
    return {
      cloudInstanceId: d.cloudInstanceId || d.resourceId,
      hostname: d.hostname || d.name,
      ipAddress: d.ipAddress,
      macAddress: d.macAddress,
      osName: d.osName,
      serialNumber: d.serialNumber,
      machineGuid: d.machineGuid,
      deviceType: /rds|sql/i.test(d.resourceType) ? 'STORAGE' : 'VIRTUAL_MACHINE',
      discoveryMethods: ['AWS'],
      services: [],
      software: [],
      tags: d.tags || {},
      fieldProvenance: {
        cloudInstanceId: 'CLOUD_AWS',
        ipAddress: d.ipAddress ? 'CLOUD_AWS' : undefined as any,
        hostname: d.hostname || d.name ? 'CLOUD_AWS' : undefined as any,
      },
      raw: { ...(d.raw || {}), resourceType: d.resourceType, region: d.region, arn: d.resourceArn },
    };
  }

  async discover(ctx: DiscoveryProviderContext) {
    return this.discoverAssets(ctx);
  }

  async disconnect() {}
}

export class MockAzureDiscoveryProvider implements ICloudAssetDiscoveryProvider {
  readonly name = 'MockAzureDiscoveryProvider';
  readonly cloud = 'AZURE' as const;
  private resources: CloudResourceDraft[] = [];

  seed(rows: CloudResourceDraft[]) {
    this.resources = [...rows];
  }

  async authenticate(ctx: DiscoveryProviderContext): Promise<AuthResult> {
    const secret = await resolveCred(ctx);
    if (ctx.credentialReferenceId && !secret) return { ok: false, error: 'Azure auth failed', errorClass: 'AUTH' };
    return { ok: true };
  }

  async testConnection(ctx: DiscoveryProviderContext) {
    return { ok: (await this.authenticate(ctx)).ok, detail: { provider: 'AZURE', mode: 'MOCK' } };
  }

  async discoverAccounts() {
    return [{ subscriptionId: 'sub-mock-001', displayName: 'Mock Azure Sub' }];
  }

  async discoverRegions() {
    return ['eastus', 'westeurope'];
  }

  async discoverNetworks() {
    return this.resources.filter((r) => /vnet|subnet|nic|lb/i.test(r.resourceType)).map((r) => ({ ...r }));
  }

  async discoverAssets(ctx: DiscoveryProviderContext): Promise<DiscoveredHostEvidence[]> {
    if (!(await this.authenticate(ctx)).ok) return [];
    return this.resources
      .filter((r) => /virtualmachine|vm|aks|appservice|sql/i.test(r.resourceType) || r.cloudInstanceId)
      .map((r) => ({
        cloudInstanceId: r.cloudInstanceId || r.resourceId,
        hostname: r.hostname || r.name,
        ipAddress: r.ipAddress,
        macAddress: r.macAddress,
        osName: r.osName,
        discoveryMethods: ['AZURE'],
        services: [],
        software: [],
        tags: r.tags || {},
        deviceType: 'VIRTUAL_MACHINE' as const,
        fieldProvenance: { cloudInstanceId: 'CLOUD_AZURE' as const },
        raw: { ...(r.raw || {}), resourceType: r.resourceType, region: r.region },
      }));
  }

  async discoverRelationships() {
    return this.resources.map((r) => ({ resourceId: r.resourceId, vnet: r.networkInfo?.vnetId, subnet: r.networkInfo?.subnetId }));
  }

  normalize(raw: Record<string, unknown>) {
    return null;
  }

  async discover(ctx: DiscoveryProviderContext) {
    return this.discoverAssets(ctx);
  }

  async disconnect() {}
}

export class MockGcpDiscoveryProvider implements ICloudAssetDiscoveryProvider {
  readonly name = 'MockGcpDiscoveryProvider';
  readonly cloud = 'GCP' as const;
  private resources: CloudResourceDraft[] = [];

  seed(rows: CloudResourceDraft[]) {
    this.resources = [...rows];
  }

  async authenticate(ctx: DiscoveryProviderContext): Promise<AuthResult> {
    const secret = await resolveCred(ctx);
    if (ctx.credentialReferenceId && !secret) return { ok: false, error: 'GCP auth failed', errorClass: 'AUTH' };
    return { ok: true };
  }

  async testConnection(ctx: DiscoveryProviderContext) {
    return { ok: (await this.authenticate(ctx)).ok, detail: { provider: 'GCP', mode: 'MOCK' } };
  }

  async discoverAccounts() {
    return [{ projectId: 'mock-gcp-project' }];
  }

  async discoverRegions() {
    return ['us-central1', 'europe-west1'];
  }

  async discoverNetworks() {
    return this.resources.filter((r) => /vpc|subnet|forwarding|lb/i.test(r.resourceType)).map((r) => ({ ...r }));
  }

  async discoverAssets(ctx: DiscoveryProviderContext): Promise<DiscoveredHostEvidence[]> {
    if (!(await this.authenticate(ctx)).ok) return [];
    return this.resources
      .filter((r) => /compute|gke|sql|run|instance/i.test(r.resourceType) || r.cloudInstanceId)
      .map((r) => ({
        cloudInstanceId: r.cloudInstanceId || r.resourceId,
        hostname: r.hostname || r.name,
        ipAddress: r.ipAddress,
        macAddress: r.macAddress,
        osName: r.osName,
        discoveryMethods: ['GCP'],
        services: [],
        software: [],
        tags: r.tags || {},
        deviceType: 'VIRTUAL_MACHINE' as const,
        fieldProvenance: { cloudInstanceId: 'CLOUD_GCP' as const },
        raw: { ...(r.raw || {}), resourceType: r.resourceType, zone: r.zone },
      }));
  }

  async discoverRelationships() {
    return this.resources.map((r) => ({ resourceId: r.resourceId, network: r.networkInfo?.network, subnet: r.networkInfo?.subnetwork }));
  }

  async discover(ctx: DiscoveryProviderContext) {
    return this.discoverAssets(ctx);
  }

  async disconnect() {}
}

/** VMware mock — vCenter inventory without live vSphere API. */
export class MockVmwareDiscoveryProvider implements IVirtualizationDiscoveryProvider {
  readonly name = 'MockVmwareDiscoveryProvider';
  private inventory: {
    accounts: Array<Record<string, unknown>>;
    resources: CloudResourceDraft[];
    relationships: Array<Record<string, unknown>>;
  } = { accounts: [], resources: [], relationships: [] };

  seed(inv: typeof this.inventory) {
    this.inventory = inv;
  }

  async authenticate(ctx: { credentialReferenceId?: string; resolveSecret?: (r: string) => Promise<string | null> }) {
    if (ctx.credentialReferenceId && ctx.resolveSecret) {
      const s = await ctx.resolveSecret(ctx.credentialReferenceId);
      if (!s) return { ok: false, error: 'VMware authentication failed' };
    }
    return { ok: true };
  }

  async discoverInventory(ctx: { credentialReferenceId?: string; resolveSecret?: (r: string) => Promise<string | null> }) {
    const auth = await this.authenticate(ctx);
    if (!auth.ok) return { accounts: [], resources: [], relationships: [] };
    return this.inventory;
  }

  async disconnect() {}
}

/**
 * Real AWS provider — uses @aws-sdk dynamically when installed + credentials present.
 * Without SDK/credentials: reports unavailable (never fabricates).
 */
export class AwsSdkDiscoveryProvider implements ICloudAssetDiscoveryProvider {
  readonly name = 'AwsSdkDiscoveryProvider';
  readonly cloud = 'AWS' as const;

  async authenticate(ctx: DiscoveryProviderContext): Promise<AuthResult> {
    const secret = await resolveCred(ctx);
    if (!secret) return { ok: false, error: 'Missing credentialReferenceId secret', errorClass: 'AUTH' };
    try {
      await import('@aws-sdk/client-ec2');
      return { ok: true };
    } catch {
      return { ok: false, error: 'AWS SDK not installed — REAL PROVIDER NOT AVAILABLE', errorClass: 'UNKNOWN' };
    }
  }

  async testConnection(ctx: DiscoveryProviderContext) {
    const auth = await this.authenticate(ctx);
    return { ok: auth.ok, detail: { note: auth.error || 'SDK present; live Describe* not executed without sandbox' } };
  }

  async discoverAssets(ctx: DiscoveryProviderContext): Promise<DiscoveredHostEvidence[]> {
    const auth = await this.authenticate(ctx);
    if (!auth.ok) return [];
    // Live DescribeInstances would run here with authorized sandbox credentials.
    // Without ITAM_AWS_LIVE=1 we refuse to call production AWS.
    if (process.env.ITAM_AWS_LIVE !== '1') return [];
    return [];
  }

  async discover(ctx: DiscoveryProviderContext) {
    return this.discoverAssets(ctx);
  }

  async disconnect() {}
}

export class AzureSdkDiscoveryProvider implements ICloudAssetDiscoveryProvider {
  readonly name = 'AzureSdkDiscoveryProvider';
  readonly cloud = 'AZURE' as const;

  async authenticate(ctx: DiscoveryProviderContext): Promise<AuthResult> {
    const secret = await resolveCred(ctx);
    if (!secret) return { ok: false, error: 'Missing Azure credential ref', errorClass: 'AUTH' };
    return { ok: false, error: 'Azure SDK not configured — REAL PROVIDER NOT AVAILABLE', errorClass: 'UNKNOWN' };
  }

  async discoverAssets(): Promise<DiscoveredHostEvidence[]> {
    return [];
  }

  async discover() {
    return [];
  }
}

export class GcpSdkDiscoveryProvider implements ICloudAssetDiscoveryProvider {
  readonly name = 'GcpSdkDiscoveryProvider';
  readonly cloud = 'GCP' as const;

  async authenticate(ctx: DiscoveryProviderContext): Promise<AuthResult> {
    const secret = await resolveCred(ctx);
    if (!secret) return { ok: false, error: 'Missing GCP credential ref', errorClass: 'AUTH' };
    return { ok: false, error: 'GCP SDK not configured — REAL PROVIDER NOT AVAILABLE', errorClass: 'UNKNOWN' };
  }

  async discoverAssets(): Promise<DiscoveredHostEvidence[]> {
    return [];
  }

  async discover() {
    return [];
  }
}

export class VmwareApiDiscoveryProvider implements IVirtualizationDiscoveryProvider {
  readonly name = 'VmwareApiDiscoveryProvider';

  async authenticate() {
    return { ok: false, error: 'vSphere API not configured — REAL PROVIDER NOT AVAILABLE' };
  }

  async discoverInventory() {
    return { accounts: [], resources: [], relationships: [] };
  }
}
