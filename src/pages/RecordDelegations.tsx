import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, UserCheck, Calendar, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useForm as useFormCtx } from '@/contexts/FormContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type ScopeType = 'all' | 'form' | 'project';

interface DelegationRow {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  scope: ScopeType;
  scope_form_id: string | null;
  scope_project_id: string | null;
  starts_at: string;
  ends_at: string;
  include_approvals: boolean;
  active: boolean;
  reason: string | null;
  created_at: string;
}

interface UserOption { id: string; email: string; first_name: string | null; last_name: string | null; }

const fullName = (u?: UserOption) => u ? (u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : u.email) : '—';

export default function RecordDelegations() {
  const { userProfile } = useAuth();
  const { forms } = useFormCtx();
  const { projects } = useProject();
  const { toast } = useToast();

  const [tab, setTab] = useState<'mine' | 'received'>('mine');
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<DelegationRow[]>([]);
  const [received, setReceived] = useState<DelegationRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [delegateId, setDelegateId] = useState('');
  const [scope, setScope] = useState<ScopeType>('all');
  const [scopeFormId, setScopeFormId] = useState('');
  const [scopeProjectId, setScopeProjectId] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 16);
  });
  const [includeApprovals, setIncludeApprovals] = useState(true);
  const [reason, setReason] = useState('');

  const userMap = React.useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);

  const loadAll = async () => {
    if (!userProfile?.id || !userProfile?.organization_id) return;
    setLoading(true);
    try {
      const [mineRes, recvRes, usersRes] = await Promise.all([
        supabase.from('record_delegations').select('*').eq('delegator_user_id', userProfile.id).order('created_at', { ascending: false }),
        supabase.from('record_delegations').select('*').eq('delegate_user_id', userProfile.id).order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('id, email, first_name, last_name').eq('organization_id', userProfile.organization_id).neq('id', userProfile.id).order('email'),
      ]);
      if (mineRes.error) throw mineRes.error;
      if (recvRes.error) throw recvRes.error;
      if (usersRes.error) throw usersRes.error;
      setMine((mineRes.data || []) as DelegationRow[]);
      setReceived((recvRes.data || []) as DelegationRow[]);
      setUsers((usersRes.data || []) as UserOption[]);
    } catch (e: any) {
      toast({ title: 'Failed to load delegations', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [userProfile?.id]);

  const resetForm = () => {
    setDelegateId(''); setScope('all'); setScopeFormId(''); setScopeProjectId('');
    setIncludeApprovals(true); setReason('');
    setStartsAt(new Date().toISOString().slice(0, 16));
    const d = new Date(); d.setDate(d.getDate() + 7);
    setEndsAt(d.toISOString().slice(0, 16));
  };

  const handleCreate = async () => {
    if (!userProfile?.id || !userProfile?.organization_id) return;
    if (!delegateId) return toast({ title: 'Pick a delegate', variant: 'destructive' });
    if (scope === 'form' && !scopeFormId) return toast({ title: 'Pick a form', variant: 'destructive' });
    if (scope === 'project' && !scopeProjectId) return toast({ title: 'Pick a project', variant: 'destructive' });
    if (new Date(endsAt) <= new Date(startsAt)) return toast({ title: 'End time must be after start', variant: 'destructive' });

    setSaving(true);
    try {
      const { error } = await supabase.from('record_delegations').insert({
        organization_id: userProfile.organization_id,
        delegator_user_id: userProfile.id,
        delegate_user_id: delegateId,
        scope,
        scope_form_id: scope === 'form' ? scopeFormId : null,
        scope_project_id: scope === 'project' ? scopeProjectId : null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        include_approvals: includeApprovals,
        reason: reason || null,
        created_by: userProfile.id,
        active: true,
      });
      if (error) throw error;
      toast({ title: 'Delegation created' });
      setOpen(false); resetForm(); loadAll();
    } catch (e: any) {
      toast({ title: 'Failed to create delegation', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEnd = async (id: string) => {
    const { error } = await supabase.from('record_delegations').update({ active: false, ends_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast({ title: 'Failed to end delegation', description: error.message, variant: 'destructive' });
    toast({ title: 'Delegation ended' });
    loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this delegation? This cannot be undone.')) return;
    const { error } = await supabase.from('record_delegations').delete().eq('id', id);
    if (error) return toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    toast({ title: 'Delegation deleted' });
    loadAll();
  };

  const statusBadge = (row: DelegationRow) => {
    const now = new Date();
    const start = new Date(row.starts_at);
    const end = new Date(row.ends_at);
    if (!row.active || now > end) return <Badge variant="outline">Ended</Badge>;
    if (now < start) return <Badge variant="secondary">Scheduled</Badge>;
    return <Badge className="bg-primary/15 text-primary border-primary/30">Active</Badge>;
  };

  const scopeLabel = (row: DelegationRow) => {
    if (row.scope === 'all') return 'All records';
    if (row.scope === 'form') return `Form: ${forms.find(f => f.id === row.scope_form_id)?.name ?? '—'}`;
    if (row.scope === 'project') return `Project: ${projects.find(p => p.id === row.scope_project_id)?.name ?? '—'}`;
    return '—';
  };

  const renderTable = (rows: DelegationRow[], showDelegator: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{showDelegator ? 'From' : 'Delegate'}</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Window</TableHead>
          <TableHead>Approvals</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No delegations yet.
            </TableCell>
          </TableRow>
        )}
        {rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">
              {fullName(userMap[showDelegator ? r.delegator_user_id : r.delegate_user_id])}
            </TableCell>
            <TableCell>{scopeLabel(r)}</TableCell>
            <TableCell className="text-sm">
              {format(new Date(r.starts_at), 'dd MMM yyyy HH:mm')} → {format(new Date(r.ends_at), 'dd MMM yyyy HH:mm')}
            </TableCell>
            <TableCell>{r.include_approvals ? 'Included' : 'Excluded'}</TableCell>
            <TableCell>{statusBadge(r)}</TableCell>
            <TableCell className="text-right">
              {!showDelegator && r.active && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => handleEnd(r.id)} title="End now">
                    End
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <DashboardLayout
      title="Record Delegation"
      description="Temporarily hand off your records to another user (e.g. during leave)"
      actions={
        <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Delegation
        </Button>
      }
    >
      <div className="space-y-4 w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              How it works
            </CardTitle>
            <CardDescription>
              While a delegation is active, the delegate can view and act on records you own within the chosen scope.
              All actions are logged with an "on behalf of" attribution. End the delegation any time.
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="mine"><UserCheck className="h-4 w-4 mr-2" />My Delegations</TabsTrigger>
            <TabsTrigger value="received"><Calendar className="h-4 w-4 mr-2" />Granted To Me</TabsTrigger>
          </TabsList>
          <TabsContent value="mine">
            <Card><CardContent className="p-0">{loading ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : renderTable(mine, false)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="received">
            <Card><CardContent className="p-0">{loading ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : renderTable(received, true)}</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Delegation</DialogTitle>
            <DialogDescription>Choose who should act on your records and for how long.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delegate</Label>
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger><SelectValue placeholder="Choose a user" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (<SelectItem key={u.id} value={u.id}>{fullName(u)} — {u.email}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as ScopeType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All my records</SelectItem>
                  <SelectItem value="form">Specific form</SelectItem>
                  <SelectItem value="project">Specific project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === 'form' && (
              <div className="space-y-2">
                <Label>Form</Label>
                <Select value={scopeFormId} onValueChange={setScopeFormId}>
                  <SelectTrigger><SelectValue placeholder="Choose a form" /></SelectTrigger>
                  <SelectContent>{forms.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            {scope === 'project' && (
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={scopeProjectId} onValueChange={setScopeProjectId}>
                  <SelectTrigger><SelectValue placeholder="Choose a project" /></SelectTrigger>
                  <SelectContent>{projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starts</Label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ends</Label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Include approvals & assignments</Label>
                <p className="text-xs text-muted-foreground">Delegate also handles items assigned to you.</p>
              </div>
              <Switch checked={includeApprovals} onCheckedChange={setIncludeApprovals} />
            </div>

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. On leave 5–12 Jun" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create Delegation'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}