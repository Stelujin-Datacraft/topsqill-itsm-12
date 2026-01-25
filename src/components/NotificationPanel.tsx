import { useState } from 'react';
import { Bell, Trash2, Inbox, CheckCircle2, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllRead } = useNotifications();
  const { acceptInvitation, rejectInvitation } = useUserInvitations();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
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

  const handleMarkAllAsRead = () => {
    markAllAsRead();
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
      className={`p-3 border-b border-border/50 transition-all duration-200 relative group ${
        !isRead 
          ? 'bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 hover:to-primary/5 cursor-pointer' 
          : 'bg-background hover:bg-muted/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base ${
          !isRead ? 'bg-primary/10' : 'bg-muted'
        }`}>
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-tight ${isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1.5 font-medium">
            {formatTimeAgo(notification.created_at)}
          </p>

          {/* Project invitation actions */}
          {notification.type === 'project_invitation' && !isRead && (
            <div className="flex gap-2 mt-2.5">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAcceptInvitation(notification);
                }}
                className="h-7 text-xs px-3 rounded-full"
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
                className="h-7 text-xs px-3 rounded-full"
              >
                Decline
              </Button>
            </div>
          )}
        </div>

        {/* Unread indicator or delete button */}
        <div className="flex-shrink-0">
          {!isRead ? (
            <div className="w-2.5 h-2.5 bg-primary rounded-full mt-1 ring-2 ring-primary/20 animate-pulse"></div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleDeleteNotification(e, notification.id)}
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 rounded-full"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative hover:bg-muted/80 transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 shadow-xl border-border/50" align="end">
        <Card className="border-0 overflow-hidden">
          {/* Tab Header */}
          <div className="flex border-b border-border/50">
            <button
              onClick={() => setActiveTab('unread')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'unread'
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Inbox className="h-4 w-4" />
              Unread
              {unreadNotifications.length > 0 && (
                <Badge 
                  variant={activeTab === 'unread' ? 'default' : 'secondary'} 
                  className="h-5 px-1.5 text-[10px] font-bold"
                >
                  {unreadNotifications.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('read')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'read'
                  ? 'bg-muted/60 text-foreground border-b-2 border-foreground/50'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Read
              {readNotifications.length > 0 && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {readNotifications.length}
                </Badge>
              )}
            </button>
          </div>

          <CardContent className="p-0">
            {/* Unread Tab Content */}
            {activeTab === 'unread' && (
              <div>
                {unreadNotifications.length > 0 && (
                  <div className="px-3 py-2 bg-primary/5 border-b border-border/50 flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleMarkAllAsRead}
                      className="h-7 text-xs px-3 text-primary hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                    >
                      <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                      Mark All as Read
                    </Button>
                  </div>
                )}
                {unreadNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Inbox className="h-7 w-7 text-primary/50" />
                    </div>
                    <p className="text-foreground font-medium">All caught up!</p>
                    <p className="text-muted-foreground text-sm mt-1">No unread notifications</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[360px]">
                    {unreadNotifications.map((notification) => 
                      renderNotificationItem(notification, false)
                    )}
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Read Tab Content */}
            {activeTab === 'read' && (
              <div>
                {readNotifications.length > 0 && (
                  <div className="px-3 py-2 bg-muted/30 border-b border-border/50 flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleDeleteAllRead}
                      className="h-7 text-xs px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Clear All
                    </Button>
                  </div>
                )}
                {readNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-foreground font-medium">No history</p>
                    <p className="text-muted-foreground text-sm mt-1">Read notifications will appear here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[360px]">
                    {readNotifications.map((notification) => 
                      renderNotificationItem(notification, true)
                    )}
                  </ScrollArea>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
