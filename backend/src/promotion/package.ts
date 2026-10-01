/**
 * Versioned platform package build / validate.
 */
import { createHash, randomUUID } from 'crypto';
import { scrubSecrets, assertNoSecrets } from './secrets';
import { isValidLogicalKey, normalizeLogicalKey } from './logical-keys';
import type {
  ComponentKind,
  PackagedComponent,
  PackageManifest,
  PlatformPackage,
} from './types';

const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i;

export function fingerprintDefinition(definition: Record<string, unknown>): string {
  const stable = JSON.stringify(sortKeys(definition));
  return createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

export function buildManifest(input: {
  key: string;
  version: string;
  displayName?: string;
  description?: string;
  createdBy?: string;
  components: ComponentKind[];
  logicalKeys: string[];
}): PackageManifest {
  const key = normalizeLogicalKey(input.key);
  if (!isValidLogicalKey(key)) throw new Error(`Invalid package key: ${input.key}`);
  if (!SEMVER_RE.test(input.version)) throw new Error(`Invalid semver: ${input.version}`);
  return {
    package: {
      key,
      version: input.version,
      displayName: input.displayName,
      description: input.description,
      sourceEnvironment: 'DEV',
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    },
    requires: {
      platformVersion: '>=1.0.0',
    },
    components: [...new Set(input.components)],
    logicalKeys: [...new Set(input.logicalKeys.map(normalizeLogicalKey))],
  };
}

export function buildPackage(components: PackagedComponent[], manifestInput: {
  key: string;
  version: string;
  displayName?: string;
  description?: string;
  createdBy?: string;
}): PlatformPackage {
  const scrubbed = components.map((c) => ({
    ...c,
    key: normalizeLogicalKey(c.key),
    definition: scrubSecrets(c.definition),
    dependsOn: c.dependsOn.map((d) => ({ ...d, key: normalizeLogicalKey(d.key) })),
  }));

  for (const c of scrubbed) {
    if (!isValidLogicalKey(c.key)) throw new Error(`Invalid component key: ${c.key}`);
  }

  const dup = findDuplicateKeys(scrubbed);
  if (dup.length) throw new Error(`Duplicate logical keys: ${dup.join(', ')}`);

  const pkg: PlatformPackage = {
    manifest: buildManifest({
      ...manifestInput,
      components: scrubbed.map((c) => c.kind),
      logicalKeys: scrubbed.map((c) => c.key),
    }),
    components: scrubbed,
  };

  const violations = assertNoSecrets(pkg);
  if (violations.length) {
    throw new Error(`Package contains secrets: ${violations.slice(0, 5).join('; ')}`);
  }
  return pkg;
}

function findDuplicateKeys(components: PackagedComponent[]): string[] {
  const seen = new Map<string, number>();
  for (const c of components) {
    const k = `${c.kind}:${c.key}`;
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

export function validatePackage(pkg: PlatformPackage): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!pkg?.manifest?.package?.key) errors.push('manifest.package.key required');
  if (!pkg?.manifest?.package?.version || !SEMVER_RE.test(pkg.manifest.package.version)) {
    errors.push('manifest.package.version must be semver');
  }
  if (pkg.manifest?.package?.sourceEnvironment !== 'DEV') {
    errors.push('This phase only accepts sourceEnvironment=DEV');
  }
  if (!Array.isArray(pkg.components)) errors.push('components array required');

  const keys = new Set<string>();
  for (const c of pkg.components || []) {
    if (!isValidLogicalKey(c.key)) errors.push(`invalid key: ${c.key}`);
    const id = `${c.kind}:${c.key}`;
    if (keys.has(id)) errors.push(`duplicate: ${id}`);
    keys.add(id);
    if (c.classification === 'SECRET') {
      errors.push(`${id}: SECRET classification must not be packaged`);
    }
    if (c.classification === 'TRANSACTIONAL_DATA') {
      errors.push(`${id}: TRANSACTIONAL_DATA must not be packaged`);
    }
  }

  // dependency presence
  for (const c of pkg.components || []) {
    for (const dep of c.dependsOn || []) {
      const found = pkg.components.some((x) => x.key === dep.key && (!dep.kind || x.kind === dep.kind));
      // soft: dependency may exist outside package (platform); only flag if same package claims it
      if (!found && pkg.manifest.logicalKeys.includes(dep.key)) {
        // listed but missing body
        errors.push(`${c.key}: listed dependency missing body: ${dep.key}`);
      }
    }
  }

  errors.push(...assertNoSecrets(pkg));
  return { ok: errors.length === 0, errors };
}

export function newAuditId(): string {
  return randomUUID();
}
