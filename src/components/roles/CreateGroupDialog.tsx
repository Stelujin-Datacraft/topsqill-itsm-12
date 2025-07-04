
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Users } from 'lucide-react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useRoles } from '@/hooks/useRoles';
import { useGroups, Group } from '@/hooks/useGroups';
import { toast } from '@/hooks/use-toast';

interface CreateGroupDialogProps {
  children?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  editingGroup?: Group | null;
  onSuccess?: () => void;
}

interface SelectedMember {
  id: string;
  name: string;
  type: 'user' | 'group';
  email?: string;
}

export function CreateGroupDialog({ children, isOpen, onOpenChange, editingGroup, onSuccess }: CreateGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [availableSelection, setAvailableSelection] = useState<string>('');

  const { users } = useOrganizationUsers();
  const { roles } = useRoles();
  const { groups, createGroup, updateGroup, getGroupMembers, loading } = useGroups();

  // Use controlled state if props are provided
  const dialogOpen = isOpen !== undefined ? isOpen : open;
  const setDialogOpen = onOpenChange || setOpen;

  // Filter out admin users and current group from available options
  const availableUsers = users.filter(user => 
    user.role !== 'admin' && 
    !selectedMembers.some(member => member.id === user.id && member.type === 'user')
  );

  const availableGroups = groups.filter(group => 
    group.id !== editingGroup?.id && 
    !selectedMembers.some(member => member.id === group.id && member.type === 'group')
  );

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!dialogOpen) {
      setGroupName('');
      setSelectedRole('');
      setSelectedMembers([]);
      setAvailableSelection('');
    } else if (editingGroup) {
      // Populate form with editing group data
      setGroupName(editingGroup.name);
      setSelectedRole(editingGroup.role_id || '');
      
      // Load group members
      getGroupMembers(editingGroup.id).then(members => {
        const formattedMembers: SelectedMember[] = members.map(member => ({
          id: member.member_id,
          name: member.member_name,
          type: member.member_type,
          email: member.member_email
        }));
        setSelectedMembers(formattedMembers);
      });
    }
  }, [dialogOpen, editingGroup]);

  const handleAddMember = () => {
    if (!availableSelection) return;

    const [type, id] = availableSelection.split(':');
    
    if (type === 'user') {
      const user = availableUsers.find(u => u.id === id);
      if (user) {
        const newMember: SelectedMember = {
          id: user.id,
          name: user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}` 
            : user.email,
          type: 'user',
          email: user.email
        };
        setSelectedMembers(prev => [...prev, newMember]);
      }
    } else if (type === 'group') {
      const group = availableGroups.find(g => g.id === id);
      if (group) {
        const newMember: SelectedMember = {
          id: group.id,
          name: group.name,
          type: 'group'
        };
        setSelectedMembers(prev => [...prev, newMember]);
      }
    }
    
    setAvailableSelection('');
  };

  const handleRemoveMember = (memberId: string, memberType: string) => {
    setSelectedMembers(prev => prev.filter(
      member => !(member.id === memberId && member.type === memberType)
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const groupData = {
        name: groupName,
        roleId: selectedRole || undefined,
        members: selectedMembers.map(member => ({
          id: member.id,
          type: member.type
        }))
      };

      if (editingGroup) {
        await updateGroup(editingGroup.id, groupData);
        toast({
          title: "Success",
          description: "Group updated successfully",
        });
      } else {
        await createGroup(groupData);
        toast({
          title: "Success",
          description: "Group created successfully",
        });
      }

      setDialogOpen(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving group:', error);
      toast({
        title: "Error",
        description: editingGroup ? "Failed to update group" : "Failed to create group",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {editingGroup ? 'Edit Group' : 'Create New Group'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              required
            />
          </div>

          <div className="space-y-4">
            <Label>Add Members</Label>
            <div className="flex gap-2">
              <Select value={availableSelection} onValueChange={setAvailableSelection}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select users or groups" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Users</div>
                      {availableUsers.map(user => (
                        <SelectItem key={`user:${user.id}`} value={`user:${user.id}`}>
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : user.email}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {availableGroups.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Groups</div>
                      {availableGroups.map(group => (
                        <SelectItem key={`group:${group.id}`} value={`group:${group.id}`}>
                          {group.name} (Group)
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                onClick={handleAddMember}
                disabled={!availableSelection}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {selectedMembers.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Members ({selectedMembers.length})</Label>
                <div className="bg-white border rounded p-3 min-h-[60px] flex flex-wrap gap-2">
                  {selectedMembers.map(member => (
                    <Badge key={`${member.type}:${member.id}`} variant="secondary" className="flex items-center gap-1">
                      {member.name} {member.type === 'group' && '(Group)'}
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id, member.type)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Assign Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role (optional)" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {editingGroup ? 'Update Group' : 'Create Group'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
