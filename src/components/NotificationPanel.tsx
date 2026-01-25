import { useState } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserInvitations } from '@/hooks/useUserInvitations';
import { useNavigate } from 'react-router-dom';

interface ExtendedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  created_at: string;
  read: boolean;
}

export function NotificationPanel() {
  const { notifications, unreadCount, markAsRead, deleteNotification, deleteAllRead } = useNotifications();
  const { acceptInvitation, rejectInvitation } = useUserInvitations();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Cast and separate notifications
  const extendedNotifications = notifications as ExtendedNotification[];
  const unreadNotifications = extendedNotifications.filter(n => !n.read);
  const readNotifications = extendedNotifications.filter(n => n.read);

  const handleNotificationClick = async (notification: ExtendedNotification) => {
    if (notification.read) return; // Already read, no action needed
    
    markAsRead(notification.id);
    
    // Handle project invitation notifications - don't navigate
    if (notification.type === 'project_invitation') {
      return;
    }
    
    setOpen(false);
    
    // Navigate based on notification type
    if (notification.type === 'organization_request' || notification.type === 'invitation_accepted') {
      navigate('/users');
    } else if (notification.type === 'form_assignment') {
      navigate('/forms');
      setTimeout(() => {
        const assignedFormsButton = document.querySelector('[data-testid="assigned-forms-trigger"]') as HTMLButtonElement;
        if (assignedFormsButton) {
          assignedFormsButton.click();
        } else {
          const event = new CustomEvent('openAssignedForms');
          window.dispatchEvent(event);
        }
      }, 100);
    }
  };

  const handleAcceptInvitation = async (notification: ExtendedNotification) => {
    const invitationId = notification.data?.invitation_id;
    if (invitationId) {
      const result = await acceptInvitation(invitationId);
      if (result && typeof result === 'object' && 'success' in result && result.success) {
        markAsRead(notification.id);
        const projectId = notification.data?.project_id || ('projectId' in result ? result.projectId : null);
        if (projectId) {
          navigate(`/projects`);
          setOpen(false);
        }
      }
    }
  };

  const handleRejectInvitation = async (notification: ExtendedNotification) => {
    const invitationId = notification.data?.invitation_id;
    if (invitationId) {
      const success = await rejectInvitation(invitationId);
      if (success) {
        markAsRead(notification.id);
      }
    }
  };

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    deleteNotification(notificationId);
  };

  const handleDeleteAllRead = () => {
    deleteAllRead();
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'form_assignment':
        return '📋';
      case 'organization_request':
        return '👥';
      case 'project_invitation':
        return '📧';
      case 'invitation_accepted':
        return '✅';
      case 'invitation_rejected':
        return '❌';
      default:
        return '🔔';
    }
  };

  const renderNotificationItem = (notification: ExtendedNotification, isRead: boolean) => (
    <div
      key={notification.id}
      onClick={() => !isRead && handleNotificationClick(notification)}
      className={`p-3 border-b transition-colors relative ${
        !isRead 
          ? 'bg-primary/5 hover:bg-primary/10 cursor-pointer' 
          : 'bg-muted/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatTimeAgo(notification.created_at)}
          </p>

          {/* Project invitation actions */}
          {notification.type === 'project_invitation' && !isRead && (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAcceptInvitation(notification);
                }}
                className="h-7 text-xs"
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRejectInvitation(notification);
                }}
                className="h-7 text-xs"
              >
                Decline
              </Button>
            </div>
          )}
        </div>

        {/* Unread indicator or delete button */}
        <div className="flex-shrink-0">
          {!isRead ? (
            <div className="w-2 h-2 bg-primary rounded-full mt-1.5"></div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleDeleteNotification(e, notification.id)}
              className="h-6 w-6 p-0 hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {unreadNotifications.length === 0 && readNotifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No notifications
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                {/* UNREAD SECTION */}
                {unreadNotifications.length > 0 && (
                  <div>
                    <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      Unread
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {unreadNotifications.length}
                      </Badge>
                    </div>
                    {unreadNotifications.map((notification) => 
                      renderNotificationItem(notification, false)
                    )}
                  </div>
                )}

                {/* READ SECTION */}
                {readNotifications.length > 0 && (
                  <div>
                    <div className="px-3 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        Read
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                          {readNotifications.length}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleDeleteAllRead}
                        className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    </div>
                    {readNotifications.map((notification) => 
                      renderNotificationItem(notification, true)
                    )}
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
