
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { XCircle, Users as UsersIcon, Clock, Mail, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OrganizationRequest {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'accepted';
  requested_at: string;
  expires_at?: string;
  role?: string;
  invitation_type?: 'admin_invite' | 'self_request';
}

interface UserRequestsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  requests: OrganizationRequest[];
  onCancelInvitation: (requestId: string) => void;
  isLoading?: boolean;
}

const UserRequestsDialog = ({
  isOpen,
  onOpenChange,
  requests,
  onCancelInvitation,
  isLoading
}: UserRequestsDialogProps) => {
  const getInitials = (firstName: string, lastName: string, email: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  const getRoleBadge = (role?: string) => {
    const roleColors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800 border-red-200',
      moderator: 'bg-blue-100 text-blue-800 border-blue-200',
      user: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return roleColors[role || 'user'] || roleColors.user;
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Filter to only show pending invitations
  const pendingInvitations = requests.filter(r => r.status === 'pending');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Pending Invitations ({pendingInvitations.length})
          </DialogTitle>
          <DialogDescription>
            View and manage pending user invitations. Cancel an invitation to invalidate the invite link.
          </DialogDescription>
        </DialogHeader>
        
        {pendingInvitations.length > 0 ? (
          <div className="space-y-3">
            {pendingInvitations.map((request) => {
              const expired = isExpired(request.expires_at);
              
              return (
                <div 
                  key={request.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    expired ? 'bg-muted/50 opacity-75' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(request.first_name, request.last_name, request.email)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {request.first_name} {request.last_name}
                        </p>
                        <Badge variant="outline" className={getRoleBadge(request.role)}>
                          {request.role || 'user'}
                        </Badge>
                        {expired && (
                          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                            Expired
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{request.email}</p>
                      
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Invited {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                        </span>
                        {request.expires_at && (
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {expired ? 'Expired' : `Expires ${formatDistanceToNow(new Date(request.expires_at), { addSuffix: true })}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isLoading}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel Invitation
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel the invitation for <strong>{request.first_name} {request.last_name}</strong>?
                            <br /><br />
                            This will invalidate the invitation link sent to their email. They will not be able to join the organization using this invitation.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Invitation</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => onCancelInvitation(request.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Cancel Invitation
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <UsersIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Pending Invitations</h3>
            <p className="text-muted-foreground text-sm">
              All invitations have been accepted or there are no pending invitations.
            </p>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserRequestsDialog;
