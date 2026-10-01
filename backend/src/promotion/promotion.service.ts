import { Injectable, Logger } from '@nestjs/common';
import { exportPlatformPackage, type ExportInput } from './exporter';
import { applyImport, planImport, verifyRoundTrip } from './importer';
import { validatePackage } from './package';
import { PromotionNamespaceStore } from './store';
import type { DryRunResult, ImportResult, PlatformPackage } from './types';

/**
 * DEV-only platform promotion foundation.
 * Does NOT provision QA/PROD. Round-trips only into isolated promotion-test-* namespaces.
 */
@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);
  private readonly store = new PromotionNamespaceStore();
  private readonly audits: ImportResult['audit'][] = [];

  createTestNamespace(name: string, organizationLogicalKey = 'dev.org') {
    const nsName = name.startsWith('promotion-test-') ? name : `promotion-test-${name}`;
    const ns = this.store.createNamespace({
      name: nsName,
      organizationLogicalKey,
    });
    this.logger.log(`Created isolated DEV namespace ${ns.name}`);
    return { id: ns.id, name: ns.name, organizationLogicalKey: ns.organizationLogicalKey };
  }

  listNamespaces() {
    return this.store.list().map((n) => ({
      id: n.id,
      name: n.name,
      organizationLogicalKey: n.organizationLogicalKey,
      recordCount: n.records.size,
      createdAt: n.createdAt,
    }));
  }

  exportPackage(input: ExportInput): PlatformPackage {
    return exportPlatformPackage(input);
  }

  validate(pkg: PlatformPackage) {
    return validatePackage(pkg);
  }

  dryRun(pkg: PlatformPackage, targetNamespaceId: string): DryRunResult {
    return planImport(pkg, this.store, targetNamespaceId);
  }

  importPackage(
    pkg: PlatformPackage,
    targetNamespaceId: string,
    opts: { dryRun: boolean; initiatedBy: string; approvedBy?: string | null },
  ): ImportResult {
    const result = applyImport(pkg, this.store, targetNamespaceId, opts);
    this.audits.push(result.audit);
    return result;
  }

  verify(pkg: PlatformPackage, targetNamespaceId: string) {
    return verifyRoundTrip(pkg, this.store, targetNamespaceId);
  }

  /**
   * Full DEV round-trip: export → validate → dry-run → import into isolated namespace → verify.
   * Does not touch live projects.
   */
  roundTrip(input: ExportInput, initiatedBy = 'system') {
    const pkg = this.exportPackage(input);
    const validation = this.validate(pkg);
    const ns = this.createTestNamespace(
      `${input.packageKey}-v${input.version.replace(/\./g, '-')}-${Date.now()}`,
    );
    const dry = this.dryRun(pkg, ns.id);
    const imported = this.importPackage(pkg, ns.id, {
      dryRun: false,
      initiatedBy,
    });
    const verified = this.verify(pkg, ns.id);
    return {
      environment: 'DEV' as const,
      package: pkg,
      validation,
      namespace: ns,
      dryRun: dry,
      import: imported,
      verified,
    };
  }

  listAudits() {
    return [...this.audits];
  }

  /** Test helper */
  getStore(): PromotionNamespaceStore {
    return this.store;
  }

  resetForTests() {
    this.store.reset();
    this.audits.length = 0;
  }
}
