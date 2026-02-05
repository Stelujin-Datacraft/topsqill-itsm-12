 import { QueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 
 /**
 * Prefetches user permissions into React Query cache immediately after login.
 * This ensures the first page load is instant instead of waiting for permission queries.
 * 
 * IMPORTANT: This function is designed to be called asynchronously (via setTimeout)
 * to avoid blocking the auth flow and prevent deadlocks in onAuthStateChange.
 */
 export async function prefetchUserPermissions(
   queryClient: QueryClient,
   userId: string,
   organizationId: string,
   projectId?: string
 ): Promise<void> {
   // Skip if no project ID - permissions are project-scoped
   if (!projectId) {
     return;
   }
 
   const queryKey = ['user-permissions-cache', projectId, userId];
 
   // Check if already cached and fresh
   const existingData = queryClient.getQueryData(queryKey);
   if (existingData) {
     return; // Already cached, no need to prefetch
   }
 
   try {
     // Prefetch the same query that useCachedUserPermissions uses
     await queryClient.prefetchQuery({
       queryKey,
       queryFn: async () => {
         // Batch all permission queries in parallel
         const [
           userProfileResult,
           projectUserResult,
           projectResult,
           roleAssignmentsResult
         ] = await Promise.all([
           supabase
             .from('user_profiles')
             .select('role')
             .eq('id', userId)
             .single(),
           supabase
             .from('project_users')
             .select('role')
             .eq('project_id', projectId)
             .eq('user_id', userId)
             .maybeSingle(),
           supabase
             .from('projects')
             .select('created_by')
             .eq('id', projectId)
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
             .eq('user_id', userId)
         ]);
 
         const isOrgAdmin = userProfileResult.data?.role === 'admin';
         const projectRole = projectUserResult.data?.role || null;
         const isProjectMember = !!projectUserResult.data;
         const isProjectCreator = projectResult.data?.created_by === userId;
         const isProjectAdmin = projectRole === 'admin' || isProjectCreator;
 
         const roleAssignments = roleAssignmentsResult.data || [];
         const formPermissions = new Map<string, Set<string>>();
         const processedRoleAssignments: Array<{
           roleId: string;
           roleName: string;
           permissions: Array<{
             resourceType: string;
             resourceId: string | null;
             permissionType: string;
           }>;
         }> = [];
 
         if (roleAssignments.length > 0) {
           const roleIds = roleAssignments.map(a => a.role_id);
           
           const { data: rolePermissions } = await supabase
             .from('role_permissions')
             .select('*')
             .in('role_id', roleIds);
 
           const permsByRole = new Map<string, any[]>();
           rolePermissions?.forEach(perm => {
             if (!permsByRole.has(perm.role_id)) {
               permsByRole.set(perm.role_id, []);
             }
             permsByRole.get(perm.role_id)!.push(perm);
 
             if (perm.resource_type === 'form' && perm.resource_id) {
               if (!formPermissions.has(perm.resource_id)) {
                 formPermissions.set(perm.resource_id, new Set());
               }
               formPermissions.get(perm.resource_id)!.add(perm.permission_type);
             }
           });
 
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
       staleTime: 2 * 60 * 1000, // 2 minutes - matches useCachedUserPermissions
     });
   } catch (error) {
     // Silent fail - prefetch is an optimization, not critical
     console.warn('Permission prefetch failed (non-critical):', error);
   }
 }
 
 /**
 * Prefetches the user's default/last project permissions.
 * Called after login to warm the cache for the most likely first page.
 */
 export async function prefetchDefaultProjectPermissions(
   queryClient: QueryClient,
   userId: string,
   organizationId: string
 ): Promise<void> {
   try {
     // Get user's most recent project (likely the one they'll navigate to)
     const { data: recentProject } = await supabase
       .from('project_users')
       .select('project_id')
       .eq('user_id', userId)
       .order('assigned_at', { ascending: false })
       .limit(1)
       .maybeSingle();
 
     if (recentProject?.project_id) {
       await prefetchUserPermissions(
         queryClient,
         userId,
         organizationId,
         recentProject.project_id
       );
     }
   } catch (error) {
     // Silent fail - this is an optimization
     console.warn('Default project prefetch failed (non-critical):', error);
   }
 }