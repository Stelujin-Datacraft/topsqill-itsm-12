
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from 'sonner';

export type EntityType = 'forms' | 'workflows' | 'reports';
export type ActionType = 'create' | 'read' | 'update' | 'delete';

interface TopLevelPermission {
  entity_type: EntityType;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface UserPermissions {
  topLevelPermissions: TopLevelPermission[];
  rolePermissions: Record<string, string[]>;
  isProjectAdmin: boolean;
  isOrgAdmin: boolean;
}

export function useComprehensivePermissions(projectId?: string, userId?: string) {
  const [permissions, setPermissions] = useState<UserPermissions>({
    topLevelPermissions: [],
    rolePermissions: {},
    isProjectAdmin: false,
    isOrgAdmin: false
  });
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { currentProject } = useProject();

  const targetProjectId = projectId || currentProject?.id;
  const targetUserId = userId || userProfile?.id;

  const loadPermissions = async () => {
    if (!targetProjectId || !targetUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load top-level permissions (excluding projects)
      const { data: topLevelData, error: topLevelError } = await supabase
        .from('project_top_level_permissions')
        .select('*')
        .eq('project_id', targetProjectId)
        .eq('user_id', targetUserId)
        .neq('entity_type', 'projects');

      if (topLevelError) {
        console.error('Error loading top-level permissions:', topLevelError);
      }

      // Check if user is project admin
      const { data: projectUserData, error: projectUserError } = await supabase
        .from('project_users')
        .select('role')
        .eq('project_id', targetProjectId)
        .eq('user_id', targetUserId)
        .single();

      if (projectUserError && projectUserError.code !== 'PGRST116') {
        console.error('Error checking project admin status:', projectUserError);
      }

      // Check if user is org admin
      const { data: userProfileData, error: userProfileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', targetUserId)
        .single();

      if (userProfileError) {
        console.error('Error loading user profile:', userProfileError);
      }

      const isOrgAdmin = userProfileData?.role === 'admin';
      const isProjectAdmin = projectUserData?.role === 'admin' || isOrgAdmin;

      // Load role permissions (simplified for now - can be expanded)
      const rolePermissions: Record<string, string[]> = {};

      // Transform top-level data with proper typing
      const topLevelPermissions: TopLevelPermission[] = (topLevelData || []).map(item => ({
        entity_type: item.entity_type as EntityType,
        can_create: item.can_create,
        can_read: item.can_read,
        can_update: item.can_update,
        can_delete: item.can_delete
      }));

      setPermissions({
        topLevelPermissions,
        rolePermissions,
        isProjectAdmin,
        isOrgAdmin
      });
    } catch (error) {
      console.error('Error loading comprehensive permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [targetProjectId, targetUserId]);

  const hasPermission = (entityType: EntityType, action: ActionType): boolean => {
    // Admin users have all permissions
    if (permissions.isOrgAdmin || permissions.isProjectAdmin) {
      return true;
    }

    // Check top-level permissions first (they are the primary constraint)
    const topLevelPerm = permissions.topLevelPermissions.find(p => p.entity_type === entityType);
    if (!topLevelPerm) {
      // If no top-level permission exists, default to no access
      return false;
    }

    // Return top-level permission for the action
    switch (action) {
      case 'create': return topLevelPerm.can_create;
      case 'read': return topLevelPerm.can_read;
      case 'update': return topLevelPerm.can_update;
      case 'delete': return topLevelPerm.can_delete;
      default: return false;
    }
  };

  const checkPermissionWithAlert = (entityType: EntityType, action: ActionType): boolean => {
    const hasAccess = hasPermission(entityType, action);
    if (!hasAccess) {
      toast.error('You do not have permission to perform this action');
    }
    return hasAccess;
  };

  return {
    permissions,
    loading,
    hasPermission,
    checkPermissionWithAlert,
    reloadPermissions: loadPermissions
  };
}
