/**
 * Network discovery providers — safe techniques only.
 * No exploitation, brute force, or credential guessing.
 */
import { createConnection } from 'net';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
  DiscoveredHostEvidence,
  DiscoveryProviderContext,
  INetworkDiscoveryProvider,
  ICloudAssetDiscoveryProvider,
  ObservedService,
} from './types';
import { assertIpInAuthorizedScopes } from './scope';

const execFileAsync = promisify(execFile);

const WELL_KNOWN: Record<number, string> = {
  22: 'ssh',
  53: 'dns',
  80: 'http',
  135: 'rpc',
  139: 'netbios',
  161: 'snmp',
  443: 'https',
  445: 'smb',
  3389: 'rdp',
  5985: 'winrm',
  5986: 'winrm-https',
};

/** In-memory lab network for tests — never probes the real network. */
export class MockNetworkDiscoveryProvider implements INetworkDiscoveryProvider {
  readonly name = 'MockNetworkDiscoveryProvider';
  readonly kind = 'MOCK';

  constructor(
    private readonly hosts: Map<string, DiscoveredHostEvidence> = new Map(),
  ) {}

  seed(host: DiscoveredHostEvidence) {
    if (host.ipAddress) this.hosts.set(host.ipAddress, host);
  }

  async discoverHosts(targets: string[], _ctx: DiscoveryProviderContext): Promise<DiscoveredHostEvidence[]> {
    const out: DiscoveredHostEvidence[] = [];
    for (const ip of targets) {
      const h = this.hosts.get(ip);
      if (h) out.push({ ...h, discoveryMethods: [...new Set([...(h.discoveryMethods || []), 'MOCK'])] });
    }
    return out;
  }

  async discoverServices(host: DiscoveredHostEvidence): Promise<ObservedService[]> {
    return host.services || [];
  }

  async collectInventory(host: DiscoveredHostEvidence): Promise<Partial<DiscoveredHostEvidence>> {
    return {
      software: host.software || [],
      osName: host.osName,
      osVersion: host.osVersion,
      serialNumber: host.serialNumber,
    };
  }
}

/** Controlled ICMP reachability via system ping (LAB/TEST only; bounded). */
export class IcmpDiscoveryProvider implements INetworkDiscoveryProvider {
  readonly name = 'IcmpDiscoveryProvider';
  readonly kind = 'ICMP';

  constructor(private readonly includeCidrs: string[] = [], private readonly excludeCidrs: string[] = []) {}

  async discoverHosts(targets: string[], ctx: DiscoveryProviderContext): Promise<DiscoveredHostEvidence[]> {
    const out: DiscoveredHostEvidence[] = [];
    for (const ip of targets) {
      assertIpInAuthorizedScopes(ip, this.includeCidrs.length ? this.includeCidrs : [`${ip}/32`], this.excludeCidrs);
      const start = Date.now();
      const reachable = await this.ping(ip, ctx.hostTimeoutMs);
      if (!reachable) continue;
      out.push({
        ipAddress: ip,
        discoveryMethods: ['ICMP'],
        responseTimeMs: Date.now() - start,
        services: [],
        software: [],
        fieldProvenance: { ipAddress: 'NETWORK_DISCOVERY' },
      });
    }
    return out;
  }

  private async ping(ip: string, timeoutMs: number): Promise<boolean> {
    try {
      const sec = Math.max(1, Math.ceil(timeoutMs / 1000));
      await execFileAsync('ping', ['-c', '1', '-W', String(sec), ip], { timeout: timeoutMs + 500 });
      return true;
    } catch {
      return false;
    }
  }
}

/** Safe TCP connect checks + optional short banner read (no payload attacks). */
export class TcpDiscoveryProvider implements INetworkDiscoveryProvider {
  readonly name = 'TcpDiscoveryProvider';
  readonly kind = 'TCP';

  constructor(private readonly includeCidrs: string[] = [], private readonly excludeCidrs: string[] = []) {}

  async discoverHosts(targets: string[], ctx: DiscoveryProviderContext): Promise<DiscoveredHostEvidence[]> {
    // TCP provider alone doesn't mark hosts up; used with ICMP or mock
    return targets.map((ip) => ({
      ipAddress: ip,
      discoveryMethods: [] as string[],
      services: [],
      software: [],
      fieldProvenance: {},
    }));
  }

  async discoverServices(
    host: DiscoveredHostEvidence,
    ports: number[],
    ctx: DiscoveryProviderContext,
  ): Promise<ObservedService[]> {
    const ip = host.ipAddress;
    if (!ip) return [];
    assertIpInAuthorizedScopes(ip, this.includeCidrs.length ? this.includeCidrs : [`${ip}/32`], this.excludeCidrs);
    const open: ObservedService[] = [];
    for (const port of ports) {
      const banner = await this.probe(ip, port, ctx.hostTimeoutMs);
      if (banner !== null) {
        open.push({
          port,
          protocol: 'tcp',
          service: WELL_KNOWN[port] || 'unknown',
          banner: banner || undefined,
        });
      }
    }
    return open;
  }

