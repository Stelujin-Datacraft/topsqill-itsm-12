
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
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const allNotifications: Notification[] = [];

      const { data: dbNotifications, error: dbError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (!dbError && dbNotifications) {
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
      }

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

      allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(allNotifications);
      setUnreadCount(allNotifications.filter(n => !n.read).length);
    } catch (error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [userProfile?.id, userProfile?.role, currentOrganization?.id]);

  useEffect(() => {
    if (!userProfile?.id) return;

    const channelName = `notifications-realtime-${userProfile.id}-${Date.now()}`;

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
          const updatedNotif = payload.new as any;
          setNotifications(prev => prev.map(n => 
            n.id === updatedNotif.id 
              ? { ...n, read: updatedNotif.read, title: updatedNotif.title, message: updatedNotif.message }
              : n
          ));
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.read).length);
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    loadNotifications
  };
}
