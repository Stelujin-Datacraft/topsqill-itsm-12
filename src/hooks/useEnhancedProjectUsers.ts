
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export function useEnhancedProjectUsers(projectId: string) {
  const [users, setUsers] = useState<EnhancedProjectUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!projectId) return;

    try {
      setError(null);
      const { data, error } = await supabase.rpc('get_project_users_with_permissions', {
        project_id_param: projectId
      });

      if (error) {
        console.error('Error loading enhanced project users:', error);
        setError(error.message);
        return;
      }

      // Transform the data to match our interface
      const transformedUsers: EnhancedProjectUser[] = (data || []).map((user: any) => ({
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

      setUsers(transformedUsers);
    } catch (error) {
      console.error('Error loading enhanced project users:', error);
      setError('Failed to load project users');
    } finally {
      setLoading(false);
    }
  };

  const addUser = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: userId,
          role: role
        });

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error adding user to project:', error);
      throw error;
    }
  };

  const removeUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error removing user from project:', error);
      throw error;
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('project_users')
        .update({ role: newRole })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadUsers();
  }, [projectId]);

  return {
    users,
    loading,
    error,
    addUser,
    removeUser,
    updateUserRole,
    refetch: loadUsers,
    loadUsers,
  };
}
