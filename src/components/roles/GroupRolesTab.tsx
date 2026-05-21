
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Edit, ChevronDown, ChevronRight, User, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
    roleIds: [] as string[],
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
        roleIds: group.role_ids && group.role_ids.length > 0
          ? group.role_ids
          : (group.role_id ? [group.role_id] : []),
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
        roleIds: group.role_id ? [group.role_id] : [],
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
      roleIds: [],
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
      roleIds: [],
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
        roleIds: formData.roleIds,
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
        <Button onClick={handleCreateGroup}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
        </Button>
      </div>

      <Dialog open={showCreateForm} onOpenChange={(o) => { if (!o) handleCancelForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
          </DialogHeader>
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
                  <Label htmlFor="role">Assign Roles</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (!value) return;
                      setFormData(prev => prev.roleIds.includes(value)
                        ? prev
                        : { ...prev, roleIds: [...prev.roleIds, value] });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add a role (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter(r => !formData.roleIds.includes(r.id))
                        .map(role => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      {roles.filter(r => !formData.roleIds.includes(r.id)).length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          All roles selected
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {formData.roleIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.roleIds.map(rid => {
                        const r = roles.find(rr => rr.id === rid);
                        return (
                          <Badge key={rid} variant="secondary" className="flex items-center gap-1">
                            {r?.name || 'Unknown role'}
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, roleIds: prev.roleIds.filter(x => x !== rid) }))}
                              className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="users">
                    Users ({formData.selectedUsers.length} selected)
                  </TabsTrigger>
                  <TabsTrigger value="groups">
                    Groups ({formData.selectedGroups.length} selected)
                  </TabsTrigger>
                </TabsList>

                {/* Users tab: Available | Selected */}
                <TabsContent value="users" className="mt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-base font-medium mb-3 block">Available Users</Label>
                      <div className="border rounded-lg p-4 max-h-72 overflow-y-auto space-y-1">
                        {nonAdminUsers.filter(u => !formData.selectedUsers.includes(u.id)).map(user => (
                          <div
                            key={user.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                            onClick={() => toggleUserSelection(user.id)}
                          >
                            <User className="h-4 w-4 text-primary" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {user.first_name} {user.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </div>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                        {nonAdminUsers.filter(u => !formData.selectedUsers.includes(u.id)).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No users available
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-base font-medium mb-3 block">Selected Users</Label>
                      <div className="border rounded-lg p-4 max-h-72 overflow-y-auto bg-muted/30 space-y-1">
                        {formData.selectedUsers.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No users selected
                          </p>
                        )}
                        {formData.selectedUsers.map(userId => {
                          const user = nonAdminUsers.find(u => u.id === userId);
                          if (!user) return null;
                          return (
                            <div key={userId} className="flex items-center justify-between bg-background p-2 rounded border">
                              <div className="flex items-center space-x-2 min-w-0">
                                <User className="h-4 w-4 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {user.first_name} {user.last_name}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                                </div>
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeSelectedUser(userId)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Groups tab: Available | Selected */}
                <TabsContent value="groups" className="mt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-base font-medium mb-3 block">Available Groups</Label>
                      <div className="border rounded-lg p-4 max-h-72 overflow-y-auto space-y-1">
                        {groups
                          .filter(g => (!editingGroup || g.id !== editingGroup.id) && !formData.selectedGroups.includes(g.id))
                          .map(group => (
                            <div
                              key={group.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                              onClick={() => toggleGroupSelection(group.id)}
                            >
                              <Users className="h-4 w-4 text-primary" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{group.name}</div>
                                <div className="text-xs text-muted-foreground">{group.member_count} members</div>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </div>
                          ))}
                        {groups.filter(g => (!editingGroup || g.id !== editingGroup.id) && !formData.selectedGroups.includes(g.id)).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No groups available
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-base font-medium mb-3 block">Selected Groups</Label>
                      <div className="border rounded-lg p-4 max-h-72 overflow-y-auto bg-muted/30 space-y-1">
                        {formData.selectedGroups.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No groups selected
                          </p>
                        )}
                        {formData.selectedGroups.map(groupId => {
                          const group = groups.find(g => g.id === groupId);
                          if (!group) return null;
                          return (
                            <div key={groupId} className="flex items-center justify-between bg-background p-2 rounded border">
                              <div className="flex items-center space-x-2 min-w-0">
                                <Users className="h-4 w-4 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{group.name}</div>
                                  <div className="text-xs text-muted-foreground">{group.member_count} members</div>
                                </div>
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeSelectedGroup(groupId)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleCancelForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </Button>
              </div>
          </form>
        </DialogContent>
      </Dialog>

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
                     <TableHead className="text-right">Actions</TableHead>
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
                          {group.role_names && group.role_names.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {group.role_names.map((n, i) => (
                                <Badge key={i} variant="default">{n}</Badge>
                              ))}
                            </div>
                          ) : group.role_name ? (
                            <Badge variant="default">{group.role_name}</Badge>
                          ) : (
                            <Badge variant="secondary">No Role</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
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
