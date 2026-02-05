 import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface Notification {
  id: string;
  type: 'organization_request' | 'form_assignment' | 'form_access_request' | 'workflow' | 'workflow_notification' | 'invitation_accepted';
  title: string;
  message: string;
  data: any;
  created_at: string;
  read: boolean;
}

 // Pagination and performance constants
 const NOTIFICATIONS_PAGE_SIZE = 50;
 const MAX_NOTIFICATIONS_LIMIT = 200; // Prevent memory issues
 const CLEANUP_THRESHOLD_DAYS = 30; // Auto-cleanup notifications older than this
 
 export function useNotifications() {
   const [notifications, setNotifications] = useState<Notification[]>([]);
   const [unreadCount, setUnreadCount] = useState(0);
   const [hasMore, setHasMore] = useState(true);
   const [isLoadingMore, setIsLoadingMore] = useState(false);
   const { userProfile } = useAuth();
   const { currentOrganization } = useOrganization();
   const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
   const loadedRef = useRef(false);
 
   // Load notifications with pagination
   const loadNotifications = useCallback(async (offset = 0, append = false) => {
     if (!userProfile) {
       setNotifications([]);
       setUnreadCount(0);
       return;
     }
 
     try {
       if (offset > 0) setIsLoadingMore(true);
       
       const allNotifications: Notification[] = append ? [...notifications] : [];
 
       // Paginated query with limit
       const { data: dbNotifications, error: dbError } = await supabase
         .from('notifications')
         .select('id, type, title, message, data, created_at, read')
         .eq('user_id', userProfile.id)
         .order('created_at', { ascending: false })
         .range(offset, offset + NOTIFICATIONS_PAGE_SIZE - 1);
 
       if (!dbError && dbNotifications) {
         const mappedNotifications: Notification[] = dbNotifications.map(notif => ({
           id: notif.id,
           type: notif.type as Notification['type'],
           title: notif.title,
           message: notif.message,
           data: notif.data,
           created_at: notif.created_at,
           read: notif.read
         }));
         
         // Check if more pages exist
         setHasMore(dbNotifications.length === NOTIFICATIONS_PAGE_SIZE && 
                    (offset + NOTIFICATIONS_PAGE_SIZE) < MAX_NOTIFICATIONS_LIMIT);
         
         allNotifications.push(...mappedNotifications);
       }
 
       // Only fetch org requests on initial load (not pagination)
       if (offset === 0 && userProfile.role === 'admin' && currentOrganization?.id) {
         const { data: orgRequests, error } = await supabase
           .from('organization_requests')
           .select('id, first_name, last_name, requested_at')
           .eq('organization_id', currentOrganization.id)
           .eq('status', 'pending')
           .order('requested_at', { ascending: false })
           .limit(20); // Limit org requests
 
         if (!error && orgRequests) {
           const orgNotifications: Notification[] = orgRequests.map(request => ({
             id: `org_req_${request.id}`,
             type: 'organization_request',
             title: 'New Join Request',
             message: `${request.first_name} ${request.last_name} wants to join your organization`,
             data: request,
             created_at: request.requested_at,
             read: false
           }));
 
           allNotifications.push(...orgNotifications);
         }
       }
 
       allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
 
       setNotifications(allNotifications);
       setUnreadCount(allNotifications.filter(n => !n.read).length);
     } catch (error) {
       if (!append) {
         setNotifications([]);
         setUnreadCount(0);
       }
     } finally {
       setIsLoadingMore(false);
     }
   }, [userProfile, currentOrganization?.id, notifications]);
 
   // Load more notifications (pagination)
   const loadMore = useCallback(() => {
     if (!isLoadingMore && hasMore) {
       loadNotifications(notifications.length, true);
     }
   }, [isLoadingMore, hasMore, notifications.length, loadNotifications]);
 
   // Auto-cleanup old read notifications (run once per session)
   const cleanupOldNotifications = useCallback(async () => {
     if (!userProfile?.id) return;
     
     const cutoffDate = new Date();
     cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_THRESHOLD_DAYS);
     
     try {
       await supabase
         .from('notifications')
         .delete()
         .eq('user_id', userProfile.id)
         .eq('read', true)
         .lt('created_at', cutoffDate.toISOString());
     } catch (error) {
       // Silent cleanup - don't interrupt user experience
     }
   }, [userProfile?.id]);

   // Initial load and cleanup
   useEffect(() => {
     if (!loadedRef.current && userProfile?.id) {
       loadNotifications(0, false);
       cleanupOldNotifications(); // Cleanup on first load only
       loadedRef.current = true;
     }
   }, [userProfile?.id, userProfile?.role, currentOrganization?.id]);
 
   // Reset on user change
   useEffect(() => {
     if (!userProfile?.id) {
       loadedRef.current = false;
       setNotifications([]);
       setUnreadCount(0);
     }
   }, [userProfile?.id]);
 
   // Single shared real-time subscription per user (prevents subscription explosion)
   useEffect(() => {
     if (!userProfile?.id) return;
 
     // Clean up existing channel before creating new one
     if (channelRef.current) {
       supabase.removeChannel(channelRef.current);
       channelRef.current = null;
     }
 
     // Create single channel for both INSERT and UPDATE
     const channel = supabase
       .channel(`notifications-${userProfile.id}`)
       .on(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'notifications',
           filter: `user_id=eq.${userProfile.id}`
         },
         (payload) => {
           const newNotif = payload.new as any;
           setNotifications(prev => {
             // Prevent duplicates and enforce max limit
             if (prev.some(n => n.id === newNotif.id)) return prev;
             const updated = [{
               id: newNotif.id,
               type: newNotif.type,
               title: newNotif.title,
               message: newNotif.message,
               data: newNotif.data,
               created_at: newNotif.created_at,
               read: newNotif.read || false
             }, ...prev];
             return updated.slice(0, MAX_NOTIFICATIONS_LIMIT);
           });
           setUnreadCount(prev => prev + 1);
         }
       )
       .on(
         'postgres_changes',
         {
           event: 'UPDATE',
           schema: 'public',
           table: 'notifications',
           filter: `user_id=eq.${userProfile.id}`
         },
         (payload) => {
           const updatedNotif = payload.new as any;
           setNotifications(prev => {
             const updated = prev.map(n => 
               n.id === updatedNotif.id 
                 ? { ...n, read: updatedNotif.read, title: updatedNotif.title, message: updatedNotif.message }
                 : n
             );
             setUnreadCount(updated.filter(n => !n.read).length);
             return updated;
           });
         }
       )
       .subscribe();
 
     channelRef.current = channel;
 
     return () => {
       if (channelRef.current) {
         supabase.removeChannel(channelRef.current);
         channelRef.current = null;
       }
     };
   }, [userProfile?.id]);

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    if (!notificationId.startsWith('org_req_')) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);
      } catch (error) {
        // Silent error handling
      }
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    if (userProfile?.id) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userProfile.id)
          .eq('read', false);
      } catch (error) {
        // Silent error handling
      }
    }
  };

  const deleteNotification = async (notificationId: string) => {
    // Remove from local state immediately
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      setUnreadCount(updated.filter(n => !n.read).length);
      return updated;
    });

    // Delete from database (skip org_req_ prefixed ones as they're virtual)
    if (!notificationId.startsWith('org_req_')) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);
      } catch (error) {
        // Silent error handling
      }
    }
  };

  const deleteAllRead = async () => {
    // Remove read notifications from local state (except org_req_ ones which are virtual)
    setNotifications(prev => prev.filter(n => !n.read || n.id.startsWith('org_req_')));

    // Delete from database
    if (userProfile?.id) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', userProfile.id)
          .eq('read', true);
      } catch (error) {
        // Silent error handling
      }
    }
  };

   return {
     notifications,
     unreadCount,
     hasMore,
     isLoadingMore,
     markAsRead,
     markAllAsRead,
     deleteNotification,
     deleteAllRead,
     loadNotifications: () => loadNotifications(0, false),
     loadMore
   };
 }
