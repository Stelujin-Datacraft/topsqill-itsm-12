import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import { remapOrgProject, writeLogicalSnapshot } from './promo-utils';

/**
 * IT Asset categories — taxonomy config only.
 * Never promotes it_assets, discovery hosts/runs, or sync history.
 */
export class AssetCategoryHandler implements PromotableHandler {
  readonly objectType = 'asset_category' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source.from('asset_categories').select('id, name, organization_id, description, icon, parent_id, created_at');
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list asset_categories: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'asset_category' as const,
      objectId: row.id,
      stableId: `${row.organization_id}:${row.name}`,
      name: row.name,
      module: 'IT Asset' as const,
      organizationId: row.organization_id,
      updatedAt: row.created_at,
      devVersion: versionFromPayload({ name: row.name, icon: row.icon }, row.created_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: cat, error } = await source.from('asset_categories').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load asset_category: ${error.message}`);
    if (!cat) return null;

    let parentName: string | null = null;
    if (cat.parent_id) {
      const { data: parent } = await source
        .from('asset_categories')
        .select('name')
        .eq('id', cat.parent_id)
        .maybeSingle();
      parentName = parent?.name || null;
    }

    const portable: Record<string, unknown> = {
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      _dev_organization_id: cat.organization_id,
      _parent_name: parentName,
      _dev_parent_id: cat.parent_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('asset_category', portable);
    const version = versionFromPayload(cleaned, cat.created_at);

    return {
      objectType: 'asset_category',
      objectId: cat.id,
      stableId: `${cat.organization_id}:${cat.name}`,
      name: cat.name,
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]> {
    const parentId = portable.portable._dev_parent_id as string | undefined;
    if (!parentId) return [];
    const { data } = await source
      .from('asset_categories')
      .select('id, name, organization_id')
      .eq('id', parentId)
      .maybeSingle();
    if (!data) return [];
    return [
      {
        objectType: 'asset_category',
        objectId: data.id,
        stableId: `${data.organization_id}:${data.name}`,
        name: data.name,
        reason: 'Parent asset category',
        required: false,
      },
    ];
  }

  async findInTarget(
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    logicalSnapshot?: { version: string; contentHash: string; payload: Record<string, unknown> } | null,
  ) {
    if (logicalSnapshot) {
      return {
        exists: true,
        version: logicalSnapshot.version,
        contentHash: logicalSnapshot.contentHash,
        name: String((logicalSnapshot.payload as any)?.name || portable.name),
      };
    }
    const { organizationId } = remapOrgProject(portable.portable, ctx);
    if (!organizationId) return { exists: false, version: null, contentHash: null };
    const { data } = await target
      .from('asset_categories')
      .select('id, name, created_at')
      .eq('organization_id', organizationId)
      .eq('name', portable.name)
      .maybeSingle();
    if (!data) return { exists: false, version: null, contentHash: null };
    return {
      exists: true,
      version: versionFromPayload({ name: data.name }, data.created_at),
      contentHash: null,
      name: data.name,
      id: data.id,
    };
  }

  async transfer(
    _source: SbClient,
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    mode: 'dual_supabase' | 'logical_snapshot',
  ) {
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'asset_category');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const { organizationId } = remapOrgProject(portable.portable, ctx);
    if (!organizationId) {
      return { status: 'failed' as const, error: 'PROMOTION_PROD_ORG_ID required to promote asset categories' };
    }

    let parentId: string | null = null;
    const parentName = portable.portable._parent_name as string | undefined;
    if (parentName) {
      const { data: parent } = await target
        .from('asset_categories')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('name', parentName)
        .maybeSingle();
      parentId = parent?.id || null;
    }

    const row = {
      name: portable.portable.name,
      description: portable.portable.description ?? null,
      icon: portable.portable.icon || 'Monitor',
      organization_id: organizationId,
      parent_id: parentId,
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('asset_categories').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row } };
    }

    const { data, error } = await target.from('asset_categories').insert(row).select('id').single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}

/**
 * ITAM form-sync mapping definitions (field maps) — config only.
 * Does NOT promote sync runs, history, links, provenance, or credentialed targets.
 */
export class ItamSyncMappingHandler implements PromotableHandler {
  readonly objectType = 'itam_sync_mapping' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source
      .from('itam_sync_mappings')
      .select('id, name, organization_id, target_form_id, status, version, updated_at');
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list itam_sync_mappings: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'itam_sync_mapping' as const,
      objectId: row.id,
      stableId: `${row.organization_id}:${row.name}`,
      name: row.name,
      module: 'IT Asset' as const,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload(
        { name: row.name, status: row.status, version: row.version },
        row.updated_at,
      ),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: mapping, error } = await source
      .from('itam_sync_mappings')
      .select('*')
      .eq('id', objectId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load itam_sync_mapping: ${error.message}`);
    if (!mapping) return null;

    const portable: Record<string, unknown> = {
      name: mapping.name,
      target_form_id: mapping.target_form_id,
      version: mapping.version,
      status: mapping.status,
      mappings: mapping.mappings,
      matching_source_fields: mapping.matching_source_fields,
      matching_target_fields: mapping.matching_target_fields,
      mapping_source: mapping.mapping_source,
      confidence: mapping.confidence,
      reasoning: mapping.reasoning,
      _dev_organization_id: mapping.organization_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('itam_sync_mapping', portable);
    const version = versionFromPayload(cleaned, mapping.updated_at);

    return {
      objectType: 'itam_sync_mapping',
      objectId: mapping.id,
      stableId: `${mapping.organization_id}:${mapping.name}`,
      name: mapping.name,
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(): Promise<DependencyRef[]> {
    return [];
  }

  async findInTarget(
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    logicalSnapshot?: { version: string; contentHash: string; payload: Record<string, unknown> } | null,
  ) {
    if (logicalSnapshot) {
      return {
        exists: true,
        version: logicalSnapshot.version,
        contentHash: logicalSnapshot.contentHash,
        name: String((logicalSnapshot.payload as any)?.name || portable.name),
      };
    }
    const { organizationId } = remapOrgProject(portable.portable, ctx);
    if (!organizationId) return { exists: false, version: null, contentHash: null };
    const { data } = await target
      .from('itam_sync_mappings')
      .select('id, name, updated_at')
      .eq('organization_id', organizationId)
      .eq('name', portable.name)
      .maybeSingle();
    if (!data) return { exists: false, version: null, contentHash: null };
    return {
      exists: true,
      version: versionFromPayload({ name: data.name }, data.updated_at),
      contentHash: null,
      name: data.name,
      id: data.id,
    };
  }

  async transfer(
    _source: SbClient,
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    mode: 'dual_supabase' | 'logical_snapshot',
  ) {
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'itam_sync_mapping');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const { organizationId } = remapOrgProject(portable.portable, ctx);
    if (!organizationId) {
      return { status: 'failed' as const, error: 'PROMOTION_PROD_ORG_ID required to promote ITAM sync mappings' };
    }

    const row = {
      name: portable.portable.name,
      organization_id: organizationId,
      target_form_id: portable.portable.target_form_id,
      version: portable.portable.version || 1,
      status: portable.portable.status || 'DRAFT',
      mappings: portable.portable.mappings || [],
      matching_source_fields: portable.portable.matching_source_fields || [],
      matching_target_fields: portable.portable.matching_target_fields || [],
      mapping_source: portable.portable.mapping_source || 'DETERMINISTIC',
      confidence: portable.portable.confidence ?? null,
      reasoning: portable.portable.reasoning ?? null,
      // Clear approval metadata — Prod must re-approve
      approved_by: null,
      approved_at: null,
      updated_at: new Date().toISOString(),
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('itam_sync_mappings').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row } };
    }

    const { data, error } = await target
      .from('itam_sync_mappings')
      .insert({ ...row, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}
