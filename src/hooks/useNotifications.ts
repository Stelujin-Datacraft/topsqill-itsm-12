
import { useState, useEffect } from 'react';
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

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { userProfile } = useAuth();
  const { currentOrganization } = useOrganization();

  const loadNotifications = async () => {
    if (!userProfile) {
      console.log('No user profile available for loading notifications');
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      console.log('Loading notifications for user:', userProfile.id);
      const allNotifications: Notification[] = [];

      // Load persistent notifications from database
      const { data: dbNotifications, error: dbError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (!dbError && dbNotifications) {
        console.log('Database notifications loaded:', dbNotifications);
        // Map database notifications to our interface with proper type casting
        const mappedNotifications: Notification[] = dbNotifications.map(notif => ({
          id: notif.id,
          type: notif.type as 'organization_request' | 'form_assignment' | 'form_access_request',
          title: notif.title,
          message: notif.message,
          data: notif.data,
          created_at: notif.created_at,
          read: notif.read
        }));
        allNotifications.push(...mappedNotifications);
      } else if (dbError) {
        console.error('Error loading database notifications:', dbError);
      }

      // Load organization requests if user is admin
      if (userProfile.role === 'admin' && currentOrganization?.id) {
        const { data: orgRequests, error } = await supabase
          .from('organization_requests')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .eq('status', 'pending')
          .order('requested_at', { ascending: false });

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

      // Sort all notifications by date
      allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('All notifications loaded:', allNotifications);
      setNotifications(allNotifications);
      setUnreadCount(allNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [userProfile?.id, userProfile?.role, currentOrganization?.id]);

  // Separate effect for real-time subscription
  useEffect(() => {
    if (!userProfile?.id) return;

    const channelName = `notifications-realtime-${userProfile.id}-${Date.now()}`;
    
    console.log('Setting up real-time notification subscription for user:', userProfile.id);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userProfile.id}`
        },
        (payload) => {
          console.log('🔔 New notification received:', payload);
          // Directly add the new notification to state for instant update
          const newNotif = payload.new as any;
          setNotifications(prev => [{
            id: newNotif.id,
            type: newNotif.type,
            title: newNotif.title,
            message: newNotif.message,
            data: newNotif.data,
            created_at: newNotif.created_at,
            read: newNotif.read || false
          }, ...prev]);
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
          console.log('🔔 Notification updated:', payload);
          const updatedNotif = payload.new as any;
          setNotifications(prev => prev.map(n => 
            n.id === updatedNotif.id 
              ? { ...n, read: updatedNotif.read, title: updatedNotif.title, message: updatedNotif.message }
              : n
          ));
          // Recalculate unread count
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.read).length);
            return prev;
          });
        }
      )
      .subscribe((status) => {
        console.log('🔔 Notification subscription status:', status);
      });

    return () => {
      console.log('🔔 Cleaning up notification subscription');
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id]);

  const markAsRead = async (notificationId: string) => {
    // Update local state immediately
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Update database if it's a persistent notification
    if (!notificationId.startsWith('org_req_')) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);
        
        if (error) {
          console.error('Error marking notification as read:', error);
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
  };

  const markAllAsRead = async () => {
    // Update local state
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    // Update database for persistent notifications
    if (userProfile?.id) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userProfile.id)
          .eq('read', false);
        
        if (error) {
          console.error('Error marking all notifications as read:', error);
        }
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
      }
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    loadNotifications
  };
}
