
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

interface CreateRoleData {
  name: string;
  description?: string;
  topLevelAccess: 'creator' | 'editor' | 'viewer' | 'no_access';
  resourcePermissions: Record<string, string[]>;
}

interface UpdateRoleData extends CreateRoleData {
  roleId: string;
}

export function useCreateRole() {
  const [loading, setLoading] = useState(false);
  const { currentOrganization } = useOrganization();
  const { userProfile } = useAuth();

  const createRole = async (data: CreateRoleData) => {
    if (!currentOrganization?.id || !userProfile?.id) {
      throw new Error('Organization or user not found');
    }

    setLoading(true);
    
    try {
      console.log('Creating role with data:', data);
      
      // Create the role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .insert({
          name: data.name,
          description: data.description,
          created_by: userProfile.id,
          organization_id: currentOrganization.id,
          top_level_access: data.topLevelAccess
        })
        .select()
        .single();

      if (roleError) {
        console.error('Error creating role:', roleError);
        throw roleError;
      }

      console.log('Role created successfully:', roleData);

      // Prepare permissions to insert
      const permissionsToInsert: any[] = [];

      // Add resource-specific permissions
      Object.entries(data.resourcePermissions).forEach(([key, permissionTypes]) => {
        const [resourceType, resourceId] = key.split(':');
        
        // Map resource types correctly for database
        let dbResourceType = resourceType;
        if (resourceType === 'forms') {
          dbResourceType = 'form';
        } else if (resourceType === 'workflows') {
          dbResourceType = 'workflow';
        } else if (resourceType === 'reports') {
          dbResourceType = 'report';
        }
        
        permissionTypes.forEach(permission => {
          permissionsToInsert.push({
            role_id: roleData.id,
            resource_type: dbResourceType,
            resource_id: resourceId,
            permission_type: permission
          });
        });
      });

      console.log('Permissions to insert:', permissionsToInsert);

      // Insert permissions if any
      if (permissionsToInsert.length > 0) {
        const { error: permissionsError } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert);

        if (permissionsError) {
          console.error('Error creating permissions:', permissionsError);
          throw permissionsError;
        }
        
        console.log('Permissions created successfully');
      }

      return roleData;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (data: UpdateRoleData) => {
    if (!currentOrganization?.id || !userProfile?.id) {
      throw new Error('Organization or user not found');
    }

    setLoading(true);
    
    try {
      console.log('Updating role with data:', data);
      
      // Update the role
      const { error: roleError } = await supabase
        .from('roles')
        .update({
          name: data.name,
          description: data.description,
          top_level_access: data.topLevelAccess,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.roleId);

      if (roleError) {
        console.error('Error updating role:', roleError);
        throw roleError;
      }

      // Delete existing permissions
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', data.roleId);

      if (deleteError) {
        console.error('Error deleting existing permissions:', deleteError);
        throw deleteError;
      }

      // Prepare permissions to insert
      const permissionsToInsert: any[] = [];

      // Add resource-specific permissions
      Object.entries(data.resourcePermissions).forEach(([key, permissionTypes]) => {
        const [resourceType, resourceId] = key.split(':');
        
        // Map resource types correctly for database
        let dbResourceType = resourceType;
        if (resourceType === 'forms') {
          dbResourceType = 'form';
        } else if (resourceType === 'workflows') {
          dbResourceType = 'workflow';
        } else if (resourceType === 'reports') {
          dbResourceType = 'report';
        }
        
        permissionTypes.forEach(permission => {
          permissionsToInsert.push({
            role_id: data.roleId,
            resource_type: dbResourceType,
            resource_id: resourceId,
            permission_type: permission
          });
        });
      });

      // Insert permissions if any
      if (permissionsToInsert.length > 0) {
        const { error: permissionsError } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert);

        if (permissionsError) {
          console.error('Error updating permissions:', permissionsError);
          throw permissionsError;
        }
      }

      return { id: data.roleId };
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    createRole,
    updateRole,
    loading
  };
}
