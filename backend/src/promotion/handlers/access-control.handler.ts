import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import { remapOrgProject, writeLogicalSnapshot } from './promo-utils';

/**
 * Access Control — role definitions + permission matrix only.
 * Does NOT promote user_role_assignments or per-user project permissions.
 */
export class RoleHandler implements PromotableHandler {
  readonly objectType = 'role' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source.from('roles').select('id, name, organization_id, updated_at, description, top_level_access');
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list roles: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'role' as const,
      objectId: row.id,
      stableId: `${row.organization_id}:${row.name}`,
      name: row.name,
      module: 'Access Control' as const,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name, top_level_access: row.top_level_access }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: role, error } = await source.from('roles').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load role: ${error.message}`);
    if (!role) return null;

    const { data: perms, error: pErr } = await source.from('role_permissions').select('*').eq('role_id', objectId);
    if (pErr) throw new Error(`Failed to load role_permissions: ${pErr.message}`);

    // Drop resource-specific grants that point at Dev UUIDs (would break Prod FKs).
    // Keep type-wide permissions (resource_id IS NULL).
    const portablePerms = (perms || [])
      .filter((p) => p.resource_id == null)
      .map((p) => ({
        resource_type: p.resource_type,
        resource_id: null,
        permission_type: p.permission_type,
      }));

    const portable: Record<string, unknown> = {
      name: role.name,
      description: role.description,
      top_level_access: role.top_level_access,
      _dev_organization_id: role.organization_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('role', portable);
    const version = versionFromPayload(cleaned, role.updated_at);

    return {
      objectType: 'role',
      objectId: role.id,
      stableId: `${role.organization_id}:${role.name}`,
      name: role.name,
      version,
      contentHash: contentHash({ ...cleaned, permissions: portablePerms }),
      portable: cleaned,
      children: { role_permissions: portablePerms },
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
      .from('roles')
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
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'role');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const { organizationId } = remapOrgProject(portable.portable, ctx);
    if (!organizationId) {
      return { status: 'failed' as const, error: 'PROMOTION_PROD_ORG_ID required to promote roles' };
    }

    const row = {
      name: portable.portable.name,
      description: portable.portable.description ?? null,
      top_level_access: portable.portable.top_level_access || 'no_access',
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };

    let roleId = existing.id;
    if (existing.exists && roleId) {
      const { error } = await target.from('roles').update(row).eq('id', roleId);
      if (error) return { status: 'failed' as const, error: error.message };
    } else {
      const { data, error } = await target
        .from('roles')
        .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) return { status: 'failed' as const, error: error.message };
      roleId = data.id;
    }

    await target.from('role_permissions').delete().eq('role_id', roleId);
    const perms = (portable.children?.role_permissions || []) as Record<string, unknown>[];
    if (perms.length) {
      const inserts = perms.map((p) => ({
        role_id: roleId,
        resource_type: p.resource_type,
        resource_id: null,
        permission_type: p.permission_type,
      }));
      const { error: pErr } = await target.from('role_permissions').insert(inserts);
      if (pErr) return { status: 'failed' as const, error: `role_permissions: ${pErr.message}` };
    }

    return { status: 'succeeded' as const, prodAfter: { id: roleId, ...row } };
  }
}
