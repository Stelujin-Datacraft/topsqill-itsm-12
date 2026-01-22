/**
 * React Query-based enhanced project users hook with automatic caching
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, cacheManager } from '@/lib/cacheManager';

export interface EnhancedProjectUser {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  assigned_at: string;
  assigned_by?: string;
  last_activity: string;
  project_permissions: Record<string, string>;
  asset_permissions: Array<{
    asset_type: string;
    asset_id: string;
    permission_type: string;
  }>;
  effective_permissions: {
    is_project_admin: boolean;
    is_org_admin: boolean;
    can_manage_users: boolean;
    can_manage_settings: boolean;
  };
}

async function fetchProjectUsers(projectId: string): Promise<EnhancedProjectUser[]> {
  const { data, error } = await supabase.rpc('get_project_users_with_permissions', {
    project_id_param: projectId
  });

  if (error) throw error;

  return (data || []).map((user: any) => ({
    user_id: user.user_id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    assigned_at: user.assigned_at,
    assigned_by: user.assigned_by,
    last_activity: user.last_activity,
    project_permissions: typeof user.project_permissions === 'object' ? user.project_permissions : {},
    asset_permissions: Array.isArray(user.asset_permissions) ? user.asset_permissions : [],
    effective_permissions: typeof user.effective_permissions === 'object' ? user.effective_permissions : {
      is_project_admin: false,
      is_org_admin: false,
      can_manage_users: false,
      can_manage_settings: false,
    }
  }));
}

export function useProjectUsersQuery(projectId: string) {
  // Main query with caching
  const { data: users = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.projectUsers(projectId),
    queryFn: () => fetchProjectUsers(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Add user mutation
  const addMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: userId,
          role: role
        });

      if (error) throw error;
    },
    onSuccess: () => {
      cacheManager.invalidateProjectUsers(projectId);
    },
  });

  // Remove user mutation
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      cacheManager.invalidateProjectUsers(projectId);
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from('project_users')
        .update({ role: newRole })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      cacheManager.invalidateProjectUsers(projectId);
    },
  });

  return {
    users,
    loading,
    error: error?.message || null,
    addUser: (userId: string, role: string) => addMutation.mutateAsync({ userId, role }),
    removeUser: (userId: string) => removeMutation.mutateAsync(userId),
    updateUserRole: (userId: string, newRole: string) => updateRoleMutation.mutateAsync({ userId, newRole }),
    refetch,
    loadUsers: refetch,
  };
}
