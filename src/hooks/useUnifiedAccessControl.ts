import { useState, useEffect } from 'react';
 import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { toast } from 'sonner';

export type EntityType = 'forms' | 'workflows' | 'reports' | 'dashboards' | 'projects' | 'policies';
export type ActionType = 'create' | 'read' | 'update' | 'delete';

interface TopLevelPermissions {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface RolePermissions {
  [resourceId: string]: {
    can_create: boolean;
    can_read: boolean;
    can_update: boolean;
    can_delete: boolean;
  };
}

interface AccessControlState {
  topLevelPermissions: Record<EntityType, TopLevelPermissions>;
  rolePermissions: Record<EntityType, RolePermissions>;
  userRole: string | null;
  isProjectAdmin: boolean;
  isOrgAdmin: boolean;
  loading: boolean;
}

const DEFAULT_PERM = { can_create: false, can_read: false, can_update: false, can_delete: false };

const defaultTopLevel = (): Record<EntityType, TopLevelPermissions> => ({
  forms: { ...DEFAULT_PERM },
  workflows: { ...DEFAULT_PERM },
  reports: { ...DEFAULT_PERM },
  dashboards: { ...DEFAULT_PERM },
  projects: { ...DEFAULT_PERM },
  policies: { ...DEFAULT_PERM },
});

const defaultRolePerms = (): Record<EntityType, RolePermissions> => ({
  forms: {},
  workflows: {},
  reports: {},
  dashboards: {},
  projects: {},
  policies: {},
});

export function useUnifiedAccessControl(projectId?: string, userId?: string) {
  const [state, setState] = useState<AccessControlState>({
    topLevelPermissions: defaultTopLevel(),
    rolePermissions: defaultRolePerms(),
    userRole: null,
    isProjectAdmin: false,
    isOrgAdmin: false,
    loading: true
  });

  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const { effectiveUserId, effectiveRole } = useEffectiveUser();

  const targetProjectId = projectId || currentProject?.id;
  // Use effective user when impersonating, otherwise use provided userId or real user
  const targetUserId = userId || effectiveUserId || userProfile?.id;

  const queryClient = useQueryClient();
  
  // Use React Query for caching - prevents repeated DB calls on navigation
  const queryKey = ['unified-access-control', targetProjectId, targetUserId, effectiveRole];
  
  const { data: accessData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!targetProjectId || !targetUserId) {
        return {
          topLevelPermissions: defaultTopLevel(),
          rolePermissions: defaultRolePerms(),
          userRole: null,
          isProjectAdmin: false,
          isOrgAdmin: false
        };
      }

      // Batch all queries in parallel for performance
      const [topLevelResult, projectUserResult, projectResult, roleAssignmentsResult] = await Promise.all([
        supabase
          .from('project_top_level_permissions')
          .select('*')
          .eq('project_id', targetProjectId)
          .eq('user_id', targetUserId)
          ,
        supabase
          .from('project_users')
          .select('role')
          .eq('project_id', targetProjectId)
          .eq('user_id', targetUserId)
          .single(),
        supabase
          .from('projects')
          .select('created_by')
          .eq('id', targetProjectId)
          .single(),
        supabase
          .from('user_role_assignments')
          .select(`
            id,
            role_id,
            roles (
              id,
              name,
              description
            )
          `)
          .eq('user_id', targetUserId)
      ]);

      const topLevelData = topLevelResult.data;
      const projectUserData = projectUserResult.data;
      const projectData = projectResult.data;
      const roleAssignments = roleAssignmentsResult.data;

      const isProjectAdmin = projectUserData?.role === 'admin' || effectiveRole === 'admin';
      const isOrgAdmin = effectiveRole === 'admin';
      const isProjectCreator = projectData?.created_by === targetUserId;

      // Fetch role permissions if needed
      const rolePermissionsMap = new Map<string, any[]>();
      
      if (roleAssignments && roleAssignments.length > 0) {
        const roleIds = roleAssignments.map(assignment => assignment.role_id);
        
        const { data: rolePermissions } = await supabase
          .from('role_permissions')
          .select('*')
          .in('role_id', roleIds);

        rolePermissions?.forEach(perm => {
          if (!rolePermissionsMap.has(perm.role_id)) {
            rolePermissionsMap.set(perm.role_id, []);
          }
          rolePermissionsMap.get(perm.role_id)?.push(perm);
        });
      }

      const processedTopLevel = defaultTopLevel();

      topLevelData?.forEach(perm => {
        const entityType = perm.entity_type as EntityType;
        if (processedTopLevel[entityType]) {
          processedTopLevel[entityType] = {
            can_create: perm.can_create,
            can_read: perm.can_read,
            can_update: perm.can_update,
            can_delete: perm.can_delete
          };
        }
      });

      const processedRolePermissions = defaultRolePerms();

      let userRoleName: string | null = null;

      if (roleAssignments && roleAssignments.length > 0) {
        roleAssignments.forEach((assignment) => {
          const role = assignment.roles;
          if (role) {
            userRoleName = role.name;
            const permissions = rolePermissionsMap.get(assignment.role_id) || [];

            permissions.forEach((perm: any) => {
              let mappedEntityType: EntityType;
              const typeMap: Record<string, EntityType> = {
                'form': 'forms',
                'workflow': 'workflows',
                'report': 'reports',
                'dashboard': 'dashboards',
                'project': 'projects',
                'policy': 'policies',
              };
              mappedEntityType = typeMap[perm.resource_type];
              if (!mappedEntityType) return;

              const resourceId = perm.resource_id;
              
              if (resourceId) {
                if (!processedRolePermissions[mappedEntityType][resourceId]) {
                  processedRolePermissions[mappedEntityType][resourceId] = {
                    can_create: false,
                    can_read: false,
                    can_update: false,
                    can_delete: false
                  };
                }

                switch (perm.permission_type) {
                  case 'create':
                    processedRolePermissions[mappedEntityType][resourceId].can_create = true;
                    break;
                  case 'update':
                    processedRolePermissions[mappedEntityType][resourceId].can_update = true;
                    break;
                  case 'delete':
                    processedRolePermissions[mappedEntityType][resourceId].can_delete = true;
                    break;
                  case 'read':
                    processedRolePermissions[mappedEntityType][resourceId].can_read = true;
                    break;
                }
              }
            });
          }
        });
      }

      return {
        topLevelPermissions: processedTopLevel,
        rolePermissions: processedRolePermissions,
        userRole: userRoleName,
        isProjectAdmin: isProjectAdmin || isProjectCreator,
        isOrgAdmin
      };
    },
    enabled: !!targetProjectId && !!targetUserId,
    staleTime: 2 * 60 * 1000, // 2 minutes - matches global cache strategy
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });

  // Update state from query data
  useEffect(() => {
    if (accessData) {
      setState({
        topLevelPermissions: accessData.topLevelPermissions,
        rolePermissions: accessData.rolePermissions,
        userRole: accessData.userRole,
        isProjectAdmin: accessData.isProjectAdmin,
        isOrgAdmin: accessData.isOrgAdmin,
        loading: false
      });
    } else if (!isLoading) {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [accessData, isLoading]);

  // Keep loading state in sync
  useEffect(() => {
    if (isLoading && !state.loading) {
      // Don't set loading to true if we already have cached data
      // This prevents flash of loading state on navigation
    }
  }, [isLoading]);

  const loadAccessControl = async () => {
    // Invalidate and refetch
    await queryClient.invalidateQueries({ queryKey });
  };

  const hasPermission = (entityType: EntityType, action: ActionType, resourceId?: string): boolean => {
    if (state.isOrgAdmin || state.isProjectAdmin) {
      return true;
    }

    const hasAssignedRole = !!state.userRole;

    const topLevelPerm = state.topLevelPermissions[entityType];
    let topLevelAllows = false;
    
    switch (action) {
      case 'create':
        topLevelAllows = topLevelPerm.can_create;
        break;
      case 'read':
        topLevelAllows = topLevelPerm.can_read;
        break;
      case 'update':
        topLevelAllows = topLevelPerm.can_update;
        break;
      case 'delete':
        topLevelAllows = topLevelPerm.can_delete;
        break;
    }

    if (!topLevelAllows) {
      return false;
    }

    if (!hasAssignedRole) {
      return topLevelAllows;
    }

    if (resourceId) {
      const rolePerms = state.rolePermissions[entityType][resourceId];
      
      if (!rolePerms) {
        return false;
      }
      
      let roleAllows = false;
      switch (action) {
        case 'create':
          roleAllows = rolePerms.can_create;
          break;
        case 'read':
          roleAllows = rolePerms.can_read;
          break;
        case 'update':
          roleAllows = rolePerms.can_update;
          break;
        case 'delete':
          roleAllows = rolePerms.can_delete;
          break;
      }
      
      return roleAllows;
    } else {
      return true;
    }
  };

  const getVisibleResources = (entityType: EntityType, allResources: any[]): any[] => {
    if (state.isOrgAdmin || state.isProjectAdmin) {
      return allResources;
    }

    const hasAssignedRole = !!state.userRole;

    if (!hasAssignedRole) {
      const canRead = state.topLevelPermissions[entityType]?.can_read;
      
      if (!canRead) {
        return [];
      }

      if (entityType === 'forms') {
        return allResources.filter(resource => resource.isPublic === true);
      }

      return allResources;
    }

    const topLevelCanRead = state.topLevelPermissions[entityType]?.can_read;
    
    if (!topLevelCanRead) {
      return [];
    }

    if (entityType === 'forms') {
      return allResources.filter(resource => {
        if (resource.isPublic === true) {
          return true;
        }

        const rolePerms = state.rolePermissions[entityType][resource.id];
        const hasRoleReadAccess = rolePerms?.can_read || false;
        
        return hasRoleReadAccess;
      });
    }

    return allResources.filter(resource => {
      const rolePerms = state.rolePermissions[entityType][resource.id];
      return rolePerms?.can_read || false;
    });
  };

  const checkPermissionWithAlert = (entityType: EntityType, action: ActionType, resourceId?: string): boolean => {
    const hasAccess = hasPermission(entityType, action, resourceId);
    
    if (!hasAccess) {
      if (state.isOrgAdmin || state.isProjectAdmin) {
        return hasAccess;
      }

      const hasAssignedRole = !!state.userRole;
      
      if (!hasAssignedRole) {
        toast.error(`You do not have ${action} permission for ${entityType}`);
      } else {
        const topLevelPerm = state.topLevelPermissions[entityType];
        let topLevelAllows = false;
        
        switch (action) {
          case 'create':
            topLevelAllows = topLevelPerm.can_create;
            break;
          case 'read':
            topLevelAllows = topLevelPerm.can_read;
            break;
          case 'update':
            topLevelAllows = topLevelPerm.can_update;
            break;
          case 'delete':
            topLevelAllows = topLevelPerm.can_delete;
            break;
        }

        if (!topLevelAllows) {
          toast.error(`You do not have top-level ${action} permission for ${entityType}`);
        } else {
          if (resourceId) {
            toast.error(`Your role does not have ${action} permission for this specific ${entityType.slice(0, -1)}`);
          } else {
            toast.error(`Your role does not have ${action} permission for any ${entityType}`);
          }
        }
      }
    }
    
    return hasAccess;
  };

  const getUserPermissions = (entityType: EntityType, resourceId: string) => {
    return {
      view: hasPermission(entityType, 'read', resourceId),
      create: hasPermission(entityType, 'create'),
      edit: hasPermission(entityType, 'update', resourceId),
      delete: hasPermission(entityType, 'delete', resourceId),
      disabled: false
    };
  };

  const getButtonState = (entityType: EntityType, action: ActionType, resourceId?: string) => {
    const hasAccess = hasPermission(entityType, action, resourceId);
    
    if (hasAccess) {
      return { disabled: false, tooltip: '' };
    }

    if (state.isOrgAdmin || state.isProjectAdmin) {
      return { disabled: false, tooltip: '' };
    }

    const hasAssignedRole = !!state.userRole;
    let tooltip = '';

    if (!hasAssignedRole) {
      tooltip = `No ${action} permission for ${entityType}`;
    } else {
      const topLevelPerm = state.topLevelPermissions[entityType];
      let topLevelAllows = false;
      
      switch (action) {
        case 'create':
          topLevelAllows = topLevelPerm.can_create;
          break;
        case 'read':
          topLevelAllows = topLevelPerm.can_read;
          break;
        case 'update':
          topLevelAllows = topLevelPerm.can_update;
          break;
        case 'delete':
          topLevelAllows = topLevelPerm.can_delete;
          break;
      }

      if (!topLevelAllows) {
        tooltip = `No top-level ${action} permission for ${entityType}`;
      } else {
        if (resourceId) {
          tooltip = `Role lacks ${action} permission for this specific ${entityType.slice(0, -1)}`;
        } else {
          tooltip = `Role lacks ${action} permission for ${entityType}`;
        }
      }
    }

    return { disabled: true, tooltip };
  };

  return {
    ...state,
    hasPermission,
    checkPermissionWithAlert,
    getUserPermissions,
    getButtonState,
    getVisibleResources,
    reloadAccessControl: loadAccessControl
  };
}
