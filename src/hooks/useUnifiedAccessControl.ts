import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from 'sonner';

export type EntityType = 'forms' | 'workflows' | 'reports';
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

export function useUnifiedAccessControl(projectId?: string, userId?: string) {
  const [state, setState] = useState<AccessControlState>({
    topLevelPermissions: {
      forms: { can_create: false, can_read: false, can_update: false, can_delete: false },
      workflows: { can_create: false, can_read: false, can_update: false, can_delete: false },
      reports: { can_create: false, can_read: false, can_update: false, can_delete: false }
    },
    rolePermissions: {
      forms: {},
      workflows: {},
      reports: {}
    },
    userRole: null,
    isProjectAdmin: false,
    isOrgAdmin: false,
    loading: true
  });

  const { userProfile } = useAuth();
  const { currentProject } = useProject();

  const targetProjectId = projectId || currentProject?.id;
  const targetUserId = userId || userProfile?.id;

  const loadAccessControl = async () => {
    if (!targetProjectId || !targetUserId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));

      const { data: topLevelData, error: topLevelError } = await supabase
        .from('project_top_level_permissions')
        .select('*')
        .eq('project_id', targetProjectId)
        .eq('user_id', targetUserId)
        .neq('entity_type', 'projects');

      const { data: projectUserData } = await supabase
        .from('project_users')
        .select('role')
        .eq('project_id', targetProjectId)
        .eq('user_id', targetUserId)
        .single();

      const isProjectAdmin = projectUserData?.role === 'admin' || userProfile?.role === 'admin';
      const isOrgAdmin = userProfile?.role === 'admin';

      const { data: projectData } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', targetProjectId)
        .single();
      
      const isProjectCreator = projectData?.created_by === targetUserId;

      const { data: roleAssignments, error: roleError } = await supabase
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
        .eq('user_id', targetUserId);

      const rolePermissionsMap = new Map<string, any[]>();
      
      if (roleAssignments && roleAssignments.length > 0) {
        const roleIds = roleAssignments.map(assignment => assignment.role_id);
        
        const { data: rolePermissions, error: permError } = await supabase
          .from('role_permissions')
          .select('*')
          .in('role_id', roleIds);

        if (!permError) {
          rolePermissions?.forEach(perm => {
            if (!rolePermissionsMap.has(perm.role_id)) {
              rolePermissionsMap.set(perm.role_id, []);
            }
            rolePermissionsMap.get(perm.role_id)?.push(perm);
          });
        }
      }

      const processedTopLevel: Record<EntityType, TopLevelPermissions> = {
        forms: { can_create: false, can_read: false, can_update: false, can_delete: false },
        workflows: { can_create: false, can_read: false, can_update: false, can_delete: false },
        reports: { can_create: false, can_read: false, can_update: false, can_delete: false }
      };

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

      const processedRolePermissions: Record<EntityType, RolePermissions> = {
        forms: {},
        workflows: {},
        reports: {}
      };

      let userRoleName: string | null = null;

      if (roleAssignments && roleAssignments.length > 0) {
        roleAssignments.forEach((assignment) => {
          const role = assignment.roles;
          if (role) {
            userRoleName = role.name;
            const permissions = rolePermissionsMap.get(assignment.role_id) || [];

            permissions.forEach((perm: any) => {
              let mappedEntityType: EntityType;
              if (perm.resource_type === 'form') {
                mappedEntityType = 'forms';
              } else if (perm.resource_type === 'workflow') {
                mappedEntityType = 'workflows';
              } else if (perm.resource_type === 'report') {
                mappedEntityType = 'reports';
              } else {
                return;
              }

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

      setState({
        topLevelPermissions: processedTopLevel,
        rolePermissions: processedRolePermissions,
        userRole: userRoleName,
        isProjectAdmin: isProjectAdmin || isProjectCreator,
        isOrgAdmin,
        loading: false
      });

    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadAccessControl();
  }, [targetProjectId, targetUserId]);

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
