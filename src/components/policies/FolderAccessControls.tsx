import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Users, Trash2, Plus, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface FolderAccessControlsProps {
  folderId: string;
}

export function FolderAccessControls({ folderId }: FolderAccessControlsProps) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('view');

  const { data: accessList = [] } = useQuery({
    queryKey: ['folder_access', folderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base_folder_access')
        .select('*')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!folderId,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['org-users-for-access', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active')
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['org-groups-for-access', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  const addAccess = useMutation({
    mutationFn: async () => {
      const isGroup = selectedUser.startsWith('group:');
      const granteeId = isGroup ? selectedUser.replace('group:', '') : selectedUser;
      const { error } = await supabase
        .from('knowledge_base_folder_access')
        .insert([{
          folder_id: folderId,
          access_type: isGroup ? 'group' : 'user',
          grantee_id: granteeId,
          permission: selectedPermission,
          granted_by: user?.id,
        } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder_access', folderId] });
      setSelectedUser('');
      toast.success('Access granted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeAccess = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_base_folder_access')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder_access', folderId] });
      toast.success('Access removed');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getGranteeName = (access: any) => {
    if (access.access_type === 'group') {
      const group = groups.find(g => g.id === access.grantee_id);
      return group?.name || 'Unknown Group';
    }
    const u = orgUsers.find(u => u.id === access.grantee_id);
    return u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email : 'Unknown User';
  };

  const alreadyGranted = new Set(accessList.map((a: any) => `${a.access_type}:${a.grantee_id}`));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" /> Grant Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>User or Group</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {orgUsers.filter(u => !alreadyGranted.has(`user:${u.id}`)).map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                    </SelectItem>
                  ))}
                  {groups.filter(g => !alreadyGranted.has(`group:${g.id}`)).map(g => (
                    <SelectItem key={`group:${g.id}`} value={`group:${g.id}`}>
                      👥 {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Permission</Label>
              <Select value={selectedPermission} onValueChange={setSelectedPermission}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="sm"
            disabled={!selectedUser || addAccess.isPending}
            onClick={() => addAccess.mutate()}
          >
            <Plus className="h-4 w-4 mr-1" /> Grant Access
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Current Access ({accessList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accessList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No specific access controls. All org members can view by default.
            </p>
          ) : (
            <div className="space-y-2">
              {accessList.map((access: any) => (
                <div key={access.id} className="flex items-center justify-between p-2.5 rounded-md border">
                  <div className="flex items-center gap-2">
                    {access.access_type === 'group' ? (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-primary/20" />
                    )}
                    <span className="text-sm font-medium">{getGranteeName(access)}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{access.access_type}</Badge>
                    <Badge variant={access.permission === 'admin' ? 'default' : 'secondary'} className="text-[10px] capitalize">
                      {access.permission}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeAccess.mutate(access.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
