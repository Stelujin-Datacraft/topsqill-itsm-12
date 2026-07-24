import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, UserPlus, UserMinus, X, Search, Users as UsersIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useSecurityTemplates } from '@/hooks/useSecurityTemplates';
import { useAllSecurityParameters } from '@/hooks/useSecurityParameters';
import { useGroups } from '@/hooks/useGroups';
import { useOrganization } from '@/contexts/OrganizationContext';
import { backend as supabase } from '@/services/api';
import { toast } from '@/hooks/use-toast';

export function AssignSecurityTemplatesTab() {
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [bulkTab, setBulkTab] = useState<'users' | 'groups'>('users');

  const { currentOrganization } = useOrganization();
  const { users: allUsers, loading: usersLoading } = useOrganizationUsers();
  const { templates, loading: templatesLoading } = useSecurityTemplates();
  const { allParameters, loading: paramsLoading, refetch } = useAllSecurityParameters();
  const { groups, loading: groupsLoading, getGroupMembers } = useGroups();

  const users = allUsers;

  const getUserTemplate = (userId: string) => {
    const p = allParameters.find(a => a.user_id === userId);
    if (!p?.security_template_id) return null;
    return templates.find(t => t.id === p.security_template_id) || null;
  };

  const getUnassignedUsers = () => users.filter(u => !getUserTemplate(u.id));

  const upsertTemplate = async (userIds: string[], templateId: string | null) => {
    if (!currentOrganization?.id) return;
    const rows = userIds.map(uid => ({
      user_id: uid,
      organization_id: currentOrganization.id,
      security_template_id: templateId,
      use_template_settings: templateId !== null,
    }));
    const { error } = await supabase
      .from('user_security_parameters')
      .upsert(rows, { onConflict: 'user_id' });
    if (error) throw error;
    await refetch();
  };

  const handleAssignTemplate = async (userId: string, templateId: string) => {
    try {
      await upsertTemplate([userId], templateId);
      toast({ title: 'Success', description: 'Template assigned successfully' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to assign template', variant: 'destructive' });
    }
  };

  const handleRemoveTemplate = async (userId: string) => {
    try {
      await upsertTemplate([userId], null);
      toast({ title: 'Success', description: 'Template removed successfully' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to remove template', variant: 'destructive' });
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedTemplate || (selectedUsers.length === 0 && selectedGroups.length === 0)) {
      toast({ title: 'Error', description: 'Please select users/groups and a template', variant: 'destructive' });
      return;
    }
    try {
      // Expand group selections into user IDs
      const groupUserIds = new Set<string>();
      for (const gid of selectedGroups) {
        const members = await getGroupMembers(gid);
        members.filter(m => m.member_type === 'user').forEach(m => groupUserIds.add(m.member_id));
      }
      const allIds = Array.from(new Set([...selectedUsers, ...groupUserIds]));
      if (allIds.length === 0) {
        toast({ title: 'Error', description: 'No users resolved from selection', variant: 'destructive' });
        return;
      }
      await upsertTemplate(allIds, selectedTemplate);
      toast({ title: 'Success', description: `Template assigned to ${allIds.length} users` });
      setSelectedUsers([]);
      setSelectedGroups([]);
      setSelectedTemplate('');
      setShowBulkAssign(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to assign templates', variant: 'destructive' });
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    setSelectedUsers(prev => checked ? [...prev, userId] : prev.filter(id => id !== userId));
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(id => id !== userId));
  };

  const handleGroupSelection = (gid: string, checked: boolean) => {
    setSelectedGroups(prev => checked ? [...prev, gid] : prev.filter(id => id !== gid));
  };
  const removeSelectedGroup = (gid: string) => {
    setSelectedGroups(prev => prev.filter(id => id !== gid));
  };

  const displayName = (u: any) =>
    u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : u?.email || '';

  const filteredUnassignedUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    const list = getUnassignedUsers();
    if (!term) return list;
    return list.filter(u =>
      displayName(u).toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
  }, [users, allParameters, userSearch]);

  const filteredGroups = useMemo(() => {
    const term = groupSearch.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter(g => g.name.toLowerCase().includes(term));
  }, [groups, groupSearch]);

  if (usersLoading || templatesLoading || paramsLoading) {
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
          <h2 className="text-xl font-semibold">User Security Template Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign security templates to individual users or in bulk (Admin users excluded)
          </p>
        </div>
        <Button
          onClick={() => setShowBulkAssign(!showBulkAssign)}
          variant={showBulkAssign ? 'secondary' : 'default'}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {showBulkAssign ? 'Cancel Bulk Assign' : 'Bulk Assign Templates'}
        </Button>
      </div>

      {showBulkAssign && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Bulk Template Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Tabs value={bulkTab} onValueChange={(v) => setBulkTab(v as 'users' | 'groups')}>
                  <TabsList className="grid grid-cols-2 w-full mb-2">
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="groups">Groups</TabsTrigger>
                  </TabsList>
                  <TabsContent value="users" className="mt-0">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <div className="space-y-2 h-56 overflow-y-auto border rounded p-2">
                      {filteredUnassignedUsers.map(user => (
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
                      {filteredUnassignedUsers.length === 0 && (
                        <p className="text-sm text-muted-foreground">No users match</p>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="groups" className="mt-0">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search groups..."
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <div className="space-y-2 h-56 overflow-y-auto border rounded p-2">
                      {groupsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading groups...</p>
                      ) : filteredGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No groups match</p>
                      ) : (
                        filteredGroups.map(g => (
                          <div key={g.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedGroups.includes(g.id)}
                              onChange={(e) => handleGroupSelection(g.id, e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm flex items-center gap-2">
                              <UsersIcon className="h-3 w-3 text-muted-foreground" />
                              {g.name}
                              <span className="text-xs text-muted-foreground">({g.member_count || 0})</span>
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Selected ({selectedUsers.length} users, {selectedGroups.length} groups)
                </label>
                <div className="bg-muted/30 border rounded p-3 h-[20.5rem] overflow-y-auto flex flex-wrap gap-2 content-start">
                  {selectedUsers.length === 0 && selectedGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing selected yet</p>
                  ) : (
                    <>
                      {selectedGroups.map(gid => {
                        const g = groups.find(x => x.id === gid);
                        return (
                          <Badge key={`g-${gid}`} variant="default" className="flex items-center gap-1 h-fit">
                            <UsersIcon className="h-3 w-3" />
                            {g?.name || gid}
                            <button
                              onClick={() => removeSelectedGroup(gid)}
                              className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                      {selectedUsers.map(userId => {
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
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Select Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.is_default ? ' (Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleBulkAssign} disabled={(selectedUsers.length === 0 && selectedGroups.length === 0) || !selectedTemplate}>
                Assign Template
              </Button>
              <Button variant="outline" onClick={() => {
                setSelectedUsers([]);
                setSelectedGroups([]);
                setSelectedTemplate('');
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
            <Shield className="h-5 w-5" />
            User Template Management ({users.length} users)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Users</TableHead>
                  <TableHead>Template Assigned</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const assigned = getUserTemplate(user.id);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.first_name && user.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user.email}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {assigned ? (
                          <Badge variant="default">{assigned.name}</Badge>
                        ) : (
                          <Badge variant="secondary">No Template</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {assigned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveTemplate(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Remove Template
                          </Button>
                        ) : (
                          <Select onValueChange={(tplId) => handleAssignTemplate(user.id, tplId)}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Assign Template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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