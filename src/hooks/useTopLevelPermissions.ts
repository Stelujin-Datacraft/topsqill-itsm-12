
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TopLevelPermission {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: 'forms' | 'workflows' | 'reports';
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export interface TopLevelPermissionUpdate {
  entity_type: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export function useTopLevelPermissions(projectId: string, userId: string) {
  const [permissions, setPermissions] = useState<TopLevelPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const loadPermissions = async () => {
    if (!projectId || !userId) return;

    try {
      const { data, error } = await supabase
        .from('project_top_level_permissions')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error loading top-level permissions:', error);
        return;
      }

      // Transform the data to ensure entity_type is properly typed and filter out projects
      const transformedPermissions: TopLevelPermission[] = (data || [])
        .filter((perm: any) => perm.entity_type !== 'projects')
        .map((perm: any) => ({
          id: perm.id,
          project_id: perm.project_id,
          user_id: perm.user_id,
          entity_type: perm.entity_type as 'forms' | 'workflows' | 'reports',
          can_create: perm.can_create,
          can_read: perm.can_read,
          can_update: perm.can_update,
          can_delete: perm.can_delete,
        }));

      setPermissions(transformedPermissions);
    } catch (error) {
      console.error('Error in loadPermissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultPermissions = async () => {
    if (!projectId || !userId || !userProfile?.id) return;

    try {
      const { error } = await supabase.rpc('initialize_default_top_level_permissions', {
        _project_id: projectId,
        _user_id: userId,
        _created_by: userProfile.id
      });

      if (error) {
        console.error('Error initializing default permissions:', error);
        return;
      }

      await loadPermissions();
    } catch (error) {
      console.error('Error in initializeDefaultPermissions:', error);
    }
  };

  const updatePermissions = async (updates: TopLevelPermissionUpdate[]) => {
    if (!projectId || !userId || !userProfile?.id) return;

    try {
      const upsertData = updates.map(update => ({
        project_id: projectId,
        user_id: userId,
        entity_type: update.entity_type,
        can_create: update.can_create,
        can_read: update.can_read,
        can_update: update.can_update,
        can_delete: update.can_delete,
        created_by: userProfile.id
      }));

      const { error } = await supabase
        .from('project_top_level_permissions')
        .upsert(upsertData, {
          onConflict: 'project_id,user_id,entity_type'
        });

      if (error) {
        console.error('Error updating top-level permissions:', error);
        throw error;
      }

      await loadPermissions();
    } catch (error) {
      console.error('Error in updatePermissions:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [projectId, userId]);

  return {
    permissions,
    loading,
    initializeDefaultPermissions,
    updatePermissions,
    refetch: loadPermissions
  };
}
