import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PromotionEnvironmentService } from './environments';
import {
  PROMOTABLE_REGISTRY,
  NON_PROMOTABLE_CATEGORIES,
  listModules,
  isRegisteredPromotable,
} from './registry/promotable-registry';
import type {
  DependencyRef,
  PortableObject,
  PromotableObjectType,
  TransferContext,
  ValidationFinding,
} from './registry/types';
import { getHandler, listHandlers } from './handlers';
import { PROMOTION_SCHEMA_SQL } from './schema.sql';
import { assertPromotionalTransferAllowed } from './promotion-access';

function makePromotionId(): string {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PROMO-${stamp}-${rand}`;
}

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly environments: PromotionEnvironmentService,
  ) {}

  private db() {
    return this.supabaseService.getServiceClient();
  }

  private schemaReady: boolean | null = null;

  /** Ensure promotion tables exist (migration or exec_sql fallback). */
  async ensureSchema(): Promise<{ ok: boolean; message: string }> {
    if (this.schemaReady) return { ok: true, message: 'ready' };
    const db = this.db();
    const { error: probe } = await db.from('promotion_packages').select('id').limit(1);
    if (!probe) {
      this.schemaReady = true;
      return { ok: true, message: 'tables present' };
    }
    const { error: rpcErr } = await db.rpc('exec_sql' as any, { sql: PROMOTION_SCHEMA_SQL } as any);
    if (!rpcErr) {
      const { error: reprobe } = await db.from('promotion_packages').select('id').limit(1);
      if (!reprobe) {
        this.schemaReady = true;
        return { ok: true, message: 'tables created via exec_sql' };
      }
    }
    this.logger.warn(
      `promotion tables missing (${probe.message}). Apply migration 20261006120000_promotional_transfer.sql`,
    );
    return {
      ok: false,
      message:
        'Promotion tables are not available. Apply supabase/migrations/20261006120000_promotional_transfer.sql',
    };
  }

  private async assertAdmin(userId: string) {
    // Defense in depth: every service entry path re-checks deployment gate
    // (in addition to PromotionalTransferEnabledGuard on the controller).
    try {
      assertPromotionalTransferAllowed(process.env, {
        sourceKey: this.environments.getSourceKey(),
        targetKey: this.environments.getTargetKey(),
      });
    } catch (e: any) {
      throw new ForbiddenException(e?.message || 'Promotional Transfer is not available');
    }

    const { data, error } = await this.db()
      .from('user_profiles')
      .select('role, organization_id')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      this.logger.warn(`admin check failed: ${error.message}`);
      throw new ForbiddenException('Unable to verify System Administrator role');
    }
    if (data?.role !== 'admin') {
      throw new ForbiddenException('System Administrator role required');
    }
    return data;
  }

  private async audit(
    packageId: string | null,
    eventType: string,
    actorId: string | null,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    await this.db().from('promotion_audit_events').insert({
      package_id: packageId,
      event_type: eventType,
      actor_id: actorId,
      message,
      details,
    });
  }

  async getDashboard(userId: string) {
    await this.assertAdmin(userId);
    const schema = await this.ensureSchema();
    const db = this.db();
    let recent: any[] = [];
    if (schema.ok) {
      const { data: packages } = await db
        .from('promotion_packages')
        .select('id, status, created_at, name, module, promotion_id')
        .order('created_at', { ascending: false })
        .limit(50);
      recent = packages || [];
    }

    const counts = {
      total: recent.length,
      completed: recent.filter((p) => p.status === 'Completed').length,
      failed: recent.filter((p) => p.status === 'Failed' || p.status === 'PartiallyCompleted').length,
      inProgress: recent.filter((p) => ['Draft', 'Validating', 'Ready', 'Promoting'].includes(p.status)).length,
    };

    const promotableObjectTypes = PROMOTABLE_REGISTRY.length;
    const lastPromotion = recent[0]?.created_at || null;

    return {
      counts,
      promotableObjectTypes,
      lastPromotion,
      recent: recent.slice(0, 10),
      environments: this.environments.getEnvironments(),
      registrySize: PROMOTABLE_REGISTRY.length,
      nonPromotableCategories: NON_PROMOTABLE_CATEGORIES,
      schema,
    };
  }

  async getEnvironments(userId: string) {
    await this.assertAdmin(userId);
    return {
      source: this.environments.getSourceKey(),
      target: this.environments.getTargetKey(),
      supportedFlow: 'Dev → Prod',
      environments: this.environments.getEnvironments(),
    };
  }

  async getRegistry(userId: string) {
    await this.assertAdmin(userId);
    return {
      objects: PROMOTABLE_REGISTRY,
      modules: listModules(),
      nonPromotableCategories: NON_PROMOTABLE_CATEGORIES,
    };
  }

  async getModules(userId: string) {
    await this.assertAdmin(userId);
    return { modules: listModules() };
  }

  async listObjects(
    userId: string,
    query: { module?: string; objectType?: string; projectId?: string; organizationId?: string },
  ) {
    await this.assertAdmin(userId);
    const source = this.environments.getSourceClient();
    const target = this.environments.getTargetClient();
    const dual = this.environments.isDualDb();
    const mode = dual ? 'dual_supabase' : 'logical_snapshot';

    let types = listHandlers().map((h) => h.objectType);
    if (query.objectType) {
      if (!isRegisteredPromotable(query.objectType)) {
        throw new BadRequestException(`Object type "${query.objectType}" is not promotable`);
      }
      types = [query.objectType as PromotableObjectType];
    } else if (query.module) {
      types = PROMOTABLE_REGISTRY.filter((e) => e.module === query.module).map((e) => e.objectType);
    }

    const results = [];
    for (const type of types) {
      const handler = getHandler(type);
      const listed = await handler.list(source, {
        projectId: query.projectId,
        organizationId: query.organizationId,
      });

      for (const obj of listed) {
        let prodVersion: string | null = null;
        let conflictStatus: string = 'unknown';
        let eligibility = 'eligible';

        try {
          const portable = await handler.loadPortable(source, obj.objectId);
          if (!portable) {
            eligibility = 'not_loadable';
          } else {
            let logical: any = null;
            if (mode === 'logical_snapshot') {
              const { data } = await this.db()
                .from('promotion_target_snapshots')
                .select('version, content_hash, payload')
                .eq('object_type', type)
                .eq('stable_id', portable.stableId)
                .maybeSingle();
              if (data) {
                logical = {
                  version: data.version,
                  contentHash: data.content_hash,
                  payload: data.payload,
                };
              }
            }
            const found = await handler.findInTarget(
              target,
              portable,
              {
                packageId: '',
                actorId: userId,
                sourceKey: this.environments.getSourceKey(),
                targetKey: this.environments.getTargetKey(),
                projectMap: this.environments.getProjectMap(),
                dualDb: dual,
              },
              logical,
            );
            prodVersion = found.version;
            if (!found.exists) conflictStatus = 'new';
            else if (found.contentHash && found.contentHash === portable.contentHash) conflictStatus = 'identical';
            else conflictStatus = 'differs';
            obj.devVersion = portable.version;
          }
        } catch (e: any) {
          eligibility = 'error';
          conflictStatus = e?.message || 'error';
        }

        const entry = PROMOTABLE_REGISTRY.find((r) => r.objectType === type)!;
        results.push({
          ...obj,
          objectType: type,
          objectTypeName: entry.displayName,
          module: entry.module,
          prodVersion,
          conflictStatus,
          eligibility,
          hasDependencies: entry.hasDependencies,
        });
      }
    }

    return { objects: results, transferMode: mode };
  }

  async listPackages(userId: string) {
    await this.assertAdmin(userId);
    const { data, error } = await this.db()
      .from('promotion_packages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new BadRequestException(error.message);
    return { packages: data || [] };
  }

  async getPackage(userId: string, id: string) {
    await this.assertAdmin(userId);
    const { data: pkg, error } = await this.db().from('promotion_packages').select('*').eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!pkg) throw new NotFoundException('Promotion package not found');

    const { data: items } = await this.db()
      .from('promotion_package_items')
      .select('*')
      .eq('package_id', id)
      .order('sort_order');
    const { data: validations } = await this.db()
      .from('promotion_validation_results')
      .select('*')
      .eq('package_id', id)
      .order('created_at');
    const { data: audit } = await this.db()
      .from('promotion_audit_events')
      .select('*')
      .eq('package_id', id)
      .order('created_at', { ascending: true });

    return {
      package: pkg,
      items: items || [],
      validations: validations || [],
      audit: audit || [],
      environments: this.environments.getEnvironments(),
    };
  }

  async createPackage(
    userId: string,
    body: { name: string; module: string; projectId?: string; organizationId?: string; notes?: string },
  ) {
    const profile = await this.assertAdmin(userId);
    const schema = await this.ensureSchema();
    if (!schema.ok) throw new BadRequestException(schema.message);
    if (!body.name?.trim()) throw new BadRequestException('Promotion name is required');
    if (!body.module?.trim()) throw new BadRequestException('Module is required');

    const modules = listModules().map((m) => m.module);
    if (!modules.includes(body.module as any)) {
      throw new BadRequestException(`Module "${body.module}" has no promotable objects`);
    }

    const promotionId = makePromotionId();
    const row = {
      promotion_id: promotionId,
      name: body.name.trim(),
      source_environment: this.environments.getSourceKey(),
      target_environment: this.environments.getTargetKey(),
      module: body.module,
      status: 'Draft',
      organization_id: body.organizationId || profile.organization_id || null,
      project_id: body.projectId || null,
      created_by: userId,
      notes: body.notes || null,
    };

    const { data, error } = await this.db().from('promotion_packages').insert(row).select('*').single();
    if (error) throw new BadRequestException(error.message);

    await this.audit(data.id, 'created', userId, `Created promotion package ${promotionId}`, {
      module: body.module,
      name: body.name,
    });

    return { package: data };
  }

  async setSelection(
    userId: string,
    packageId: string,
    body: {
      selections: Array<{ objectType: string; objectId: string; stableId?: string; objectName?: string }>;
    },
  ) {
    await this.assertAdmin(userId);
    const detail = await this.getPackage(userId, packageId);
    const pkg = detail.package;
    if (!['Draft', 'Ready', 'Failed'].includes(pkg.status)) {
      throw new BadRequestException(`Cannot change selection while status is ${pkg.status}`);
    }

    const selections = body.selections || [];
    for (const s of selections) {
      if (!isRegisteredPromotable(s.objectType)) {
        throw new BadRequestException(`Object type "${s.objectType}" is not promotable and cannot be selected`);
      }
    }

    // Clear previous items & validations
    await this.db().from('promotion_package_items').delete().eq('package_id', packageId);
    await this.db().from('promotion_validation_results').delete().eq('package_id', packageId);

    const source = this.environments.getSourceClient();
    const items = [];
    let order = 0;
    for (const s of selections) {
      const handler = getHandler(s.objectType);
      const portable = await handler.loadPortable(source, s.objectId);
      if (!portable) {
        throw new BadRequestException(`Could not load ${s.objectType} ${s.objectId} from Dev`);
      }
      const entry = PROMOTABLE_REGISTRY.find((e) => e.objectType === s.objectType)!;
      items.push({
        package_id: packageId,
        object_type: portable.objectType,
        object_id: portable.objectId,
        stable_id: portable.stableId,
        object_name: portable.name,
        module: entry.module,
        selection_source: 'explicit',
        included: true,
        dev_version: portable.version,
        portable_payload: {
          ...portable.portable,
          children: portable.children,
          contentHash: portable.contentHash,
          envSpecificStripped: portable.envSpecificStripped,
        },
        sort_order: order++,
      });
    }

    if (items.length) {
      const { error } = await this.db().from('promotion_package_items').insert(items);
      if (error) throw new BadRequestException(error.message);
    }

    await this.db()
      .from('promotion_packages')
      .update({ status: 'Draft', updated_at: new Date().toISOString(), validation_summary: {} })
      .eq('id', packageId);

    await this.audit(packageId, 'selection_set', userId, `Selected ${items.length} object(s)`, {
      count: items.length,
      types: selections.map((s) => s.objectType),
    });

    return this.getPackage(userId, packageId);
  }

  async resolveDependencies(userId: string, packageId: string, body?: { includeStableIds?: string[] }) {
    await this.assertAdmin(userId);
    const detail = await this.getPackage(userId, packageId);
    const source = this.environments.getSourceClient();
    const includeSet = new Set(body?.includeStableIds || []);

    const explicit = (detail.items || []).filter((i: any) => i.selection_source === 'explicit' && i.included);
    const selectedKeys = new Set(explicit.map((i: any) => `${i.object_type}:${i.stable_id}`));

    const missing: Array<DependencyRef & { selected: boolean }> = [];
    const toAdd: any[] = [];

    for (const item of explicit) {
      const handler = getHandler(item.object_type);
      const portable = await handler.loadPortable(source, item.object_id);
      if (!portable) continue;
      const deps = await handler.discoverDependencies(source, portable);
      for (const dep of deps) {
        const key = `${dep.objectType}:${dep.stableId}`;
        if (selectedKeys.has(key)) continue;
        const alreadyListed = missing.find((m) => m.objectType === dep.objectType && m.stableId === dep.stableId);
        if (!alreadyListed) {
          missing.push({ ...dep, selected: includeSet.has(dep.stableId) });
        }
        if (includeSet.has(dep.stableId) || includeSet.has(key)) {
          if (![...selectedKeys].includes(key) && !toAdd.find((t) => t.stable_id === dep.stableId && t.object_type === dep.objectType)) {
            const depHandler = getHandler(dep.objectType);
            const depPortable = await depHandler.loadPortable(source, dep.objectId);
            if (!depPortable) continue;
            const entry = PROMOTABLE_REGISTRY.find((e) => e.objectType === dep.objectType)!;
            toAdd.push({
              package_id: packageId,
              object_type: depPortable.objectType,
              object_id: depPortable.objectId,
              stable_id: depPortable.stableId,
              object_name: depPortable.name,
              module: entry.module,
              selection_source: 'dependency',
              included: true,
              dev_version: depPortable.version,
              dependency_of: `${item.object_type}:${item.stable_id}`,
              portable_payload: {
                ...depPortable.portable,
                children: depPortable.children,
                contentHash: depPortable.contentHash,
                envSpecificStripped: depPortable.envSpecificStripped,
              },
              sort_order: 0,
            });
            selectedKeys.add(key);
          }
        }
      }
    }

    // Remove previous dependency items not re-included
    await this.db()
      .from('promotion_package_items')
      .delete()
      .eq('package_id', packageId)
      .eq('selection_source', 'dependency');

    if (toAdd.length) {
      // Dependencies first in sort order
      toAdd.forEach((t, i) => {
        t.sort_order = i;
      });
      const { error } = await this.db().from('promotion_package_items').insert(toAdd);
      if (error) throw new BadRequestException(error.message);
      // Bump explicit items sort order
      const { data: explicits } = await this.db()
        .from('promotion_package_items')
        .select('id')
        .eq('package_id', packageId)
        .eq('selection_source', 'explicit');
      let o = toAdd.length;
      for (const ex of explicits || []) {
        await this.db().from('promotion_package_items').update({ sort_order: o++ }).eq('id', ex.id);
      }
    }

    await this.audit(packageId, 'dependencies_resolved', userId, `Resolved dependencies`, {
      missing: missing.length,
      included: toAdd.length,
    });

    const refreshed = await this.getPackage(userId, packageId);
    return {
      ...refreshed,
      missingDependencies: missing.filter((m) => !includeSet.has(m.stableId)),
      includedDependencies: toAdd.map((t) => ({
        objectType: t.object_type,
        stableId: t.stable_id,
        name: t.object_name,
      })),
    };
  }

  async validate(userId: string, packageId: string) {
    await this.assertAdmin(userId);
    const detail = await this.getPackage(userId, packageId);
    const items = (detail.items || []).filter((i: any) => i.included);
    if (!items.length) throw new BadRequestException('Select at least one promotable object before validation');

    await this.db()
      .from('promotion_packages')
      .update({ status: 'Validating', updated_at: new Date().toISOString() })
      .eq('id', packageId);

    await this.db().from('promotion_validation_results').delete().eq('package_id', packageId);

    const source = this.environments.getSourceClient();
    const target = this.environments.getTargetClient();
    const dual = this.environments.isDualDb();
    const mode = dual ? 'dual_supabase' : 'logical_snapshot';
    const findings: ValidationFinding[] = [];
    const selectedKeys = new Set(items.map((i: any) => `${i.object_type}:${i.stable_id}`));

    const ctx: TransferContext = {
      packageId,
      actorId: userId,
      sourceKey: this.environments.getSourceKey(),
      targetKey: this.environments.getTargetKey(),
      organizationId: detail.package.organization_id,
      projectId: detail.package.project_id,
      targetOrganizationId: this.environments.getTargetOrganizationId(),
      projectMap: this.environments.getProjectMap(),
      dualDb: dual,
    };

    for (const item of items) {
      if (!isRegisteredPromotable(item.object_type)) {
        findings.push({
          objectType: item.object_type,
          stableId: item.stable_id,
          severity: 'conflict',
          code: 'UNSUPPORTED_TYPE',
          message: `Object type "${item.object_type}" is not supported for promotion`,
        });
        continue;
      }

      const handler = getHandler(item.object_type);
      let portable: PortableObject | null = null;
      try {
        portable = await handler.loadPortable(source, item.object_id);
      } catch (e: any) {
        findings.push({
          objectType: item.object_type,
          stableId: item.stable_id,
          severity: 'conflict',
          code: 'LOAD_FAILED',
          message: e?.message || 'Failed to load object from Dev',
        });
        continue;
      }
      if (!portable) {
        findings.push({
          objectType: item.object_type,
          stableId: item.stable_id,
          severity: 'conflict',
          code: 'NOT_FOUND_DEV',
          message: `${item.object_name} no longer exists in Dev`,
        });
        continue;
      }

      let itemStatus: 'ready' | 'warning' | 'conflict' = 'ready';
      const messages: string[] = [];

      // Missing dependencies
      const deps = await handler.discoverDependencies(source, portable);
      for (const dep of deps.filter((d) => d.required)) {
        const key = `${dep.objectType}:${dep.stableId}`;
        if (!selectedKeys.has(key)) {
          itemStatus = 'conflict';
          findings.push({
            objectType: item.object_type,
            stableId: item.stable_id,
            severity: 'conflict',
            code: 'MISSING_DEPENDENCY',
            message: `${item.object_name} requires ${dep.name} (${dep.objectType}). ${dep.name} is not currently selected.`,
            details: { dependency: dep },
          });
        }
      }

      let logical: any = null;
      if (mode === 'logical_snapshot') {
        const { data } = await this.db()
          .from('promotion_target_snapshots')
          .select('version, content_hash, payload')
          .eq('object_type', item.object_type)
          .eq('stable_id', portable.stableId)
          .maybeSingle();
        if (data) {
          logical = { version: data.version, contentHash: data.content_hash, payload: data.payload };
        }
      }

      const found = await handler.findInTarget(target, portable, ctx, logical);

      if (!found.exists) {
        findings.push({
          objectType: item.object_type,
          stableId: item.stable_id,
          severity: 'ready',
          code: 'NEW_IN_PROD',
          message: `${item.object_name} is new in Production and can be created`,
        });
        messages.push('New in Production');
      } else if (found.contentHash && found.contentHash === portable.contentHash) {
        findings.push({
          objectType: item.object_type,
          stableId: item.stable_id,
          severity: 'ready',
          code: 'IDENTICAL',
          message: `${item.object_name} is identical in Production (will be skipped)`,
        });
        messages.push('Identical — will skip');
      } else {
        if (itemStatus !== 'conflict') itemStatus = 'warning';
        findings.push({
          objectType: item.object_type,
          stableId: item.stable_id,
          severity: 'warning',
          code: 'WILL_UPDATE',
          message: `${item.object_name} exists in Production (Dev ${portable.version} vs Prod ${found.version}) and will be updated`,
          details: { devVersion: portable.version, prodVersion: found.version },
        });
        messages.push('Exists in Production — will update');
      }

      if (portable.envSpecificStripped?.length) {
        // Preserve conflict when missing dependencies; otherwise surface as warning
        itemStatus = itemStatus === 'conflict' ? 'conflict' : 'warning';
        findings.push({
          objectType: item.object_type,
          stableId: item.stable_id,
          severity: 'warning',
          code: 'ENV_SPECIFIC_STRIPPED',
          message: `Environment-specific values will not be copied from Dev: ${portable.envSpecificStripped.join(', ')}`,
          details: { stripped: portable.envSpecificStripped },
        });
      }

      // Name collision with different stable id
      if (found.exists && found.name && found.name === portable.name && found.id && found.id !== portable.objectId) {
        // same name ok if matched by stable id
      }

      await this.db()
        .from('promotion_package_items')
        .update({
          validation_status: itemStatus,
          validation_messages: messages,
          prod_version: found.version,
          prod_before_snapshot: found.exists ? { version: found.version, id: found.id, name: found.name } : null,
          portable_payload: {
            ...portable.portable,
            children: portable.children,
            contentHash: portable.contentHash,
            envSpecificStripped: portable.envSpecificStripped,
          },
          dev_version: portable.version,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    }

    if (findings.length) {
      await this.db().from('promotion_validation_results').insert(
        findings.map((f) => ({
          package_id: packageId,
          object_type: f.objectType || null,
          stable_id: f.stableId || null,
          severity: f.severity,
          code: f.code,
          message: f.message,
          details: f.details || {},
        })),
      );
    }

    const ready = findings.filter((f) => f.severity === 'ready').length;
    const warnings = findings.filter((f) => f.severity === 'warning').length;
    const conflicts = findings.filter((f) => f.severity === 'conflict').length;
    const summary = {
      ready,
      warnings,
      conflicts,
      selected: items.filter((i: any) => i.selection_source === 'explicit').length,
      dependencies: items.filter((i: any) => i.selection_source === 'dependency').length,
      totalItems: items.length,
      transferMode: mode,
    };

    const nextStatus = conflicts > 0 ? 'Failed' : 'Ready';
    await this.db()
      .from('promotion_packages')
      .update({
        status: nextStatus === 'Failed' ? 'Draft' : 'Ready',
        validation_summary: summary,
        validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Keep Draft if conflicts so admin can fix selection; Ready only when clean
        ...(conflicts > 0
          ? { status: 'Draft', error_details: { validationConflicts: conflicts } }
          : { status: 'Ready', error_details: null }),
      })
      .eq('id', packageId);

    await this.audit(packageId, 'validated', userId, `Validation complete: ${ready} ready, ${warnings} warnings, ${conflicts} conflicts`, summary);

    return this.getPackage(userId, packageId);
  }

  async getSummary(userId: string, packageId: string) {
    const detail = await this.getPackage(userId, packageId);
    const items = (detail.items || []).filter((i: any) => i.included);
    const validations = detail.validations || [];
    const newObjects = items.filter((i: any) => !i.prod_version).length;
    const toUpdate = items.filter((i: any) => i.prod_version && i.validation_status === 'warning').length;
    return {
      source: detail.package.source_environment,
      target: detail.package.target_environment,
      module: detail.package.module,
      selectedObjects: items.filter((i: any) => i.selection_source === 'explicit').length,
      dependencies: items.filter((i: any) => i.selection_source === 'dependency').length,
      newObjects,
      objectsToUpdate: toUpdate,
      warnings: validations.filter((v: any) => v.severity === 'warning').length,
      conflicts: validations.filter((v: any) => v.severity === 'conflict').length,
      status: detail.package.status,
      transferMode: this.environments.isDualDb() ? 'dual_supabase' : 'logical_snapshot',
      items,
      package: detail.package,
    };
  }

  async execute(userId: string, packageId: string) {
    await this.assertAdmin(userId);
    const detail = await this.getPackage(userId, packageId);
    const pkg = detail.package;

    if (pkg.status !== 'Ready') {
      throw new BadRequestException('Promotion must be validated and Ready before execution');
    }

    const conflicts = (detail.validations || []).filter((v: any) => v.severity === 'conflict');
    if (conflicts.length) {
      throw new BadRequestException('Cannot promote while conflicts remain');
    }

    const items = (detail.items || []).filter((i: any) => i.included);
    if (!items.length) throw new BadRequestException('No objects to promote');

    const dual = this.environments.isDualDb();
    const mode = dual ? 'dual_supabase' : 'logical_snapshot';
    const source = this.environments.getSourceClient();
    const target = this.environments.getTargetClient();

    const ctx: TransferContext = {
      packageId,
      actorId: userId,
      sourceKey: this.environments.getSourceKey(),
      targetKey: this.environments.getTargetKey(),
      organizationId: pkg.organization_id,
      projectId: pkg.project_id,
      targetOrganizationId: this.environments.getTargetOrganizationId(),
      projectMap: this.environments.getProjectMap(),
      dualDb: dual,
    };

    await this.db()
      .from('promotion_packages')
      .update({
        status: 'Promoting',
        execution_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', packageId);

    await this.audit(packageId, 'execution_started', userId, 'Promotion execution started', { mode, count: items.length });

    // Dependency items first (lower sort_order)
    const ordered = [...items].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const item of ordered) {
      await this.db()
        .from('promotion_package_items')
        .update({ execution_status: 'promoting', updated_at: new Date().toISOString() })
        .eq('id', item.id);

      try {
        const handler = getHandler(item.object_type);
        const portable = await handler.loadPortable(source, item.object_id);
        if (!portable) {
          failed++;
          await this.db()
            .from('promotion_package_items')
            .update({
              execution_status: 'failed',
              execution_error: 'Object missing in Dev at execution time',
            })
            .eq('id', item.id);
          results.push({ stableId: item.stable_id, status: 'failed', error: 'missing in Dev' });
          continue;
        }

        let logical: any = null;
        if (mode === 'logical_snapshot') {
          const { data } = await this.db()
            .from('promotion_target_snapshots')
            .select('version, content_hash, payload')
            .eq('object_type', item.object_type)
            .eq('stable_id', portable.stableId)
            .maybeSingle();
          if (data) {
            logical = { version: data.version, contentHash: data.content_hash, payload: data.payload };
          }
        }

        const found = await handler.findInTarget(target, portable, ctx, logical);
        if (found.exists && found.contentHash && found.contentHash === portable.contentHash) {
          skipped++;
          await this.db()
            .from('promotion_package_items')
            .update({
              execution_status: 'identical',
              prod_version: found.version,
            })
            .eq('id', item.id);
          results.push({ stableId: item.stable_id, status: 'identical' });
          continue;
        }

        const transferResult = await handler.transfer(source, target, portable, ctx, mode);
        if (transferResult.status === 'failed') {
          failed++;
          await this.db()
            .from('promotion_package_items')
            .update({
              execution_status: 'failed',
              execution_error: transferResult.error || 'Transfer failed',
            })
            .eq('id', item.id);
          results.push({ stableId: item.stable_id, status: 'failed', error: transferResult.error });
          // Stop on hard failure to avoid unknown Prod state cascades
          break;
        }

        succeeded++;
        await this.db()
          .from('promotion_package_items')
          .update({
            execution_status: transferResult.status === 'identical' ? 'identical' : 'succeeded',
            prod_after_snapshot: transferResult.prodAfter || null,
            prod_version: portable.version,
          })
          .eq('id', item.id);

        await this.db().from('promotion_object_versions').insert({
          object_type: item.object_type,
          stable_id: portable.stableId,
          environment: this.environments.getTargetKey(),
          version: portable.version,
          content_hash: portable.contentHash,
          package_id: packageId,
          promoted_by: userId,
          metadata: {
            name: portable.name,
            previousProdVersion: found.version,
            mode,
          },
        });

        results.push({ stableId: item.stable_id, status: 'succeeded' });
      } catch (e: any) {
        failed++;
        const msg = e?.message || 'Unexpected transfer error';
        await this.db()
          .from('promotion_package_items')
          .update({ execution_status: 'failed', execution_error: msg })
          .eq('id', item.id);
        results.push({ stableId: item.stable_id, status: 'failed', error: msg });
        break;
      }
    }

    // Mark remaining unfinished items as skipped if we stopped early
    const { data: stillPending } = await this.db()
      .from('promotion_package_items')
      .select('id, execution_status')
      .eq('package_id', packageId)
      .eq('included', true);

    for (const row of stillPending || []) {
      if (!row.execution_status || row.execution_status === 'pending' || row.execution_status === 'promoting') {
        await this.db()
          .from('promotion_package_items')
          .update({ execution_status: 'skipped', execution_error: 'Skipped due to earlier failure' })
          .eq('id', row.id);
        skipped++;
      }
    }

    let finalStatus: string = 'Completed';
    if (failed > 0 && succeeded > 0) finalStatus = 'PartiallyCompleted';
    else if (failed > 0 && succeeded === 0) finalStatus = 'Failed';

    const promotionSummary = {
      succeeded,
      failed,
      skipped,
      total: items.length,
      mode,
      results,
    };

    await this.db()
      .from('promotion_packages')
      .update({
        status: finalStatus,
        execution_ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        promotion_summary: promotionSummary,
        error_details: failed ? { failed, results: results.filter((r) => r.status === 'failed') } : null,
      })
      .eq('id', packageId);

    await this.audit(packageId, 'execution_finished', userId, `Promotion ${finalStatus}`, promotionSummary);

    return this.getPackage(userId, packageId);
  }
}
