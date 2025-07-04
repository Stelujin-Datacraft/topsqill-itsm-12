
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/hooks/use-toast';

export interface FormPermissionUser {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  project_role: string;
  permissions: Record<string, { granted: boolean; explicit: boolean }>;
  has_explicit_permissions: boolean;
}

export interface FormPermissionType {
  id: string;
  label: string;
  description: string;
  category: 'access' | 'content' | 'management';
}

export const FORM_PERMISSION_TYPES: FormPermissionType[] = [
  { id: 'view_form', label: 'View Form', description: 'Can view form structure and fields', category: 'access' },
  { id: 'submit_form', label: 'Submit Form', description: 'Can submit form responses', category: 'access' },
  { id: 'create_form', label: 'Create Form', description: 'Can create new forms', category: 'content' },
  { id: 'edit_form', label: 'Edit Form', description: 'Can modify form structure and fields', category: 'content' },
  { id: 'delete_form', label: 'Delete Form', description: 'Can delete forms', category: 'management' },
  { id: 'edit_rules', label: 'Edit Rules', description: 'Can configure form rules and logic', category: 'content' },
  { id: 'view_submissions', label: 'View Submissions', description: 'Can view form responses', category: 'content' },
  { id: 'create_records', label: 'Create Records', description: 'Can create new form records', category: 'content' },
  { id: 'export_data', label: 'Export Data', description: 'Can export form data', category: 'management' },
  { id: 'manage_access', label: 'Manage Access', description: 'Can manage user access to form', category: 'management' },
  { id: 'change_settings', label: 'Change Settings', description: 'Can modify form settings', category: 'management' },
  { id: 'change_lifecycle', label: 'Change Lifecycle', description: 'Can change form status', category: 'management' },
];

export function useFormAccessMatrix(formId: string) {
  const [users, setUsers] = useState<FormPermissionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { currentProject } = useProject();

  const loadFormPermissions = async () => {
    if (!formId || !currentProject) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_project_users_form_permissions', {
        _project_id: currentProject.id,
        _form_id: formId
      });

      if (error) {
        console.error('Error loading form permissions:', error);
        toast({
          title: "Error",
          description: "Failed to load form permissions",
          variant: "destructive",
        });
        return;
      }

      // Cast the permissions from Json to the expected type
      const formattedUsers = (data || []).map(user => ({
        ...user,
        permissions: user.permissions as Record<string, { granted: boolean; explicit: boolean }>
      })) as FormPermissionUser[];

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error loading form permissions:', error);
      toast({
        title: "Error",
        description: "Failed to load form permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const grantPermission = async (userId: string, permissionType: string) => {
    if (!currentProject) return;

    try {
      setUpdating(`${userId}-${permissionType}`);
      
      const { error } = await supabase
        .from('asset_permissions')
        .upsert({
          project_id: currentProject.id,
          user_id: userId,
          asset_type: 'form',
          asset_id: formId,
          permission_type: permissionType,
        });

      if (error) throw error;

      await loadFormPermissions();
      toast({
        title: "Permission granted",
        description: `Permission ${permissionType} granted successfully`,
      });
    } catch (error) {
      console.error('Error granting permission:', error);
      toast({
        title: "Error",
        description: "Failed to grant permission",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const revokePermission = async (userId: string, permissionType: string) => {
    if (!currentProject) return;

    try {
      setUpdating(`${userId}-${permissionType}`);
      
      const { error } = await supabase
        .from('asset_permissions')
        .delete()
        .eq('project_id', currentProject.id)
        .eq('user_id', userId)
        .eq('asset_type', 'form')
        .eq('asset_id', formId)
        .eq('permission_type', permissionType);

      if (error) throw error;

      await loadFormPermissions();
      toast({
        title: "Permission revoked",
        description: `Permission ${permissionType} revoked successfully`,
      });
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast({
        title: "Error",
        description: "Failed to revoke permission",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const bulkUpdatePermissions = async (userIds: string[], permissions: Record<string, boolean>) => {
    if (!currentProject) return;

    try {
      setUpdating('bulk');
      
      for (const userId of userIds) {
        for (const [permissionType, grant] of Object.entries(permissions)) {
          if (grant) {
            await supabase
              .from('asset_permissions')
              .upsert({
                project_id: currentProject.id,
                user_id: userId,
                asset_type: 'form',
                asset_id: formId,
                permission_type: permissionType,
              });
          } else {
            await supabase
              .from('asset_permissions')
              .delete()
              .eq('project_id', currentProject.id)
              .eq('user_id', userId)
              .eq('asset_type', 'form')
              .eq('asset_id', formId)
              .eq('permission_type', permissionType);
          }
        }
      }

      await loadFormPermissions();
      toast({
        title: "Permissions updated",
        description: `Bulk permissions updated for ${userIds.length} users`,
      });
    } catch (error) {
      console.error('Error updating bulk permissions:', error);
      toast({
        title: "Error",
        description: "Failed to update permissions",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    loadFormPermissions();
  }, [formId, currentProject]);

  return {
    users,
    loading,
    updating,
    grantPermission,
    revokePermission,
    bulkUpdatePermissions,
    reloadPermissions: loadFormPermissions,
  };
}
