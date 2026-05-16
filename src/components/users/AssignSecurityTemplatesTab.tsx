import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, UserPlus, UserMinus, X } from 'lucide-react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useSecurityTemplates } from '@/hooks/useSecurityTemplates';
import { useAllSecurityParameters } from '@/hooks/useSecurityParameters';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function AssignSecurityTemplatesTab() {
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const { currentOrganization } = useOrganization();
  const { users: allUsers, loading: usersLoading } = useOrganizationUsers();
  const { templates, loading: templatesLoading } = useSecurityTemplates();
  const { allParameters, loading: paramsLoading, refetch } = useAllSecurityParameters();

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
    if (selectedUsers.length === 0 || !selectedTemplate) {
      toast({ title: 'Error', description: 'Please select users and a template', variant: 'destructive' });
      return;
    }
    try {
      await upsertTemplate(selectedUsers, selectedTemplate);
      toast({ title: 'Success', description: `Template assigned to ${selectedUsers.length} users` });
      setSelectedUsers([]);
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
                <label className="text-sm font-medium mb-2 block">Available Users (No Current Template)</label>
                <div className="space-y-2 h-64 overflow-y-auto border rounded p-2">
                  {getUnassignedUsers().map(user => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.email}
                      </span>
                    </div>
                  ))}
                  {getUnassignedUsers().length === 0 && (
                    <p className="text-sm text-muted-foreground">All users have templates assigned</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Selected Users ({selectedUsers.length})</label>
                <div className="bg-muted/30 border rounded p-3 h-64 overflow-y-auto flex flex-wrap gap-2 content-start">
                  {selectedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users selected yet</p>
                  ) : (
                    selectedUsers.map(userId => {
                      const user = users.find(u => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary" className="flex items-center gap-1 h-fit">
                          {user?.first_name && user?.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : user?.email}
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
              <Button onClick={handleBulkAssign} disabled={selectedUsers.length === 0 || !selectedTemplate}>
                Assign Template to Selected Users
              </Button>
              <Button variant="outline" onClick={() => {
                setSelectedUsers([]);
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