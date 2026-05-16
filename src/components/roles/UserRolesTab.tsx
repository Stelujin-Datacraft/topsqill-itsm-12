
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, UserMinus, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

  const bulkAssignRole = async (userIds: string[], roleId: string) => {
    // Remove existing roles for selected users first to avoid duplicates
    await supabase.from('user_role_assignments').delete().in('user_id', userIds);
    const assignments = userIds.map(userId => ({
      user_id: userId,
      role_id: roleId,
      assigned_by: userProfile?.id
    }));

    const { error } = await supabase
      .from('user_role_assignments')
      .insert(assignments);
    
    if (error) throw error;
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveRole = async (userId: string) => {
    try {
      await removeRole(userId);
      toast({
        title: "Success",
        description: "Role removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove role",
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign roles",
        variant: "destructive",
      });
    }
  };

  const getUserRole = (userId: string) => {
    const assignment = userRoleAssignments.find(a => a.user_id === userId);
    if (!assignment) return null;
    return roles.find(r => r.id === assignment.role_id);
  };

  const getUnassignedUsers = () => {
    return users.filter(user => !getUserRole(user.id));
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
                  <TableHead>Role Assigned</TableHead>
                  <TableHead>Group Assigned</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const assignedRole = getUserRole(user.id);
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
                        {assignedRole ? (
                          <Badge variant="default">{assignedRole.name}</Badge>
                        ) : (
                          <Badge variant="secondary">No Role</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {groupNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {groupNames.map((g, i) => (
                              <Badge key={i} variant="outline">{g}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {assignedRole ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveRole(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Remove Role
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Use Bulk Assign</span>
                        )}
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
