import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserInvitations } from '@/hooks/useUserInvitations';
import { useNavigate } from 'react-router-dom';

// Extended notification interface that includes all possible notification types
interface ExtendedNotification {
  id: string;
  type: string; // Use string to allow any notification type
  title: string;
  message: string;
  data: any;
  created_at: string;
  read: boolean;
}

export function NotificationPanel() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { acceptInvitation, rejectInvitation } = useUserInvitations();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: ExtendedNotification) => {
    markAsRead(notification.id);
    
    // Handle project invitation notifications
    if (notification.type === 'project_invitation') {
      // Don't navigate, let user interact with the invitation directly
      return;
    }
    
    setOpen(false);
    
    // Navigate based on notification type
    if (notification.type === 'organization_request') {
      navigate('/user-requests');
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
        // Navigate to the project
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

  // ... keep existing code (formatTimeAgo function)
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

  // Cast notifications to the extended type and filter out read notifications
  const extendedNotifications = (notifications as ExtendedNotification[]).filter(n => !n.read);

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
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {extendedNotifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {extendedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-b transition-colors ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="mr-2 text-lg">
                            {getNotificationIcon(notification.type)}
                          </span>
                          <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notification.title}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          {formatTimeAgo(notification.created_at)}
                        </p>

                        {/* Project invitation actions */}
                        {notification.type === 'project_invitation' && (
                          <div className="flex gap-2 mt-2 ml-6">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptInvitation(notification)}
                              className="h-7 text-xs"
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectInvitation(notification)}
                              className="h-7 text-xs"
                            >
                              Decline
                            </Button>
                          </div>
                        )}

                        {/* Regular notification click */}
                        {!['project_invitation', 'invitation_accepted', 'invitation_rejected'].includes(notification.type) && (
                          <div
                            onClick={() => handleNotificationClick(notification)}
                            className="absolute inset-0 w-full h-full cursor-pointer hover:bg-muted/50 z-10"
                          />
                        )}
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-2"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
