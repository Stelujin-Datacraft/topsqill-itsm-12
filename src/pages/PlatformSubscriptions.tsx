import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, BadgeCheck, Building2, ChevronRight, Clock, Download, History, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useEntitlements, ENTITLEMENTS_QUERY_KEY } from '@/hooks/useEntitlements';
import { request } from '@/services/api/apiClient';
import {
  ATTENTION_LABEL,
  LEVEL_LABEL,
  SOURCE_LABEL,
  activeModuleCount,
  auditToCsv,
  describeAudit,
  filterOrgs,
  limitsFromInputs,
  orgAttention,
  paginate,
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
  const missing = value.trim().length < 3;
  return (
    <div className="space-y-1.5">
      <Label>Reason (required, saved in the audit log)</Label>
      <Textarea rows={2} value={value} onChange={(event) => onChange(event.target.value)} placeholder="e.g. Annual renewal, invoice INV-2026-104" />
      {missing && <p className="text-xs text-muted-foreground">Enter a reason of at least 3 characters to save.</p>}
    </div>
  );
}

function SaveError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">Not saved: {message}</p>;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const plan = plans.find((p) => p.key === planKey);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
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
      setSaveError(errorText(err));
      toast.error(errorText(err));
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
        <SaveError message={saveError} />
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
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    const { limits, error } = limitsFromInputs(limitInputs);
    if (error) {
      setSaveError(error);
      toast.error(error);
      return;
    }
    setSaving(true);
    setSaveError(null);
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
      setSaveError(errorText(err));
      toast.error(errorText(err));
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
        <SaveError message={saveError} />
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const remove = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await call(`/platform/orgs/${org.id}/modules/${module}?reason=${encodeURIComponent(reason)}`, 'DELETE');
      toast.success(`${MODULES[module].name} removed from ${org.name}`);
      onSaved();
    } catch (err) {
      setSaveError(errorText(err));
      toast.error(errorText(err));
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
        <SaveError message={saveError} />
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
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    const limits: Record<string, Record<string, number>> = {};
    for (const module of modules) {
      const parsed = limitsFromInputs(limitInputs[module] || {});
      if (parsed.error) {
        setSaveError(parsed.error);
        toast.error(parsed.error);
        return;
      }
      if (Object.keys(parsed.limits).length) limits[module] = parsed.limits;
    }
    setSaving(true);
    setSaveError(null);
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
      setSaveError(errorText(err));
      toast.error(errorText(err));
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
        <SaveError message={saveError} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !key.trim() || !name.trim() || reason.trim().length < 3}>Save plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PAGE_SIZE = 20;

const LEVEL_DOT: Record<AccessLevel, string> = {
  full: 'bg-emerald-500',
  grace: 'bg-amber-500',
  read_only: 'bg-red-500',
  none: 'bg-muted-foreground/25',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  trial: 'secondary',
  past_due: 'destructive',
  expired: 'destructive',
  cancelled: 'outline',
};

const statusLabel = (status: string | null | undefined) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : 'No subscription';

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  tone?: 'warning';
  onClick?: () => void;
}) {
  const content = (
    <CardContent className="flex items-center gap-3 p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tone === 'warning' && value > 0 ? 'bg-amber-500/15 text-amber-600' : 'bg-primary/10 text-primary'}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-2xl font-semibold tabular-nums leading-none">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </CardContent>
  );
  return onClick ? (
    <Card role="button" tabIndex={0} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      {content}
    </Card>
  ) : (
    <Card>{content}</Card>
  );
}

