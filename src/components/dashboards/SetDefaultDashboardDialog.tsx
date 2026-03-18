import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Users, User, Search, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboards } from '@/hooks/useDashboards';
import { useToast } from '@/hooks/use-toast';
import { DashboardWithReports } from '@/types/dashboard';

interface ProjectUser {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface SetDefaultDashboardDialogProps {
  dashboard: DashboardWithReports | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SetDefaultDashboardDialog({ dashboard, isOpen, onClose }: SetDefaultDashboardDialogProps) {
  const [defaultFor, setDefaultFor] = useState<'all' | 'specific'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [projectUsers, setProjectUsers] = useState<ProjectUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const { currentProject } = useProject();
  const { user } = useAuth();
  const { setDefaultDashboard, refetchDashboards } = useDashboards();
  const { toast } = useToast();

  // Load current settings and project users when dialog opens
  useEffect(() => {
    if (!isOpen || !dashboard || !currentProject) return;

    const loadData = async () => {
      setUsersLoading(true);
      try {
        // Load all organization users
        const { data: currentUser } = await supabase
          .from('user_profiles')
          .select('organization_id')
          .eq('id', user?.id)
          .single();

        if (currentUser?.organization_id) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, email, first_name, last_name, role')
            .eq('organization_id', currentUser.organization_id)
            .order('email');

          const merged: ProjectUser[] = (profiles || []).map(p => ({
            user_id: p.id,
            email: p.email,
            first_name: p.first_name,
            last_name: p.last_name,
            role: p.role || 'user',
          }));
          setProjectUsers(merged);
        }

        // Load existing default settings
        const currentDefaultFor = dashboard.default_for || 'all';
        setDefaultFor(currentDefaultFor as 'all' | 'specific');

        if (currentDefaultFor === 'specific') {
          const { data: assignedUsers } = await supabase
            .from('default_dashboard_users')
            .select('user_id')
            .eq('dashboard_id', dashboard.id);
          setSelectedUserIds((assignedUsers || []).map(u => u.user_id));
        } else {
          setSelectedUserIds([]);
        }
      } catch (err) {
        console.error('Error loading dialog data:', err);
      } finally {
        setUsersLoading(false);
      }
    };

    loadData();
  }, [isOpen, dashboard?.id, currentProject?.id]);

  const handleSave = async () => {
    if (!dashboard || !currentProject) return;

    if (defaultFor === 'specific' && selectedUserIds.length === 0) {
      toast({ title: 'Select Users', description: 'Please select at least one user.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Update dashboard: set is_default and default_for
      const { error: updateError } = await supabase
        .from('dashboards')
        .update({ is_default: true, default_for: defaultFor })
        .eq('id', dashboard.id);

      if (updateError) throw updateError;

      // Clear existing user assignments for this project
      await supabase
        .from('default_dashboard_users')
        .delete()
        .eq('project_id', currentProject.id);

      // If specific users, insert assignments
      if (defaultFor === 'specific' && selectedUserIds.length > 0) {
        const rows = selectedUserIds.map(userId => ({
          dashboard_id: dashboard.id,
          user_id: userId,
          project_id: currentProject.id,
        }));
        const { error: insertError } = await supabase
          .from('default_dashboard_users')
          .insert(rows);
        if (insertError) throw insertError;
      }

      toast({
        title: 'Default Dashboard Set',
        description: defaultFor === 'all'
          ? 'All users will see this dashboard after login.'
          : `${selectedUserIds.length} user(s) will see this dashboard after login.`,
      });

      await refetchDashboards();
      onClose();
    } catch (err) {
      console.error('Error setting default dashboard:', err);
      toast({ title: 'Error', description: 'Failed to set default dashboard.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDefault = async () => {
    if (!dashboard || !currentProject) return;
    setLoading(true);
    try {
      await supabase
        .from('dashboards')
        .update({ is_default: false, default_for: 'all' } as any)
        .eq('id', dashboard.id);

      await supabase
        .from('default_dashboard_users')
        .delete()
        .eq('dashboard_id', dashboard.id);

      toast({ title: 'Default Removed', description: 'Default dashboard has been unset.' });
      await refetchDashboards();
      onClose();
    } catch (err) {
      console.error('Error removing default:', err);
      toast({ title: 'Error', description: 'Failed to remove default.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = projectUsers.filter(u => {
    const name = `${u.first_name || ''} ${u.last_name || ''} ${u.email}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const isCurrentlyDefault = (dashboard as any)?.is_default;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Set Default Dashboard
          </DialogTitle>
          <DialogDescription>
            Choose who will be auto-redirected to "<strong>{dashboard?.name}</strong>" after login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={defaultFor} onValueChange={(v) => setDefaultFor(v as 'all' | 'specific')}>
            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
              onClick={() => setDefaultFor('all')}>
              <RadioGroupItem value="all" id="all-users" />
              <Label htmlFor="all-users" className="flex items-center gap-2 cursor-pointer flex-1">
                <Users className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">All Users</div>
                  <div className="text-xs text-muted-foreground">Everyone in this project will see this dashboard after login</div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
              onClick={() => setDefaultFor('specific')}>
              <RadioGroupItem value="specific" id="specific-users" />
              <Label htmlFor="specific-users" className="flex items-center gap-2 cursor-pointer flex-1">
                <User className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">Specific Users</div>
                  <div className="text-xs text-muted-foreground">Only selected users will see this dashboard</div>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {defaultFor === 'specific' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-48 border rounded-md">
                {usersLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No users found</div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredUsers.map(u => (
                      <div
                        key={u.user_id}
                        className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleUser(u.user_id)}
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(u.user_id)}
                          onCheckedChange={() => toggleUser(u.user_id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {u.first_name || u.last_name
                              ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                              : u.email}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {selectedUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedUserIds.length} user(s) selected</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          {isCurrentlyDefault && (
            <Button variant="outline" onClick={handleRemoveDefault} disabled={loading} className="mr-auto">
              Remove Default
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Set as Default'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
