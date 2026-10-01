/**
 * Import / dry-run engine for DEV-only isolated namespaces.
 * Never modifies live DEV configuration during destructive tests.
 */
import { fingerprintDefinition, newAuditId, validatePackage } from './package';
import type { PromotionNamespaceStore } from './store';
import type {
  DiffAction,
  DiffItem,
  DryRunResult,
  ImportResult,
  PlatformPackage,
  PromotionAuditRecord,
} from './types';

const EMPTY_SUMMARY = (): Record<DiffAction, number> => ({
  CREATE: 0,
  UPDATE: 0,
  NO_CHANGE: 0,
  CONFLICT: 0,
  MISSING_DEPENDENCY: 0,
  INVALID_REFERENCE: 0,
  BLOCKED: 0,
});

function compatibleDefinitions(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  // Conflict if both claim incompatible structural kinds/types
  const aType = a.fieldType ?? a.provider ?? a.channel;
  const bType = b.fieldType ?? b.provider ?? b.channel;
  if (aType != null && bType != null && String(aType) !== String(bType)) return false;
  return true;
}

export function planImport(
  pkg: PlatformPackage,
  store: PromotionNamespaceStore,
  targetNamespaceId: string,
): DryRunResult {
  const validation = validatePackage(pkg);
  const ns = store.get(targetNamespaceId);
  if (!ns) {
    throw new Error(`Unknown target namespace: ${targetNamespaceId}`);
  }

  const items: DiffItem[] = [];
  const summary = EMPTY_SUMMARY();
  const available = new Set<string>([...ns.records.keys()]);

  // Package components also satisfy dependencies during ordered import planning
  for (const c of pkg.components) {
    available.add(`${c.kind}:${c.key}`);
  }

  if (!validation.ok) {
    for (const err of validation.errors) {
      items.push({
        kind: 'project',
        key: pkg.manifest.package.key,
        action: 'BLOCKED',
        detail: err,
      });
      summary.BLOCKED += 1;
    }
  }

  for (const c of pkg.components) {
    // dependency check against target + package
    for (const dep of c.dependsOn || []) {
      const depId = `${dep.kind}:${dep.key}`;
      const inPkg = pkg.components.some((x) => x.kind === dep.kind && x.key === dep.key);
      const inNs = !!store.getRecord(ns, dep.kind, dep.key);
      if (!inPkg && !inNs) {
        const item: DiffItem = {
          kind: c.kind,
          key: c.key,
          action: 'MISSING_DEPENDENCY',
          detail: `Missing dependency ${depId}`,
        };
        items.push(item);
        summary.MISSING_DEPENDENCY += 1;
      }
    }

    const existing = store.getRecord(ns, c.kind, c.key);
    const fp = fingerprintDefinition(c.definition);
    if (!existing) {
      items.push({
        kind: c.kind,
        key: c.key,
        action: 'CREATE',
        sourceFingerprint: fp,
      });
      summary.CREATE += 1;
      continue;
    }

    if (existing.fingerprint === fp) {
      items.push({
        kind: c.kind,
        key: c.key,
        action: 'NO_CHANGE',
        sourceFingerprint: fp,
        targetFingerprint: existing.fingerprint,
      });
      summary.NO_CHANGE += 1;
      continue;
    }

    if (!compatibleDefinitions(existing.definition, c.definition)) {
      items.push({
        kind: c.kind,
        key: c.key,
        action: 'CONFLICT',
        detail: 'Incompatible definition for same logical key',
        sourceFingerprint: fp,
        targetFingerprint: existing.fingerprint,
      });
      summary.CONFLICT += 1;
      continue;
    }

    items.push({
      kind: c.kind,
      key: c.key,
      action: 'UPDATE',
      sourceFingerprint: fp,
      targetFingerprint: existing.fingerprint,
    });
    summary.UPDATE += 1;
  }

  return {
    packageKey: pkg.manifest.package.key,
    packageVersion: pkg.manifest.package.version,
    targetNamespace: ns.name,
    environment: 'DEV',
    summary,
    items,
    wouldWrite: false,
  };
}

