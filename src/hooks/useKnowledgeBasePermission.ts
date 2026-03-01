import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type KBPermission = 'view' | 'edit' | 'admin';

/**
 * Resolves the current user's effective permission level for a knowledge-base
 * policy/audit, taking into account:
 *  1. Org-level admin role → always "admin"
 *  2. Direct user grants on the folder
 *  3. Group-based grants on the folder (via group_memberships)
 *  4. Fallback: if no folder or no explicit access → "view" (org-wide visibility)
 */
export function useKnowledgeBasePermission(folderId: string | null | undefined) {
  const { user, userProfile } = useAuth();

  const isOrgAdmin = userProfile?.role === 'admin';

  const { data: folderPermission, isLoading } = useQuery({
    queryKey: ['kb-folder-permission', folderId, user?.id],
    queryFn: async (): Promise<KBPermission> => {
      if (!folderId || !user?.id) return 'view';

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

      if (allPerms.length === 0) return 'view'; // no explicit access → org-wide default

      if (allPerms.includes('admin')) return 'admin';
      if (allPerms.includes('edit')) return 'edit';
      return 'view';
    },
    enabled: !!user?.id && !!folderId && !isOrgAdmin,
    staleTime: 2 * 60 * 1000,
  });

  // Org admins always get full admin access
  if (isOrgAdmin) {
    return { permission: 'admin' as KBPermission, canEdit: true, canAdmin: true, isLoading: false };
  }

  const effective = folderPermission || 'view';

  return {
    permission: effective,
    canEdit: effective === 'edit' || effective === 'admin',
    canAdmin: effective === 'admin',
    isLoading,
  };
}
