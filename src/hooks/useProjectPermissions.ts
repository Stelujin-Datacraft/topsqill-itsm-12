
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProjectPermission, ProjectUserWithPermissions } from '@/types/project';
import { toast } from '@/hooks/use-toast';

export function useProjectPermissions(projectId: string) {
  const [permissions, setPermissions] = useState<ProjectPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('project_permissions')
        .select('*')
        .eq('project_id', projectId);

      if (error) {
        console.error('Error loading project permissions:', error);
        return;
      }

      // Type the data properly by casting the resource_type and permission_level
      const typedPermissions: ProjectPermission[] = (data || []).map(perm => ({
        ...perm,
        resource_type: perm.resource_type as ProjectPermission['resource_type'],
        permission_level: perm.permission_level as ProjectPermission['permission_level']
      }));

      setPermissions(typedPermissions);
    } catch (error) {
      console.error('Error loading project permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const grantPermission = async (
    userId: string,
    resourceType: ProjectPermission['resource_type'],
    permissionLevel: ProjectPermission['permission_level']
  ) => {
    try {
      const { error } = await supabase
        .from('project_permissions')
        .upsert({
          project_id: projectId,
          user_id: userId,
          resource_type: resourceType,
          permission_level: permissionLevel,
        });

      if (error) {
        console.error('Error granting permission:', error);
        throw error;
      }

      await loadPermissions();
      toast({
        title: "Permission granted",
        description: `${permissionLevel} access granted for ${resourceType}`,
      });
    } catch (error) {
      console.error('Error granting permission:', error);
      toast({
        title: "Error",
        description: "Failed to grant permission",
        variant: "destructive",
      });
    }
  };

  const revokePermission = async (
    userId: string,
    resourceType: ProjectPermission['resource_type']
  ) => {
    try {
      const { error } = await supabase
        .from('project_permissions')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('resource_type', resourceType);

      if (error) {
        console.error('Error revoking permission:', error);
        throw error;
      }

      await loadPermissions();
      toast({
        title: "Permission revoked",
        description: `Access revoked for ${resourceType}`,
      });
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast({
        title: "Error",
        description: "Failed to revoke permission",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [projectId]);

  return {
    permissions,
    loading,
    grantPermission,
    revokePermission,
    loadPermissions,
  };
}
