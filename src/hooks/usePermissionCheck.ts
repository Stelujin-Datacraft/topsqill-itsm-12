
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

export type EntityType = 'form' | 'report' | 'workflow';
export type ActionType = 
  | 'view' | 'edit' | 'delete' | 'create' | 'share'
  | 'view_submissions' | 'export_data' | 'manage_access'
  | 'change_settings' | 'change_lifecycle' | 'submit_form'
  | 'start_instances' | 'view_records' | 'export_records';

interface PermissionCheckResult {
  hasPermission: boolean;
  loading: boolean;
  error?: string;
}

export function usePermissionCheck(
  entityType: EntityType,
  entityId: string | null,
  action: ActionType
): PermissionCheckResult {
  const [result, setResult] = useState<PermissionCheckResult>({
    hasPermission: false,
    loading: true
  });
  
  const { userProfile } = useAuth();
  const { currentProject } = useProject();

  useEffect(() => {
    async function checkPermission() {
      if (!userProfile?.id || !currentProject?.id) {
        setResult({ hasPermission: false, loading: false });
        return;
      }

      try {
        setResult(prev => ({ ...prev, loading: true }));

        // Check if user is organization admin (has full access)
        if (userProfile.role === 'admin') {
          setResult({ hasPermission: true, loading: false });
          return;
        }

        // Check if user is project admin or creator
        const isProjectAdmin = await checkProjectAdmin(currentProject.id, userProfile.id);
        if (isProjectAdmin) {
          setResult({ hasPermission: true, loading: false });
          return;
        }

        // Check if user is a project member (should have read access by default)
        const isProjectMember = await checkProjectMembership(currentProject.id, userProfile.id);
        if (isProjectMember) {
          // For read/view actions, project members should have access by default
          if (action === 'view' || action === 'view_records' || action === 'view_submissions') {
            setResult({ hasPermission: true, loading: false });
            return;
          }
          
          // For create actions, check if they have explicit permission or top-level permission
          if (action === 'create') {
            const canCreate = await checkCreatePermission(currentProject.id, userProfile.id);
            setResult({ hasPermission: canCreate, loading: false });
            return;
          }
        }

        // For entity-specific actions, check asset permissions
        if (entityId) {
          const hasAssetPermission = await checkAssetPermission(
            currentProject.id,
            userProfile.id,
            entityType,
            entityId,
            action
          );
          
          // If no explicit asset permission but user is project member and action is view-related
          if (!hasAssetPermission && isProjectMember && (action === 'view' || action === 'view_records' || action === 'view_submissions')) {
            setResult({ hasPermission: true, loading: false });
            return;
          }
          
          setResult({ hasPermission: hasAssetPermission, loading: false });
        } else {
          setResult({ hasPermission: false, loading: false });
        }
      } catch (error) {
        console.error('Error checking permission:', error);
        setResult({ 
          hasPermission: false, 
          loading: false, 
          error: 'Failed to check permissions' 
        });
      }
    }

    checkPermission();
  }, [userProfile?.id, currentProject?.id, entityType, entityId, action, userProfile?.role]);

  return result;
}

async function checkProjectAdmin(projectId: string, userId: string): Promise<boolean> {
  try {
    // Check if user is project admin
    const { data: projectUser, error: projectUserError } = await supabase
      .from('project_users')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectUserError && projectUserError.code !== 'PGRST116') {
      console.error('Error checking project user:', projectUserError);
      return false;
    }

    if (projectUser?.role === 'admin') {
      return true;
    }

    // Check if user is project creator
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Error checking project creator:', projectError);
      return false;
    }

    return project?.created_by === userId;
  } catch (error) {
    console.error('Error in checkProjectAdmin:', error);
    return false;
  }
}

async function checkProjectMembership(projectId: string, userId: string): Promise<boolean> {
  try {
    const { data: projectUser, error } = await supabase
      .from('project_users')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking project membership:', error);
      return false;
    }

    return !!projectUser;
  } catch (error) {
    console.error('Error in checkProjectMembership:', error);
    return false;
  }
}

async function checkCreatePermission(projectId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('can_create_asset_in_project', {
        _project_id: projectId,
        _user_id: userId
      });

    if (error) {
      console.error('Error checking create permission:', error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error('Error in checkCreatePermission:', error);
    return false;
  }
}

async function checkAssetPermission(
  projectId: string,
  userId: string,
  assetType: EntityType,
  assetId: string,
  action: ActionType
): Promise<boolean> {
  try {
    // Map UI actions to database permission types
    const permissionMapping: Record<ActionType, string[]> = {
      'view': ['view'],
      'edit': ['edit'],
      'delete': ['delete'],
      'share': ['share'],
      'view_submissions': ['view_records', 'view_submissions'],
      'export_data': ['export_records', 'export_data'],
      'manage_access': ['share'],
      'change_settings': ['edit'],
      'change_lifecycle': ['edit'],
      'submit_form': ['submit_form'],
      'start_instances': ['start_instances'],
      'view_records': ['view_records'],
      'export_records': ['export_records'],
      'create': ['edit'] // fallback, should be handled above
    };

    const permissionTypes = permissionMapping[action] || [action];

    // Check each possible permission type
    for (const permissionType of permissionTypes) {
      const { data, error } = await supabase
        .rpc('has_asset_permission', {
          _project_id: projectId,
          _user_id: userId,
          _asset_type: assetType,
          _asset_id: assetId,
          _permission_type: permissionType
        });

      if (error) {
        console.error('Error checking asset permission:', error);
        continue;
      }

      if (data) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error in checkAssetPermission:', error);
    return false;
  }
}

// Utility function for checking permissions outside of React components
export async function checkUserPermission(
  userId: string,
  projectId: string,
  entityType: EntityType,
  entityId: string | null,
  action: ActionType
): Promise<boolean> {
  try {
    // Check if user is organization admin
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user profile:', userError);
      return false;
    }

    if (userProfile?.role === 'admin') {
      return true;
    }

    // Check project admin status
    const isProjectAdmin = await checkProjectAdmin(projectId, userId);
    if (isProjectAdmin) {
      return true;
    }

    // Check project membership for read access
    const isProjectMember = await checkProjectMembership(projectId, userId);
    if (isProjectMember && (action === 'view' || action === 'view_records' || action === 'view_submissions')) {
      return true;
    }

    // For create actions
    if (action === 'create') {
      return await checkCreatePermission(projectId, userId);
    }

    // For entity-specific actions
    if (entityId) {
      return await checkAssetPermission(projectId, userId, entityType, entityId, action);
    }

    return false;
  } catch (error) {
    console.error('Error in checkUserPermission:', error);
    return false;
  }
}
