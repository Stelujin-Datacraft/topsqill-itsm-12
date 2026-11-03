import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { BadgeCheck, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useEntitlements, ENTITLEMENTS_QUERY_KEY } from '@/hooks/useEntitlements';
import { request } from '@/services/api/apiClient';
import {
  LEVEL_LABEL,
  SOURCE_LABEL,
  auditToCsv,
  describeAudit,
  limitsFromInputs,
  summarizeOrgs,
  type AuditRow,
  type EntitlementRow,
  type OrgSummary,
  type PlatformOverview,
  type PlatformPlanRow,
} from '@/lib/entitlements/console';
import { MODULES, type AccessLevel, type ModuleKey } from '@/lib/entitlements/modules';

const LEVEL_VARIANT: Record<AccessLevel, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  full: 'default',
  grace: 'secondary',
  read_only: 'destructive',
  none: 'outline',
};

const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'expired', 'cancelled'];

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const { data, error } = await request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (error) throw new Error(error.message);
  return data as T;
}

const dateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');
const showDate = (value: string | null | undefined) => (value ? format(new Date(value), 'd MMM yyyy') : '—');

function ReasonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Reason (saved in the audit log)</Label>
      <Textarea rows={2} value={value} onChange={(event) => onChange(event.target.value)} placeholder="e.g. Annual renewal, invoice INV-2026-104" />
    </div>
  );
}

