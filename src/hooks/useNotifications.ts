
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface Notification {
  id: string;
  type: 'organization_request' | 'form_assignment' | 'form_access_request';
  title: string;
  message: string;
  data: any;
  created_at: string;
  read: boolean;
}

let globalChannel: any = null;
let subscriptionCount = 0;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const hasSubscribed = useRef(false);

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

    // Set up real-time subscription only once
    if (userProfile && !hasSubscribed.current) {
      const channelName = `notifications-${userProfile.id}`;
      
      // Clean up existing global channel if it exists
      if (globalChannel) {
        console.log('Removing existing notification channel');
        supabase.removeChannel(globalChannel);
        globalChannel = null;
      }

      console.log('Setting up notification subscription for user:', userProfile.id);

      globalChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile.id}`
          },
          (payload) => {
            console.log('Notification change detected:', payload);
            loadNotifications();
          }
        );

      // Also listen to organization requests if admin
      if (userProfile.role === 'admin' && currentOrganization?.id) {
        globalChannel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'organization_requests',
            filter: `organization_id=eq.${currentOrganization.id}`
          },
          (payload) => {
            console.log('Organization request change detected:', payload);
            loadNotifications();
          }
        );
      }

      globalChannel.subscribe((status: string) => {
        console.log('Notification subscription status:', status);
        if (status === 'SUBSCRIBED') {
          hasSubscribed.current = true;
          subscriptionCount++;
        } else if (status === 'CLOSED') {
          console.log('Notification subscription closed');
          hasSubscribed.current = false;
        }
      });

      return () => {
        subscriptionCount--;
        console.log('Component unmounting, subscription count:', subscriptionCount);
        
        // Only remove channel when no components are using it
        if (subscriptionCount <= 0 && globalChannel) {
          console.log('Cleaning up global notification subscription');
          supabase.removeChannel(globalChannel);
          globalChannel = null;
          hasSubscribed.current = false;
          subscriptionCount = 0;
        }
      };
    }
  }, [userProfile?.id, userProfile?.role, currentOrganization?.id]);

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
