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
  projectPermissions: Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }>;
  userRole: string | null;
  hasRoleAssignments: boolean;
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
    projectPermissions: {},
    userRole: null,
    hasRoleAssignments: false,
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
          hasRoleAssignments: false,
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
          .maybeSingle(),
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
      const processedProjectPermissions: Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> = {};

      let userRoleName: string | null = null;
      const hasRoleAssignments = (roleAssignments?.length ?? 0) > 0;

      if (roleAssignments && roleAssignments.length > 0) {
        roleAssignments.forEach((assignment) => {
          const role = assignment.roles;
          if (role) {
            userRoleName = role.name;
            const permissions = rolePermissionsMap.get(assignment.role_id) || [];

            permissions.forEach((perm: any) => {
              // Project-scope permissions cascade to all entities inside that project
              if (perm.resource_type === 'project' && perm.resource_id) {
                const pid = perm.resource_id;
                if (!processedProjectPermissions[pid]) {
                  processedProjectPermissions[pid] = {
                    can_create: false,
                    can_read: false,
                    can_update: false,
                    can_delete: false,
                  };
                }
                const bucket = processedProjectPermissions[pid];
                switch (perm.permission_type) {
                  case 'create': bucket.can_create = true; break;
                  case 'read':   bucket.can_read = true; break;
                  case 'update': bucket.can_update = true; break;
                  case 'delete': bucket.can_delete = true; break;
                }
                return;
              }

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

              const resourceId = perm.resource_id ?? 'all';
              
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
        projectPermissions: processedProjectPermissions,
        userRole: userRoleName,
        hasRoleAssignments,
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
        projectPermissions: accessData.projectPermissions,
        userRole: accessData.userRole,
        hasRoleAssignments: accessData.hasRoleAssignments,
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

  // Check if the current user owns the given resource (createdBy can be UUID or email)
  const isResourceOwner = (resource: any): boolean => {
    if (!resource || !targetUserId) return false;
    const createdBy = resource.createdBy ?? resource.created_by;
    if (!createdBy) return false;
    if (createdBy === targetUserId) return true;
    if (userProfile?.email && createdBy === userProfile.email) return true;
    return false;
  };

  const hasAnyExplicitReadPermission = (entityType: EntityType): boolean => {
    const itemLevel = Object.entries(state.rolePermissions[entityType] || {}).some(([resourceId, perms]) => {
      // Update/delete grants implicitly include read so the user can see
      // the items they're allowed to act on.
      return perms.can_read || perms.can_update || perms.can_delete;
    });
    if (itemLevel) return true;
    // Project-level grant cascades ONLY to forms. For reports, dashboards,
    // workflows, and policies (KB docs/folders), read must be explicitly
    // granted per-item or via the ':all' wildcard.
    const pid = targetProjectId;
    if (pid && state.projectPermissions[pid]?.can_read && entityType === 'forms') {
      return true;
    }
    return false;
  };

  const projectGrants = (action: ActionType, resourceProjectId?: string | null): boolean => {
    const pid = resourceProjectId || targetProjectId;
    if (!pid) return false;
    const perms = state.projectPermissions[pid];
    if (!perms) return false;
    switch (action) {
      case 'create': return perms.can_create;
      case 'read':   return perms.can_read;
      case 'update': return perms.can_update;
      case 'delete': return perms.can_delete;
    }
    return false;
  };

  const shouldApplyLegacyTopLevelRead = (entityType: EntityType): boolean => {
    if (!state.hasRoleAssignments) return true;
    // Once the user has any custom role assignment, the legacy top-level
    // project_top_level_permissions row no longer cascades for reports,
    // dashboards, workflows, or policies — those require explicit per-item
    // or ':all' grants from the role.
    return entityType !== 'reports'
      && entityType !== 'dashboards'
      && entityType !== 'workflows'
      && entityType !== 'policies';
  };

  const hasPermission = (entityType: EntityType, action: ActionType, resourceId?: string, resource?: any): boolean => {
    if (state.isOrgAdmin || state.isProjectAdmin) {
      return true;
    }

    // Resource owners always have full access to their own resource
    if (resource && isResourceOwner(resource)) {
      return true;
    }

    // ---- Top-level project permissions are DEPRECATED ----
    // Standalone "create" buttons follow simple rules:
    //   - forms / workflows / policies / projects → admin only (already returned above)
    //   - reports / dashboards → any project member can create
    // Per-resource (resourceId) checks fall back to role-based permissions for
    // update/delete, while read defaults to true and is filtered via
    // getVisibleResources or per-asset access matrices.
    if (action === 'create' && !resourceId) {
      // Global "Create" toggle for universal modules (dashboards, reports,
      // and Knowledge Base — both folders and docs use the 'policies' type)
      // is stored as a role_permission with resource_id = 'all'.
      if (entityType === 'reports' || entityType === 'dashboards' || entityType === 'policies') {
        const globalCreate = state.rolePermissions[entityType]?.['all']?.can_create;
        if (globalCreate) return true;
        // The role UI exposes a single "Create Dashboards & Reports" toggle stored
        // under dashboards:all:create. Treat it as enabling report creation too.
        if (entityType === 'reports' && state.rolePermissions.dashboards?.['all']?.can_create) {
          return true;
        }
        // Project-level create grant cascades only for reports/dashboards.
        // Knowledge Base creation requires the explicit global KB create toggle.
        if (entityType !== 'policies' && projectGrants('create')) return true;
        // Legacy fallback: users with no role assignments retain default-allow
        if (!state.hasRoleAssignments) {
          return entityType === 'reports' || entityType === 'dashboards';
        }
        return false;
      }
      // forms / workflows / projects: admin-only standalone create
      return false;
    }

    if (action === 'read') {
      if (shouldApplyLegacyTopLevelRead(entityType) && state.topLevelPermissions[entityType]?.can_read) {
        return true;
      }

      if (resourceId) {
        const itemPerms = state.rolePermissions[entityType][resourceId];
        if (itemPerms?.can_read || itemPerms?.can_update || itemPerms?.can_delete) return true;
        // Global "all" read grant covers every item of this entity type
        const allPerms = state.rolePermissions[entityType]?.['all'];
        if (allPerms?.can_read || allPerms?.can_update || allPerms?.can_delete) return true;
        // Cross-module: KB "Create Dashboards & Reports" does not imply read.
        // But an explicit dashboards:all:read should grant report read too.
        if (entityType === 'reports' && state.rolePermissions.dashboards?.['all']?.can_read) return true;
        // Project-level read cascades ONLY to forms. Reports, dashboards,
        // workflows, and policies require explicit per-item (or ':all') grants.
        if (entityType === 'forms' && projectGrants('read', (resource as any)?.project_id)) return true;
        // If the user has any role assignments, hide unless explicitly granted above
        if (state.hasRoleAssignments) return false;
        return true;
      }

      return hasAnyExplicitReadPermission(entityType) || !state.hasRoleAssignments;
    }

    if (resourceId) {
      const rolePerms = state.rolePermissions[entityType][resourceId];
      const allPerms = state.rolePermissions[entityType]?.['all'];
      // Project-level update/delete grant cascades only for forms.
      // Reports/dashboards/workflows/policies require explicit per-item grants.
      if (entityType === 'forms' && projectGrants(action, (resource as any)?.project_id)) return true;
      if (allPerms) {
        switch (action) {
          case 'create': if (allPerms.can_create) return true; break;
          case 'update': if (allPerms.can_update) return true; break;
          case 'delete': if (allPerms.can_delete) return true; break;
        }
      }
      if (!rolePerms) {
        // No explicit per-resource grant; only the project/global checks above can allow
        return false;
      }
      switch (action) {
        case 'create': return rolePerms.can_create;
        case 'update': return rolePerms.can_update;
        case 'delete': return rolePerms.can_delete;
      }
    }

    return false;
  };

  const getVisibleResources = (entityType: EntityType, allResources: any[]): any[] => {
    if (state.isOrgAdmin || state.isProjectAdmin) {
      return allResources;
    }

    if (shouldApplyLegacyTopLevelRead(entityType) && state.topLevelPermissions[entityType]?.can_read) {
      return allResources;
    }

    // Forms: public + owned + role-granted reads
    if (entityType === 'forms') {
      return allResources.filter(resource => {
        if (resource.isPublic === true) return true;
        if (isResourceOwner(resource)) return true;
        const rolePerms = state.rolePermissions[entityType][resource.id];
        if (rolePerms?.can_read || rolePerms?.can_update || rolePerms?.can_delete) return true;
        const allPerms = state.rolePermissions[entityType]?.['all'];
        if (allPerms?.can_read || allPerms?.can_update || allPerms?.can_delete) return true;
        if (projectGrants('read', resource.project_id ?? resource.projectId)) return true;
        // Preserve legacy visibility only for users with no assigned roles.
        return !state.hasRoleAssignments;
      });
    }

    // Workflows / reports / dashboards / policies: any user with role
    // assignments only sees resources explicitly granted (item, global "all",
    // or project-scoped). Users without any role assignments retain legacy
    // org/project-wide visibility.
    return allResources.filter(resource => {
      if (isResourceOwner(resource)) return true;
      const rolePerms = state.rolePermissions[entityType][resource.id];
      if (rolePerms?.can_read || rolePerms?.can_update || rolePerms?.can_delete) return true;
      const allPerms = state.rolePermissions[entityType]?.['all'];
      if (allPerms?.can_read || allPerms?.can_update || allPerms?.can_delete) return true;
      // Cross-module alias for reports under the dashboard module
      if (entityType === 'reports' && state.rolePermissions.dashboards?.['all']?.can_read) return true;
      // Project-level cascade applies ONLY to forms — reports, dashboards,
      // workflows, and policies require explicit per-item or ':all' grants.
      // (forms are handled in the branch above; this branch never runs for them)
      // If the user has any role assignments, hide unless explicitly granted
      if (state.hasRoleAssignments) return false;
      return true;
    });
  };

  const checkPermissionWithAlert = (entityType: EntityType, action: ActionType, resourceId?: string): boolean => {
    const hasAccess = hasPermission(entityType, action, resourceId);
    
    if (!hasAccess) {
      if (action === 'create' && !resourceId &&
          (entityType === 'forms' || entityType === 'workflows' || entityType === 'policies')) {
        toast.error(`Only administrators can create ${entityType}`);
      } else if (resourceId) {
        toast.error(`Your role does not have ${action} permission for this ${entityType.slice(0, -1)}`);
      } else {
        toast.error(`You do not have ${action} permission for ${entityType}`);
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

    let tooltip = '';
    if (action === 'create' && !resourceId &&
        (entityType === 'forms' || entityType === 'workflows' || entityType === 'policies')) {
      tooltip = `Only administrators can create ${entityType}`;
    } else if (resourceId) {
      tooltip = `Role lacks ${action} permission for this ${entityType.slice(0, -1)}`;
    } else {
      tooltip = `No ${action} permission for ${entityType}`;
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
