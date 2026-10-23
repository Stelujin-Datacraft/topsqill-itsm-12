import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import {
  mergeFormFieldPayload,
  mergeFormPermissions,
  mergePages,
  mergeRules,
  parseJsonArray,
  remapPageFieldIds,
} from '../engines/form-deep-merge';
import type { PromotableHandler, SbClient } from './handler.types';
import { stableIdFromRow } from './handler.types';

function fieldMatchKey(f: Record<string, unknown>): string {
  return `${String(f.label || '')
    .trim()
    .toLowerCase()}::${String(f.field_type || '')
    .trim()
    .toLowerCase()}`;
}

const PORTABLE_FORM_KEYS = [
  'name',
  'description',
  'status',
  'layout',
  'pages',
  'field_rules',
  'form_rules',
  'permissions',
  'is_public',
  'reference_id',
] as const;

export class FormHandler implements PromotableHandler {
  readonly objectType = 'form' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source.from('forms').select('id, name, reference_id, project_id, organization_id, updated_at, status');
    if (opts.projectId) q = q.eq('project_id', opts.projectId);
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list forms: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'form' as const,
      objectId: row.id,
      stableId: stableIdFromRow(row),
      name: row.name,
      module: 'Forms' as const,
      projectId: row.project_id,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name, updated_at: row.updated_at }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: form, error } = await source.from('forms').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load form: ${error.message}`);
    if (!form) return null;

    const { data: fields, error: fErr } = await source
      .from('form_fields')
      .select('*')
      .eq('form_id', objectId)
      .order('field_order', { ascending: true });
    if (fErr) throw new Error(`Failed to load form_fields: ${fErr.message}`);

    const portable: Record<string, unknown> = {};
    for (const k of PORTABLE_FORM_KEYS) {
      portable[k] = form[k];
    }
    portable._dev_project_id = form.project_id;
    portable._dev_organization_id = form.organization_id;

    const childFields = (fields || []).map((f) => {
      const { id: _id, form_id: _fid, created_at: _c, updated_at: _u, current_value: _cv, ...rest } = f;
      return { ...rest, _dev_field_id: f.id };
    });

    const { stripped, portable: cleaned } = sanitizeEnvSpecific('form', portable);
    const version = versionFromPayload(cleaned, form.updated_at);

    return {
      objectType: 'form',
      objectId: form.id,
      stableId: stableIdFromRow(form),
      name: form.name,
      version,
      contentHash: contentHash({ ...cleaned, fields: childFields }),
      portable: cleaned,
      children: { form_fields: childFields },
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(_source: SbClient, _portable: PortableObject): Promise<DependencyRef[]> {
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
    const byRef = portable.stableId;
    let row: any = null;
    if (byRef && byRef !== portable.objectId) {
      const { data } = await target.from('forms').select('id, name, reference_id, updated_at').eq('reference_id', byRef).maybeSingle();
      row = data;
    }
    if (!row) {
      const { data } = await target.from('forms').select('id, name, reference_id, updated_at').eq('id', portable.objectId).maybeSingle();
      row = data;
    }
    if (!row) {
      return { exists: false, version: null, contentHash: null };
    }
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
          object_type: 'form',
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
    const applyMode = ctx.childApplyMode || 'replace';

    let fieldRules: unknown = portable.portable.field_rules;
    let formRules: unknown = portable.portable.form_rules;
    let permissions: unknown = portable.portable.permissions;
    let pages: unknown = portable.portable.pages;
    let prodPagesForMerge: unknown = null;

    // merge: dig into rules / permissions / pages (pages finalized after field id remap).
    // replace: package values replace Prod wholesale (Archer default).
    if (applyMode === 'merge' && existing.exists && existing.id) {
      const { data: prodForm } = await target
        .from('forms')
        .select('field_rules, form_rules, permissions, pages')
        .eq('id', existing.id)
        .maybeSingle();
      if (prodForm) {
        fieldRules = mergeRules(prodForm.field_rules, portable.portable.field_rules);
        formRules = mergeRules(prodForm.form_rules, portable.portable.form_rules);
        permissions = mergeFormPermissions(prodForm.permissions, portable.portable.permissions);
        prodPagesForMerge = prodForm.pages;
      }
    }

    const row: Record<string, unknown> = {
      name: portable.portable.name,
      description: portable.portable.description,
      status: portable.portable.status || 'active',
      layout: portable.portable.layout,
      // Temporary — rewritten after field sync with remapped field UUIDs
      pages: pages ?? [],
      field_rules: fieldRules,
      form_rules: formRules,
      permissions,
      is_public: portable.portable.is_public ?? false,
      reference_id: portable.stableId,
      project_id: projectId,
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };

    let formId = existing.id;
    if (existing.exists && formId) {
      const { error } = await target.from('forms').update(row).eq('id', formId);
      if (error) return { status: 'failed' as const, error: error.message };
    } else {
      const insert = {
        ...row,
        created_by: ctx.actorId,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await target.from('forms').insert(insert).select('id').single();
      if (error) return { status: 'failed' as const, error: error.message };
      formId = data.id;
    }

    // Nested fields — configuration only (never touches submissions).
    // replace: delete+insert so Prod matches Dev package.
    // merge: upsert by label+field_type; dig-merge options/custom_config/permissions;
    //        leave Prod-only fields untouched.
    const fields = (portable.children?.form_fields || []) as Record<string, unknown>[];
    const devToProdFieldId = new Map<string, string>();

    if (applyMode === 'merge') {
      if (fields.length) {
        const { data: existingFields } = await target
          .from('form_fields')
          .select('id, label, field_type, options, custom_config, permissions, validation')
          .eq('form_id', formId);
        const byKey = new Map(
          (existingFields || []).map((f) => [fieldMatchKey(f as Record<string, unknown>), f as Record<string, unknown>]),
        );
        for (let idx = 0; idx < fields.length; idx++) {
          const f = fields[idx];
          const { _dev_field_id, ...rest } = f;
          const key = fieldMatchKey(rest);
          const prodField = byKey.get(key);
          const mergedRest = prodField ? mergeFormFieldPayload(prodField, rest) : rest;
          const payload = {
            ...mergedRest,
            form_id: formId,
            field_order: mergedRest.field_order ?? rest.field_order ?? idx,
            updated_at: new Date().toISOString(),
          };
          if (prodField?.id) {
            const { error } = await target.from('form_fields').update(payload).eq('id', prodField.id);
            if (error) return { status: 'failed' as const, error: `form_fields merge update: ${error.message}` };
            if (_dev_field_id) devToProdFieldId.set(String(_dev_field_id), String(prodField.id));
          } else {
            const { data: inserted, error } = await target.from('form_fields').insert(payload).select('id').single();
            if (error) return { status: 'failed' as const, error: `form_fields merge insert: ${error.message}` };
            if (_dev_field_id && inserted?.id) devToProdFieldId.set(String(_dev_field_id), String(inserted.id));
          }
        }
      }
    } else {
      await target.from('form_fields').delete().eq('form_id', formId);
      if (fields.length) {
        for (let idx = 0; idx < fields.length; idx++) {
          const f = fields[idx];
          const { _dev_field_id, ...rest } = f;
          const payload = {
            ...rest,
            form_id: formId,
            field_order: rest.field_order ?? idx,
            updated_at: new Date().toISOString(),
          };
          const { data: inserted, error: fErr } = await target.from('form_fields').insert(payload).select('id').single();
          if (fErr) return { status: 'failed' as const, error: `form_fields: ${fErr.message}` };
          if (_dev_field_id && inserted?.id) devToProdFieldId.set(String(_dev_field_id), String(inserted.id));
        }
      }
    }

    // Remap page field UUID lists to Prod ids; merge keeps Prod-only pages/fields.
    const remappedDevPages = remapPageFieldIds(portable.portable.pages, devToProdFieldId);
    const finalPages =
      applyMode === 'merge' && prodPagesForMerge != null
        ? mergePages(prodPagesForMerge, remappedDevPages)
        : remappedDevPages;
    const { error: pagesErr } = await target
      .from('forms')
      .update({ pages: finalPages, updated_at: new Date().toISOString() })
      .eq('id', formId);
    if (pagesErr) return { status: 'failed' as const, error: `forms.pages remap: ${pagesErr.message}` };
    row.pages = finalPages;

    return {
      status: 'succeeded' as const,
      prodAfter: {
        id: formId,
        ...row,
        childApplyMode: applyMode,
        field_rules_count: parseJsonArray(fieldRules).length,
        form_rules_count: parseJsonArray(formRules).length,
        remapped_fields: devToProdFieldId.size,
      },
    };
  }
}
