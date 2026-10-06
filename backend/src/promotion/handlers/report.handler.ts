import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import { stableIdFromRow } from './handler.types';

export class ReportHandler implements PromotableHandler {
  readonly objectType = 'report' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source.from('reports').select('id, name, reference_id, project_id, organization_id, updated_at, dashboard_id');
    if (opts.projectId) q = q.eq('project_id', opts.projectId);
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list reports: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'report' as const,
      objectId: row.id,
      stableId: stableIdFromRow(row),
      name: row.name,
      module: 'Reports' as const,
      projectId: row.project_id,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: report, error } = await source.from('reports').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load report: ${error.message}`);
    if (!report) return null;

    const portable: Record<string, unknown> = {
      name: report.name,
      description: report.description,
      is_public: report.is_public,
      is_default_report: report.is_default_report,
      reference_id: report.reference_id,
      _dev_dashboard_id: report.dashboard_id,
      _dev_project_id: report.project_id,
      _dev_organization_id: report.organization_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('report', portable);
    const version = versionFromPayload(cleaned, report.updated_at);
    return {
      objectType: 'report',
      objectId: report.id,
      stableId: stableIdFromRow(report),
      name: report.name,
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]> {
    const deps: DependencyRef[] = [];
    const dashId = portable.portable._dev_dashboard_id;
    if (typeof dashId === 'string' && dashId) {
      const { data } = await source.from('dashboards').select('id, name, reference_id').eq('id', dashId).maybeSingle();
      if (data) {
        deps.push({
          objectType: 'dashboard',
          objectId: data.id,
          stableId: stableIdFromRow(data),
          name: data.name,
          reason: `Report "${portable.name}" is linked to dashboard "${data.name}"`,
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
    let row: any = null;
    if (portable.stableId !== portable.objectId) {
      const { data } = await target.from('reports').select('id, name, updated_at').eq('reference_id', portable.stableId).maybeSingle();
      row = data;
    }
    if (!row) {
      const { data } = await target.from('reports').select('id, name, updated_at').eq('id', portable.objectId).maybeSingle();
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
      const payload = { ...portable.portable, name: portable.name, stable_id: portable.stableId };
      const { error } = await target.from('promotion_target_snapshots').upsert(
        {
          object_type: 'report',
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
      is_public: portable.portable.is_public ?? false,
      is_default_report: portable.portable.is_default_report ?? false,
      reference_id: portable.stableId,
      project_id: projectId,
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('reports').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row } };
    }

    const { data, error } = await target
      .from('reports')
      .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}

export class DashboardHandler implements PromotableHandler {
  readonly objectType = 'dashboard' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source.from('dashboards').select('id, name, reference_id, project_id, organization_id, updated_at');
    if (opts.projectId) q = q.eq('project_id', opts.projectId);
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list dashboards: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'dashboard' as const,
      objectId: row.id,
      stableId: stableIdFromRow(row),
      name: row.name,
      module: 'Reports' as const,
      projectId: row.project_id,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: dash, error } = await source.from('dashboards').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load dashboard: ${error.message}`);
    if (!dash) return null;
    const portable: Record<string, unknown> = {
      name: dash.name,
      description: dash.description,
      layout: dash.layout,
      is_public: dash.is_public,
      is_default: dash.is_default,
      default_for: dash.default_for,
      reference_id: dash.reference_id,
      _dev_project_id: dash.project_id,
      _dev_organization_id: dash.organization_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('dashboard', portable);
    const version = versionFromPayload(cleaned, dash.updated_at);
    return {
      objectType: 'dashboard',
      objectId: dash.id,
      stableId: stableIdFromRow(dash),
      name: dash.name,
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]> {
    const deps: DependencyRef[] = [];
    const reportIds = new Set<string>();
    collectReportIds(portable.portable.layout, reportIds);
    for (const rid of reportIds) {
      const { data } = await source.from('reports').select('id, name, reference_id').eq('id', rid).maybeSingle();
      if (data) {
        deps.push({
          objectType: 'report',
          objectId: data.id,
          stableId: stableIdFromRow(data),
          name: data.name,
          reason: `Dashboard "${portable.name}" references report "${data.name}"`,
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
      const { data } = await target.from('dashboards').select('id, name, updated_at').eq('reference_id', portable.stableId).maybeSingle();
      row = data;
    }
    if (!row) {
      const { data } = await target.from('dashboards').select('id, name, updated_at').eq('id', portable.objectId).maybeSingle();
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
      const payload = { ...portable.portable, name: portable.name, stable_id: portable.stableId };
      const { error } = await target.from('promotion_target_snapshots').upsert(
        {
          object_type: 'dashboard',
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
      layout: portable.portable.layout,
      is_public: portable.portable.is_public ?? false,
      is_default: portable.portable.is_default ?? false,
      default_for: portable.portable.default_for,
      reference_id: portable.stableId,
      project_id: projectId,
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('dashboards').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row } };
    }

    const { data, error } = await target
      .from('dashboards')
      .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}

function collectReportIds(layout: unknown, out: Set<string>) {
  if (!layout || typeof layout !== 'object') return;
  if (Array.isArray(layout)) {
    for (const item of layout) collectReportIds(item, out);
    return;
  }
  const obj = layout as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if ((k === 'report_id' || k === 'reportId') && typeof v === 'string') out.add(v);
    else if (v && typeof v === 'object') collectReportIds(v, out);
  }
}

export class EmailTemplateHandler implements PromotableHandler {
  readonly objectType = 'email_template' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source.from('email_templates').select('id, name, project_id, updated_at, is_active');
    if (opts.projectId) q = q.eq('project_id', opts.projectId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list email_templates: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'email_template' as const,
      objectId: row.id,
      stableId: row.id,
      name: row.name,
      module: 'Notifications' as const,
      projectId: row.project_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: tpl, error } = await source.from('email_templates').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load email_template: ${error.message}`);
    if (!tpl) return null;
    const portable: Record<string, unknown> = {
      name: tpl.name,
      description: tpl.description,
      subject: tpl.subject,
      html_content: tpl.html_content,
      text_content: tpl.text_content,
      template_variables: tpl.template_variables,
      custom_params: tpl.custom_params,
      recipients: tpl.recipients,
      is_active: tpl.is_active,
      _dev_project_id: tpl.project_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('email_template', portable);
    const version = versionFromPayload(cleaned, tpl.updated_at);
    return {
      objectType: 'email_template',
      objectId: tpl.id,
      stableId: tpl.id,
      name: tpl.name,
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
    // Match by name + project when no reference_id column
    const { data: byId } = await target.from('email_templates').select('id, name, updated_at').eq('id', portable.objectId).maybeSingle();
    if (byId) {
      return {
        exists: true,
        version: versionFromPayload({ name: byId.name }, byId.updated_at),
        contentHash: null,
        name: byId.name,
        id: byId.id,
      };
    }
    const { data: byName } = await target
      .from('email_templates')
      .select('id, name, updated_at')
      .eq('name', portable.name)
      .maybeSingle();
    if (byName) {
      return {
        exists: true,
        version: versionFromPayload({ name: byName.name }, byName.updated_at),
        contentHash: null,
        name: byName.name,
        id: byName.id,
      };
    }
    return { exists: false, version: null, contentHash: null };
  }

  async transfer(
    _source: SbClient,
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    mode: 'dual_supabase' | 'logical_snapshot',
  ) {
    if (mode === 'logical_snapshot') {
      const payload = { ...portable.portable, name: portable.name, stable_id: portable.stableId };
      const { error } = await target.from('promotion_target_snapshots').upsert(
        {
          object_type: 'email_template',
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
    const row: Record<string, unknown> = {
      name: portable.portable.name,
      description: portable.portable.description,
      subject: portable.portable.subject,
      html_content: portable.portable.html_content,
      text_content: portable.portable.text_content,
      template_variables: portable.portable.template_variables || {},
      custom_params: portable.portable.custom_params || {},
      recipients: portable.portable.recipients,
      is_active: portable.portable.is_active ?? true,
      project_id: projectId,
      updated_at: new Date().toISOString(),
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('email_templates').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row } };
    }

    const { data, error } = await target
      .from('email_templates')
      .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}
