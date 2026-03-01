import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type KBPermission = 'view' | 'edit' | 'admin';

/**
 * Resolves the current user's effective permission level for a knowledge-base
 * folder, taking into account:
 *  1. Explicit folder-level grants (direct user or group-based) — highest priority
 *  2. Org-level admin role → "admin" only if no explicit folder grant exists
 *  3. Fallback: "view" (org-wide read visibility)
 */
export function useKnowledgeBasePermission(folderId: string | null | undefined) {
  const { user, userProfile } = useAuth();

  const isOrgAdmin = userProfile?.role === 'admin';

  const { data: resolvedPermission, isLoading } = useQuery({
    queryKey: ['kb-folder-permission', folderId, user?.id],
    queryFn: async (): Promise<{ permission: KBPermission; hasExplicit: boolean }> => {
      if (!folderId || !user?.id) return { permission: 'view', hasExplicit: false };

      // 1. Check direct user access
      const { data: directAccess } = await supabase
        .from('knowledge_base_folder_access')
        .select('permission')
        .eq('folder_id', folderId)
        .eq('access_type', 'user')
        .eq('grantee_id', user.id);

      // 2. Check group-based access
      const { data: userGroups } = await supabase
        .from('group_memberships')
        .select('group_id')
        .eq('member_id', user.id)
        .eq('member_type', 'user');

      let groupAccess: { permission: string }[] = [];
      if (userGroups && userGroups.length > 0) {
        const groupIds = userGroups.map(g => g.group_id);
        const { data } = await supabase
          .from('knowledge_base_folder_access')
          .select('permission')
          .eq('folder_id', folderId)
          .eq('access_type', 'group')
          .in('grantee_id', groupIds);
        groupAccess = data || [];
      }

      // Merge all permissions — highest wins
      const allPerms = [
        ...(directAccess || []).map(a => a.permission),
        ...groupAccess.map(a => a.permission),
      ];

      if (allPerms.length === 0) {
        // No explicit folder access set for this user
        return { permission: 'view', hasExplicit: false };
      }

      // Explicit permission found — this takes priority over org admin role
      if (allPerms.includes('admin')) return { permission: 'admin', hasExplicit: true };
      if (allPerms.includes('edit')) return { permission: 'edit', hasExplicit: true };
      return { permission: 'view', hasExplicit: true };
    },
    enabled: !!user?.id && !!folderId,
    staleTime: 2 * 60 * 1000,
  });

  // Determine effective permission:
  // - If explicit folder permission exists → use it (overrides org admin)
  // - If no explicit permission and user is org admin → admin
  // - Otherwise → view
  let effective: KBPermission = 'view';
  if (resolvedPermission?.hasExplicit) {
    effective = resolvedPermission.permission;
  } else if (isOrgAdmin) {
    effective = 'admin';
  }

  return {
    permission: effective,
    canEdit: effective === 'edit' || effective === 'admin',
    canAdmin: effective === 'admin',
    isLoading,
  };
}
