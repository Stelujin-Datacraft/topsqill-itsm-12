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
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

    // Debounced + scoped invalidation. We only invalidate the permissions
    // cache itself — NOT the forms/workflows/reports data lists. Those page
    // data lists do not depend on permission rows, and invalidating them on
    // every realtime tick was causing pages to show their loading state a
    // second time right after navigation.
    function invalidatePermissionCache() {
      if (invalidateTimer) return; // coalesce bursts
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        queryClient.invalidateQueries({ queryKey: ['user-permissions-cache'] });
      }, 400);
    }
 
     // Create a single channel for all permission-related subscriptions
     const channel = supabase
      .channel(`permission-changes-${userId}`)
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
      // NOTE: We intentionally do NOT subscribe to the global `role_permissions`
      // table. Listening to every row in every org caused this hook to fire
      // constantly and re-invalidate the permissions cache on every navigation,
      // which made every page show its loading skeleton twice. The 2-minute
      // staleTime + explicit refetch after a role-edit flow are sufficient.
       .subscribe((status) => {
         if (status === 'SUBSCRIBED') {
           console.log('[PermissionSync] Real-time subscription active');
         } else if (status === 'CHANNEL_ERROR') {
           console.warn('[PermissionSync] Channel error, falling back to staleTime refresh');
         }
       });
 
     // Cleanup subscription on unmount or user change
     return () => {
        if (invalidateTimer) clearTimeout(invalidateTimer);
       console.log('[PermissionSync] Cleaning up subscription');
       supabase.removeChannel(channel);
     };
   }, [user?.id, queryClient]);
 }