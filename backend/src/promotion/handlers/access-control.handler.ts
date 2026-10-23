import { randomBytes } from 'crypto';
import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import {
  remapOrgProject,
  resolveGroupIdByName,
  resolveRoleIdByName,
  resolveUserIdByEmail,
  writeLogicalSnapshot,
} from './promo-utils';

/**
 * Access Control — role definitions + type-wide permission matrix.
 * Resource-scoped grants (Dev UUIDs) are stripped.
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

    const applyMode = ctx.childApplyMode || 'replace';
    const perms = (portable.children?.role_permissions || []) as Record<string, unknown>[];

    if (applyMode === 'merge') {
      // Union by resource_type + permission_type; keep Prod-only type-wide grants.
      const { data: existingPerms } = await target
        .from('role_permissions')
        .select('id, resource_type, permission_type, resource_id')
        .eq('role_id', roleId)
        .is('resource_id', null);
      const existingKeys = new Set(
        (existingPerms || []).map(
          (p) => `${String(p.resource_type || '').toLowerCase()}::${String(p.permission_type || '').toLowerCase()}`,
        ),
      );
      for (const p of perms) {
        const key = `${String(p.resource_type || '').toLowerCase()}::${String(p.permission_type || '').toLowerCase()}`;
        if (existingKeys.has(key)) continue;
        const { error: pErr } = await target.from('role_permissions').insert({
          role_id: roleId,
          resource_type: p.resource_type,
          resource_id: null,
          permission_type: p.permission_type,
        });
        if (pErr && !/duplicate|unique/i.test(pErr.message)) {
          return { status: 'failed' as const, error: `role_permissions merge: ${pErr.message}` };
        }
        existingKeys.add(key);
      }
    } else {
      await target.from('role_permissions').delete().eq('role_id', roleId);
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
    }

    return { status: 'succeeded' as const, prodAfter: { id: roleId, ...row, childApplyMode: applyMode } };
  }
}

/**
 * Organization users — profile + assigned role names (matched by email on Prod).
 * Never copies passwords. New Prod users get a random password (must reset / invite).
 */