export function applyImport(
  pkg: PlatformPackage,
  store: PromotionNamespaceStore,
  targetNamespaceId: string,
  opts: {
    dryRun: boolean;
    initiatedBy: string;
    approvedBy?: string | null;
    /** When true, refuse to apply if any CONFLICT / MISSING_DEPENDENCY / BLOCKED */
    failOnConflict?: boolean;
  },
): ImportResult {
  const plan = planImport(pkg, store, targetNamespaceId);
  const ns = store.get(targetNamespaceId)!;
  const blocked = plan.items.filter((i) =>
    i.action === 'CONFLICT'
    || i.action === 'MISSING_DEPENDENCY'
    || i.action === 'BLOCKED'
    || i.action === 'INVALID_REFERENCE',
  );

  if (opts.dryRun) {
    const audit: PromotionAuditRecord = {
      id: newAuditId(),
      packageKey: pkg.manifest.package.key,
      packageVersion: pkg.manifest.package.version,
      sourceEnvironment: 'DEV',
      targetEnvironment: 'DEV',
      targetNamespace: ns.name,
      initiatedBy: opts.initiatedBy,
      approvedBy: opts.approvedBy ?? null,
      timestamp: new Date().toISOString(),
      result: 'DRY_RUN',
      components: plan.items,
      failures: blocked.map((b) => `${b.key}: ${b.action}${b.detail ? ` — ${b.detail}` : ''}`),
    };
    return {
      dryRun: true,
      packageKey: pkg.manifest.package.key,
      packageVersion: pkg.manifest.package.version,
      targetNamespace: ns.name,
      applied: [],
      blocked,
      audit,
    };
  }

  if ((opts.failOnConflict !== false) && blocked.length > 0) {
    const audit: PromotionAuditRecord = {
      id: newAuditId(),
      packageKey: pkg.manifest.package.key,
      packageVersion: pkg.manifest.package.version,
      sourceEnvironment: 'DEV',
      targetEnvironment: 'DEV',
      targetNamespace: ns.name,
      initiatedBy: opts.initiatedBy,
      approvedBy: opts.approvedBy ?? null,
      timestamp: new Date().toISOString(),
      result: 'FAILED',
      components: plan.items,
      failures: blocked.map((b) => `${b.key}: ${b.action}${b.detail ? ` — ${b.detail}` : ''}`),
    };
    return {
      dryRun: false,
      packageKey: pkg.manifest.package.key,
      packageVersion: pkg.manifest.package.version,
      targetNamespace: ns.name,
      applied: [],
      blocked,
      audit,
    };
  }

  const applied: DiffItem[] = [];
  for (const item of plan.items) {
    if (item.action !== 'CREATE' && item.action !== 'UPDATE') continue;
    const component = pkg.components.find((c) => c.kind === item.kind && c.key === item.key);
    if (!component) continue;
    store.upsertRecord(ns, component.kind, component.key, component.definition);
    applied.push(item);
  }

  const audit: PromotionAuditRecord = {
    id: newAuditId(),
    packageKey: pkg.manifest.package.key,
    packageVersion: pkg.manifest.package.version,
    sourceEnvironment: 'DEV',
    targetEnvironment: 'DEV',
    targetNamespace: ns.name,
    initiatedBy: opts.initiatedBy,
    approvedBy: opts.approvedBy ?? null,
    timestamp: new Date().toISOString(),
    result: blocked.length ? 'PARTIAL' : 'SUCCESS',
    components: plan.items,
    failures: blocked.map((b) => `${b.key}: ${b.action}${b.detail ? ` — ${b.detail}` : ''}`),
  };

  return {
    dryRun: false,
    packageKey: pkg.manifest.package.key,
    packageVersion: pkg.manifest.package.version,
    targetNamespace: ns.name,
    applied,
    blocked,
    audit,
  };
}

/** Compare source package vs namespace content after import. */
export function verifyRoundTrip(
  pkg: PlatformPackage,
  store: PromotionNamespaceStore,
  targetNamespaceId: string,
): { ok: boolean; mismatches: string[] } {
  const ns = store.get(targetNamespaceId);
  if (!ns) return { ok: false, mismatches: ['namespace missing'] };
  const mismatches: string[] = [];
  for (const c of pkg.components) {
    const rec = store.getRecord(ns, c.kind, c.key);
    if (!rec) {
      mismatches.push(`missing ${c.kind}:${c.key}`);
      continue;
    }
    const fp = fingerprintDefinition(c.definition);
    if (rec.fingerprint !== fp) {
      mismatches.push(`fingerprint mismatch ${c.kind}:${c.key}`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}
