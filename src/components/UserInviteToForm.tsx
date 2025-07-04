
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UserInviteToFormProps {
  formId: string;
  onUserAdded: () => void;
}

export function UserInviteToForm({ formId, onUserAdded }: UserInviteToFormProps) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(false);
  const { users } = useOrganizationUsers();
  const { currentProject } = useProject();

  const handleInvite = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    if (!currentProject) {
      toast({
        title: "Error",
        description: "No project selected",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // First, add user to project if not already added
      const { error: projectUserError } = await supabase
        .from('project_users')
        .upsert({
          project_id: currentProject.id,
          user_id: selectedUserId,
          role: role,
        }, {
          onConflict: 'project_id,user_id'
        });

      if (projectUserError) {
        console.error('Error adding user to project:', projectUserError);
      }

      // Add basic permissions for the user to the form
      const basicPermissions = ['view_form', 'submit_form'];
      
      for (const permission of basicPermissions) {
        const { error: permissionError } = await supabase
          .from('asset_permissions')
          .upsert({
            project_id: currentProject.id,
            user_id: selectedUserId,
            asset_type: 'form',
            asset_id: formId,
            permission_type: permission,
          });

        if (permissionError) {
          console.error('Error granting permission:', permissionError);
        }
      }
      
      toast({
        title: "Success",
        description: "User added to form successfully with basic permissions",
      });
      
      onUserAdded();
      setOpen(false);
      setSelectedUserId('');
    } catch (error) {
      console.error('Error adding user to form:', error);
      toast({
        title: "Error",
        description: "Failed to add user to form",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User to Form</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="user">Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email} {user.first_name && `(${user.first_name} ${user.last_name})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="role">Initial Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={loading}>
              {loading ? 'Adding...' : 'Add User'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
