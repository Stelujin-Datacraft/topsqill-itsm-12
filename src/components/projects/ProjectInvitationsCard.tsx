import React from 'react';
import { useUserInvitations } from '@/hooks/useUserInvitations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, Clock, Check, X, Loader2, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ProjectInvitationsCardProps {
  showTitle?: boolean;
  maxItems?: number;
  onInvitationAccepted?: (projectId: string) => void;
}

export function ProjectInvitationsCard({
  showTitle = true,
  maxItems,
  onInvitationAccepted,
}: ProjectInvitationsCardProps) {
  const {
    invitations,
    loading,
    acceptInvitation,
    rejectInvitation,
    acceptingId,
    rejectingId,
  } = useUserInvitations();
  const navigate = useNavigate();

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

  const formatExpiresIn = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 0) return 'Expired';
    if (diffInHours < 1) return 'Expires soon';
    if (diffInHours < 24) return `Expires in ${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `Expires in ${diffInDays}d`;
  };

  const getRoleStyles = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'editor':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'viewer':
        return 'bg-emerald-500/10 text-success dark:text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const handleAcceptInvitation = async (invitation: any) => {
    const result = await acceptInvitation(invitation.id);
    if (result.success) {
      onInvitationAccepted?.(result.projectId || invitation.project_id);
      setTimeout(() => navigate('/projects'), 800);
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    await rejectInvitation(invitationId);
  };

  // Header (shared)
  const Header = ({ count }: { count?: number }) => (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Mail className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="font-semibold text-base leading-tight">Project Invitations</h3>
          <p className="text-xs text-muted-foreground">
            Pending project memberships awaiting your response
          </p>
        </div>
      </div>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="rounded-full px-2.5 font-medium">
          {count} pending
        </Badge>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card className="overflow-hidden border-border/60">
        {showTitle && <Header />}
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="icon-md animate-spin" />
            Loading invitations...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card className="overflow-hidden border-border/60">
        {showTitle && <Header />}
        <CardContent className="py-10">
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="icon-lg text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No pending invitations</p>
            <p className="text-xs text-muted-foreground">
              You're all caught up — new invites will show up here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayInvitations = maxItems ? invitations.slice(0, maxItems) : invitations;

  return (
    <Card className="overflow-hidden border-border/60">
      {showTitle && <Header count={invitations.length} />}
      <CardContent className="p-4 space-y-3">
        {displayInvitations.map((invitation) => {
          const isProcessing = acceptingId === invitation.id || rejectingId === invitation.id;
          return (
            <div
              key={invitation.id}
              className="group rounded-lg border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="h-10 w-10 border border-border/60 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {invitation.project_name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{invitation.project_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      Invited by <span className="font-medium text-foreground/80">{invitation.inviter_name}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={cn('text-xs font-medium', getRoleStyles(invitation.role))}>
                  {invitation.role === 'admin'
                    ? 'Project Admin'
                    : invitation.role === 'editor'
                    ? 'Project Editor'
                    : 'Project Viewer'}
                </Badge>
              </div>

              {invitation.message && (
                <div className="text-sm text-muted-foreground bg-muted/40 border-l-2 border-primary/30 px-3 py-2 rounded-r italic">
                  "{invitation.message}"
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="icon-xs" />
                    Invited {formatTimeAgo(invitation.invited_at)}
                  </span>
                  <span className="text-border">•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {formatExpiresIn(invitation.expires_at)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectInvitation(invitation.id)}
                    disabled={isProcessing}
                    className="h-8"
                  >
                    {rejectingId === invitation.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvitation(invitation)}
                    disabled={isProcessing}
                    className="h-8"
                  >
                    {acceptingId === invitation.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Accept
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {maxItems && invitations.length > maxItems && (
          <div className="text-center pt-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
              View all {invitations.length} invitations
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