function PlanDialog({
  org,
  plans,
  onClose,
  onSaved,
}: {
  org: OrgSummary;
  plans: PlatformPlanRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planKey, setPlanKey] = useState(org.subscription?.plan_key || plans[0]?.key || '');
  const [status, setStatus] = useState(org.subscription?.status || 'active');
  const [periodEnd, setPeriodEnd] = useState(dateInput(org.subscription?.current_period_end));
  const [graceDays, setGraceDays] = useState(String(org.subscription?.grace_days ?? 14));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const plan = plans.find((p) => p.key === planKey);

  const save = async () => {
    setSaving(true);
    try {
      await call(`/platform/orgs/${org.id}/plan`, 'POST', {
        planKey,
        status,
        periodEnd: periodEnd ? new Date(`${periodEnd}T23:59:59`).toISOString() : null,
        graceDays: Number(graceDays),
        reason,
      });
      toast.success(`${org.name} is now on ${plan?.name || planKey}`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan for {org.name}</DialogTitle>
          <DialogDescription>Modules from the plan follow it. Add-ons, trials and manual grants are kept.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planKey} onValueChange={setPlanKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {plans.filter((p) => p.active || p.key === planKey).map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {plan && (
              <p className="text-xs text-muted-foreground">
                Includes: {plan.modules.length ? plan.modules.map((m) => MODULES[m]?.name || m).join(', ') : 'core features only'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Grace days</Label>
              <Input type="number" min={0} max={365} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Paid until (blank = no end date)</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <ReasonField value={reason} onChange={setReason} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || reason.trim().length < 3}>Save plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModuleDialog({
  org,
  module,
  entitlement,
  onClose,
  onSaved,
}: {
  org: OrgSummary;
  module: ModuleKey;
  entitlement?: EntitlementRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const metrics = Object.keys(MODULES[module].metrics);
  const [source, setSource] = useState(entitlement && entitlement.source !== 'legacy' ? entitlement.source : 'add_on');
  const [status, setStatus] = useState(entitlement?.status || 'active');
  const [endsAt, setEndsAt] = useState(dateInput(entitlement?.ends_at));
  const [graceDays, setGraceDays] = useState(String(entitlement?.grace_days ?? 14));
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>(
    Object.fromEntries(metrics.map((m) => [m, entitlement?.limits?.[m] !== undefined ? String(entitlement.limits[m]) : ''])),
  );
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const { limits, error } = limitsFromInputs(limitInputs);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      await call(`/platform/orgs/${org.id}/modules/${module}`, 'PUT', {
        source,
        status,
        endsAt: endsAt ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
        graceDays: Number(graceDays),
        limits,
        reason,
      });
      toast.success(`${MODULES[module].name} updated for ${org.name}`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{MODULES[module].name} for {org.name}</DialogTitle>
          <DialogDescription>Grant or change this module outside the plan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['add_on', 'trial', 'manual', 'plan'].map((s) => <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended (read-only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ends on (blank = no end)</Label>
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Grace days</Label>
              <Input type="number" min={0} max={365} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
            </div>
          </div>
          {metrics.map((metric) => (
            <div key={metric} className="space-y-1.5">
              <Label>Monthly limit: {MODULES[module].metrics[metric]} (blank = unlimited)</Label>
              <Input
                inputMode="numeric"
                value={limitInputs[metric] || ''}
                onChange={(e) => setLimitInputs((prev) => ({ ...prev, [metric]: e.target.value }))}
              />
            </div>
          ))}
          <ReasonField value={reason} onChange={setReason} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || reason.trim().length < 3}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveModuleDialog({
  org,
  module,
  onClose,
  onSaved,
}: {
  org: OrgSummary;
  module: ModuleKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const remove = async () => {
    setSaving(true);
    try {
      await call(`/platform/orgs/${org.id}/modules/${module}?reason=${encodeURIComponent(reason)}`, 'DELETE');
      toast.success(`${MODULES[module].name} removed from ${org.name}`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {MODULES[module].name}?</DialogTitle>
          <DialogDescription>
            {org.name} loses access completely, including read-only access. Data is not deleted. To keep data visible, suspend the module instead.
          </DialogDescription>
        </DialogHeader>
        <ReasonField value={reason} onChange={setReason} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={remove} disabled={saving || reason.trim().length < 3}>Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanEditor({
  plan,
  onClose,
  onSaved,
}: {
  plan: PlatformPlanRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [key, setKey] = useState(plan?.key || '');
  const [name, setName] = useState(plan?.name || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [modules, setModules] = useState<ModuleKey[]>(plan?.modules || []);
  const [active, setActive] = useState(plan?.active ?? true);
  const [limitInputs, setLimitInputs] = useState<Record<string, Record<string, string>>>(() => {
    const inputs: Record<string, Record<string, string>> = {};
    for (const [module, info] of Object.entries(MODULES)) {
      inputs[module] = Object.fromEntries(
        Object.keys(info.metrics).map((m) => [m, plan?.limits?.[module]?.[m] !== undefined ? String(plan.limits[module][m]) : '']),
      );
    }
    return inputs;
  });
  const [applyToSubscribers, setApplyToSubscribers] = useState(true);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const limits: Record<string, Record<string, number>> = {};
    for (const module of modules) {
      const parsed = limitsFromInputs(limitInputs[module] || {});
      if (parsed.error) {
        toast.error(parsed.error);
        return;
      }
      if (Object.keys(parsed.limits).length) limits[module] = parsed.limits;
    }
    setSaving(true);
    try {
      const result = await call<{ organizationsUpdated: number }>(`/platform/plans/${key.trim()}`, 'PUT', {
        name,
        description,
        modules,
        limits,
        active,
        applyToSubscribers,
        reason,
      });
      toast.success(`Plan saved${result.organizationsUpdated ? `; ${result.organizationsUpdated} organisation(s) updated` : ''}`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : 'New plan'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Key</Label>
              <Input value={key} disabled={!!plan} onChange={(e) => setKey(e.target.value.toLowerCase())} placeholder="e.g. growth" />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Modules</Label>
            {Object.values(MODULES).map((info) => {
              const checked = modules.includes(info.key);
              return (
                <div key={info.key} className="space-y-2 rounded-md border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        setModules((prev) => (value ? [...prev, info.key] : prev.filter((m) => m !== info.key)))
                      }
                    />
                    {info.name}
                  </label>
                  {checked &&
                    Object.entries(info.metrics).map(([metric, label]) => (
                      <div key={metric} className="flex items-center gap-2 ps-6">
                        <span className="text-xs text-muted-foreground">Monthly {label}</span>
                        <Input
                          className="h-8 w-32"
                          inputMode="numeric"
                          placeholder="unlimited"
                          value={limitInputs[info.key]?.[metric] || ''}
                          onChange={(e) =>
                            setLimitInputs((prev) => ({ ...prev, [info.key]: { ...prev[info.key], [metric]: e.target.value } }))
                          }
                        />
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(value) => setActive(value === true)} />
            Available for new subscriptions
          </label>
          {plan && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={applyToSubscribers} onCheckedChange={(value) => setApplyToSubscribers(value === true)} />
              Apply the change to every organisation already on this plan
            </label>
          )}
          <ReasonField value={reason} onChange={setReason} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !key.trim() || !name.trim() || reason.trim().length < 3}>Save plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PlatformSubscriptions = () => {
  const queryClient = useQueryClient();
  const { isPlatformAdmin, loading: entitlementsLoading } = useEntitlements();
  const [search, setSearch] = useState('');
  const [planFor, setPlanFor] = useState<OrgSummary | null>(null);
  const [moduleFor, setModuleFor] = useState<{ org: OrgSummary; module: ModuleKey; entitlement?: EntitlementRow } | null>(null);
  const [removeFor, setRemoveFor] = useState<{ org: OrgSummary; module: ModuleKey } | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlatformPlanRow | null | 'new'>(null);
  const [auditOrg, setAuditOrg] = useState('all');

  const overview = useQuery({
    queryKey: ['platform', 'overview'],
    enabled: isPlatformAdmin,
    queryFn: () => call<PlatformOverview>('/platform/overview', 'GET'),
  });
  const audit = useQuery({
    queryKey: ['platform', 'audit', auditOrg],
    enabled: isPlatformAdmin,
    queryFn: () => call<AuditRow[]>(`/platform/audit?limit=500${auditOrg === 'all' ? '' : `&orgId=${auditOrg}`}`, 'GET'),
  });

  const refresh = () => {
    setPlanFor(null);
    setModuleFor(null);
    setRemoveFor(null);
    setEditingPlan(null);
    void queryClient.invalidateQueries({ queryKey: ['platform'] });
    void queryClient.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
  };

  const orgs = useMemo(() => (overview.data ? summarizeOrgs(overview.data) : []), [overview.data]);
  const orgNames = useMemo(() => Object.fromEntries(orgs.map((org) => [org.id, org.name])), [orgs]);
  const term = search.trim().toLowerCase();
  const visibleOrgs = orgs.filter((org) => !term || org.name.toLowerCase().includes(term) || org.planName.toLowerCase().includes(term));

  const exportAudit = () => {
    const csv = auditToCsv(audit.data || [], orgNames);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `entitlement-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (entitlementsLoading) return <LoadingScreen message="Loading…" />;
  if (!isPlatformAdmin) {
    return (
      <DashboardLayout title="Subscriptions">
        <p className="py-12 text-center text-muted-foreground">Only the Topsqill platform team can manage subscriptions.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Subscriptions" description="Plans, paid modules and limits for every organisation. Every change is audited.">
      {overview.error && (
        <Card className="mb-4"><CardContent className="p-4 text-sm text-destructive">{(overview.error as Error).message}</CardContent></Card>
      )}
      <Tabs defaultValue="orgs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orgs">Organisations</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="orgs" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search organisations or plans" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {overview.isLoading ? (
            <LoadingScreen message="Loading organisations…" />
          ) : (
            visibleOrgs.map((org) => (
              <Card key={org.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{org.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {org.planName} · {org.subscription?.status?.replace('_', ' ') || 'no subscription'} · paid until {showDate(org.subscription?.current_period_end)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setPlanFor(org)}>
                      <BadgeCheck className="me-1.5 h-4 w-4" /> Change plan
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module</TableHead>
                        <TableHead>Access</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Ends</TableHead>
                        <TableHead>This month</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {org.modules.map((m) => (
                        <TableRow key={m.key}>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell><Badge variant={LEVEL_VARIANT[m.level]}>{LEVEL_LABEL[m.level]}</Badge></TableCell>
                          <TableCell>{m.entitlement ? SOURCE_LABEL[m.entitlement.source] || m.entitlement.source : '—'}</TableCell>
                          <TableCell>{showDate(m.entitlement?.ends_at)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {Object.keys(MODULES[m.key].metrics).map((metric) => {
                              const limit = m.entitlement?.limits?.[metric];
                              return (
                                <div key={metric}>
                                  {m.usage[metric] || 0}{limit !== undefined ? ` / ${limit}` : ''} {MODULES[m.key].metrics[metric]}
                                </div>
                              );
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setModuleFor({ org, module: m.key, entitlement: m.entitlement })}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {m.entitlement && (
                                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setRemoveFor({ org, module: m.key })}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-3">
          <Button onClick={() => setEditingPlan('new')}><Plus className="me-1.5 h-4 w-4" /> New plan</Button>
          {(overview.data?.plans || []).map((plan) => (
            <Card key={plan.key}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {plan.is_default && <Badge variant="secondary">Default for new organisations</Badge>}
                    {!plan.active && <Badge variant="outline">Retired</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.modules.length === 0 && <Badge variant="outline">Core features only</Badge>}
                    {plan.modules.map((m) => {
                      const limits = plan.limits?.[m] || {};
                      const text = Object.entries(limits).map(([metric, value]) => `${value} ${MODULES[m]?.metrics[metric] || metric}/month`).join(', ');
                      return <Badge key={m} variant="secondary">{MODULES[m]?.name || m}{text ? ` · ${text}` : ''}</Badge>;
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {orgs.filter((org) => org.subscription?.plan_key === plan.key).length} organisation(s)
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditingPlan(plan)}><Pencil className="me-1.5 h-4 w-4" /> Edit</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={auditOrg} onValueChange={setAuditOrg}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organisations</SelectItem>
                {orgs.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportAudit} disabled={!audit.data?.length}>
              <Download className="me-1.5 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(audit.data || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">{format(new Date(row.occurred_at), 'd MMM yyyy, HH:mm')}</TableCell>
                    <TableCell>{row.organization_id ? orgNames[row.organization_id] || row.organization_id : '—'}</TableCell>
                    <TableCell>{describeAudit(row)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.actor_source}{row.actor_id ? ` · ${row.actor_id.slice(0, 8)}` : ''}</TableCell>
                    <TableCell className="text-sm">{row.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {planFor && overview.data && <PlanDialog org={planFor} plans={overview.data.plans} onClose={() => setPlanFor(null)} onSaved={refresh} />}
      {moduleFor && (
        <ModuleDialog org={moduleFor.org} module={moduleFor.module} entitlement={moduleFor.entitlement} onClose={() => setModuleFor(null)} onSaved={refresh} />
      )}
      {removeFor && <RemoveModuleDialog org={removeFor.org} module={removeFor.module} onClose={() => setRemoveFor(null)} onSaved={refresh} />}
      {editingPlan && <PlanEditor plan={editingPlan === 'new' ? null : editingPlan} onClose={() => setEditingPlan(null)} onSaved={refresh} />}
    </DashboardLayout>
  );
};

export default PlatformSubscriptions;
