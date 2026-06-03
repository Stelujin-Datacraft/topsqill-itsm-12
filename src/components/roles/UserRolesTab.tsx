
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, UserMinus, X, Search, ChevronDown, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useRoles } from '@/hooks/useRoles';
import { useUserRoleAssignments } from '@/hooks/useUserRoleAssignments';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function UserRolesTab() {
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [userGroupsMap, setUserGroupsMap] = useState<Record<string, string[]>>({});
  
  const { users: allUsers, loading: usersLoading } = useOrganizationUsers();
  const { roles, loading: rolesLoading } = useRoles();
  const { 
    assignments: userRoleAssignments, 
    loading: assignmentsLoading,
    refetch: refetchAssignments
  } = useUserRoleAssignments(); // Load all assignments for admin view
  
  const { userProfile } = useAuth();

  // Load user->group name list via group_memberships
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('group_memberships')
        .select('member_id, member_type, groups!inner(name)')
        .eq('member_type', 'user');
      if (error || !mounted) return;
      const map: Record<string, string[]> = {};
      for (const row of (data as any[]) || []) {
        const uid = row.member_id;
        const gname = row.groups?.name;
        if (!uid || !gname) continue;
        (map[uid] ||= []).push(gname);
      }
      setUserGroupsMap(map);
    })();
    return () => { mounted = false; };
  }, []);

  const assignRole = async (userId: string, roleId: string) => {
    const { error } = await supabase
      .from('user_role_assignments')
      .insert({
        user_id: userId,
        role_id: roleId,
        assigned_by: userProfile?.id
      });
    
    if (error) throw error;
    await refetchAssignments();
  };

  const removeRole = async (userId: string) => {
    const { error } = await supabase
      .from('user_role_assignments')
      .delete()
      .eq('user_id', userId);
    
    if (error) throw error;
    await refetchAssignments();
  };

  const removeOneRole = async (userId: string, roleId: string) => {
    const { error } = await supabase
      .from('user_role_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);
    if (error) throw error;
    await refetchAssignments();
  };

  const bulkAssignRole = async (userIds: string[], roleId: string) => {
    if (!userProfile?.id) {
      throw new Error('Missing current user profile');
    }
    // Add the role to all selected users (skip duplicates)
    const existing = new Set(
      userRoleAssignments
        .filter(a => a.role_id === roleId && userIds.includes(a.user_id))
        .map(a => a.user_id)
    );
    const assignments = userIds
      .filter(uid => !existing.has(uid))
      .map(userId => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: userProfile.id,
      }));
    if (assignments.length > 0) {
      const { error } = await supabase
        .from('user_role_assignments')
        .insert(assignments);
      if (error) throw error;
    }
    await refetchAssignments();
  };

  // Filter out admin users from the list
  const users = allUsers.filter(user => user.role !== 'admin');

  const displayName = (u: any) =>
    u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : u?.email || '';

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      await assignRole(userId, roleId);
      toast({
        title: "Success",
        description: "Role assigned successfully",
      });
    } catch (error: any) {
      console.error('Assign role error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to assign role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveOneRole = async (userId: string, roleId: string) => {
    try {
      await removeOneRole(userId, roleId);
      toast({ title: "Success", description: "Role removed successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove role",
        variant: "destructive",
      });
    }
  };

  const handleBulkAssign = async () => {
    if (selectedUsers.length === 0 || !selectedRole) {
      toast({
        title: "Error",
        description: "Please select users and a role",
        variant: "destructive",
      });
      return;
    }

    try {
      await bulkAssignRole(selectedUsers, selectedRole);
      toast({
        title: "Success",
        description: `Role assigned to ${selectedUsers.length} users`,
      });
      setSelectedUsers([]);
      setSelectedRole('');
      setShowBulkAssign(false);
    } catch (error: any) {
      console.error('Bulk assign error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to assign roles",
        variant: "destructive",
      });
    }
  };

  const getUserRoles = (userId: string) => {
    const ids = userRoleAssignments.filter(a => a.user_id === userId).map(a => a.role_id);
    return roles.filter(r => ids.includes(r.id));
  };

  const getUnassignedUsers = () => {
    return users.filter(user => getUserRoles(user.id).length === 0);
  };

  const filteredUnassigned = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    const list = getUnassignedUsers();
    if (!term) return list;
    return list.filter(u =>
      displayName(u).toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
  }, [users, userRoleAssignments, userSearch]);

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(id => id !== userId));
  };

  if (usersLoading || rolesLoading || assignmentsLoading) {
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
          <h2 className="text-xl font-semibold">User Role Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign roles to individual users and manage their permissions (Admin users excluded)
          </p>
        </div>
        <Button 
          onClick={() => setShowBulkAssign(!showBulkAssign)}
          variant={showBulkAssign ? "secondary" : "default"}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {showBulkAssign ? 'Cancel Bulk Assign' : 'Bulk Assign Roles'}
        </Button>
      </div>

      {showBulkAssign && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Bulk Role Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Available Users (No Current Role)</label>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <div className="space-y-2 h-64 overflow-y-auto border rounded p-2">
                  {filteredUnassigned.map(user => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">{displayName(user)}</span>
                    </div>
                  ))}
                  {filteredUnassigned.length === 0 && (
                    <p className="text-sm text-muted-foreground">No users match</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Selected Users ({selectedUsers.length})</label>
                <div className="bg-muted/30 border rounded p-3 h-[19.5rem] overflow-y-auto flex flex-wrap gap-2 content-start">
                  {selectedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users selected yet</p>
                  ) : (
                    selectedUsers.map(userId => {
                      const user = users.find(u => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary" className="flex items-center gap-1 h-fit">
                          {displayName(user)}
                          <button
                            onClick={() => removeSelectedUser(userId)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Select Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
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

            <div className="flex gap-2">
              <Button onClick={handleBulkAssign} disabled={selectedUsers.length === 0 || !selectedRole}>
                Assign Role to Selected Users
              </Button>
              <Button variant="outline" onClick={() => {
                setSelectedUsers([]);
                setSelectedRole('');
                setShowBulkAssign(false);
              }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Role Management ({users.length} users)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Users</TableHead>
                  <TableHead>Roles Assigned</TableHead>
                  <TableHead>Group Assigned</TableHead>
                  <TableHead>Add Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const assignedRoles = getUserRoles(user.id);
                  const assignedIds = new Set(assignedRoles.map(r => r.id));
                  const groupNames = userGroupsMap[user.id] || [];
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{displayName(user)}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignedRoles.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-module-compliance" />
                                View Roles ({assignedRoles.length})
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-72 p-2">
                              <div className="space-y-1 max-h-64 overflow-y-auto">
                                {assignedRoles.map(r => (
                                  <div
                                    key={r.id}
                                    className="flex items-center justify-between gap-2 p-2 rounded border bg-background"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Shield className="h-4 w-4 text-module-compliance shrink-0" />
                                      <span className="text-sm font-medium truncate">{r.name}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOneRole(user.id, r.id)}
                                      className="hover:bg-destructive/20 rounded-full p-1 shrink-0"
                                      title="Remove role"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Badge variant="secondary">No Role</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {groupNames.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-module-access" />
                                View Groups ({groupNames.length})
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-72 p-2">
                              <div className="space-y-1 max-h-64 overflow-y-auto">
                                {groupNames.map((g, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 p-2 rounded border bg-background"
                                  >
                                    <Users className="h-4 w-4 text-module-access shrink-0" />
                                    <span className="text-sm font-medium truncate">{g}</span>
                                  </div>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value=""
                          onValueChange={(roleId) => handleAssignRole(user.id, roleId)}
                        >
                          <SelectTrigger className="h-9 w-[200px]">
                            <SelectValue placeholder="Add role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.filter(r => !assignedIds.has(r.id)).length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                {roles.length === 0 ? 'No roles available' : 'All roles assigned'}
                              </div>
                            ) : (
                              roles.filter(r => !assignedIds.has(r.id)).map(role => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
