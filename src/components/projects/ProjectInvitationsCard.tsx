
import React from 'react';
import { useUserInvitations } from '@/hooks/useUserInvitations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, Clock, Check, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProjectInvitationsCardProps {
  showTitle?: boolean;
  maxItems?: number;
  onInvitationAccepted?: (projectId: string) => void;
}

export function ProjectInvitationsCard({ 
  showTitle = true, 
  maxItems,
  onInvitationAccepted 
}: ProjectInvitationsCardProps) {
  const { 
    invitations, 
    loading, 
    acceptInvitation, 
    rejectInvitation,
    acceptingId,
    rejectingId 
  } = useUserInvitations();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Project Invitations
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading invitations...
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayInvitations = maxItems ? invitations.slice(0, maxItems) : invitations;

  if (invitations.length === 0) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Project Invitations
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center text-muted-foreground">No pending invitations</div>
        </CardContent>
      </Card>
    );
  }

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
    
    if (diffInHours < 1) return 'Expires soon';
    if (diffInHours < 24) return `Expires in ${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `Expires in ${diffInDays}d`;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAcceptInvitation = async (invitation: any) => {
    const result = await acceptInvitation(invitation.id);
    if (result.success) {
      onInvitationAccepted?.(result.projectId || invitation.project_id);
      // Navigate to the project after successful acceptance
      setTimeout(() => {
        navigate(`/projects`);
      }, 1000);
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    await rejectInvitation(invitationId);
  };

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Project Invitations ({invitations.length})
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {displayInvitations.map((invitation) => (
          <div key={invitation.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {invitation.project_name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{invitation.project_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Invited by {invitation.inviter_name}
                  </div>
                </div>
              </div>
              <Badge className={getRoleBadgeColor(invitation.role)}>
                {invitation.role === 'admin' ? 'Project Admin' :
                 invitation.role === 'editor' ? 'Project Editor' :
                 'Project Viewer'}
              </Badge>
            </div>

            {invitation.message && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                "{invitation.message}"
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Invited {formatTimeAgo(invitation.invited_at)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatExpiresIn(invitation.expires_at)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAcceptInvitation(invitation)}
                disabled={acceptingId === invitation.id || rejectingId === invitation.id}
                className="flex-1"
              >
                {acceptingId === invitation.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {acceptingId === invitation.id ? 'Accepting...' : 'Accept'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRejectInvitation(invitation.id)}
                disabled={acceptingId === invitation.id || rejectingId === invitation.id}
                className="flex-1"
              >
                {rejectingId === invitation.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                {rejectingId === invitation.id ? 'Declining...' : 'Decline'}
              </Button>
            </div>
          </div>
        ))}

        {maxItems && invitations.length > maxItems && (
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
              View all {invitations.length} invitations
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
