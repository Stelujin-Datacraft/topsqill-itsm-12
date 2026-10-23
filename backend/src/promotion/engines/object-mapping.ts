/**
 * Archer-style Dev → Prod identity mapping preview.
 * Does not mutate Prod — only resolves and reports how selected objects/fields/refs map.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChildApplyMode,
  MappingEntry,
  MappingReport,
  MappingStatus,
  PortableObject,
  TransferContext,
} from '../registry/types';
import { getHandler } from '../handlers';
import { formStableId, resolveFormIdOnTarget, resolveUserIdByEmail, resolveRoleIdByName, resolveGroupIdByName } from '../handlers/promo-utils';
import { listOptionLabels, listRuleSummaries, optionStableKey } from './form-deep-merge';

function bump(counts: MappingReport['counts'], status: MappingStatus) {
  counts.total += 1;
  counts[status] += 1;
}

function add(
  entries: MappingEntry[],
  counts: MappingReport['counts'],
  entry: Omit<MappingEntry, 'status'> & { status: MappingStatus },
) {
  entries.push(entry);
  bump(counts, entry.status);
}

function fieldStableKey(f: Record<string, unknown>): string {
  const label = String(f.label || '').trim().toLowerCase();
  const type = String(f.field_type || '').trim().toLowerCase();
  return `${label}::${type}`;
}

function optionValues(options: unknown): string[] {
  return listOptionLabels(options);
}

function addRuleMappingEntries(
  entries: MappingEntry[],
  counts: MappingReport['counts'],
  opts: {
    portable: PortableObject;
    ruleKind: 'field_rules' | 'form_rules';
    devRules: unknown;
    prodRules: unknown;
    childApplyMode: ChildApplyMode;
  },
) {
  const { portable, ruleKind, devRules, prodRules, childApplyMode } = opts;
  const prodSummaries = listRuleSummaries(prodRules);
  const prodByKey = new Map(prodSummaries.map((r) => [r.key, r]));
  const prodActionKeys = new Set(
    prodSummaries.flatMap((r) => r.actions.map((a) => `${r.key}::${a.toLowerCase()}`)),
  );

  for (const rule of listRuleSummaries(devRules)) {
    const prod = prodByKey.get(rule.key);
    add(entries, counts, {
      kind: 'rule',
      objectType: 'form',
      objectStableId: portable.stableId,
      objectName: portable.name,
      label: `${ruleKind === 'field_rules' ? 'Field rule' : 'Form rule'}: ${rule.label}`,
      sourceKey: rule.key,
      targetKey: prod ? prod.key : null,
      status: prod ? 'matched' : 'new',
      detail:
        childApplyMode === 'merge'
          ? prod
            ? 'merge — update rule; keep Prod-only rules'
            : 'merge — append rule on Prod'
          : 'replace — package rules overwrite Prod',
    });

    for (const act of rule.actions) {
      const actKey = `${rule.key}::${act.toLowerCase()}`;
      const hit = prodActionKeys.has(actKey);
      add(entries, counts, {
        kind: 'action',
        objectType: 'form',
        objectStableId: portable.stableId,
        objectName: portable.name,
        label: `${rule.label}: ${act}`,
        sourceKey: act,
        targetKey: hit ? act : null,
        status: !prod ? 'new' : hit ? 'matched' : 'new',
        detail:
          childApplyMode === 'merge'
            ? hit
              ? 'merge — update action'
              : 'merge — append action'
            : 'replace with package',
      });
    }
  }
}

function extractFormIdsFromConfig(config: unknown, out: Set<string>) {
  if (!config || typeof config !== 'object') return;
  if (Array.isArray(config)) {
    for (const item of config) extractFormIdsFromConfig(item, out);
    return;
  }
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    const key = k.toLowerCase();
    if (
      (key === 'form_id' || key === 'formid' || key === 'source_form_id' || key === 'target_form_id') &&
      typeof v === 'string' &&
      v.trim().length > 0
    ) {
      out.add(v);
    } else if (v && typeof v === 'object') {
      extractFormIdsFromConfig(v, out);
    }
  }
}

export async function buildMappingReport(opts: {
  source: SupabaseClient;
  target: SupabaseClient;
  items: Array<{
    object_type: string;
    object_id: string;
    stable_id: string;
    object_name: string;
    included?: boolean;
  }>;
  ctx: TransferContext;
  childApplyMode: ChildApplyMode;
  transferMode: 'dual_supabase' | 'logical_snapshot';
}): Promise<MappingReport> {
  const { source, target, items, ctx, childApplyMode, transferMode } = opts;
  const entries: MappingEntry[] = [];
  const counts: MappingReport['counts'] = {
    matched: 0,
    new: 0,
    unresolved: 0,
    stripped: 0,
    total: 0,
  };
  const blockers: string[] = [];

  // Org / project env map
  if (ctx.targetOrganizationId) {
    add(entries, counts, {
      kind: 'org',
      objectType: 'organization',
      objectStableId: 'env',
      objectName: 'Organization',
      label: 'Organization remap',
      sourceKey: String(ctx.organizationId || 'dev-org'),
      targetKey: ctx.targetOrganizationId,
      status: 'matched',
      detail: 'PROMOTION_PROD_ORG_ID',
    });
  } else if (transferMode === 'dual_supabase') {
    add(entries, counts, {
      kind: 'org',
      objectType: 'organization',
      objectStableId: 'env',
      objectName: 'Organization',
      label: 'Organization remap',
      sourceKey: String(ctx.organizationId || ''),
      targetKey: null,
      status: 'unresolved',
      detail: 'Set PROMOTION_PROD_ORG_ID for dual-DB org remap',
    });
    blockers.push('PROMOTION_PROD_ORG_ID is not set (required for dual-DB org-scoped objects)');
  }

  const projectEntries = Object.entries(ctx.projectMap || {});
  if (projectEntries.length) {
    for (const [dev, prod] of projectEntries) {
      add(entries, counts, {
        kind: 'project',
        objectType: 'project',
        objectStableId: `${dev}->${prod}`,
        objectName: 'Project',
        label: 'Project remap',
        sourceKey: dev,
        targetKey: prod,
        status: 'matched',
        detail: 'PROMOTION_PROD_PROJECT_MAP',
      });
    }
  } else if (transferMode === 'dual_supabase' && ctx.projectId) {
    add(entries, counts, {
      kind: 'project',
      objectType: 'project',
      objectStableId: 'env',
      objectName: 'Project',
      label: 'Project remap',
      sourceKey: String(ctx.projectId),
      targetKey: null,
      status: 'unresolved',
      detail: 'PROMOTION_PROD_PROJECT_MAP empty — package project_id will be used as-is',
    });
  }

  for (const item of items.filter((i) => i.included !== false)) {
    const handler = getHandler(item.object_type);
    let portable: PortableObject | null = null;
    try {
      portable = await handler.loadPortable(source, item.object_id);
    } catch (e: any) {
      add(entries, counts, {
        kind: 'object',
        objectType: item.object_type,
        objectStableId: item.stable_id,
        objectName: item.object_name,
        label: item.object_name,
        sourceKey: item.stable_id,
        targetKey: null,
        status: 'unresolved',
        detail: e?.message || 'Failed to load from Dev',
      });
      blockers.push(`Cannot load ${item.object_name} from Dev`);
      continue;
    }
    if (!portable) {
      add(entries, counts, {
        kind: 'object',
        objectType: item.object_type,
        objectStableId: item.stable_id,
        objectName: item.object_name,
        label: item.object_name,
        sourceKey: item.stable_id,
        targetKey: null,
        status: 'unresolved',
        detail: 'Missing on Dev',
      });
      continue;
    }

    let logical: any = null;
    if (transferMode === 'logical_snapshot') {
      // Caller may not pass snapshots table here — treat as new unless findInTarget finds dual row
    }
    const found = await handler.findInTarget(target, portable, ctx, logical);
    add(entries, counts, {
      kind: 'object',
      objectType: portable.objectType,
      objectStableId: portable.stableId,
      objectName: portable.name,
      label: portable.name,
      sourceKey: portable.stableId,
      targetKey: found.id || (found.exists ? portable.stableId : null),
      status: found.exists ? 'matched' : 'new',
      detail: found.exists
        ? `Will ${childApplyMode === 'merge' ? 'merge' : 'replace'} on Prod`
        : 'Will create on Prod',
    });

    // Per-type child / identity mappings
    if (portable.objectType === 'form') {
      const fields = (portable.children?.form_fields || []) as Record<string, unknown>[];
      let prodFields: Record<string, unknown>[] = [];
      let prodFormRow: { field_rules?: unknown; form_rules?: unknown } | null = null;
      if (found.id) {
        const { data } = await target
          .from('form_fields')
          .select('id, label, field_type, options')
          .eq('form_id', found.id);
        prodFields = (data || []) as any[];
        const { data: formRow } = await target
          .from('forms')
          .select('field_rules, form_rules')
          .eq('id', found.id)
          .maybeSingle();
        prodFormRow = formRow;
      }
      const prodByKey = new Map(prodFields.map((f) => [fieldStableKey(f), f]));
      for (const f of fields) {
        const key = fieldStableKey(f);
        const prod = prodByKey.get(key);
        add(entries, counts, {
          kind: 'field',
          objectType: 'form',
          objectStableId: portable.stableId,
          objectName: portable.name,
          label: String(f.label || '(unnamed field)'),
          sourceKey: key,
          targetKey: prod ? String(prod.id) : null,
          status: prod ? 'matched' : 'new',
          detail: `${f.field_type || 'field'} · ${childApplyMode}`,
        });
        const prodOptKeys = new Set(
          (prod ? optionValues(prod.options) : []).map((p) => optionStableKey(p)),
        );
        for (const opt of optionValues(f.options)) {
          const hit = prodOptKeys.has(optionStableKey(opt));
          add(entries, counts, {
            kind: 'option',
            objectType: 'form',
            objectStableId: portable.stableId,
            objectName: portable.name,
            label: `${f.label}: ${opt}`,
            sourceKey: opt,
            targetKey: hit ? opt : null,
            status: !prod ? 'new' : hit ? 'matched' : 'new',
            detail:
              childApplyMode === 'merge'
                ? hit
                  ? 'merge — update option value'
                  : 'merge — append option (keep Prod-only options)'
                : 'replace — package options overwrite field',
          });
        }
      }

      addRuleMappingEntries(entries, counts, {
        portable,
        ruleKind: 'field_rules',
        devRules: portable.portable.field_rules,
        prodRules: prodFormRow?.field_rules,
        childApplyMode,
      });
      addRuleMappingEntries(entries, counts, {
        portable,
        ruleKind: 'form_rules',
        devRules: portable.portable.form_rules,
        prodRules: prodFormRow?.form_rules,
        childApplyMode,
      });
    }

    if (portable.objectType === 'org_user') {
      const email = String(portable.portable.email || portable.stableId);
      const prodId = await resolveUserIdByEmail(target, email);
      add(entries, counts, {
        kind: 'user',
        objectType: 'org_user',
        objectStableId: portable.stableId,
        objectName: portable.name,
        label: email,
        sourceKey: email,
        targetKey: prodId,
        status: prodId ? 'matched' : 'new',
        detail: 'Matched by email',
      });
      const roleNames = (portable.portable.assigned_role_names as string[]) || [];
      const orgId = ctx.targetOrganizationId || (portable.portable._dev_organization_id as string);
      for (const rn of roleNames) {
        const rid = await resolveRoleIdByName(target, orgId, rn);
        add(entries, counts, {
          kind: 'role',
          objectType: 'org_user',
          objectStableId: portable.stableId,
          objectName: portable.name,
          label: `Assigned role: ${rn}`,
          sourceKey: rn,
          targetKey: rid,
          status: rid ? 'matched' : 'unresolved',
          detail: rid ? 'Role exists on Prod' : 'Promote Role first or create on Prod',
        });
        if (!rid) blockers.push(`User ${email}: role "${rn}" not found on Prod`);
      }
    }

    if (portable.objectType === 'role') {
      // object entry already added
    }

    if (portable.objectType === 'group') {
      const orgId = ctx.targetOrganizationId || (portable.portable._dev_organization_id as string);
      const roleNames = (portable.portable.role_names as string[]) || [];
      for (const rn of roleNames) {
        const rid = await resolveRoleIdByName(target, orgId, rn);
        add(entries, counts, {
          kind: 'role',
          objectType: 'group',
          objectStableId: portable.stableId,
          objectName: portable.name,
          label: `Group role: ${rn}`,
          sourceKey: rn,
          targetKey: rid,
          status: rid ? 'matched' : 'unresolved',
          detail: rid ? 'Role exists on Prod' : 'Promote Role first',
        });
      }
      const members = (portable.portable.members as Array<{ type: string; email?: string; name?: string }>) || [];
      for (const m of members) {
        if (m.type === 'user' && m.email) {
          const uid = await resolveUserIdByEmail(target, m.email);
          add(entries, counts, {
            kind: 'user',
            objectType: 'group',
            objectStableId: portable.stableId,
            objectName: portable.name,
            label: `Member: ${m.email}`,
            sourceKey: m.email,
            targetKey: uid,
            status: uid ? 'matched' : 'unresolved',
            detail: uid ? 'User exists on Prod' : 'Promote User first (or create)',
          });
        } else if (m.type === 'group' && m.name) {
          const gid = await resolveGroupIdByName(target, orgId, m.name);
          add(entries, counts, {
            kind: 'group',
            objectType: 'group',
            objectStableId: portable.stableId,
            objectName: portable.name,
            label: `Nested group: ${m.name}`,
            sourceKey: m.name,
            targetKey: gid,
            status: gid ? 'matched' : 'unresolved',
            detail: gid ? 'Group exists on Prod' : 'Promote nested group first',
          });
        }
      }
    }

    if (portable.objectType === 'workflow') {
      const formIds = new Set<string>();
      const nodes = (portable.children?.workflow_nodes || []) as Array<{ config?: unknown }>;
      for (const n of nodes) extractFormIdsFromConfig(n.config, formIds);
      for (const formId of formIds) {
        const stable = await formStableId(source, formId);
        const prodFormId = await resolveFormIdOnTarget(target, {
          formId,
          formStableId: stable,
        });
        add(entries, counts, {
          kind: 'form_ref',
          objectType: 'workflow',
          objectStableId: portable.stableId,
          objectName: portable.name,
          label: `Form ref in workflow`,
          sourceKey: stable || formId,
          targetKey: prodFormId,
          status: prodFormId ? 'matched' : 'unresolved',
          detail: prodFormId
            ? 'Will remap node config form_id on transfer'
            : 'Promote the form (same reference_id) first',
        });
        if (!prodFormId) {
          blockers.push(`Workflow "${portable.name}" references a form not found on Prod (${stable || formId})`);
        }
      }
    }

    if (portable.objectType === 'data_feed') {
      for (const [label, stableKey, idKey] of [
        ['Source form', '_source_form_stable_id', '_dev_source_form_id'],
        ['Target form', '_target_form_stable_id', '_dev_target_form_id'],
      ] as const) {
        const stable = portable.portable[stableKey] as string | undefined;
        const formId = portable.portable[idKey] as string | undefined;
        const prodFormId = await resolveFormIdOnTarget(target, { formId, formStableId: stable });
        add(entries, counts, {
          kind: 'form_ref',
          objectType: 'data_feed',
          objectStableId: portable.stableId,
          objectName: portable.name,
          label,
          sourceKey: stable || formId || '',
          targetKey: prodFormId,
          status: prodFormId ? 'matched' : 'unresolved',
          detail: prodFormId ? 'Form remapped' : 'Promote Forms first',
        });
        if (!prodFormId) blockers.push(`Data feed "${portable.name}": ${label} not on Prod`);
      }
    }

    for (const path of portable.envSpecificStripped || []) {
      add(entries, counts, {
        kind: 'object',
        objectType: portable.objectType,
        objectStableId: portable.stableId,
        objectName: portable.name,
        label: `Env-specific: ${path}`,
        sourceKey: path,
        targetKey: null,
        status: 'stripped',
        detail: 'Not copied from Dev — Prod value preserved when updating',
      });
    }
  }

  return {
    childApplyMode,
    generatedAt: new Date().toISOString(),
    counts,
    entries,
    blockers: Array.from(new Set(blockers)),
  };
}

/** Deep-remap form UUID references inside workflow node configs using Dev→Prod form resolution. */
export async function remapFormIdsInValue(
  value: unknown,
  resolve: (devFormId: string) => Promise<string | null>,
): Promise<unknown> {
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await remapFormIdsInValue(v, resolve));
    return out;
  }
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    if (
      (key === 'form_id' || key === 'formid' || key === 'source_form_id' || key === 'target_form_id') &&
      typeof v === 'string' &&
      v.trim().length > 0
    ) {
      const mapped = await resolve(v);
      out[k] = mapped || v;
    } else {
      out[k] = await remapFormIdsInValue(v, resolve);
    }
  }
  return out;
}
