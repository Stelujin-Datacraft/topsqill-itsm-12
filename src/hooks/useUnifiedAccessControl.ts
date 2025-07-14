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

      // Load top-level permissions (no projects entity type)
      const { data: topLevelData, error: topLevelError } = await supabase
        .from('project_top_level_permissions')
        .select('*')
        .eq('project_id', targetProjectId)
        .eq('user_id', targetUserId)
        .neq('entity_type', 'projects');

      if (topLevelError) {
        console.error('Error loading top-level permissions:', topLevelError);
      }

      // Check admin status
      const { data: projectUserData, error: projectUserError } = await supabase
        .from('project_users')
        .select('role')
        .eq('project_id', targetProjectId)
        .eq('user_id', targetUserId)
        .single();

      const isProjectAdmin = projectUserData?.role === 'admin' || userProfile?.role === 'admin';
      const isOrgAdmin = userProfile?.role === 'admin';

      // Check if user is project creator
      const { data: projectData } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', targetProjectId)
        .single();
      
      const isProjectCreator = projectData?.created_by === targetUserId;

      // Load user role assignments - FIXED QUERY
      const { data: roleAssignments, error: roleError } = await supabase
        .from('user_role_assignments')
        .select(`
          role_id,
          roles!inner(
            name,
            role_permissions(
              resource_type,
              resource_id,
              permission_type
            )
          )
        `)
        .eq('user_id', targetUserId);

      if (roleError) {
        console.error('Error loading role assignments:', roleError);
      }

      // Process top-level permissions - Start with false, only set what's explicitly granted
      const processedTopLevel: Record<EntityType, TopLevelPermissions> = {
        forms: { can_create: false, can_read: false, can_update: false, can_delete: false },
        workflows: { can_create: false, can_read: false, can_update: false, can_delete: false },
        reports: { can_create: false, can_read: false, can_update: false, can_delete: false }
      };

      // Apply loaded top-level permissions
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

      // Process role permissions - Initialize with explicit structure
      const processedRolePermissions: Record<EntityType, RolePermissions> = {
        forms: {},
        workflows: {},
        reports: {}
      };

      let userRoleName: string | null = null;

      // CRITICAL FIX: Check if roleAssignments exists and has data
      if (roleAssignments && roleAssignments.length > 0) {
        roleAssignments.forEach(assignment => {
          const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
          if (role) {
            userRoleName = role.name;
            role.role_permissions?.forEach((perm: any) => {
              // Map database resource types to frontend types
              let mappedEntityType: EntityType;
              if (perm.resource_type === 'form') {
                mappedEntityType = 'forms';
              } else if (perm.resource_type === 'workflow') {
                mappedEntityType = 'workflows';
              } else if (perm.resource_type === 'report') {
                mappedEntityType = 'reports';
              } else {
                return; // Skip unknown types
              }

              const resourceId = perm.resource_id;
              
              if (resourceId) {
                // Initialize resource permissions if not exists (defaults to false for all permissions)
                if (!processedRolePermissions[mappedEntityType][resourceId]) {
                  processedRolePermissions[mappedEntityType][resourceId] = {
                    can_create: false,
                    can_read: false,
                    can_update: false,
                    can_delete: false
                  };
                }

                // Set the specific permission to true
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

      console.log('🔧 FIXED Access control loaded:', {
        topLevelPermissions: processedTopLevel,
        rolePermissions: processedRolePermissions,
        isProjectAdmin: isProjectAdmin || isProjectCreator,
        isOrgAdmin,
        userRole: userRoleName,
        hasRole: !!userRoleName,
        roleAssignments: roleAssignments?.length || 0
      });

    } catch (error) {
      console.error('Error loading access control:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadAccessControl();
  }, [targetProjectId, targetUserId]);

  // Main permission check function with STRICT role-based logic
  const hasPermission = (entityType: EntityType, action: ActionType, resourceId?: string): boolean => {
    console.log(`🔍 Checking permission: ${entityType} ${action}${resourceId ? ` on ${resourceId}` : ''}`);
    
    // Admin users have all permissions - skip all checks
    if (state.isOrgAdmin || state.isProjectAdmin) {
      console.log(`✅ Admin access granted for ${entityType} ${action}`);
      return true;
    }

    // Check if user has a role assigned
    const hasAssignedRole = !!state.userRole;
    console.log(`🎭 User has assigned role: ${hasAssignedRole} (${state.userRole})`);

    // Step 1: Check top-level permissions first
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

    console.log(`📊 Top-level permission for ${entityType} ${action}:`, topLevelAllows);

    // If top-level doesn't allow, immediately deny
    if (!topLevelAllows) {
      console.log(`❌ Access denied: Top-level permission denied for ${entityType} ${action}`);
      return false;
    }

    // CASE 1: No role assigned - use only top-level permissions
    if (!hasAssignedRole) {
      console.log(`📊 No role assigned - Access granted based on top-level permission: ${topLevelAllows}`);
      return topLevelAllows;
    }

    // CASE 2: Role assigned - need BOTH top-level AND role permissions
    
    // Step 2: Check role permissions for specific resource
    if (resourceId) {
      // For specific resource access - MUST have explicit role permission
      const rolePerms = state.rolePermissions[entityType][resourceId];
      
      // IMPORTANT: If no role permission exists for this resource, DENY access
      if (!rolePerms) {
        console.log(`❌ Access denied: No role permission found for ${entityType} ${action} on ${resourceId}`);
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
      
      console.log(`🎭 Role permission for ${entityType} ${action} on ${resourceId}:`, roleAllows);
      console.log(`✅ Final decision: ${roleAllows ? 'GRANTED' : 'DENIED'}`);
      return roleAllows;
    } else {
      // For general actions (like create), check if role has any permissions for this entity type
      const hasAnyRolePermission = Object.keys(state.rolePermissions[entityType]).length > 0;
      
      if (!hasAnyRolePermission) {
        console.log(`❌ Access denied: User has role but no permissions for ${entityType}`);
        return false;
      }

      // Check if any role permission allows this action
      const roleAllowsAction = Object.values(state.rolePermissions[entityType]).some(perm => {
        switch (action) {
          case 'create':
            return perm.can_create;
          case 'read':
            return perm.can_read;
          case 'update':
            return perm.can_update;
          case 'delete':
            return perm.can_delete;
          default:
            return false;
        }
      });
      
      console.log(`🎭 Role allows general ${entityType} ${action}:`, roleAllowsAction);
      console.log(`✅ Final decision: ${roleAllowsAction ? 'GRANTED' : 'DENIED'}`);
      return roleAllowsAction;
    }
  };

  // Enhanced getVisibleResources - only show resources user has READ access to with proper private form filtering
  const getVisibleResources = (entityType: EntityType, allResources: any[]): any[] => {
    if (state.isOrgAdmin || state.isProjectAdmin) {
      return allResources; // Admins see everything
    }

    const hasAssignedRole = !!state.userRole;

    if (!hasAssignedRole) {
      // No role - check top-level read permission
      const canRead = state.topLevelPermissions[entityType]?.can_read;
      if (!canRead) {
        return []; // No top-level read access
      }

      // For forms specifically, apply private/public filtering
      if (entityType === 'forms') {
        return allResources.filter(resource => {
          // Only show public forms if user has no assigned role
          return resource.isPublic === true;
        });
      }

      return canRead ? allResources : [];
    }

    // Role assigned - check both top-level AND role permissions
    const topLevelCanRead = state.topLevelPermissions[entityType]?.can_read;
    if (!topLevelCanRead) {
      return []; // No top-level read access
    }

    // For forms, apply enhanced filtering based on role permissions and visibility
    if (entityType === 'forms') {
      return allResources.filter(resource => {
        // Public forms: show if user has top-level read access
        if (resource.isPublic === true) {
          return true;
        }

        // Private forms: require explicit role permission
        const rolePerms = state.rolePermissions[entityType][resource.id];
        const hasRoleReadAccess = rolePerms?.can_read || false;
        
        console.log(`🔍 Private form ${resource.name} (${resource.id}): role read access = ${hasRoleReadAccess}`);
        return hasRoleReadAccess;
      });
    }

    // For other entities, use existing logic
    return allResources.filter(resource => {
      const rolePerms = state.rolePermissions[entityType][resource.id];
      return rolePerms?.can_read || false;
    });
  };

  // Permission check with detailed alert messages
  const checkPermissionWithAlert = (entityType: EntityType, action: ActionType, resourceId?: string): boolean => {
    const hasAccess = hasPermission(entityType, action, resourceId);
    
    if (!hasAccess) {
      // Admin users don't need detailed error messages
      if (state.isOrgAdmin || state.isProjectAdmin) {
        return hasAccess; // Should always be true for admins
      }

      const hasAssignedRole = !!state.userRole;
      
      if (!hasAssignedRole) {
        toast.error(`You do not have ${action} permission for ${entityType}`);
      } else {
        // Check what specifically is missing
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

  // Get user permissions for a specific resource (for UI display)
  const getUserPermissions = (entityType: EntityType, resourceId: string) => {
    return {
      view: hasPermission(entityType, 'read', resourceId),
      create: hasPermission(entityType, 'create'),
      edit: hasPermission(entityType, 'update', resourceId),
      delete: hasPermission(entityType, 'delete', resourceId),
      disabled: false
    };
  };

  // Check if button should be disabled with reason
  const getButtonState = (entityType: EntityType, action: ActionType, resourceId?: string) => {
    const hasAccess = hasPermission(entityType, action, resourceId);
    
    if (hasAccess) {
      return { disabled: false, tooltip: '' };
    }

    // Admin users should never have disabled buttons
    if (state.isOrgAdmin || state.isProjectAdmin) {
      return { disabled: false, tooltip: '' };
    }

    const hasAssignedRole = !!state.userRole;
    let tooltip = '';

    if (!hasAssignedRole) {
      tooltip = `No ${action} permission for ${entityType}`;
    } else {
      // Check what specifically is missing for tooltip
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
