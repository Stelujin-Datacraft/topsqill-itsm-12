
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CheckCircle, Users as UsersIcon, XCircle } from 'lucide-react';

interface OrganizationRequest {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

interface UserRequestsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  requests: OrganizationRequest[];
  selectedRequests: Set<string>;
  onToggleSelection: (requestId: string) => void;
  onApproveRequest: (request: OrganizationRequest) => void;
  onRejectRequest: (requestId: string) => void;
  onApproveSelected: () => void;
  onApproveAll: () => void;
}

const UserRequestsDialog = ({
  isOpen,
  onOpenChange,
  requests,
  selectedRequests,
  onToggleSelection,
  onApproveRequest,
  onRejectRequest,
  onApproveSelected,
  onApproveAll
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pending User Requests ({requests.length})</DialogTitle>
          <DialogDescription>
            Review and approve user requests to join your organization.
          </DialogDescription>
        </DialogHeader>
        
        {requests.length > 0 ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={onApproveSelected}
                disabled={selectedRequests.size === 0}
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve Selected ({selectedRequests.size})
              </Button>
              <Button 
                onClick={onApproveAll}
                variant="outline"
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve All ({requests.length})
              </Button>
            </div>
            
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedRequests.has(request.id)}
                      onChange={() => onToggleSelection(request.id)}
                      className="h-4 w-4"
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {getInitials(request.first_name, request.last_name, request.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.first_name} {request.last_name}</p>
                      <p className="text-sm text-muted-foreground">{request.email}</p>
                      {request.message && (
                        <p className="text-xs text-muted-foreground mt-1">{request.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Requested: {new Date(request.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => onApproveRequest(request)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reject Request</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to reject the request from {request.first_name} {request.last_name}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onRejectRequest(request.id)}>
                            Reject
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No pending requests found.</p>
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
