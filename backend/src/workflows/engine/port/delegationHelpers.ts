// @ts-nocheck
import { workflowDb } from '@/services/workflow/db';

/**
 * Returns active delegate user IDs for a given delegator, optionally filtered by scope.
 * Use this in workflow assignment / approval routing and email CC logic so that
 * tasks intended for a user during their leave also reach their delegate.
 */
export async function resolveDelegatesForUser(
  delegatorUserId: string,
  opts: { formId?: string | null; projectId?: string | null; requireIncludeApprovals?: boolean } = {}
): Promise<string[]> {
  if (!delegatorUserId) return [];
  const nowIso = new Date().toISOString();
  let q = supabase
    .from('record_delegations')
    .select('delegate_user_id, scope, scope_form_id, scope_project_id, include_approvals, starts_at, ends_at')
    .eq('delegator_user_id', delegatorUserId)
    .eq('active', true)
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso);

  const { data, error } = await q;
  if (error || !data) return [];

  const matches = data.filter((d: any) => {
    if (opts.requireIncludeApprovals && !d.include_approvals) return false;
    if (d.scope === 'all') return true;
    if (d.scope === 'form' && opts.formId && d.scope_form_id === opts.formId) return true;
    if (d.scope === 'project' && opts.projectId && d.scope_project_id === opts.projectId) return true;
    // If no scope filter requested, accept any
    if (!opts.formId && !opts.projectId) return true;
    return false;
  });

  return Array.from(new Set(matches.map((m: any) => m.delegate_user_id)));
}

/**
 * Expands a list of assignee user IDs with their active delegates.
 * Useful when notifying or assigning approvers — delegates inherit the task.
 */
export async function expandAssigneesWithDelegates(
  userIds: string[],
  opts: { formId?: string | null; projectId?: string | null } = {}
): Promise<string[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return unique;
  const all = new Set(unique);
  await Promise.all(
    unique.map(async (uid) => {
      const delegates = await resolveDelegatesForUser(uid, { ...opts, requireIncludeApprovals: true });
      delegates.forEach((d) => all.add(d));
    })
  );
  return Array.from(all);
}

/**
 * Builds the attribution string written to history rows.
 * Format: `<actorId>` or `<actorId>|on_behalf_of:<delegatorId>`
 */
export function buildChangedByAttribution(actorId: string, onBehalfOfUserId?: string | null): string {
  if (!onBehalfOfUserId || onBehalfOfUserId === actorId) return actorId;
  return `${actorId}|on_behalf_of:${onBehalfOfUserId}`;
}

/** Parses a changed_by string written by buildChangedByAttribution. */
export function parseChangedByAttribution(changedBy: string | null | undefined): { actorId: string | null; onBehalfOfUserId: string | null } {
  if (!changedBy) return { actorId: null, onBehalfOfUserId: null };
  const [actor, marker] = changedBy.split('|on_behalf_of:');
  return { actorId: actor || null, onBehalfOfUserId: marker || null };
}