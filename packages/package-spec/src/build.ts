import { computeChecksum, signChecksum } from './integrity';
import { PACKAGE_FORMAT, PACKAGE_FORMAT_VERSION, type PackageFile, type PackageManifest, type PackageObject } from './types';
import { validatePackage } from './validate';

export interface Signer {
  keyId: string;
  privateKeyPem: string;
}

/** Orders objects predictably, adds the checksum, signs when a signer is given, and validates. */
export function buildPackage(manifest: PackageManifest, objects: PackageObject[], signer?: Signer | null): PackageFile {
  const order = { solution: 0, form: 1, workflow: 2, report: 3 } as const;
  const sorted = [...objects].sort((a, b) => order[a.type] - order[b.type] || a.key.localeCompare(b.key));
  const body = { format: PACKAGE_FORMAT, formatVersion: PACKAGE_FORMAT_VERSION, manifest, objects: sorted } as const;
  const checksum = computeChecksum(body);
  const pkg: PackageFile = {
    ...body,
    integrity: { algorithm: 'sha256', checksum },
    signature: signer ? signChecksum(checksum, signer.privateKeyPem, signer.keyId) : null,
  };
  const result = validatePackage(pkg);
  if (!result.ok) throw new Error(`Invalid package: ${result.errors.join('; ')}`);
  return pkg;
}

export function packageFileName(manifest: Pick<PackageManifest, 'key' | 'version'>): string {
  return `${manifest.key}-${manifest.version}.tpkg.json`;
}
