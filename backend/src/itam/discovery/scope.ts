/**
 * CIDR / network scope safety — fail closed outside authorized ranges.
 * No scanning of arbitrary public internet without explicit approved scope.
 */
import { isIP } from 'net';

const PRIVATE_V4 = [
  { base: ipToLong('10.0.0.0'), mask: 8 },
  { base: ipToLong('172.16.0.0'), mask: 12 },
  { base: ipToLong('192.168.0.0'), mask: 16 },
  { base: ipToLong('127.0.0.0'), mask: 8 },
  { base: ipToLong('169.254.0.0'), mask: 16 },
];

export function ipToLong(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function longToIp(n: number): string {
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.');
}

export function parseCidr(cidr: string): { network: number; mask: number; prefix: number } {
  const trimmed = String(cidr || '').trim();
  const m = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!m) throw new Error(`Invalid CIDR: ${cidr}`);
  const prefix = Number(m[2]);
  if (prefix < 0 || prefix > 32) throw new Error(`Invalid CIDR prefix: ${cidr}`);
  if (isIP(m[1]) !== 4) throw new Error(`CIDR must be IPv4: ${cidr}`);
  const ip = ipToLong(m[1]);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  return { network, mask, prefix };
}

export function cidrHostCount(cidr: string): number {
  const { prefix } = parseCidr(cidr);
  if (prefix >= 31) return prefix === 32 ? 1 : 2;
  return 2 ** (32 - prefix) - 2; // exclude network/broadcast for normal subnets
}

export function expandCidr(cidr: string, maxHosts: number): string[] {
  const { network, prefix } = parseCidr(cidr);
  if (prefix === 32) return [longToIp(network)];
  if (prefix === 31) return [longToIp(network), longToIp(network + 1)];
  const total = 2 ** (32 - prefix);
  const first = network + 1;
  const last = network + total - 2;
  const count = Math.max(0, last - first + 1);
  if (count > maxHosts) {
    throw new Error(
      `CIDR ${cidr} expands to ${count} hosts which exceeds maxHosts=${maxHosts}. Narrow the scope or raise the approved limit.`,
    );
  }
  const out: string[] = [];
  for (let n = first; n <= last; n++) out.push(longToIp(n));
  return out;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const { network, mask } = parseCidr(cidr);
  const addr = ipToLong(ip);
  return ((addr & mask) >>> 0) === network;
}

export function isPrivateIpv4(ip: string): boolean {
  const n = ipToLong(ip);
  return PRIVATE_V4.some((r) => {
    const mask = r.mask === 0 ? 0 : (~0 << (32 - r.mask)) >>> 0;
    return ((n & mask) >>> 0) === r.base;
  });
}

export interface ScopeValidationResult {
  ok: boolean;
  targets: string[];
  estimatedHosts: number;
  errors: string[];
  warnings: string[];
}

/**
 * Build the final host list from include/exclude CIDRs.
 * Only APPROVED scopes may contribute includes when requireApproved=true.
 */
export function buildAuthorizedTargets(opts: {
  includeCidrs: string[];
  excludeCidrs: string[];
  maxHosts: number;
  requirePrivate?: boolean;
  denylistCidrs?: string[];
}): ScopeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const include = opts.includeCidrs || [];
  const exclude = opts.excludeCidrs || [];
  const deny = opts.denylistCidrs || [];

  if (!include.length) {
    return { ok: false, targets: [], estimatedHosts: 0, errors: ['At least one include CIDR is required'], warnings };
  }

  let estimated = 0;
  try {
    for (const c of include) {
      parseCidr(c);
      estimated += cidrHostCount(c);
    }
    for (const c of exclude) parseCidr(c);
    for (const c of deny) parseCidr(c);
  } catch (e: any) {
    return { ok: false, targets: [], estimatedHosts: 0, errors: [e?.message || String(e)], warnings };
  }

  if (estimated > opts.maxHosts) {
    errors.push(`Estimated ${estimated} hosts exceeds maxHosts=${opts.maxHosts}`);
  }

  const set = new Set<string>();
  try {
    for (const c of include) {
      for (const ip of expandCidr(c, opts.maxHosts)) {
        if (opts.requirePrivate !== false && !isPrivateIpv4(ip) && ip !== '127.0.0.1') {
          errors.push(`Refusing non-private target ${ip} outside lab loopback (fail-closed)`);
          continue;
        }
        if (exclude.some((ex) => ipInCidr(ip, ex))) continue;
        if (deny.some((d) => ipInCidr(ip, d))) continue;
        set.add(ip);
      }
    }
  } catch (e: any) {
    errors.push(e?.message || String(e));
  }

  if (set.size > opts.maxHosts) {
    errors.push(`Expanded target count ${set.size} exceeds maxHosts=${opts.maxHosts}`);
  }

  if (estimated > 256) {
    warnings.push('Large range — administrator confirmation recommended before start');
  }

  return {
    ok: errors.length === 0,
    targets: [...set],
    estimatedHosts: set.size,
    errors,
    warnings,
  };
}

export function assertIpInAuthorizedScopes(
  ip: string,
  includeCidrs: string[],
  excludeCidrs: string[] = [],
): void {
  if (excludeCidrs.some((c) => ipInCidr(ip, c))) {
    throw new Error(`Target ${ip} is in an excluded range — DO NOT SCAN`);
  }
  if (!includeCidrs.some((c) => ipInCidr(ip, c))) {
    throw new Error(`Target ${ip} is outside authorized include scopes — DO NOT SCAN`);
  }
}