export class OrgUserHandler implements PromotableHandler {
  readonly objectType = 'org_user' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source
      .from('user_profiles')
      .select('id, email, first_name, last_name, role, status, organization_id, updated_at');
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('email');
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    return (data || []).map((row) => {
      const display =
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email;
      return {
        objectType: 'org_user' as const,
        objectId: row.id,
        stableId: String(row.email || '').trim().toLowerCase(),
        name: display,
        module: 'Access Control' as const,
        organizationId: row.organization_id,
        updatedAt: row.updated_at,
        devVersion: versionFromPayload(
          { email: row.email, role: row.role, status: row.status },
          row.updated_at,
        ),
      };
    });
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: user, error } = await source.from('user_profiles').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load user: ${error.message}`);
    if (!user) return null;

    const { data: assignments } = await source
      .from('user_role_assignments')
      .select('role_id, roles!inner(name)')
      .eq('user_id', objectId);
    const roleNames = (assignments || [])
      .map((a: any) => a.roles?.name)
      .filter((n: unknown): n is string => typeof n === 'string' && !!n.trim());

    // Optional project memberships for remap
    const { data: projectMemberships } = await source
      .from('project_users')
      .select('project_id, role')
      .eq('user_id', objectId);

    const portable: Record<string, unknown> = {
      email: String(user.email || '').trim().toLowerCase(),
      first_name: user.first_name,
      last_name: user.last_name,
      mobile: user.mobile,
      gender: user.gender,
      nationality: user.nationality,
      timezone: user.timezone,
      role: user.role || 'user',
      status: user.status || 'active',
      assigned_role_names: roleNames,
      _dev_organization_id: user.organization_id,
      _dev_user_id: user.id,
      _dev_project_memberships: (projectMemberships || []).map((m) => ({
        project_id: m.project_id,
        role: m.role,
      })),
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('org_user', portable);
    const version = versionFromPayload(cleaned, user.updated_at);

    return {
      objectType: 'org_user',
      objectId: user.id,
      stableId: cleaned.email as string,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || (cleaned.email as string),
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      children: { assigned_roles: roleNames.map((n) => ({ name: n })) },
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]> {
    const deps: DependencyRef[] = [];
    const roleNames = (portable.portable.assigned_role_names as string[]) || [];
    const orgId = portable.portable._dev_organization_id as string | undefined;
    for (const name of roleNames) {
      let q = source.from('roles').select('id, name, organization_id').eq('name', name);
      if (orgId) q = q.eq('organization_id', orgId);
      const { data } = await q.maybeSingle();
      if (data) {
        deps.push({
          objectType: 'role',
          objectId: data.id,
          stableId: `${data.organization_id}:${data.name}`,
          name: data.name,
          reason: `User is assigned role "${data.name}"`,
          required: false,
        });
      }
    }
    return deps;
  }

  async findInTarget(
    target: SbClient,
    portable: PortableObject,
    _ctx: TransferContext,
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
    const email = String(portable.portable.email || portable.stableId || '').trim().toLowerCase();
    if (!email) return { exists: false, version: null, contentHash: null };
    const { data } = await target
      .from('user_profiles')
      .select('id, email, first_name, last_name, updated_at')
      .ilike('email', email)
      .maybeSingle();
    if (!data) return { exists: false, version: null, contentHash: null };
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || data.email;
    return {
      exists: true,
      version: versionFromPayload({ email: data.email }, data.updated_at),
      contentHash: null,
      name,
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
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'org_user');

    const email = String(portable.portable.email || '').trim().toLowerCase();
    if (!email) return { status: 'failed' as const, error: 'User email is required' };

    const { organizationId, projectId } = remapOrgProject(portable.portable, ctx);
    if (!organizationId) {
      return { status: 'failed' as const, error: 'PROMOTION_PROD_ORG_ID required to promote users' };
    }

    const existing = await this.findInTarget(target, portable, ctx, null);
    let userId = existing.id;

    const profileRow = {
      email,
      first_name: portable.portable.first_name ?? null,
      last_name: portable.portable.last_name ?? null,
      mobile: portable.portable.mobile ?? null,
      gender: portable.portable.gender ?? null,
      nationality: portable.portable.nationality ?? null,
      timezone: portable.portable.timezone ?? null,
      role: portable.portable.role || 'user',
      status: portable.portable.status || 'active',
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };

    if (!userId) {
      // Create auth user on Prod (no Dev password copied)
      const tempPassword = randomBytes(24).toString('base64url');
      const { data: authData, error: authErr } = await target.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: profileRow.first_name,
          last_name: profileRow.last_name,
          organization_id: organizationId,
          role: profileRow.role,
          promoted_from_dev: true,
        },
      });
      if (authErr || !authData.user?.id) {
        // Maybe already exists in auth but not profile — try lookup by email again
        const byEmail = await resolveUserIdByEmail(target, email);
        if (!byEmail) {
          return { status: 'failed' as const, error: `auth.createUser: ${authErr?.message || 'no user id'}` };
        }
        userId = byEmail;
      } else {
        userId = authData.user.id;
      }

      const { data: existingProfile } = await target
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (existingProfile) {
        const { error } = await target.from('user_profiles').update(profileRow).eq('id', userId);
        if (error) return { status: 'failed' as const, error: error.message };
      } else {
        const { error } = await target.from('user_profiles').insert({
          ...profileRow,
          id: userId,
          created_at: new Date().toISOString(),
        });
        if (error) return { status: 'failed' as const, error: error.message };
      }
    } else {
      const { error } = await target.from('user_profiles').update(profileRow).eq('id', userId);
      if (error) return { status: 'failed' as const, error: error.message };
    }

    // Sync role assignments by role name
    const applyMode = ctx.childApplyMode || 'replace';
    const roleNames = (portable.portable.assigned_role_names as string[]) || [];
    if (applyMode === 'merge') {
      // Append missing Dev roles; keep Prod-only assignments.
      const { data: existingAssigns } = await target
        .from('user_role_assignments')
        .select('role_id')
        .eq('user_id', userId);
      const have = new Set((existingAssigns || []).map((a) => String(a.role_id)));
      for (const roleName of roleNames) {
        const roleId = await resolveRoleIdByName(target, organizationId, roleName);
        if (!roleId || have.has(roleId)) continue;
        const { error: aErr } = await target.from('user_role_assignments').insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: ctx.actorId,
          assigned_at: new Date().toISOString(),
        });
        if (aErr && !/duplicate|unique/i.test(aErr.message)) {
          return { status: 'failed' as const, error: `user_role_assignments merge: ${aErr.message}` };
        }
        have.add(roleId);
      }
    } else {
      await target.from('user_role_assignments').delete().eq('user_id', userId);
      for (const roleName of roleNames) {
        const roleId = await resolveRoleIdByName(target, organizationId, roleName);
        if (!roleId) continue;
        const { error: aErr } = await target.from('user_role_assignments').insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: ctx.actorId,
          assigned_at: new Date().toISOString(),
        });
        if (aErr && !/duplicate|unique/i.test(aErr.message)) {
          return { status: 'failed' as const, error: `user_role_assignments: ${aErr.message}` };
        }
      }
    }

    // Ensure membership on mapped package project when available
    if (projectId && userId) {
      const { data: pu } = await target
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!pu) {
        const memberships = (portable.portable._dev_project_memberships as any[]) || [];
        const mapped = memberships.find((m) => ctx.projectMap[String(m.project_id)] === projectId);
        await target.from('project_users').insert({
          project_id: projectId,
          user_id: userId,
          role: mapped?.role || 'member',
        });
      }
    }

    return {
      status: 'succeeded' as const,
      prodAfter: { id: userId, ...profileRow, assigned_role_names: roleNames, childApplyMode: applyMode },
    };
  }
}

/**
 * Groups — definition, role assignments (by name), memberships (users by email / nested groups by name).
 */
export class GroupHandler implements PromotableHandler {
  readonly objectType = 'group' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source.from('groups').select('id, name, organization_id, role_id, updated_at');
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list groups: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'group' as const,
      objectId: row.id,
      stableId: `${row.organization_id}:${row.name}`,
      name: row.name,
      module: 'Access Control' as const,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: group, error } = await source.from('groups').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load group: ${error.message}`);
    if (!group) return null;

    let legacyRoleName: string | null = null;
    if (group.role_id) {
      const { data: role } = await source.from('roles').select('name').eq('id', group.role_id).maybeSingle();
      legacyRoleName = role?.name || null;
    }

    const { data: roleAssigns } = await source
      .from('group_role_assignments')
      .select('role_id, roles!inner(name)')
      .eq('group_id', objectId);
    const roleNames = Array.from(
      new Set(
        [
          ...(roleAssigns || []).map((a: any) => a.roles?.name).filter(Boolean),
          ...(legacyRoleName ? [legacyRoleName] : []),
        ].filter((n): n is string => typeof n === 'string'),
      ),
    );

    const { data: memberships } = await source
      .from('group_memberships')
      .select('member_id, member_type')
      .eq('group_id', objectId);

    const memberRefs: Array<{ type: 'user' | 'group'; email?: string; name?: string }> = [];
    for (const m of memberships || []) {
      if (m.member_type === 'user') {
        const { data: u } = await source.from('user_profiles').select('email').eq('id', m.member_id).maybeSingle();
        if (u?.email) memberRefs.push({ type: 'user', email: String(u.email).trim().toLowerCase() });
      } else if (m.member_type === 'group') {
        const { data: g } = await source.from('groups').select('name').eq('id', m.member_id).maybeSingle();
        if (g?.name) memberRefs.push({ type: 'group', name: g.name });
      }
    }

    const portable: Record<string, unknown> = {
      name: group.name,
      role_names: roleNames,
      members: memberRefs,
      _dev_organization_id: group.organization_id,
      _legacy_role_name: legacyRoleName,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('group', portable);
    const version = versionFromPayload(cleaned, group.updated_at);

    return {
      objectType: 'group',
      objectId: group.id,
      stableId: `${group.organization_id}:${group.name}`,
      name: group.name,
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      children: { members: memberRefs, roles: roleNames.map((n) => ({ name: n })) },
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]> {
    const deps: DependencyRef[] = [];
    const orgId = portable.portable._dev_organization_id as string | undefined;
    const roleNames = (portable.portable.role_names as string[]) || [];
    for (const name of roleNames) {
      let q = source.from('roles').select('id, name, organization_id').eq('name', name);
      if (orgId) q = q.eq('organization_id', orgId);
      const { data } = await q.maybeSingle();
      if (data) {
        deps.push({
          objectType: 'role',
          objectId: data.id,
          stableId: `${data.organization_id}:${data.name}`,
          name: data.name,
          reason: `Group is assigned role "${data.name}"`,
          required: false,
        });
      }
    }
    const members = (portable.portable.members as Array<{ type: string; email?: string; name?: string }>) || [];
    for (const m of members) {
      if (m.type === 'user' && m.email) {
        const { data: u } = await source
          .from('user_profiles')
          .select('id, email, first_name, last_name, organization_id')
          .ilike('email', m.email)
          .maybeSingle();
        if (u) {
          const display = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
          deps.push({
            objectType: 'org_user',
            objectId: u.id,
            stableId: String(u.email).trim().toLowerCase(),
            name: display,
            reason: `Group member ${display}`,
            required: false,
          });
        }
      } else if (m.type === 'group' && m.name) {
        let q = source.from('groups').select('id, name, organization_id').eq('name', m.name);
        if (orgId) q = q.eq('organization_id', orgId);
        const { data: g } = await q.maybeSingle();
        if (g && g.id !== portable.objectId) {
          deps.push({
            objectType: 'group',
            objectId: g.id,
            stableId: `${g.organization_id}:${g.name}`,
            name: g.name,
            reason: `Nested group member "${g.name}"`,
            required: false,
          });
        }
      }
    }
    return deps;
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
      .from('groups')
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
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'group');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const { organizationId } = remapOrgProject(portable.portable, ctx);
    if (!organizationId) {
      return { status: 'failed' as const, error: 'PROMOTION_PROD_ORG_ID required to promote groups' };
    }

    const roleNames = (portable.portable.role_names as string[]) || [];
    const primaryRoleId =
      (roleNames[0] && (await resolveRoleIdByName(target, organizationId, roleNames[0]))) || null;

    const row = {
      name: portable.portable.name,
      organization_id: organizationId,
      role_id: primaryRoleId,
      updated_at: new Date().toISOString(),
    };

    let groupId = existing.id;
    if (existing.exists && groupId) {
      const { error } = await target.from('groups').update(row).eq('id', groupId);
      if (error) return { status: 'failed' as const, error: error.message };
    } else {
      const { data, error } = await target
        .from('groups')
        .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) return { status: 'failed' as const, error: error.message };
      groupId = data.id;
    }

    const applyMode = ctx.childApplyMode || 'replace';
    const members = (portable.portable.members as Array<{ type: string; email?: string; name?: string }>) || [];

    if (applyMode === 'merge') {
      // Append missing roles / members; keep Prod-only extras.
      const { data: existingRoles } = await target
        .from('group_role_assignments')
        .select('role_id')
        .eq('group_id', groupId);
      const haveRoles = new Set((existingRoles || []).map((r) => String(r.role_id)));
      for (const roleName of roleNames) {
        const roleId = await resolveRoleIdByName(target, organizationId, roleName);
        if (!roleId || haveRoles.has(roleId)) continue;
        const { error: rErr } = await target.from('group_role_assignments').insert({
          group_id: groupId,
          role_id: roleId,
          assigned_by: ctx.actorId,
        });
        if (rErr && !/duplicate|unique/i.test(rErr.message)) {
          return { status: 'failed' as const, error: `group_role_assignments merge: ${rErr.message}` };
        }
        haveRoles.add(roleId);
      }

      const { data: existingMembers } = await target
        .from('group_memberships')
        .select('member_id, member_type')
        .eq('group_id', groupId);
      const haveMembers = new Set(
        (existingMembers || []).map((m) => `${m.member_type}:${m.member_id}`),
      );
      for (const m of members) {
        let memberId: string | null = null;
        if (m.type === 'user') memberId = await resolveUserIdByEmail(target, m.email);
        else if (m.type === 'group') memberId = await resolveGroupIdByName(target, organizationId, m.name);
        if (!memberId) continue;
        const key = `${m.type}:${memberId}`;
        if (haveMembers.has(key)) continue;
        const { error: mErr } = await target.from('group_memberships').insert({
          group_id: groupId,
          member_id: memberId,
          member_type: m.type,
          added_by: ctx.actorId,
          added_at: new Date().toISOString(),
        });
        if (mErr && !/duplicate|unique/i.test(mErr.message)) {
          return { status: 'failed' as const, error: `group_memberships merge: ${mErr.message}` };
        }
        haveMembers.add(key);
      }
    } else {
      // Sync multi-role assignments
      await target.from('group_role_assignments').delete().eq('group_id', groupId);
      for (const roleName of roleNames) {
        const roleId = await resolveRoleIdByName(target, organizationId, roleName);
        if (!roleId) continue;
        const { error: rErr } = await target.from('group_role_assignments').insert({
          group_id: groupId,
          role_id: roleId,
          assigned_by: ctx.actorId,
        });
        if (rErr && !/duplicate|unique/i.test(rErr.message)) {
          return { status: 'failed' as const, error: `group_role_assignments: ${rErr.message}` };
        }
      }

      // Sync memberships (users by email, nested groups by name — skip unresolved)
      await target.from('group_memberships').delete().eq('group_id', groupId);
      for (const m of members) {
        let memberId: string | null = null;
        if (m.type === 'user') memberId = await resolveUserIdByEmail(target, m.email);
        else if (m.type === 'group') memberId = await resolveGroupIdByName(target, organizationId, m.name);
        if (!memberId) continue;
        const { error: mErr } = await target.from('group_memberships').insert({
          group_id: groupId,
          member_id: memberId,
          member_type: m.type,
          added_by: ctx.actorId,
          added_at: new Date().toISOString(),
        });
        if (mErr && !/duplicate|unique/i.test(mErr.message)) {
          return { status: 'failed' as const, error: `group_memberships: ${mErr.message}` };
        }
      }
    }

    return {
      status: 'succeeded' as const,
      prodAfter: { id: groupId, ...row, role_names: roleNames, members, childApplyMode: applyMode },
    };
  }
}
