
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/hooks/use-toast';

interface WorkflowAccessWithUser {
  id: string;
  user_id: string;
  permission_type: string;
  granted_by: string;
  granted_at: string;
  user_profiles: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export function useWorkflowAccess(workflowId: string) {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: workflowAccess = [], isLoading: loading } = useQuery({
    queryKey: ['workflow-access', workflowId],
    queryFn: async () => {
      if (!workflowId || !currentProject) return [];
      
      // First get the asset permissions
      const { data: permissions, error: permissionsError } = await supabase
        .from('asset_permissions')
        .select('*')
        .eq('asset_type', 'workflow')
        .eq('asset_id', workflowId)
        .eq('project_id', currentProject.id);

      if (permissionsError) throw permissionsError;
      
      if (!permissions || permissions.length === 0) return [];

      // Then get user profiles for these permissions
      const userIds = [...new Set(permissions.map(p => p.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const combinedData = permissions.map(permission => ({
        ...permission,
        user_profiles: profiles?.find(profile => profile.id === permission.user_id) || null
      }));

      return combinedData || [];
    },
    enabled: !!workflowId && !!currentProject,
  });

  const grantAccess = async (userId: string, accessLevel: 'view' | 'edit' | 'admin') => {
    if (!currentProject || !userProfile) return;

    try {
      // Remove existing permissions for this user
      await supabase
        .from('asset_permissions')
        .delete()
        .eq('asset_type', 'workflow')
        .eq('asset_id', workflowId)
        .eq('user_id', userId)
        .eq('project_id', currentProject.id);

      // Add new permissions based on access level
      const permissions = [];
      
      if (accessLevel === 'view') {
        permissions.push('view');
      } else if (accessLevel === 'edit') {
        permissions.push('view', 'edit');
      } else if (accessLevel === 'admin') {
        permissions.push('view', 'edit', 'delete', 'share', 'start_instances');
      }

      for (const permission of permissions) {
        const { error } = await supabase
          .from('asset_permissions')
          .insert({
            project_id: currentProject.id,
            user_id: userId,
            asset_type: 'workflow',
            asset_id: workflowId,
            permission_type: permission,
            granted_by: userProfile.id,
          });

        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['workflow-access'] });
      
      toast({
        title: "Access granted",
        description: `${accessLevel} access granted successfully`,
      });
    } catch (error) {
      console.error('Error granting access:', error);
      toast({
        title: "Error",
        description: "Failed to grant access",
        variant: "destructive",
      });
    }
  };

  const revokeAccess = async (userId: string) => {
    if (!currentProject) return;

    try {
      const { error } = await supabase
        .from('asset_permissions')
        .delete()
        .eq('asset_type', 'workflow')
        .eq('asset_id', workflowId)
        .eq('user_id', userId)
        .eq('project_id', currentProject.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['workflow-access'] });
      
      toast({
        title: "Access revoked",
        description: "Access revoked successfully",
      });
    } catch (error) {
      console.error('Error revoking access:', error);
      toast({
        title: "Error",
        description: "Failed to revoke access",
        variant: "destructive",
      });
    }
  };

  const checkUserAccess = (userId: string): 'view' | 'edit' | 'admin' | null => {
    const userPermissions = workflowAccess.filter(access => access.user_id === userId);
    
    if (userPermissions.some(p => p.permission_type === 'delete' || p.permission_type === 'share' || p.permission_type === 'start_instances')) {
      return 'admin';
    } else if (userPermissions.some(p => p.permission_type === 'edit')) {
      return 'edit';
    } else if (userPermissions.some(p => p.permission_type === 'view')) {
      return 'view';
    }
    
    return null;
  };

  // Group permissions by user and determine their access level
  const groupedAccess = workflowAccess.reduce((acc: any[], permission: any) => {
    const existingUser = acc.find(item => item.user_id === permission.user_id);
    
    if (existingUser) {
      existingUser.permissions.push(permission.permission_type);
    } else {
      acc.push({
        id: permission.id,
        user_id: permission.user_id,
        permissions: [permission.permission_type],
        user_profiles: permission.user_profiles,
        granted_by: permission.granted_by,
        granted_at: permission.granted_at,
        access_level: checkUserAccess(permission.user_id)
      });
    }
    
    return acc;
  }, []);

  return {
    workflowAccess: groupedAccess,
    loading,
    grantAccess,
    revokeAccess,
    checkUserAccess,
  };
}
