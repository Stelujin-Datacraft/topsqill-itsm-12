import type { TransferContext } from '../registry/types';
import type { PortableObject } from '../registry/types';
import type { SbClient } from './handler.types';

/** Shared logical-snapshot write used by all handlers. */
export async function writeLogicalSnapshot(
  target: SbClient,
  portable: PortableObject,
  ctx: TransferContext,
  objectType: string,
) {
  const payload = {
    ...portable.portable,
    children: portable.children,
    name: portable.name,
    stable_id: portable.stableId,
  };
  const { error } = await target.from('promotion_target_snapshots').upsert(
    {
      object_type: objectType,
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

export function remapOrgProject(
  portable: Record<string, unknown>,
  ctx: TransferContext,
): { organizationId: string | null; projectId: string | null } {
  const organizationId =
    ctx.targetOrganizationId || (portable._dev_organization_id as string) || null;
  const projectId =
    ctx.projectMap[String(portable._dev_project_id || '')] ||
    ctx.projectId ||
    (portable._dev_project_id as string) ||
    null;
  return { organizationId, projectId };
}

/** Resolve a Dev form UUID to the matching Prod form id via reference_id (preferred) or id. */
export async function resolveFormIdOnTarget(
  target: SbClient,
  opts: { formId?: string | null; formStableId?: string | null },
): Promise<string | null> {
  const stable = opts.formStableId && String(opts.formStableId).trim();
  if (stable) {
    const { data } = await target.from('forms').select('id').eq('reference_id', stable).maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.formId) {
    const { data: byId } = await target.from('forms').select('id').eq('id', opts.formId).maybeSingle();
    if (byId?.id) return byId.id;
    const { data: byRef } = await target
      .from('forms')
      .select('id')
      .eq('reference_id', opts.formId)
      .maybeSingle();
    if (byRef?.id) return byRef.id;
  }
  return null;
}

export async function formStableId(source: SbClient, formId: string | null | undefined): Promise<string | null> {
  if (!formId) return null;
  const { data } = await source.from('forms').select('id, reference_id').eq('id', formId).maybeSingle();
  if (!data) return null;
  return (data.reference_id && String(data.reference_id).trim()) || data.id;
}

/** Resolve a role on the target by organization + name. */
export async function resolveRoleIdByName(
  target: SbClient,
  organizationId: string | null | undefined,
  roleName: string | null | undefined,
): Promise<string | null> {
  if (!organizationId || !roleName?.trim()) return null;
  const { data } = await target
    .from('roles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', roleName.trim())
    .maybeSingle();
  return data?.id || null;
}

/** Resolve a user on the target by email (case-insensitive). */
export async function resolveUserIdByEmail(
  target: SbClient,
  email: string | null | undefined,
): Promise<string | null> {
  if (!email?.trim()) return null;
  const normalized = email.trim().toLowerCase();
  const { data } = await target
    .from('user_profiles')
    .select('id, email')
    .ilike('email', normalized)
    .maybeSingle();
  return data?.id || null;
}

/** Resolve a group on the target by organization + name. */
export async function resolveGroupIdByName(
  target: SbClient,
  organizationId: string | null | undefined,
  groupName: string | null | undefined,
): Promise<string | null> {
  if (!organizationId || !groupName?.trim()) return null;
  const { data } = await target
    .from('groups')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', groupName.trim())
    .maybeSingle();
  return data?.id || null;
}
