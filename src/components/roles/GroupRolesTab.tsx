
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Edit, ChevronDown, ChevronRight, User, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGroups, Group, GroupMember } from '@/hooks/useGroups';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useRoles } from '@/hooks/useRoles';
import { toast } from '@/hooks/use-toast';

export function GroupRolesTab() {
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    roleId: '',
    selectedUsers: [] as string[],
    selectedGroups: [] as string[]
  });

  const { groups, loading, createGroup, updateGroup, deleteGroup, getGroupMembers } = useGroups();
  const { users } = useOrganizationUsers();
  const { roles } = useRoles();

  // Filter out admin users from the All Users list
  const nonAdminUsers = users.filter(user => user.role !== 'admin');

  const handleViewMembers = async (groupId: string) => {
    if (expandedGroups.has(groupId)) {
      setExpandedGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
    } else {
      if (!groupMembers[groupId]) {
        try {
          const members = await getGroupMembers(groupId);
          setGroupMembers(prev => ({
            ...prev,
            [groupId]: members
          }));
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to load group members",
            variant: "destructive",
          });
          return;
        }
      }
      
      setExpandedGroups(prev => {
        const newSet = new Set(prev);
        newSet.add(groupId);
        return newSet;
      });
    }
  };

  const handleEditGroup = async (group: Group) => {
    setEditingGroup(group);
    
    // Load existing group members
    try {
      const members = await getGroupMembers(group.id);
      const existingUsers = members.filter(m => m.member_type === 'user').map(m => m.member_id);
      const existingGroups = members.filter(m => m.member_type === 'group').map(m => m.member_id);
      
      setFormData({
        name: group.name,
        roleId: group.role_id || '',
        selectedUsers: existingUsers,
        selectedGroups: existingGroups
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load existing group members",
        variant: "destructive",
      });
      setFormData({
        name: group.name,
        roleId: group.role_id || '',
        selectedUsers: [],
        selectedGroups: []
      });
    }
    
    setShowCreateForm(true);
  };

  const handleDeleteGroup = async (group: Group) => {
    if (window.confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)) {
      try {
        await deleteGroup(group.id);
        toast({
          title: "Success",
          description: "Group deleted successfully",
        });
        // Clear any cached member data for this group
        setGroupMembers(prev => {
          const updated = { ...prev };
          delete updated[group.id];
          return updated;
        });
        setExpandedGroups(prev => {
          const newSet = new Set(prev);
          newSet.delete(group.id);
          return newSet;
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete group",
          variant: "destructive",
        });
      }
    }
  };

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      roleId: '',
      selectedUsers: [],
      selectedGroups: []
    });
    setShowCreateForm(true);
  };

  const handleCancelForm = () => {
    setShowCreateForm(false);
    setEditingGroup(null);
    setFormData({
      name: '',
      roleId: '',
      selectedUsers: [],
      selectedGroups: []
    });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const groupData = {
        name: formData.name,
        roleId: formData.roleId || undefined,
        members: [
          ...formData.selectedUsers.map(id => ({ id, type: 'user' as const })),
          ...formData.selectedGroups.map(id => ({ id, type: 'group' as const }))
        ]
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

      handleCancelForm();
      setGroupMembers({});
      setExpandedGroups(new Set());
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${editingGroup ? 'update' : 'create'} group`,
        variant: "destructive",
      });
    }
  };

  const toggleUserSelection = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }));
  };

  const toggleGroupSelection = (groupId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedGroups: prev.selectedGroups.includes(groupId)
        ? prev.selectedGroups.filter(id => id !== groupId)
        : [...prev.selectedGroups, groupId]
    }));
  };

  const removeSelectedUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.filter(id => id !== userId)
    }));
  };

  const removeSelectedGroup = (groupId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedGroups: prev.selectedGroups.filter(id => id !== groupId)
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Group Role Management</h2>
          <p className="text-sm text-muted-foreground">
            Create groups and assign roles to multiple users at once
          </p>
        </div>
        {!showCreateForm && (
          <Button onClick={handleCreateGroup}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        )}
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {editingGroup ? 'Edit Group' : 'Create New Group'}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCancelForm}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitForm} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="groupName">Group Name *</Label>
                  <Input
                    id="groupName"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter group name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Assign Role</Label>
                  <Select
                    value={formData.roleId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, roleId: value }))}
                  >
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
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* All Users Column - Filter out admin users */}
                <div>
                  <Label className="text-base font-medium mb-3 block">All Users</Label>
                  <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                    {nonAdminUsers.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => toggleUserSelection(user.id)}
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="rounded"
                        />
                        <User className="h-4 w-4 text-blue-500" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    ))}
                    {nonAdminUsers.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No users available
                      </p>
                    )}
                  </div>
                </div>

                {/* All Groups Column */}
                <div>
                  <Label className="text-base font-medium mb-3 block">All Groups</Label>
                  <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                    {groups.filter(group => !editingGroup || group.id !== editingGroup.id).map(group => (
                      <div
                        key={group.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => toggleGroupSelection(group.id)}
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedGroups.includes(group.id)}
                          onChange={() => toggleGroupSelection(group.id)}
                          className="rounded"
                        />
                        <Users className="h-4 w-4 text-green-500" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {group.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {group.member_count} members
                          </div>
                        </div>
                      </div>
                    ))}
                    {groups.filter(group => !editingGroup || group.id !== editingGroup.id).length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No groups available
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Members Display */}
              <div>
                <Label className="text-base font-medium mb-3 block">Selected Members</Label>
                <div className="border rounded-lg p-4 min-h-32 bg-gray-50">
                  {(formData.selectedUsers.length > 0 || formData.selectedGroups.length > 0) ? (
                    <div className="space-y-2">
                      {/* Selected Users */}
                      {formData.selectedUsers.map(userId => {
                        const user = nonAdminUsers.find(u => u.id === userId);
                        return user ? (
                          <div key={userId} className="flex items-center justify-between bg-white p-2 rounded border">
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">
                                {user.first_name} {user.last_name}
                              </span>
                              <span className="text-xs text-gray-500">({user.email})</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSelectedUser(userId)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null;
                      })}
                      
                      {/* Selected Groups */}
                      {formData.selectedGroups.map(groupId => {
                        const group = groups.find(g => g.id === groupId);
                        return group ? (
                          <div key={groupId} className="flex items-center justify-between bg-white p-2 rounded border">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">{group.name}</span>
                              <span className="text-xs text-gray-500">({group.member_count} members)</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSelectedGroup(groupId)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No members selected. Choose users or groups from the lists above.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleCancelForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Groups ({groups.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No groups created yet
              </p>
              <Button onClick={handleCreateGroup}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Group
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Group Members</TableHead>
                    <TableHead>Role Assigned</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map(group => (
                    <React.Fragment key={group.id}>
                      <TableRow>
                        <TableCell>
                          <div className="font-medium">{group.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Created {new Date(group.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewMembers(group.id)}
                            className="flex items-center gap-2"
                          >
                            {expandedGroups.has(group.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            View Members ({group.member_count})
                          </Button>
                        </TableCell>
                        <TableCell>
                          {group.role_name ? (
                            <Badge variant="default">{group.role_name}</Badge>
                          ) : (
                            <Badge variant="secondary">No Role</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditGroup(group)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteGroup(group)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedGroups.has(group.id) && (
                        <TableRow>
                          <TableCell colSpan={4} className="p-0">
                            <div className="bg-muted/50 p-4 border-t">
                              <h4 className="font-medium mb-3">Group Members</h4>
                              {groupMembers[group.id]?.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {groupMembers[group.id].map(member => (
                                    <div
                                      key={`${member.member_type}:${member.member_id}`}
                                      className="flex items-center gap-2 p-2 bg-white rounded border"
                                    >
                                      {member.member_type === 'user' ? (
                                        <User className="h-4 w-4 text-blue-500" />
                                      ) : (
                                        <Users className="h-4 w-4 text-green-500" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">
                                          {member.member_name}
                                        </div>
                                        {member.member_email && (
                                          <div className="text-xs text-muted-foreground truncate">
                                            {member.member_email}
                                          </div>
                                        )}
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {member.member_type}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No members in this group
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
