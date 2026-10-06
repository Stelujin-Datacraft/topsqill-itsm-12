import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import { stableIdFromRow } from './handler.types';

function extractFormIdsFromConfig(config: unknown, out: Set<string>) {
  if (!config || typeof config !== 'object') return;
  if (Array.isArray(config)) {
    for (const item of config) extractFormIdsFromConfig(item, out);
    return;
  }
  const obj = config as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    if (
      (key === 'form_id' || key === 'formid' || key === 'source_form_id' || key === 'target_form_id') &&
      typeof v === 'string' &&
      v.length > 10
    ) {
      out.add(v);
    } else if (v && typeof v === 'object') {
      extractFormIdsFromConfig(v, out);
    }
  }
}

export class WorkflowHandler implements PromotableHandler {
  readonly objectType = 'workflow' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source.from('workflows').select('id, name, reference_id, project_id, organization_id, updated_at, status');
    if (opts.projectId) q = q.eq('project_id', opts.projectId);
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list workflows: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'workflow' as const,
      objectId: row.id,
      stableId: stableIdFromRow(row),
      name: row.name,
      module: 'Workflows' as const,
      projectId: row.project_id,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name, updated_at: row.updated_at }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: wf, error } = await source.from('workflows').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load workflow: ${error.message}`);
    if (!wf) return null;

    const { data: nodes, error: nErr } = await source.from('workflow_nodes').select('*').eq('workflow_id', objectId);
    if (nErr) throw new Error(`Failed to load workflow_nodes: ${nErr.message}`);
    const { data: connections, error: cErr } = await source
      .from('workflow_connections')
      .select('*')
      .eq('workflow_id', objectId);
    if (cErr) throw new Error(`Failed to load workflow_connections: ${cErr.message}`);

    const portable: Record<string, unknown> = {
      name: wf.name,
      description: wf.description,
      status: wf.status,
      enrollment_mode: wf.enrollment_mode,
      enrollment_cooldown_hours: wf.enrollment_cooldown_hours,
      notify_on_failure: wf.notify_on_failure,
      reference_id: wf.reference_id,
      _dev_project_id: wf.project_id,
      _dev_organization_id: wf.organization_id,
    };

    const nodePortable = (nodes || []).map((n) => ({
      _dev_node_id: n.id,
      label: n.label,
      node_type: n.node_type,
      position_x: n.position_x,
      position_y: n.position_y,
      config: n.config,
    }));

    const connPortable = (connections || []).map((c) => ({
      _dev_connection_id: c.id,
      _dev_source_node_id: c.source_node_id,
      _dev_target_node_id: c.target_node_id,
      source_handle: c.source_handle,
      target_handle: c.target_handle,
      condition_type: c.condition_type,
    }));

    const { stripped, portable: cleaned } = sanitizeEnvSpecific('workflow', {
      ...portable,
      nodes: nodePortable,
    });

    const version = versionFromPayload(cleaned, wf.updated_at);
    return {
      objectType: 'workflow',
      objectId: wf.id,
      stableId: stableIdFromRow(wf),
      name: wf.name,
      version,
      contentHash: contentHash({ ...cleaned, connections: connPortable }),
      portable: cleaned,
      children: { workflow_nodes: nodePortable, workflow_connections: connPortable },
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]> {
    const formIds = new Set<string>();
    const nodes = (portable.children?.workflow_nodes || portable.portable.nodes || []) as Array<{ config?: unknown }>;
    for (const n of nodes) extractFormIdsFromConfig(n.config, formIds);

    const deps: DependencyRef[] = [];
    for (const formId of formIds) {
      const { data } = await source.from('forms').select('id, name, reference_id').eq('id', formId).maybeSingle();
      if (data) {
        deps.push({
          objectType: 'form',
          objectId: data.id,
          stableId: stableIdFromRow(data),
          name: data.name,
          reason: `Workflow "${portable.name}" references form "${data.name}"`,
          required: true,
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
    let row: any = null;
    if (portable.stableId !== portable.objectId) {
      const { data } = await target
        .from('workflows')
        .select('id, name, reference_id, updated_at')
        .eq('reference_id', portable.stableId)
        .maybeSingle();
      row = data;
    }
    if (!row) {
      const { data } = await target
        .from('workflows')
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
    if (mode === 'logical_snapshot') {
      const payload = {
        ...portable.portable,
        children: portable.children,
        name: portable.name,
        stable_id: portable.stableId,
      };
      const { error } = await target.from('promotion_target_snapshots').upsert(
        {
          object_type: 'workflow',
          stable_id: portable.stableId,
          object_name: portable.name,
          version: portable.version,
          content_hash: portable.contentHash,
          payload,
          last_package_id: ctx.packageId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'object_type,stable_id' },
      );
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: payload };
    }

    const existing = await this.findInTarget(target, portable, ctx, null);
    const projectId =
      ctx.projectMap[String(portable.portable._dev_project_id || '')] ||
      ctx.projectId ||
      portable.portable._dev_project_id;
    const organizationId = ctx.targetOrganizationId || portable.portable._dev_organization_id || null;

    const row: Record<string, unknown> = {
      name: portable.portable.name,
      description: portable.portable.description,
      status: portable.portable.status || 'active',
      enrollment_mode: portable.portable.enrollment_mode || 'automatic',
      enrollment_cooldown_hours: portable.portable.enrollment_cooldown_hours,
      notify_on_failure: portable.portable.notify_on_failure ?? false,
      reference_id: portable.stableId,
      project_id: projectId,
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };

    let workflowId = existing.id;
    if (existing.exists && workflowId) {
      const { error } = await target.from('workflows').update(row).eq('id', workflowId);
      if (error) return { status: 'failed' as const, error: error.message };
      await target.from('workflow_connections').delete().eq('workflow_id', workflowId);
      await target.from('workflow_nodes').delete().eq('workflow_id', workflowId);
    } else {
      const { data, error } = await target
        .from('workflows')
        .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) return { status: 'failed' as const, error: error.message };
      workflowId = data.id;
    }

    const nodes = (portable.children?.workflow_nodes || []) as Record<string, unknown>[];
    const idMap = new Map<string, string>();
    if (nodes.length) {
      for (const n of nodes) {
        const { _dev_node_id, config, ...rest } = n;
        const { data, error } = await target
          .from('workflow_nodes')
          .insert({
            ...rest,
            config: config || {},
            workflow_id: workflowId,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (error) return { status: 'failed' as const, error: `workflow_nodes: ${error.message}` };
        if (_dev_node_id) idMap.set(String(_dev_node_id), data.id);
      }
    }

    const conns = (portable.children?.workflow_connections || []) as Record<string, unknown>[];
    if (conns.length) {
      const inserts = conns
        .map((c) => {
          const src = idMap.get(String(c._dev_source_node_id));
          const tgt = idMap.get(String(c._dev_target_node_id));
          if (!src || !tgt) return null;
          return {
            workflow_id: workflowId,
            source_node_id: src,
            target_node_id: tgt,
            source_handle: c.source_handle,
            target_handle: c.target_handle,
            condition_type: c.condition_type,
          };
        })
        .filter(Boolean);
      if (inserts.length) {
        const { error } = await target.from('workflow_connections').insert(inserts);
        if (error) return { status: 'failed' as const, error: `workflow_connections: ${error.message}` };
      }
    }

    return { status: 'succeeded' as const, prodAfter: { id: workflowId, ...row } };
  }
}
