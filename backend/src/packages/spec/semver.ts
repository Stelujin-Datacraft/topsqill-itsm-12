// Generated from packages/package-spec/src by scripts/sync-package-spec.mjs. Do not edit.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export function parseVersion(version: string): ParsedVersion | null {
  const match = SEMVER.exec(String(version).trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

export function isValidVersion(version: string): boolean {
  return parseVersion(version) !== null;
}

/** Negative when a < b, 0 when equal, positive when a > b. Throws on invalid versions. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`Invalid version: ${!pa ? a : b}`);
  for (const part of ['major', 'minor', 'patch'] as const) {
    if (pa[part] !== pb[part]) return pa[part] - pb[part];
  }
  if (!pa.prerelease.length || !pb.prerelease.length) return pb.prerelease.length - pa.prerelease.length;
  for (let i = 0; i < Math.max(pa.prerelease.length, pb.prerelease.length); i++) {
    const x = pa.prerelease[i];
    const y = pb.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x) ? Number(x) : null;
    const ny = /^\d+$/.test(y) ? Number(y) : null;
    if (nx !== null && ny !== null && nx !== ny) return nx - ny;
    if (nx !== null && ny === null) return -1;
    if (nx === null && ny !== null) return 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
