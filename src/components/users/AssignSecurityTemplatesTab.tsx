import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Shield, Search, Users as UsersIcon, User, UserCog } from 'lucide-react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useSecurityTemplates } from '@/hooks/useSecurityTemplates';
import { useAllSecurityParameters } from '@/hooks/useSecurityParameters';
import { useGroups } from '@/hooks/useGroups';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AssignSecurityTemplatesTab() {
  const { currentOrganization } = useOrganization();
  const { users } = useOrganizationUsers();
  const { templates } = useSecurityTemplates();
  const { allParameters, refetch: refetchParams } = useAllSecurityParameters();
  const { groups, getGroupMembers } = useGroups();

  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [targetTemplate, setTargetTemplate] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const templateById = useMemo(() => {
    const m = new Map<string, string>();
    templates.forEach(t => m.set(t.id, t.name));
    return m;
  }, [templates]);

  const paramsByUser = useMemo(() => {
    const m = new Map<string, string | null>();
    allParameters.forEach(p => m.set(p.user_id, p.security_template_id));
    return m;
  }, [allParameters]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleUser = (id: string) => {
    setSelectedUsers(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const expandGroupsToUserIds = async (): Promise<Set<string>> => {
    const userIds = new Set<string>();
    for (const gid of selectedGroups) {
      const members = await getGroupMembers(gid);
      members.forEach(m => {
        if (m.member_type === 'user') userIds.add(m.member_id);
      });
    }
    return userIds;
  };

  const openAssignDialog = () => {
    if (selectedUsers.size === 0 && selectedGroups.size === 0) {
      toast.error('Select at least one user or group');
      return;
    }
    setTargetTemplate('');
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!targetTemplate || !currentOrganization?.id) return;
    setSaving(true);
    try {
      const groupUserIds = await expandGroupsToUserIds();
      const allIds = new Set<string>([...selectedUsers, ...groupUserIds]);
      if (allIds.size === 0) {
        toast.error('No users to assign');
        return;
      }

      const rows = Array.from(allIds).map(uid => ({
        user_id: uid,
        organization_id: currentOrganization.id,
        security_template_id: targetTemplate,
        use_template_settings: true,
      }));

      const { error } = await supabase
        .from('user_security_parameters')
        .upsert(rows, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success(`Template assigned to ${allIds.size} user(s)`);
      setAssignOpen(false);
      setSelectedUsers(new Set());
      setSelectedGroups(new Set());
      await refetchParams();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to assign template');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTemplate = async (userId: string) => {
    if (!currentOrganization?.id) return;
    try {
      const { error } = await supabase
        .from('user_security_parameters')
        .upsert(
          {
            user_id: userId,
            organization_id: currentOrganization.id,
            security_template_id: null,
            use_template_settings: false,
          },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      toast.success('Template removed');
      await refetchParams();
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove template');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Assign Security Templates</CardTitle>
              <CardDescription>
                Assign a security template to users individually or in bulk via groups
              </CardDescription>
            </div>
          </div>
          <Button onClick={openAssignDialog} disabled={selectedUsers.size === 0 && selectedGroups.size === 0}>
            <Shield className="h-4 w-4 mr-2" />
            Assign Template ({selectedUsers.size + selectedGroups.size})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="users">
              <User className="h-4 w-4 mr-2" />
              Users ({selectedUsers.size} selected)
            </TabsTrigger>
            <TabsTrigger value="groups">
              <UsersIcon className="h-4 w-4 mr-2" />
              Groups ({selectedGroups.size} selected)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4 space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current Template</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => {
                    const tplId = paramsByUser.get(u.id);
                    const tplName = tplId ? templateById.get(tplId) : null;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.has(u.id)}
                            onCheckedChange={() => toggleUser(u.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          {tplName ? (
                            <Badge variant="default">{tplName}</Badge>
                          ) : (
                            <Badge variant="secondary">No Template</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {tplId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTemplate(u.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="groups" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecting a group will apply the chosen template to all of its user members.
            </p>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map(g => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedGroups.has(g.id)}
                          onCheckedChange={() => toggleGroup(g.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>{g.member_count}</TableCell>
                      <TableCell>
                        {g.role_name ? (
                          <Badge variant="outline">{g.role_name}</Badge>
                        ) : (
                          <Badge variant="secondary">No Role</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {groups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No groups available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Security Template</DialogTitle>
            <DialogDescription>
              Apply the selected template to {selectedUsers.size} user(s)
              {selectedGroups.size > 0 && ` and members of ${selectedGroups.size} group(s)`}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Security Template</label>
            <Select value={targetTemplate} onValueChange={setTargetTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.is_default ? ' (Default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No templates available. Create one in the "Create Templates" tab first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!targetTemplate || saving}>
              {saving ? 'Assigning...' : 'Assign Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}