
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface UserInviteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (data: { email: string; firstName: string; lastName: string; role: string }) => void;
  organizationName?: string;
}

const UserInviteDialog = ({ isOpen, onOpenChange, onInvite, organizationName }: UserInviteDialogProps) => {
  const [inviteData, setInviteData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInvite(inviteData);
    setInviteData({ email: '', firstName: '', lastName: '', role: 'user' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation to join {organizationName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                placeholder="Enter email address"
                required
              />
            </div>
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                type="text"
                value={inviteData.firstName}
                onChange={(e) => setInviteData({ ...inviteData, firstName: e.target.value })}
                placeholder="Enter first name"
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                type="text"
                value={inviteData.lastName}
                onChange={(e) => setInviteData({ ...inviteData, lastName: e.target.value })}
                placeholder="Enter last name"
                required
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={inviteData.role} onValueChange={(value) => setInviteData({ ...inviteData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Send Invitation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserInviteDialog;
