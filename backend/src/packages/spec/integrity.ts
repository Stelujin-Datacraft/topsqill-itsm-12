// Generated from packages/package-spec/src by scripts/sync-package-spec.mjs. Do not edit.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign as edSign, verify as edVerify } from 'crypto';
import type { PackageFile, PackageSignature } from './types';

/** JSON with object keys sorted at every level, so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(',')}}`;
}

/** Covers everything except the integrity and signature blocks themselves. */
export function computeChecksum(pkg: Pick<PackageFile, 'format' | 'formatVersion' | 'manifest' | 'objects'>): string {
  const body = { format: pkg.format, formatVersion: pkg.formatVersion, manifest: pkg.manifest, objects: pkg.objects };
  return createHash('sha256').update(canonicalJson(body)).digest('hex');
}

export function generateSigningKeys(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

export function signChecksum(checksum: string, privateKeyPem: string, keyId: string): PackageSignature {
  const value = edSign(null, Buffer.from(checksum, 'utf8'), createPrivateKey(privateKeyPem)).toString('base64');
  return { algorithm: 'ed25519', keyId, value };
}

export type IntegrityResult =
  | { ok: true; signed: boolean; keyId: string | null }
  | { ok: false; reason: 'checksum_mismatch' | 'unsigned' | 'unknown_key' | 'bad_signature'; message: string };

/**
 * Checks the checksum always; checks the signature against trusted public keys (keyId -> PEM).
 * With `requireSignature` an unsigned package is rejected.
 */
export function verifyIntegrity(
  pkg: PackageFile,
  trustedKeys: Record<string, string>,
  options: { requireSignature: boolean },
): IntegrityResult {
  const checksum = computeChecksum(pkg);
  if (!pkg.integrity || pkg.integrity.checksum !== checksum) {
    return { ok: false, reason: 'checksum_mismatch', message: 'The package contents do not match its checksum. It may have been edited or damaged.' };
  }
  if (!pkg.signature) {
    if (options.requireSignature) return { ok: false, reason: 'unsigned', message: 'The package is not signed by a trusted publisher.' };
    return { ok: true, signed: false, keyId: null };
  }
  const publicKey = trustedKeys[pkg.signature.keyId];
  if (!publicKey) {
    return { ok: false, reason: 'unknown_key', message: `The package is signed with an unknown key (${pkg.signature.keyId}).` };
  }
  const valid = edVerify(null, Buffer.from(checksum, 'utf8'), createPublicKey(publicKey), Buffer.from(pkg.signature.value, 'base64'));
  if (!valid) return { ok: false, reason: 'bad_signature', message: 'The package signature is not valid.' };
  return { ok: true, signed: true, keyId: pkg.signature.keyId };
}
