import { Injectable, Logger } from '@nestjs/common';
import { exportPlatformPackage, type ExportInput } from './exporter';
import { applyImport, planImport, verifyRoundTrip } from './importer';
import { validatePackage } from './package';
import { PromotionNamespaceStore } from './store';
import {
  applyPromotionSchema,
  applyPgImport,
  backfillFormFieldKeysPg,
  countPromotionRows,
  ensureIsolatedTarget,
  getPromotionDatabaseUrl,
  planPgImport,
  snapshotDbState,
  verifyPgRoundTrip,
  closePromotionPool,
} from './pg-persistence';
import { PlatformPgSecretProvider } from './platform-secret-provider';
import { loadAndMigrateConnectorsFromPg, scanAuthConfigForSecrets } from './connector-credentials';
import { getPromotionPool } from './pg-persistence';
import type { DryRunResult, ImportResult, PlatformPackage } from './types';

/**
 * Platform promotion service.
 * - memory: isolated promotion-test-* namespaces (unit)
 * - postgres: real PostgreSQL persistence via PROMOTION_DATABASE_URL
 */
@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);
  private readonly store = new PromotionNamespaceStore();
  private readonly audits: ImportResult['audit'][] = [];
  private mode: 'memory' | 'postgres' =
    process.env.PROMOTION_PERSISTENCE === 'postgres' || getPromotionDatabaseUrl()
      ? 'postgres'
      : 'memory';

  persistenceMode(): 'memory' | 'postgres' {
    return this.mode;
  }

  async initializePersistence(opts?: { mode?: 'memory' | 'postgres'; applySchema?: boolean }) {
    if (opts?.mode === 'memory') {
      this.mode = 'memory';
      return;
    }
    if (opts?.mode === 'postgres' || getPromotionDatabaseUrl()) {
      this.mode = 'postgres';
      if (opts?.applySchema !== false) {
        await applyPromotionSchema();
        this.logger.log('Promotion PostgreSQL schema applied');
      }
    }
  }

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

  async dryRun(
    pkg: PlatformPackage,
    target: { namespaceId?: string; organizationLogicalKey?: string; projectLogicalKey?: string; namespace?: string },
  ): Promise<DryRunResult> {
    if (this.mode === 'postgres' && (target.namespace || target.organizationLogicalKey)) {
      const ctx = await ensureIsolatedTarget({
        organizationLogicalKey: target.organizationLogicalKey || 'promotion.dev.org',
        projectLogicalKey: target.projectLogicalKey || pkg.manifest.package.key,
        namespace: target.namespace || `promotion-test-${pkg.manifest.package.key}`,
      });
      const before = await snapshotDbState(ctx);
      const plan = await planPgImport(pkg, ctx);
      const after = await snapshotDbState(ctx);
      if (before !== after) {
        throw new Error('Dry-run mutated database state — aborting');
      }
      return plan;
    }
    if (!target.namespaceId) throw new Error('namespaceId required for memory dry-run');
    return planImport(pkg, this.store, target.namespaceId);
  }

  async importPackage(
    pkg: PlatformPackage,
    target: {
      namespaceId?: string;
      organizationLogicalKey?: string;
      projectLogicalKey?: string;
      namespace?: string;
    },
    opts: { dryRun: boolean; initiatedBy: string; approvedBy?: string | null },
  ): Promise<ImportResult> {
    if (this.mode === 'postgres' && (target.namespace || target.organizationLogicalKey)) {
      const ctx = await ensureIsolatedTarget({
        organizationLogicalKey: target.organizationLogicalKey || 'promotion.dev.org',
        projectLogicalKey: target.projectLogicalKey || pkg.manifest.package.key,
        namespace: target.namespace || `promotion-test-${pkg.manifest.package.key}`,
      });
      const result = await applyPgImport(pkg, ctx, opts);
      this.audits.push(result.audit);
      return result;
    }
    if (!target.namespaceId) throw new Error('namespaceId required for memory import');
    const result = applyImport(pkg, this.store, target.namespaceId, opts);
    this.audits.push(result.audit);
    return result;
  }

  async verify(
    pkg: PlatformPackage,
    target: { namespaceId?: string; organizationLogicalKey?: string; projectLogicalKey?: string; namespace?: string },
  ) {
    if (this.mode === 'postgres' && (target.namespace || target.organizationLogicalKey)) {
      const ctx = await ensureIsolatedTarget({
        organizationLogicalKey: target.organizationLogicalKey || 'promotion.dev.org',
        projectLogicalKey: target.projectLogicalKey || pkg.manifest.package.key,
        namespace: target.namespace || `promotion-test-${pkg.manifest.package.key}`,
      });
      return verifyPgRoundTrip(pkg, ctx);
    }
    if (!target.namespaceId) throw new Error('namespaceId required');
    return verifyRoundTrip(pkg, this.store, target.namespaceId);
  }

  /**
   * Full round-trip with real PostgreSQL when PROMOTION_DATABASE_URL is set.
   */
  async roundTrip(input: ExportInput, initiatedBy = 'system') {
    const pkg = this.exportPackage(input);
    const validation = this.validate(pkg);

    if (this.mode === 'postgres') {
      await this.initializePersistence({ mode: 'postgres' });
      const nsName = `promotion-test-${input.packageKey}-v${input.version.replace(/\./g, '-')}-${Date.now()}`;
      const ctx = await ensureIsolatedTarget({
        organizationLogicalKey: `org.${input.packageKey}`,
        projectLogicalKey: input.packageKey,
        namespace: nsName,
      });
      const beforeDry = await snapshotDbState(ctx);
      const dry = await planPgImport(pkg, ctx);
      const afterDry = await snapshotDbState(ctx);
      if (beforeDry !== afterDry) throw new Error('Dry-run wrote to database');

      const imported = await applyPgImport(pkg, ctx, { dryRun: false, initiatedBy });
      const verified = await verifyPgRoundTrip(pkg, ctx);
      const counts = await countPromotionRows(ctx);

      // Idempotent second dry-run
      const second = await planPgImport(pkg, ctx);

      // Restart persistence simulation: close pool and re-verify
      await closePromotionPool();
      await this.initializePersistence({ mode: 'postgres', applySchema: false });
      const ctx2 = await ensureIsolatedTarget({
        organizationLogicalKey: `org.${input.packageKey}`,
        projectLogicalKey: input.packageKey,
        namespace: nsName,
      });
      const afterRestart = await verifyPgRoundTrip(pkg, ctx2);

      return {
        environment: 'DEV' as const,
        persistence: 'postgres' as const,
        package: pkg,
        validation,
        namespace: { id: ctx.projectId, name: nsName, organizationId: ctx.organizationId },
        dryRun: dry,
        import: imported,
        verified,
        counts,
        idempotentDryRun: second,
        afterRestart,
      };
    }

    const ns = this.createTestNamespace(
      `${input.packageKey}-v${input.version.replace(/\./g, '-')}-${Date.now()}`,
    );
    const dry = planImport(pkg, this.store, ns.id);
    const imported = applyImport(pkg, this.store, ns.id, { dryRun: false, initiatedBy });
    const verified = verifyRoundTrip(pkg, this.store, ns.id);
    return {
      environment: 'DEV' as const,
      persistence: 'memory' as const,
      package: pkg,
      validation,
      namespace: ns,
      dryRun: dry,
      import: imported,
      verified,
    };
  }

  async migrateConnectorSecrets(dryRun = false) {
    await this.initializePersistence({ mode: 'postgres' });
    const secrets = new PlatformPgSecretProvider(getPromotionPool());
    return loadAndMigrateConnectorsFromPg(getPromotionPool(), secrets, dryRun);
  }

  async scanConnectorSecrets() {
    await this.initializePersistence({ mode: 'postgres' });
    const db = getPromotionPool();
    const r = await db.query(`SELECT id, name, http_auth_config, credential_reference_id FROM data_source_connections`);
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      credentialReferenceId: row.credential_reference_id,
      secretFindings: scanAuthConfigForSecrets(row.http_auth_config),
    }));
  }

  async backfillFieldKeys() {
    await this.initializePersistence({ mode: 'postgres' });
    return backfillFormFieldKeysPg();
  }

  listAudits() {
    return [...this.audits];
  }

  getStore(): PromotionNamespaceStore {
    return this.store;
  }

  resetForTests() {
    this.store.reset();
    this.audits.length = 0;
  }
}