  private probe(ip: string, port: number, timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      const socket = createConnection({ host: ip, port });
      let settled = false;
      const done = (v: string | null) => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch { /* */ }
        resolve(v);
      };
      socket.setTimeout(timeoutMs);
      socket.on('connect', () => {
        // Optional short banner — never send attack payloads
        socket.setEncoding('utf8');
        let data = '';
        socket.on('data', (chunk) => {
          data += String(chunk).slice(0, 200);
          done(data.trim());
        });
        setTimeout(() => done(data.trim() || ''), 200);
      });
      socket.on('timeout', () => done(null));
      socket.on('error', () => done(null));
    });
  }
}

/**
 * SNMP provider abstraction — requires credentialReferenceId.
 * Does not hardcode community strings; resolves via SecretProvider.
 */
export class SnmpDiscoveryProvider implements INetworkDiscoveryProvider {
  readonly name = 'SnmpDiscoveryProvider';
  readonly kind = 'SNMP';

  async collectInventory(
    host: DiscoveredHostEvidence,
    ctx: DiscoveryProviderContext,
  ): Promise<Partial<DiscoveredHostEvidence>> {
    if (!ctx.credentialReferenceId || !ctx.resolveSecret) {
      return {};
    }
    // Credential resolved but never logged. Real SNMP client can be wired later.
    const secret = await ctx.resolveSecret(ctx.credentialReferenceId);
    if (!secret) return {};
    // Placeholder enrichment when SNMP library not installed — mock-friendly override via raw
    if (host.raw?.snmp) {
      const snmp = host.raw.snmp as Record<string, string>;
      return {
        hostname: snmp.sysName || host.hostname,
        manufacturer: snmp.vendor || host.manufacturer,
        model: snmp.model || host.model,
        osName: snmp.sysDescr || host.osName,
        serialNumber: snmp.serial || host.serialNumber,
        discoveryMethods: [...(host.discoveryMethods || []), 'SNMP'],
        fieldProvenance: {
          ...host.fieldProvenance,
          hostname: 'SNMP',
          manufacturer: 'SNMP',
          osName: 'SNMP',
          serialNumber: snmp.serial ? 'SNMP' : host.fieldProvenance?.serialNumber,
        },
      };
    }
    return {};
  }
}

/** Windows credentialed inventory — WinRM/WMI via approved credential ref only. */
export class WindowsInventoryProvider implements INetworkDiscoveryProvider {
  readonly name = 'WindowsInventoryProvider';
  readonly kind = 'WINRM';

  async collectInventory(
    host: DiscoveredHostEvidence,
    ctx: DiscoveryProviderContext,
  ): Promise<Partial<DiscoveredHostEvidence>> {
    if (!ctx.credentialReferenceId || !ctx.resolveSecret) return {};
    const secret = await ctx.resolveSecret(ctx.credentialReferenceId);
    if (!secret) return {};
    // Lab/mock path: evidence may already include credentialed software
    if (host.raw?.windowsInventory) {
      const inv = host.raw.windowsInventory as DiscoveredHostEvidence;
      return {
        ...inv,
        discoveryMethods: [...(host.discoveryMethods || []), 'WINRM'],
        fieldProvenance: { ...host.fieldProvenance, ...(inv.fieldProvenance || {}), osName: 'CREDENTIALED' },
      };
    }
    return {};
  }
}

/** Linux SSH inventory — authorized key/password via SecretProvider only. */
export class LinuxInventoryProvider implements INetworkDiscoveryProvider {
  readonly name = 'LinuxInventoryProvider';
  readonly kind = 'SSH';

  async collectInventory(
    host: DiscoveredHostEvidence,
    ctx: DiscoveryProviderContext,
  ): Promise<Partial<DiscoveredHostEvidence>> {
    if (!ctx.credentialReferenceId || !ctx.resolveSecret) return {};
    const secret = await ctx.resolveSecret(ctx.credentialReferenceId);
    if (!secret) return {};
    if (host.raw?.linuxInventory) {
      const inv = host.raw.linuxInventory as DiscoveredHostEvidence;
      return {
        ...inv,
        discoveryMethods: [...(host.discoveryMethods || []), 'SSH'],
        fieldProvenance: { ...host.fieldProvenance, ...(inv.fieldProvenance || {}), osName: 'CREDENTIALED' },
      };
    }
    return {};
  }
}

/** Future cloud discovery — interface only unless credentials provided. */
export class CloudAssetDiscoveryStub implements ICloudAssetDiscoveryProvider {
  readonly name = 'CloudAssetDiscoveryStub';
  constructor(readonly cloud: 'AWS' | 'AZURE' | 'GCP' | 'OTHER') {}
  async discover(): Promise<DiscoveredHostEvidence[]> {
    return [];
  }
}
