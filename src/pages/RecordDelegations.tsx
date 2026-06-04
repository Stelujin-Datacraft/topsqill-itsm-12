import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, UserCheck, Calendar, Shield, AlertTriangle, Check, ChevronsUpDown, X, Power, Pencil, Activity, ArrowRight } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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
  grant_delegator_access?: boolean;
}

interface UserOption { id: string; email: string; first_name: string | null; last_name: string | null; }

const fullName = (u?: UserOption) => u ? (u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : u.email) : '—';

// Generic multi-select combobox
function MultiSelect({
  options, selected, onChange, placeholder, emptyText,
}: {
  options: { value: string; label: string; sub?: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  const labelFor = (v: string) => options.find(o => o.value === v)?.label ?? v;
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            <span className="truncate">
              {selected.length === 0 ? <span className="text-muted-foreground">{placeholder}</span> : `${selected.length} selected`}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search…" />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map(o => {
                  const checked = selected.includes(o.value);
                  return (
                    <CommandItem key={o.value} value={`${o.label} ${o.sub ?? ''}`} onSelect={() => toggle(o.value)}>
                      <div className={cn("mr-2 h-4 w-4 border rounded flex items-center justify-center", checked ? "bg-primary border-primary" : "border-input")}>
                        {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex flex-col">
                        <span>{o.label}</span>
                        {o.sub && <span className="text-xs text-muted-foreground">{o.sub}</span>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(v => (
            <Badge key={v} variant="secondary" className="gap-1">
              {labelFor(v)}
              <button type="button" onClick={() => toggle(v)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecordDelegations() {
  const { userProfile } = useAuth();
  const { forms } = useFormCtx();
  const { projects } = useProject();
  const { toast } = useToast();

  const [tab, setTab] = useState<'mine' | 'received' | 'activity'>('mine');
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<DelegationRow[]>([]);
  const [received, setReceived] = useState<DelegationRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit mode state — when set, the dialog edits this row instead of creating new ones
  const [editingId, setEditingId] = useState<string | null>(null);

  // Bulk-end selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Activity tab data: changes other users made on my behalf
  const [activity, setActivity] = useState<Array<{
    id: string;
    submission_id: string;
    field_label: string;
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
    change_type: string;
    actor_id: string;
  }>>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Form fields
  const [delegateIds, setDelegateIds] = useState<string[]>([]);
  const [scope, setScope] = useState<ScopeType>('all');
  const [scopeFormIds, setScopeFormIds] = useState<string[]>([]);
  const [scopeProjectIds, setScopeProjectIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 16);
  });
  const [includeApprovals, setIncludeApprovals] = useState(true);
  const [reason, setReason] = useState('');
  // Trust toggle: when ON, delegate inherits delegator's scope access even if they don't have it themselves.
  // When OFF, delegation only re-routes work — delegate must already have access to act.
  const [grantDelegatorAccess, setGrantDelegatorAccess] = useState(true);

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

  // Load activity (changes made on my behalf) when Activity tab is active
  useEffect(() => {
    if (tab !== 'activity' || !userProfile?.id) return;
    let cancelled = false;
    (async () => {
      setActivityLoading(true);
      try {
        const { data, error } = await supabase
          .from('record_field_history')
          .select('id, submission_id, field_label, old_value, new_value, changed_at, change_type, changed_by')
          .ilike('changed_by', `%|on_behalf_of:${userProfile.id}`)
          .order('changed_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        if (cancelled) return;
        const rows = (data || []).map((r: any) => {
          const actor = String(r.changed_by || '').split('|on_behalf_of:')[0] || '';
          return {
            id: r.id,
            submission_id: r.submission_id,
            field_label: r.field_label,
            old_value: r.old_value,
            new_value: r.new_value,
            changed_at: r.changed_at,
            change_type: r.change_type,
            actor_id: actor,
          };
        });
        // Ensure we have user profiles for actors
        const missing = Array.from(new Set(rows.map(r => r.actor_id).filter(id => id && !userMap[id])));
        if (missing.length) {
          const { data: extra } = await supabase
            .from('user_profiles')
            .select('id, email, first_name, last_name')
            .in('id', missing);
          if (extra && !cancelled) setUsers(prev => [...prev, ...(extra as UserOption[])]);
        }
        if (!cancelled) setActivity(rows);
      } catch (e: any) {
        toast({ title: 'Failed to load delegated activity', description: e.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userProfile?.id]);

  const resetForm = () => {
    setDelegateIds([]); setScope('all'); setScopeFormIds([]); setScopeProjectIds([]);
    setIncludeApprovals(true); setReason(''); setGrantDelegatorAccess(true);
    setStartsAt(new Date().toISOString().slice(0, 16));
    const d = new Date(); d.setDate(d.getDate() + 7);
    setEndsAt(d.toISOString().slice(0, 16));
    setEditingId(null);
  };

  // Open the dialog pre-populated with an existing row's values
  const openEdit = (row: DelegationRow) => {
    setEditingId(row.id);
    setDelegateIds([row.delegate_user_id]);
    setScope(row.scope);
    setScopeFormIds(row.scope_form_id ? [row.scope_form_id] : []);
    setScopeProjectIds(row.scope_project_id ? [row.scope_project_id] : []);
    setStartsAt(new Date(row.starts_at).toISOString().slice(0, 16));
    setEndsAt(new Date(row.ends_at).toISOString().slice(0, 16));
    setIncludeApprovals(row.include_approvals);
    setReason(row.reason || '');
    setGrantDelegatorAccess(row.grant_delegator_access ?? true);
    setOpen(true);
  };

  const handleCreate = async () => {
    if (!userProfile?.id || !userProfile?.organization_id) return;
    if (delegateIds.length === 0) return toast({ title: 'Pick at least one delegate', variant: 'destructive' });
    if (scope === 'form' && scopeFormIds.length === 0) return toast({ title: 'Pick at least one form', variant: 'destructive' });
    if (scope === 'project' && scopeProjectIds.length === 0) return toast({ title: 'Pick at least one project', variant: 'destructive' });
    if (new Date(endsAt) <= new Date(startsAt)) return toast({ title: 'End time must be after start', variant: 'destructive' });

    setSaving(true);
    try {
      // EDIT MODE: update only mutable fields on the single existing row
      if (editingId) {
        const patch = {
          scope,
          scope_form_id: scope === 'form' ? (scopeFormIds[0] ?? null) : null,
          scope_project_id: scope === 'project' ? (scopeProjectIds[0] ?? null) : null,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          include_approvals: includeApprovals,
          reason: reason || null,
          grant_delegator_access: grantDelegatorAccess,
        };
        const { error: upErr } = await supabase.from('record_delegations').update(patch).eq('id', editingId);
        if (upErr) throw upErr;
        toast({ title: 'Delegation updated' });
        setOpen(false); resetForm(); loadAll();
        return;
      }

      // Build the row matrix: delegates × scope targets
      const targets: { form: string | null; project: string | null }[] =
        scope === 'form'    ? scopeFormIds.map(id => ({ form: id, project: null }))
      : scope === 'project' ? scopeProjectIds.map(id => ({ form: null, project: id }))
      :                       [{ form: null, project: null }];

      const rows = delegateIds.flatMap(uid => targets.map(t => ({
        organization_id: userProfile.organization_id,
        delegator_user_id: userProfile.id,
        delegate_user_id: uid,
        scope,
        scope_form_id: t.form,
        scope_project_id: t.project,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        include_approvals: includeApprovals,
        reason: reason || null,
        grant_delegator_access: grantDelegatorAccess,
        created_by: userProfile.id,
        active: true,
      })));

      const { error } = await supabase.from('record_delegations').insert(rows);
      if (error) throw error;

      // Notify each delegate in-app
      try {
        const delegatorName = fullName({
          id: userProfile.id,
          email: (userProfile as any).email ?? '',
          first_name: userProfile.first_name ?? null,
          last_name: userProfile.last_name ?? null,
        });
        const notifs = delegateIds.map(uid => ({
          user_id: uid,
          type: 'delegation_created',
          title: 'You have been delegated access',
          message: `${delegatorName} delegated ${scope === 'all' ? 'all their records' : scope === 'form' ? `${scopeFormIds.length} form(s)` : `${scopeProjectIds.length} project(s)`} to you until ${format(new Date(endsAt), 'dd MMM yyyy HH:mm')}.`,
          data: { scope, ends_at: new Date(endsAt).toISOString(), delegator_user_id: userProfile.id, reason: reason || null },
        }));
        await supabase.from('notifications').insert(notifs);
      } catch (e) { /* non-fatal */ }

      // Fire-and-forget email notifications
      try {
        const scopeSummary = scope === 'all' ? 'All their records' : scope === 'form' ? `${scopeFormIds.length} form(s)` : `${scopeProjectIds.length} project(s)`;
        await Promise.all(delegateIds.map(uid =>
          supabase.functions.invoke('send-delegation-email', {
            body: {
              type: 'delegation_created',
              recipientUserId: uid,
              organizationId: userProfile.organization_id,
              delegatorName: fullName({ id: userProfile.id, email: (userProfile as any).email ?? '', first_name: userProfile.first_name ?? null, last_name: userProfile.last_name ?? null }),
              scope,
              scopeSummary,
              endsAt: new Date(endsAt).toISOString(),
              reason: reason || null,
              includeApprovals,
            },
          }).catch((e) => console.warn('delegation email failed:', e?.message))
        ));
      } catch { /* non-fatal */ }

      toast({ title: `Created ${rows.length} delegation${rows.length === 1 ? '' : 's'}` });
      setOpen(false); resetForm(); loadAll();
    } catch (e: any) {
      toast({ title: 'Failed to create delegation', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEnd = async (id: string) => {
    if (!confirm('End this delegation now? The delegate will lose access immediately, but the history will be kept.')) return;
    const row = mine.find(r => r.id === id) || received.find(r => r.id === id);
    const { error } = await supabase.from('record_delegations').update({ active: false, ends_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast({ title: 'Failed to end delegation', description: error.message, variant: 'destructive' });
    if (row) {
      try {
        await supabase.from('notifications').insert({
          user_id: row.delegate_user_id,
          type: 'delegation_ended',
          title: 'A delegation has ended',
          message: `${fullName(userMap[row.delegator_user_id]) || 'A user'} ended a delegation that was assigned to you.`,
          data: { delegation_id: id, delegator_user_id: row.delegator_user_id },
        });
      } catch { /* non-fatal */ }
      try {
        await supabase.functions.invoke('send-delegation-email', {
          body: {
            type: 'delegation_ended',
            recipientUserId: row.delegate_user_id,
            organizationId: (row as any).organization_id ?? userProfile?.organization_id,
            delegatorName: fullName(userMap[row.delegator_user_id]) || 'A user',
          },
        });
      } catch (e: any) { console.warn('delegation email failed:', e?.message); }
    }
    toast({ title: 'Delegation ended' });
    loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this delegation record? This removes it from history and cannot be undone. Use "End" instead if you just want to revoke access.')) return;
    const { error } = await supabase.from('record_delegations').delete().eq('id', id);
    if (error) return toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    toast({ title: 'Delegation deleted' });
    loadAll();
  };

  // Bulk-end all selected live delegations in My Delegations.
  const handleBulkEnd = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`End ${ids.length} delegation(s) now? Delegates will lose access immediately. History is kept.`)) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('record_delegations')
      .update({ active: false, ends_at: nowIso })
      .in('id', ids);
    if (error) return toast({ title: 'Bulk end failed', description: error.message, variant: 'destructive' });
    toast({ title: `Ended ${ids.length} delegation(s)` });
    setSelected(new Set());
    loadAll();
  };

  // Clear selection whenever tab switches to avoid acting on stale rows
  useEffect(() => { setSelected(new Set()); }, [tab]);

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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

  const renderTable = (rows: DelegationRow[], showDelegator: boolean) => {
    const selectable = !showDelegator;
    const liveIds = rows.filter(r => r.active && new Date() <= new Date(r.ends_at)).map(r => r.id);
    const allSelected = selectable && liveIds.length > 0 && liveIds.every(id => selected.has(id));
    const toggleAll = () => {
      if (allSelected) setSelected(new Set());
      else setSelected(new Set(liveIds));
    };
    return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-8">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
            </TableHead>
          )}
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
            <TableCell colSpan={selectable ? 7 : 6} className="text-center text-muted-foreground py-8">
              No delegations yet.
            </TableCell>
          </TableRow>
        )}
        {rows.map(r => (
          <TableRow key={r.id}>
            {selectable && (
              <TableCell>
                {r.active && new Date() <= new Date(r.ends_at) ? (
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelected(r.id)} aria-label="Select row" />
                ) : null}
              </TableCell>
            )}
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
              {!showDelegator && (() => {
                const now = new Date();
                const isLive = r.active && now <= new Date(r.ends_at);
                return (
                  <div className="flex items-center justify-end gap-1">
                    {isLive && (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Edit dates / scope">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {isLive && (
                      <Button size="sm" variant="ghost" onClick={() => handleEnd(r.id)} title="Revoke access now (keeps history)">
                        <Power className="h-4 w-4 mr-1" /> End
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} title="Permanently delete this record" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    );
  };

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
            <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-2" />Activity on My Behalf</TabsTrigger>
          </TabsList>
          <TabsContent value="mine">
            {selected.size > 0 && (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-3 py-2 mb-2">
                <span className="text-sm">{selected.size} selected</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
                  <Button size="sm" variant="destructive" onClick={handleBulkEnd}>
                    <Power className="h-4 w-4 mr-1" /> End selected
                  </Button>
                </div>
              </div>
            )}
            <Card><CardContent className="p-0">{loading ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : renderTable(mine, false)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="received">
            <Card><CardContent className="p-0">{loading ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : renderTable(received, true)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="activity">
            <Card>
              <CardContent className="p-0">
                {activityLoading ? (
                  <div className="p-6 text-sm text-muted-foreground">Loading…</div>
                ) : activity.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    No actions have been taken on your behalf yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Delegate</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activity.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm whitespace-nowrap">{format(new Date(a.changed_at), 'dd MMM yyyy HH:mm')}</TableCell>
                          <TableCell className="font-medium">{fullName(userMap[a.actor_id])}</TableCell>
                          <TableCell>{a.field_label}</TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive max-w-[180px] truncate" title={a.old_value ?? ''}>
                                {a.old_value || <em className="text-muted-foreground">empty</em>}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary max-w-[180px] truncate" title={a.new_value ?? ''}>
                                {a.new_value || <em className="text-muted-foreground">empty</em>}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{a.change_type}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Delegation' : 'New Delegation'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the scope, dates, approvals, or reason. The delegate stays the same.'
                : 'Choose who should act on your records and for how long.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delegate{editingId ? '' : 's'}</Label>
              {editingId ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {fullName(userMap[delegateIds[0]])}
                  <span className="text-xs text-muted-foreground ml-2">(delegate cannot be changed — end and recreate to switch)</span>
                </div>
              ) : (
                <MultiSelect
                  options={users.map(u => ({ value: u.id, label: fullName(u), sub: u.email }))}
                  selected={delegateIds}
                  onChange={setDelegateIds}
                  placeholder="Choose one or more users"
                  emptyText="No users found"
                />
              )}
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
                <Label>Forms</Label>
                <MultiSelect
                  options={forms.map(f => ({ value: f.id, label: f.name }))}
                  selected={scopeFormIds}
                  onChange={setScopeFormIds}
                  placeholder="Choose one or more forms"
                  emptyText="No forms found"
                />
              </div>
            )}
            {scope === 'project' && (
              <div className="space-y-2">
                <Label>Projects</Label>
                <MultiSelect
                  options={projects.map(p => ({ value: p.id, label: p.name }))}
                  selected={scopeProjectIds}
                  onChange={setScopeProjectIds}
                  placeholder="Choose one or more projects"
                  emptyText="No projects found"
                />
              </div>
            )}

            {(scope === 'form' || scope === 'project') && delegateIds.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Delegates will only see your records on a {scope === 'form' ? 'form' : 'project'} they already have access to.
                  If the delegate isn't a member, share the {scope === 'form' ? 'form/project' : 'project'} with them first — otherwise this delegation will silently grant nothing.
                </p>
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

            {!editingId && delegateIds.length > 0 && (scope === 'all' || scopeFormIds.length > 0 || scopeProjectIds.length > 0) && (
              <p className="text-xs text-muted-foreground">
                Will create <b className="text-foreground">
                  {delegateIds.length * (scope === 'form' ? scopeFormIds.length : scope === 'project' ? scopeProjectIds.length : 1)}
                </b> delegation row(s).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Delegation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}