
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface Role {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  organization_id: string;
  top_level_access: 'creator' | 'editor' | 'viewer' | 'no_access';
  created_at: string;
  updated_at: string;
  creator_name?: string;
  permissions: RolePermission[];
}

export interface RolePermission {
  id: string;
  resource_type: 'project' | 'form' | 'workflow' | 'report';
  resource_id?: string;
  permission_type: 'create' | 'read' | 'update' | 'delete';
  resource_name?: string;
}

export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  const fetchRoles = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      
      // First, fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Then fetch user profiles for creators
      const creatorIds = [...new Set(rolesData?.map(role => role.created_by) || [])];
      let userProfiles: any[] = [];
      
      if (creatorIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name, email')
          .in('id', creatorIds);

        if (profilesError) {
          console.warn('Error fetching user profiles:', profilesError);
        } else {
          userProfiles = profilesData || [];
        }
      }

      // Fetch permissions for each role
      const roleIds = rolesData?.map(role => role.id) || [];
      
      let permissionsData: any[] = [];
      if (roleIds.length > 0) {
        const { data, error: permissionsError } = await supabase
          .from('role_permissions')
          .select('*')
          .in('role_id', roleIds);

        if (permissionsError) throw permissionsError;
        permissionsData = data || [];
      }

      // Combine roles with their permissions and creator info
      const enrichedRoles: Role[] = (rolesData || []).map(role => {
        const profile = userProfiles.find(p => p.id === role.created_by);
        let creator_name = 'Unknown';
        
        if (profile) {
          const firstName = profile.first_name;
          const lastName = profile.last_name;
          const email = profile.email;
          
          if (firstName && lastName) {
            creator_name = `${firstName} ${lastName}`;
          } else if (email) {
            creator_name = email;
          }
        }

        return {
          ...role,
          top_level_access: role.top_level_access as 'creator' | 'editor' | 'viewer' | 'no_access',
          creator_name,
          permissions: permissionsData.filter(p => p.role_id === role.id)
        };
      });

      setRoles(enrichedRoles);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const refetchRoles = () => {
    fetchRoles();
  };

  useEffect(() => {
    fetchRoles();
  }, [currentOrganization?.id]);

  return {
    roles,
    loading,
    refetchRoles
  };
}