function OrgSettings({
  org,
  onChangePlan,
  onEditModule,
  onRemoveModule,
  onShowAudit,
}: {
  org: OrgSummary;
  onChangePlan: () => void;
  onEditModule: (module: ModuleKey, entitlement?: EntitlementRow) => void;
  onRemoveModule: (module: ModuleKey) => void;
  onShowAudit: () => void;
}) {
  const attention = orgAttention(org);
  return (
    <div className="space-y-5">
      <SheetHeader className="text-left">
        <SheetTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> {org.name}
        </SheetTitle>
        <SheetDescription className="font-mono text-xs">{org.id}</SheetDescription>
      </SheetHeader>

      {attention && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {ATTENTION_LABEL[attention]}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Plan</div>
            <div className="font-medium">{org.planName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <Badge variant={STATUS_VARIANT[org.subscription?.status || ''] || 'outline'}>{statusLabel(org.subscription?.status)}</Badge>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Paid until</div>
            <div className="font-medium">{showDate(org.subscription?.current_period_end)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Grace days</div>
            <div className="font-medium">{org.subscription?.grace_days ?? '—'}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onChangePlan}><BadgeCheck className="me-1.5 h-4 w-4" /> Change plan</Button>
        <Button variant="outline" onClick={onShowAudit}><History className="me-1.5 h-4 w-4" /> View audit log</Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Modules</h3>
        {org.modules.map((m) => (
          <Card key={m.key}>
            <CardContent className="flex flex-wrap items-center gap-3 p-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_DOT[m.level]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  <Badge variant={LEVEL_VARIANT[m.level]}>{LEVEL_LABEL[m.level]}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{m.entitlement ? SOURCE_LABEL[m.entitlement.source] || m.entitlement.source : 'Not granted'}</span>
                  {m.entitlement && <span>Ends {showDate(m.entitlement.ends_at)}</span>}
                  {Object.keys(MODULES[m.key].metrics).map((metric) => {
                    const limit = m.entitlement?.limits?.[metric];
                    return (
                      <span key={metric}>
                        {m.usage[metric] || 0}{limit !== undefined ? ` / ${limit}` : ''} {MODULES[m.key].metrics[metric]} this month
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => onEditModule(m.key, m.entitlement)}>
                  {m.entitlement ? <><Pencil className="me-1.5 h-3.5 w-3.5" /> Edit</> : <><Plus className="me-1.5 h-3.5 w-3.5" /> Grant</>}
                </Button>
                {m.entitlement && (
                  <Button size="icon" variant="ghost" aria-label={`Remove ${m.name}`} onClick={() => onRemoveModule(m.key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const PlatformSubscriptions = () => {
  const queryClient = useQueryClient();
  const { isPlatformAdmin, loading: entitlementsLoading } = useEntitlements();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<OrgSummary | null>(null);
  const [moduleFor, setModuleFor] = useState<{ org: OrgSummary; module: ModuleKey; entitlement?: EntitlementRow } | null>(null);
  const [removeFor, setRemoveFor] = useState<{ org: OrgSummary; module: ModuleKey } | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlatformPlanRow | null | 'new'>(null);
  const [auditOrg, setAuditOrg] = useState('all');
  const [tab, setTab] = useState('orgs');

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
  const filteredOrgs = useMemo(
    () => filterOrgs(orgs, { term: search, plan: planFilter, status: statusFilter }),
    [orgs, search, planFilter, statusFilter],
  );
  const pageOfOrgs = paginate(filteredOrgs, page, PAGE_SIZE);
  const selectedOrg = orgs.find((org) => org.id === selectedOrgId) || null;

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
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="orgs">Organisations</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="orgs" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Building2} label="Organisations" value={orgs.length} />
            <StatCard icon={BadgeCheck} label="Active or trial" value={orgs.filter((o) => ['active', 'trial'].includes(o.subscription?.status || '')).length} />
            <StatCard icon={AlertTriangle} label="Need attention" value={orgs.filter((o) => orgAttention(o) !== null).length} tone="warning" onClick={() => { setStatusFilter('attention'); setPage(1); }} />
            <StatCard icon={Clock} label="Renew within 30 days" value={orgs.filter((o) => orgAttention(o) === 'expiring').length} />
          </div>

          <Card>
            <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by name, plan or ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <Select value={planFilter} onValueChange={(value) => { setPlanFilter(value); setPage(1); }}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {(overview.data?.plans || []).map((plan) => <SelectItem key={plan.key} value={plan.key}>{plan.name}</SelectItem>)}
                  <SelectItem value="none">No plan</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="attention">Needs attention</SelectItem>
                  {SUBSCRIPTION_STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground sm:ms-auto">{filteredOrgs.length} of {orgs.length}</span>
            </div>
            {overview.isLoading ? (
              <LoadingScreen message="Loading organisations…" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Paid until</TableHead>
                    <TableHead className="hidden lg:table-cell">Modules</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageOfOrgs.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No organisations match these filters.</TableCell>
                    </TableRow>
                  )}
                  {pageOfOrgs.rows.map((org) => {
                    const attention = orgAttention(org);
                    return (
                      <TableRow
                        key={org.id}
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => setSelectedOrgId(org.id)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedOrgId(org.id); } }}
                      >
                        <TableCell>
                          <div className="font-medium">{org.name}</div>
                          {attention && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" /> {ATTENTION_LABEL[attention]}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{org.planName}</TableCell>
                        <TableCell><Badge variant={STATUS_VARIANT[org.subscription?.status || ''] || 'outline'}>{statusLabel(org.subscription?.status)}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell">{showDate(org.subscription?.current_period_end)}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <span className="text-sm tabular-nums">{activeModuleCount(org)} / {org.modules.length}</span>
                            <div className="flex gap-1">
                              {org.modules.map((m) => (
                                <span key={m.key} title={`${m.name}: ${LEVEL_LABEL[m.level]}`} className={`h-2 w-2 rounded-full ${LEVEL_DOT[m.level]}`} />
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {pageOfOrgs.pages > 1 && (
              <div className="flex items-center justify-end gap-2 border-t p-3 text-sm">
                <span className="text-muted-foreground">Page {pageOfOrgs.page} of {pageOfOrgs.pages}</span>
                <Button size="sm" variant="outline" disabled={pageOfOrgs.page <= 1} onClick={() => setPage(pageOfOrgs.page - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={pageOfOrgs.page >= pageOfOrgs.pages} onClick={() => setPage(pageOfOrgs.page + 1)}>Next</Button>
              </div>
            )}
          </Card>
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

      <Sheet open={!!selectedOrg} onOpenChange={(open) => !open && setSelectedOrgId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedOrg && (
            <OrgSettings
              org={selectedOrg}
              onChangePlan={() => setPlanFor(selectedOrg)}
              onEditModule={(module, entitlement) => setModuleFor({ org: selectedOrg, module, entitlement })}
              onRemoveModule={(module) => setRemoveFor({ org: selectedOrg, module })}
              onShowAudit={() => { setAuditOrg(selectedOrg.id); setSelectedOrgId(null); setTab('audit'); }}
            />
          )}
        </SheetContent>
      </Sheet>

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
