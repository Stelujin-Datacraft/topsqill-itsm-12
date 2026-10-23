import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import {
  fieldMappingStableKey,
  matchingRuleStableKey,
  mergeKeyedRecords,
} from '../engines/form-deep-merge';
import {
  formStableId,
  remapOrgProject,
  resolveFormIdOnTarget,
  writeLogicalSnapshot,
} from './promo-utils';

/**
 * Data Feed definitions only — never promotes data_feed_runs or credentials.
 * Forms should be promoted first so source/target form FKs can remap.
 */
export class DataFeedHandler implements PromotableHandler {
  readonly objectType = 'data_feed' as const;

  async list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    let q = source
      .from('data_feeds')
      .select('id, name, project_id, organization_id, updated_at, source_form_id, target_form_id, is_active');
    if (opts.projectId) q = q.eq('project_id', opts.projectId);
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q.order('name');
    if (error) throw new Error(`Failed to list data_feeds: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'data_feed' as const,
      objectId: row.id,
      stableId: row.id,
      name: row.name,
      module: 'Data Feed' as const,
      projectId: row.project_id,
      organizationId: row.organization_id,
      updatedAt: row.updated_at,
      devVersion: versionFromPayload({ name: row.name, is_active: row.is_active }, row.updated_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: feed, error } = await source.from('data_feeds').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load data_feed: ${error.message}`);
    if (!feed) return null;

    const sourceStable = await formStableId(source, feed.source_form_id);
    const targetStable = await formStableId(source, feed.target_form_id);

    const portable: Record<string, unknown> = {
      name: feed.name,
      description: feed.description,
      matching_type: feed.matching_type,
      matching_rules: feed.matching_rules,
      field_mappings: feed.field_mappings,
      no_match_behavior: feed.no_match_behavior,
      schedule: feed.schedule,
      is_active: feed.is_active,
      _dev_project_id: feed.project_id,
      _dev_organization_id: feed.organization_id,
      _source_form_stable_id: sourceStable,
      _target_form_stable_id: targetStable,
      _dev_source_form_id: feed.source_form_id,
      _dev_target_form_id: feed.target_form_id,
    };
    // Never carry connection/runtime stats
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('data_feed', portable);
    const version = versionFromPayload(cleaned, feed.updated_at);

    return {
      objectType: 'data_feed',
      objectId: feed.id,
      stableId: feed.id,
      name: feed.name,
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]> {
    const deps: DependencyRef[] = [];
    for (const [key, label] of [
      ['_dev_source_form_id', 'source form'],
      ['_dev_target_form_id', 'target form'],
    ] as const) {
      const formId = portable.portable[key] as string | undefined;
      if (!formId) continue;
      const { data } = await source.from('forms').select('id, name, reference_id').eq('id', formId).maybeSingle();
      if (data) {
        deps.push({
          objectType: 'form',
          objectId: data.id,
          stableId: (data.reference_id && String(data.reference_id).trim()) || data.id,
          name: data.name,
          reason: `Data feed requires ${label}`,
          required: true,
        });
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
    const { projectId } = remapOrgProject(portable.portable, ctx);
    let q = target.from('data_feeds').select('id, name, updated_at').eq('name', portable.name);
    if (projectId) q = q.eq('project_id', projectId);
    const { data } = await q.maybeSingle();
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
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'data_feed');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const { organizationId, projectId } = remapOrgProject(portable.portable, ctx);
    if (!projectId) {
      return { status: 'failed' as const, error: 'PROMOTION_PROD_PROJECT_MAP required to promote data feeds' };
    }

    const sourceFormId = await resolveFormIdOnTarget(target, {
      formId: portable.portable._dev_source_form_id as string,
      formStableId: portable.portable._source_form_stable_id as string,
    });
    const targetFormId = await resolveFormIdOnTarget(target, {
      formId: portable.portable._dev_target_form_id as string,
      formStableId: portable.portable._target_form_stable_id as string,
    });
    if (!sourceFormId || !targetFormId) {
      return {
        status: 'failed' as const,
        error:
          'Could not remap source/target forms on Prod. Promote the Forms module first (same reference_id), then retry.',
      };
    }

    const applyMode = ctx.childApplyMode || 'replace';
    let matchingRules: unknown = portable.portable.matching_rules || [];
    let fieldMappings: unknown = portable.portable.field_mappings || [];

    // merge: union mapping/rule rows by source↔target name (preferred) or id.
    // replace: package arrays overwrite Prod.
    if (applyMode === 'merge' && existing.exists && existing.id) {
      const { data: prodFeed } = await target
        .from('data_feeds')
        .select('matching_rules, field_mappings')
        .eq('id', existing.id)
        .maybeSingle();
      if (prodFeed) {
        matchingRules = mergeKeyedRecords(prodFeed.matching_rules, matchingRules, matchingRuleStableKey);
        fieldMappings = mergeKeyedRecords(prodFeed.field_mappings, fieldMappings, fieldMappingStableKey);
      }
    }

    const row = {
      name: portable.portable.name,
      description: portable.portable.description ?? null,
      project_id: projectId,
      organization_id: organizationId,
      source_form_id: sourceFormId,
      target_form_id: targetFormId,
      matching_type: portable.portable.matching_type || 'field_matching',
      matching_rules: matchingRules,
      field_mappings: fieldMappings,
      no_match_behavior: portable.portable.no_match_behavior || 'skip',
      schedule: portable.portable.schedule ?? null,
      is_active: portable.portable.is_active ?? true,
      // Never copy run stats from Dev
      last_run_at: null,
      last_run_status: null,
      last_run_stats: null,
      updated_at: new Date().toISOString(),
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('data_feeds').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row, childApplyMode: applyMode } };
    }

    const { data, error } = await target
      .from('data_feeds')
      .insert({ ...row, created_by: ctx.actorId, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}
