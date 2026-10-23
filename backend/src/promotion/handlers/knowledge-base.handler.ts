import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import { stableIdFromRow } from './handler.types';
import {
  formStableId,
  remapOrgProject,
  resolveFormIdOnTarget,
  writeLogicalSnapshot,
} from './promo-utils';

/**
 * Knowledge Base folders — structure only.
 * Does NOT promote knowledge_base_folder_access (user/group grants are env-specific).
 */
export class KbFolderHandler implements PromotableHandler {
  readonly objectType = 'kb_folder' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source
      .from('knowledge_base_folders')
      .select('id, name, project_id, organization_id, updated_at, description');
    if (opts.projectId) q = q.eq('project_id', opts.projectId);
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list knowledge_base_folders: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'kb_folder' as const,
      objectId: row.id,
      stableId: `${row.project_id}:${row.name}`,
      name: row.name,
      module: 'Knowledge Base' as const,
      projectId: row.project_id,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name, description: row.description }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: folder, error } = await source
      .from('knowledge_base_folders')
      .select('*')
      .eq('id', objectId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load kb_folder: ${error.message}`);
    if (!folder) return null;

    const portable: Record<string, unknown> = {
      name: folder.name,
      description: folder.description,
      _dev_project_id: folder.project_id,
      _dev_organization_id: folder.organization_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('kb_folder', portable);
    const version = versionFromPayload(cleaned, folder.updated_at);

    return {
      objectType: 'kb_folder',
      objectId: folder.id,
      stableId: `${folder.project_id}:${folder.name}`,
      name: folder.name,
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
    const { projectId } = remapOrgProject(portable.portable, ctx);
    if (!projectId) return { exists: false, version: null, contentHash: null };
    const { data } = await target
      .from('knowledge_base_folders')
      .select('id, name, updated_at')
      .eq('project_id', projectId)
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
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'kb_folder');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const { organizationId, projectId } = remapOrgProject(portable.portable, ctx);
    if (!projectId) {
      return { status: 'failed' as const, error: 'PROMOTION_PROD_PROJECT_MAP required to promote KB folders' };
    }

    const row = {
      name: portable.portable.name,
      description: portable.portable.description ?? null,
      project_id: projectId,
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('knowledge_base_folders').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row } };
    }

    const { data, error } = await target
      .from('knowledge_base_folders')
      .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}

/**
 * Knowledge Base policies / audits — document config + content.
 * Skips approvals, ratings, and user-specific folder access.
 */
export class PolicyHandler implements PromotableHandler {
  readonly objectType = 'policy' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source
      .from('policies')
      .select(
        'id, name, reference_id, project_id, organization_id, updated_at, status, item_type, category, folder_id',
      );
    if (opts.projectId) q = q.eq('project_id', opts.projectId);
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list policies: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'policy' as const,
      objectId: row.id,
      stableId: stableIdFromRow(row),
      name: row.name,
      module: 'Knowledge Base' as const,
      projectId: row.project_id,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload(
        { name: row.name, status: row.status, item_type: row.item_type },
        row.updated_at,
      ),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: policy, error } = await source.from('policies').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load policy: ${error.message}`);
    if (!policy) return null;

    let folderName: string | null = null;
    if (policy.folder_id) {
      const { data: folder } = await source
        .from('knowledge_base_folders')
        .select('name')
        .eq('id', policy.folder_id)
        .maybeSingle();
      folderName = folder?.name || null;
    }

    const formStable = await formStableId(source, policy.form_id);
    let workflowStable: string | null = null;
    if (policy.workflow_id) {
      const { data: wf } = await source
        .from('workflows')
        .select('id, reference_id')
        .eq('id', policy.workflow_id)
        .maybeSingle();
      workflowStable = (wf?.reference_id && String(wf.reference_id).trim()) || wf?.id || null;
    }

    const portable: Record<string, unknown> = {
      name: policy.name,
      description: policy.description,
      category: policy.category,
      department: policy.department,
      status: policy.status,
      owner_type: policy.owner_type,
      compliance_standard: policy.compliance_standard,
      compliance_reference: policy.compliance_reference,
      content: policy.content,
      attachments: policy.attachments,
      tags: policy.tags,
      current_version: policy.current_version,
      item_type: policy.item_type || 'policy',
      reference_id: policy.reference_id || policy.id,
      _dev_project_id: policy.project_id,
      _dev_organization_id: policy.organization_id,
      _dev_folder_id: policy.folder_id,
      _folder_name: folderName,
      _dev_form_id: policy.form_id,
      _form_stable_id: formStable,
      _dev_workflow_id: policy.workflow_id,
      _workflow_stable_id: workflowStable,
      // owner_id is remapped to promoting admin on insert
      _dev_owner_id: policy.owner_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('policy', portable);
    const version = versionFromPayload(cleaned, policy.updated_at);

    return {
      objectType: 'policy',
      objectId: policy.id,
      stableId: stableIdFromRow(policy),
      name: policy.name,
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]> {
    const deps: DependencyRef[] = [];
    const folderId = portable.portable._dev_folder_id as string | undefined;
    if (folderId) {
      const { data } = await source
        .from('knowledge_base_folders')
        .select('id, name, project_id')
        .eq('id', folderId)
        .maybeSingle();
      if (data) {
        deps.push({
          objectType: 'kb_folder',
          objectId: data.id,
          stableId: `${data.project_id}:${data.name}`,
          name: data.name,
          reason: 'Policy belongs to this Knowledge Base folder',
          required: false,
        });
      }
    }
    const formId = portable.portable._dev_form_id as string | undefined;
    if (formId) {
      const { data } = await source.from('forms').select('id, name, reference_id').eq('id', formId).maybeSingle();
      if (data) {
        deps.push({
          objectType: 'form',
          objectId: data.id,
          stableId: (data.reference_id && String(data.reference_id).trim()) || data.id,
          name: data.name,
          reason: 'Policy links to this form',
          required: false,
        });
      }
    }
    const workflowId = portable.portable._dev_workflow_id as string | undefined;
    if (workflowId) {
      const { data } = await source
        .from('workflows')
        .select('id, name, reference_id')
        .eq('id', workflowId)
        .maybeSingle();
      if (data) {
        deps.push({
          objectType: 'workflow',
          objectId: data.id,
          stableId: (data.reference_id && String(data.reference_id).trim()) || data.id,
          name: data.name,
          reason: 'Policy links to this workflow',
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
    const byRef = portable.stableId;
    let row: any = null;
    if (byRef && byRef !== portable.objectId) {
      const { data } = await target
        .from('policies')
        .select('id, name, reference_id, updated_at')
        .eq('reference_id', byRef)
        .maybeSingle();
      row = data;
    }
    if (!row) {
      const { data } = await target
        .from('policies')
        .select('id, name, reference_id, updated_at')
        .eq('id', portable.objectId)
        .maybeSingle();
      row = data;
    }
    if (!row) return { exists: false, version: null, contentHash: null };
    return {
      exists: true,
      version: versionFromPayload({ name: row.name }, row.updated_at),
      contentHash: null,
      name: row.name,
      id: row.id,
    };
  }

  async transfer(
    _source: SbClient,
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    mode: 'dual_supabase' | 'logical_snapshot',
  ) {
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'policy');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const { organizationId, projectId } = remapOrgProject(portable.portable, ctx);
    if (!projectId) {
      return { status: 'failed' as const, error: 'PROMOTION_PROD_PROJECT_MAP required to promote policies' };
    }

    let folderId: string | null = null;
    const folderName = portable.portable._folder_name as string | undefined;
    if (folderName) {
      const { data: folder } = await target
        .from('knowledge_base_folders')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', folderName)
        .maybeSingle();
      folderId = folder?.id || null;
    }

    const formId = await resolveFormIdOnTarget(target, {
      formId: portable.portable._dev_form_id as string,
      formStableId: portable.portable._form_stable_id as string,
    });

    let workflowId: string | null = null;
    const wfStable = portable.portable._workflow_stable_id as string | undefined;
    const wfDev = portable.portable._dev_workflow_id as string | undefined;
    if (wfStable) {
      const { data: byRef } = await target
        .from('workflows')
        .select('id')
        .eq('reference_id', wfStable)
        .maybeSingle();
      if (byRef?.id) workflowId = byRef.id;
    }
    if (!workflowId && wfDev) {
      const { data: byId } = await target.from('workflows').select('id').eq('id', wfDev).maybeSingle();
      workflowId = byId?.id || null;
    }

    const row: Record<string, unknown> = {
      name: portable.portable.name,
      description: portable.portable.description ?? null,
      category: portable.portable.category || 'General',
      department: portable.portable.department ?? null,
      status: portable.portable.status || 'draft',
      owner_type: portable.portable.owner_type || 'user',
      owner_id: ctx.actorId,
      compliance_standard: portable.portable.compliance_standard ?? null,
      compliance_reference: portable.portable.compliance_reference ?? null,
      content: portable.portable.content || {},
      attachments: portable.portable.attachments || [],
      tags: portable.portable.tags || [],
      current_version: portable.portable.current_version || 1,
      item_type: portable.portable.item_type || 'policy',
      reference_id: portable.stableId,
      project_id: projectId,
      organization_id: organizationId,
      folder_id: folderId,
      form_id: formId,
      workflow_id: workflowId,
      updated_at: new Date().toISOString(),
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('policies').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row } };
    }

    const { data, error } = await target
      .from('policies')
      .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}
