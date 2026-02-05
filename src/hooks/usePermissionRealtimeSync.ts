 import { useEffect } from 'react';
 import { useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 /**
  * Real-time permission sync hook.
  * Subscribes to changes in permission-related tables and invalidates
  * the user permissions cache when relevant changes occur.
  * 
  * This ensures users see permission updates immediately without
  * waiting for the 2-minute staleTime to expire.
  * 
  * Subscribes to:
  * - user_role_assignments: When roles are assigned/removed from user
  * - role_permissions: When permissions on a role change
  * - project_users: When project membership/role changes
  * - asset_permissions: When specific asset permissions change
  */
 export function usePermissionRealtimeSync() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   useEffect(() => {
     if (!user?.id) return;
 
     const userId = user.id;
 
     // Create a single channel for all permission-related subscriptions
     const channel = supabase
       .channel('permission-changes')
       // Subscribe to user_role_assignments changes for current user
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'user_role_assignments',
           filter: `user_id=eq.${userId}`,
         },
         (payload) => {
           console.log('[PermissionSync] Role assignment changed:', payload.eventType);
           invalidatePermissionCache();
         }
       )
       // Subscribe to project_users changes for current user
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'project_users',
           filter: `user_id=eq.${userId}`,
         },
         (payload) => {
           console.log('[PermissionSync] Project membership changed:', payload.eventType);
           invalidatePermissionCache();
         }
       )
       // Subscribe to asset_permissions changes for current user
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'asset_permissions',
           filter: `user_id=eq.${userId}`,
         },
         (payload) => {
           console.log('[PermissionSync] Asset permission changed:', payload.eventType);
           invalidatePermissionCache();
         }
       )
       // Subscribe to role_permissions changes (affects all users with that role)
       // We listen to all changes since the user might have any role
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'role_permissions',
         },
         (payload) => {
           console.log('[PermissionSync] Role permissions changed:', payload.eventType);
           // Invalidate cache - the user might be affected by this role change
           invalidatePermissionCache();
         }
       )
       .subscribe((status) => {
         if (status === 'SUBSCRIBED') {
           console.log('[PermissionSync] Real-time subscription active');
         } else if (status === 'CHANNEL_ERROR') {
           console.warn('[PermissionSync] Channel error, falling back to staleTime refresh');
         }
       });
 
     function invalidatePermissionCache() {
       // Invalidate the user permissions cache to trigger a refetch
       queryClient.invalidateQueries({ queryKey: ['user-permissions-cache'] });
       
       // Also invalidate related caches that depend on permissions
       queryClient.invalidateQueries({ queryKey: ['forms'] });
       queryClient.invalidateQueries({ queryKey: ['workflows'] });
       queryClient.invalidateQueries({ queryKey: ['reports'] });
     }
 
     // Cleanup subscription on unmount or user change
     return () => {
       console.log('[PermissionSync] Cleaning up subscription');
       supabase.removeChannel(channel);
     };
   }, [user?.id, queryClient]);
 }