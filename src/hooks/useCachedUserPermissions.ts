 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useProject } from '@/contexts/ProjectContext';
 
 export interface CachedUserPermissions {
   userId: string;
   organizationId: string;
   isOrgAdmin: boolean;
   isProjectAdmin: boolean;
   isProjectCreator: boolean;
   isProjectMember: boolean;
   projectRole: string | null;
   roleAssignments: Array<{
     roleId: string;
     roleName: string;
     permissions: Array<{
       resourceType: string;
       resourceId: string | null;
       permissionType: string;
     }>;
   }>;
   formPermissions: Map<string, Set<string>>;
 }
 
 /**
  * Centralized hook for caching user permissions data.
  * This eliminates redundant DB calls across hooks like useFormsLoader, useUnifiedAccessControl, etc.
  * 
  * Cache strategy:
  * - staleTime: 2 minutes (matches global React Query config)
  * - gcTime: 10 minutes
  * - Invalidated on project/user change
  */
 export function useCachedUserPermissions(projectId?: string) {
   const { userProfile } = useAuth();
   const { currentProject } = useProject();
 
   const targetProjectId = projectId || currentProject?.id;
   const userId = userProfile?.id;
   const organizationId = userProfile?.organization_id;
 
   const queryKey = ['user-permissions-cache', targetProjectId, userId];
 
   const { data, isLoading, refetch } = useQuery({
     queryKey,
     queryFn: async (): Promise<CachedUserPermissions | null> => {
       if (!targetProjectId || !userId || !organizationId) {
         return null;
       }
 
       // Batch all permission queries in parallel
       const [
         userProfileResult,
         projectUserResult,
         projectResult,
         roleAssignmentsResult
       ] = await Promise.all([
         // Get org admin status from user_profiles
         supabase
           .from('user_profiles')
           .select('role')
           .eq('id', userId)
           .single(),
         
         // Get project membership and role
         supabase
           .from('project_users')
           .select('role')
           .eq('project_id', targetProjectId)
           .eq('user_id', userId)
           .maybeSingle(),
         
         // Get project creator info
         supabase
           .from('projects')
           .select('created_by')
           .eq('id', targetProjectId)
           .single(),
         
         // Get role assignments with roles
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
           .eq('user_id', userId)
       ]);
 
       const isOrgAdmin = userProfileResult.data?.role === 'admin';
       const projectRole = projectUserResult.data?.role || null;
       const isProjectMember = !!projectUserResult.data;
       const isProjectCreator = projectResult.data?.created_by === userId;
       const isProjectAdmin = projectRole === 'admin' || isProjectCreator;
 
       // Fetch role permissions if user has role assignments
       const roleAssignments = roleAssignmentsResult.data || [];
       const formPermissions = new Map<string, Set<string>>();
       const processedRoleAssignments: CachedUserPermissions['roleAssignments'] = [];
 
       if (roleAssignments.length > 0) {
         const roleIds = roleAssignments.map(a => a.role_id);
         
         const { data: rolePermissions } = await supabase
           .from('role_permissions')
           .select('*')
           .in('role_id', roleIds);
 
         // Group permissions by role
         const permsByRole = new Map<string, any[]>();
         rolePermissions?.forEach(perm => {
           if (!permsByRole.has(perm.role_id)) {
             permsByRole.set(perm.role_id, []);
           }
           permsByRole.get(perm.role_id)!.push(perm);
 
           // Build form permissions map for quick lookups
           if (perm.resource_type === 'form' && perm.resource_id) {
             if (!formPermissions.has(perm.resource_id)) {
               formPermissions.set(perm.resource_id, new Set());
             }
             formPermissions.get(perm.resource_id)!.add(perm.permission_type);
           }
         });
 
         // Build processed role assignments
         roleAssignments.forEach(assignment => {
           const role = assignment.roles as any;
           const perms = permsByRole.get(assignment.role_id) || [];
           
           processedRoleAssignments.push({
             roleId: assignment.role_id,
             roleName: role?.name || 'Unknown',
             permissions: perms.map(p => ({
               resourceType: p.resource_type,
               resourceId: p.resource_id,
               permissionType: p.permission_type
             }))
           });
         });
       }
 
       return {
         userId,
         organizationId,
         isOrgAdmin,
         isProjectAdmin,
         isProjectCreator,
         isProjectMember,
         projectRole,
         roleAssignments: processedRoleAssignments,
         formPermissions
       };
     },
     enabled: !!targetProjectId && !!userId && !!organizationId,
     staleTime: 2 * 60 * 1000, // 2 minutes
     gcTime: 10 * 60 * 1000, // 10 minutes
   });
 
   return {
     permissions: data,
     isLoading,
     refetch,
     // Convenience getters
     isOrgAdmin: data?.isOrgAdmin ?? false,
     isProjectAdmin: data?.isProjectAdmin ?? false,
     isProjectMember: data?.isProjectMember ?? false,
     isAnyAdmin: (data?.isOrgAdmin || data?.isProjectAdmin || data?.isProjectCreator) ?? false,
     hasFormReadPermission: (formId: string) => {
       if (!data) return false;
       if (data.isOrgAdmin || data.isProjectAdmin || data.isProjectCreator) return true;
       return data.formPermissions.get(formId)?.has('read') ?? false;
     },
   };
 }