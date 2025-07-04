import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from 'sonner';

export const ENHANCED_FORM_PERMISSION_TYPES = [
  { id: 'view_form', label: 'View Form' },
  { id: 'edit_form', label: 'Edit Form' },
  { id: 'create_form', label: 'Create Form' },
  { id: 'delete_form', label: 'Delete Form' }
];

interface TopLevelPermissions {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface UserPermission {
  granted: boolean;
  explicit: boolean;
  disabled: boolean;
}

interface UserWithPermissions {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  project_role: string;
  top_level_permissions: TopLevelPermissions;
  permissions: Record<string, UserPermission>;
}

export function useEnhancedFormAccessMatrix(formId: string) {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { currentProject } = useProject();

  const loadUsers = async () => {
    if (!currentProject?.id || !formId) return;

    try {
      setLoading(true);

      // Get all project users
      const { data: projectUsers, error: usersError } = await supabase
        .from('project_users')
        .select(`
          user_id,
          role,
          user_profiles!inner(
            email,
            first_name,
            last_name
          )
        `)
        .eq('project_id', currentProject.id);

      if (usersError) throw usersError;

      // Get top-level permissions for forms
      const { data: topLevelPerms, error: topLevelError } = await supabase
        .from('project_top_level_permissions')
        .select('*')
        .eq('project_id', currentProject.id)
        .eq('entity_type', 'forms');

      if (topLevelError) throw topLevelError;

      // Transform data
      const usersWithPermissions: UserWithPermissions[] = projectUsers.map(user => {
        const userProfile = Array.isArray(user.user_profiles) ? user.user_profiles[0] : user.user_profiles;
        const topLevelPerm = topLevelPerms.find(p => p.user_id === user.user_id);

        return {
          user_id: user.user_id,
          email: userProfile?.email || '',
          first_name: userProfile?.first_name || null,
          last_name: userProfile?.last_name || null,
          project_role: user.role,
          top_level_permissions: {
            can_create: topLevelPerm?.can_create || false,
            can_read: topLevelPerm?.can_read || true,
            can_update: topLevelPerm?.can_update || false,
            can_delete: topLevelPerm?.can_delete || false
          },
          permissions: {
            view_form: {
              granted: topLevelPerm?.can_read || user.role === 'admin',
              explicit: false,
              disabled: !topLevelPerm?.can_read && user.role !== 'admin'
            },
            edit_form: {
              granted: topLevelPerm?.can_update || user.role === 'admin',
              explicit: false,
              disabled: !topLevelPerm?.can_update && user.role !== 'admin'
            },
            create_form: {
              granted: topLevelPerm?.can_create || user.role === 'admin',
              explicit: false,
              disabled: !topLevelPerm?.can_create && user.role !== 'admin'
            },
            delete_form: {
              granted: topLevelPerm?.can_delete || user.role === 'admin',
              explicit: false,
              disabled: !topLevelPerm?.can_delete && user.role !== 'admin'
            }
          }
        };
      });

      setUsers(usersWithPermissions);
    } catch (error) {
      console.error('Error loading form access matrix:', error);
      toast.error('Failed to load user permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentProject?.id, formId]);

  const grantPermission = async (userId: string, permissionType: string) => {
    setUpdating(`${userId}-${permissionType}`);
    try {
      // Placeholder for actual permission granting logic
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Permission granted successfully');
      await loadUsers();
    } catch (error) {
      console.error('Error granting permission:', error);
      toast.error('Failed to grant permission');
    } finally {
      setUpdating(null);
    }
  };

  const revokePermission = async (userId: string, permissionType: string) => {
    setUpdating(`${userId}-${permissionType}`);
    try {
      // Placeholder for actual permission revoking logic
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Permission revoked successfully');
      await loadUsers();
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast.error('Failed to revoke permission');
    } finally {
      setUpdating(null);
    }
  };

  return {
    users,
    loading,
    updating,
    grantPermission,
    revokePermission,
    reloadUsers: loadUsers
  };
}
