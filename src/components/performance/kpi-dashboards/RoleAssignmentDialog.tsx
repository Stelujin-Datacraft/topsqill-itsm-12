import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { PerformanceRoleType } from '@/hooks/usePerformanceKPI';
import { Loader2, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfProjectId: string;
}

const ROLE_LABELS: Record<PerformanceRoleType, string> = {
  senior_management: 'Senior Management',
  project_manager: 'Project Manager',
  discipline_engineer: 'Discipline Engineer',
  finance_contract: 'Finance / Contract',
  risk_governance: 'Risk / Governance',
};

export function RoleAssignmentDialog({ open, onOpenChange, perfProjectId }: Props) {
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<PerformanceRoleType>('project_manager');

  // Fetch project users
  const { data: users = [] } = useQuery({
    queryKey: ['project-users-for-roles', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .eq('organization_id', userProfile?.organization_id);
      return data || [];
    },
    enabled: !!projectId && open,
  });

  // Fetch existing role assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['perf-role-assignments', projectId, perfProjectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_user_roles')
        .select('*')
        .eq('project_id', projectId)
        .eq('performance_project_id', perfProjectId);
      return data || [];
    },
    enabled: !!projectId && open,
  });

  const assignRole = useMutation({
    mutationFn: async () => {
      if (!projectId || !selectedUserId) throw new Error('Missing data');
      const { error } = await supabase
        .from('performance_user_roles')
        .upsert({
          user_id: selectedUserId,
          project_id: projectId,
          performance_project_id: perfProjectId,
          role_type: selectedRole,
          assigned_by: userProfile?.id,
        }, { onConflict: 'user_id,project_id,performance_project_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perf-role-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['perf-user-role'] });
      toast({ title: 'Role assigned successfully' });
      setSelectedUserId('');
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const removeRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('performance_user_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perf-role-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['perf-user-role'] });
      toast({ title: 'Role removed' });
    },
  });

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    if (!u) return userId.slice(0, 8);
    return u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Performance Roles</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Assign new role */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Role</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as PerformanceRoleType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as PerformanceRoleType[]).map(r => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => assignRole.mutate()} disabled={!selectedUserId || assignRole.isPending}>
              {assignRole.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
            </Button>
          </div>

          {/* Current assignments */}
          {isLoading ? (
            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No roles assigned yet. Admins default to Senior Management view.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>{getUserName(a.user_id)}</TableCell>
                    <TableCell>{ROLE_LABELS[a.role_type as PerformanceRoleType] || a.role_type}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeRole.mutate(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
