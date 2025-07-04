
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AssetPermission } from '@/types/project';
import { toast } from '@/hooks/use-toast';

export function useAssetPermissions(projectId: string) {
  const [assetPermissions, setAssetPermissions] = useState<AssetPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssetPermissions = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('asset_permissions')
        .select('*')
        .eq('project_id', projectId);

      if (error) {
        console.error('Error loading asset permissions:', error);
        return;
      }

      // Type the data properly by casting the asset_type and permission_type
      const typedPermissions: AssetPermission[] = (data || []).map(perm => ({
        ...perm,
        asset_type: perm.asset_type as AssetPermission['asset_type'],
        permission_type: perm.permission_type as AssetPermission['permission_type']
      }));

      setAssetPermissions(typedPermissions);
    } catch (error) {
      console.error('Error loading asset permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const grantAssetPermission = async (
    userId: string,
    assetType: AssetPermission['asset_type'],
    assetId: string,
    permissionType: AssetPermission['permission_type']
  ) => {
    try {
      const { error } = await supabase
        .from('asset_permissions')
        .upsert({
          project_id: projectId,
          user_id: userId,
          asset_type: assetType,
          asset_id: assetId,
          permission_type: permissionType,
        });

      if (error) {
        console.error('Error granting asset permission:', error);
        throw error;
      }

      await loadAssetPermissions();
      toast({
        title: "Permission granted",
        description: `${permissionType} access granted for ${assetType}`,
      });
    } catch (error) {
      console.error('Error granting asset permission:', error);
      toast({
        title: "Error",
        description: "Failed to grant asset permission",
        variant: "destructive",
      });
    }
  };

  const revokeAssetPermission = async (
    userId: string,
    assetType: AssetPermission['asset_type'],
    assetId: string,
    permissionType: AssetPermission['permission_type']
  ) => {
    try {
      const { error } = await supabase
        .from('asset_permissions')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('asset_type', assetType)
        .eq('asset_id', assetId)
        .eq('permission_type', permissionType);

      if (error) {
        console.error('Error revoking asset permission:', error);
        throw error;
      }

      await loadAssetPermissions();
      toast({
        title: "Permission revoked",
        description: `${permissionType} access revoked for ${assetType}`,
      });
    } catch (error) {
      console.error('Error revoking asset permission:', error);
      toast({
        title: "Error",
        description: "Failed to revoke asset permission",
        variant: "destructive",
      });
    }
  };

  const hasAssetPermission = async (
    userId: string,
    assetType: AssetPermission['asset_type'],
    assetId: string,
    permissionType: AssetPermission['permission_type']
  ): Promise<boolean> => {
    try {
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
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking asset permission:', error);
      return false;
    }
  };

  const canCreateAssets = async (userId: string): Promise<boolean> => {
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
      console.error('Error checking create permission:', error);
      return false;
    }
  };

  useEffect(() => {
    loadAssetPermissions();
  }, [projectId]);

  return {
    assetPermissions,
    loading,
    grantAssetPermission,
    revokeAssetPermission,
    hasAssetPermission,
    canCreateAssets,
    loadAssetPermissions,
  };
}
