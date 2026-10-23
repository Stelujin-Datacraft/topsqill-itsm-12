import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import PageContent from '@/components/PageContent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { promotionApi } from '@/lib/promotion/api';
import { DEFAULT_PROMOTION_ENVIRONMENTS, PROMOTION_MODULES } from '@/lib/promotion/registry';
import { ModuleObjectDualListbox } from '@/components/promotion/ModuleObjectDualListbox';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  'Source & Target',
  'Modules',
  'Select Objects',
  'Dependencies',
  'Validation',
  'Mapping',
  'Summary',
  'Result',
] as const;

type Step = (typeof STEPS)[number];

export default function PromotionalTransferWizard() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('Source & Target');
  const [name, setName] = useState('');
  /** Selected modules for this package (Archer-style multi-module). */
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  // Always seed from the static registry so the dropdown is never blank if Nest is down.
  const [modules, setModules] = useState(PROMOTION_MODULES);
  const [envs, setEnvs] = useState<any>(DEFAULT_PROMOTION_ENVIRONMENTS);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [objects, setObjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeObjectModule, setActiveObjectModule] = useState<string>('');
  const [packageId, setPackageId] = useState<string | null>(null);
  const [pkgDetail, setPkgDetail] = useState<any>(null);
  const [missingDeps, setMissingDeps] = useState<any[]>([]);
  const [includeDeps, setIncludeDeps] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<any>(null);
  const [mappingReport, setMappingReport] = useState<any>(null);
  const [childApplyMode, setChildApplyMode] = useState<'replace' | 'merge'>('replace');
  const [busy, setBusy] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;
    (async () => {
      try {
        const [e, m] = await Promise.all([promotionApi.environments(), promotionApi.modules()]);
        setEnvs(e);
        if (Array.isArray(m?.modules) && m.modules.length > 0) {
          setModules(m.modules);
        } else {
          // Keep static registry — never clear the dropdown to empty.
          setModules(PROMOTION_MODULES);
        }
        setApiWarning(null);
      } catch (err: any) {
        setModules(PROMOTION_MODULES);
        setEnvs(DEFAULT_PROMOTION_ENVIRONMENTS);
        setApiWarning(
          err?.message ||
            'Promotion API unreachable — showing built-in modules. Creating a package still requires the Nest /api/promotion service.',
        );
        toast.error(err?.message || 'Promotion API unreachable; using built-in module list');
      }
    })();
  }, [userProfile?.role]);

  const selectedList = useMemo(
    () => objects.filter((o) => selected[`${o.objectType}:${o.objectId}`]),
    [objects, selected],
  );

  const loadObjects = useCallback(async (mods: string[]) => {
    setLoadingObjects(true);
    try {
      const res = await promotionApi.objects({
        modules: mods,
        projectId: currentProject?.id,
        organizationId: userProfile?.organization_id || undefined,
      });
      setObjects(res.objects || []);
      setSelected({});
      setActiveObjectModule(mods[0] || '');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to list promotable objects');
    } finally {
      setLoadingObjects(false);
    }
  }, [currentProject?.id, userProfile?.organization_id]);

  /** Objects grouped by package module for tabbed dual-listboxes. */
  const objectsByModule = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const mod of selectedModules) map.set(mod, []);
    for (const o of objects) {
      const mod = o.module || 'Other';
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(o);
    }
    return selectedModules
      .filter((m) => map.has(m))
      .map((module) => ({ module, items: map.get(module) || [] }));
  }, [objects, selectedModules]);

  function toggleModule(mod: string) {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  if (userProfile && userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const stepIndex = STEPS.indexOf(step);

  async function goSelectObjects() {
    if (!name.trim()) {
      toast.error('Enter a promotion name');
      return;
    }
    if (!selectedModules.length) {
      toast.error('Select at least one module');
      return;
    }
    setBusy(true);
    try {
      const created = await promotionApi.createPackage({
        name: name.trim(),
        modules: selectedModules,
        projectId: currentProject?.id,
        organizationId: userProfile?.organization_id || undefined,
      });
      setPackageId(created.package.id);
      await loadObjects(selectedModules);
      setStep('Select Objects');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create promotion package');
    } finally {
      setBusy(false);
    }
  }

  async function saveSelectionAndDeps() {
    if (!packageId) return;
    if (!selectedList.length) {
      toast.error('Select at least one promotable object');
      return;
    }
    setBusy(true);
    try {
      await promotionApi.setSelection(
        packageId,
        selectedList.map((o) => ({
          objectType: o.objectType,
          objectId: o.objectId,
          stableId: o.stableId,
          objectName: o.name,
        })),
      );
      const deps = await promotionApi.resolveDependencies(packageId, []);
      setPkgDetail(deps);
      setMissingDeps(deps.missingDependencies || []);
      setIncludeDeps({});
      setStep('Dependencies');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save selection');
    } finally {
      setBusy(false);
    }
  }

  async function includeDepsAndValidate() {
    if (!packageId) return;
    setBusy(true);
    try {
      const ids = Object.entries(includeDeps)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const deps = await promotionApi.resolveDependencies(packageId, ids);
      setPkgDetail(deps);
      const validated = await promotionApi.validate(packageId);
      setPkgDetail(validated);
      setStep('Validation');
    } catch (e: any) {
      toast.error(e?.message || 'Validation failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadMappings() {
    if (!packageId) return;
    setBusy(true);
    try {
      const res = await promotionApi.mappings(packageId, { childApplyMode });
      setMappingReport(res.mapping);
      setChildApplyMode(res.childApplyMode || 'replace');
      setStep('Mapping');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to build object mappings');
    } finally {
      setBusy(false);
    }
  }

  async function refreshMappings(mode: 'replace' | 'merge') {
    if (!packageId) return;
    setBusy(true);
    setChildApplyMode(mode);
    try {
      const res = await promotionApi.mappings(packageId, { childApplyMode: mode });
      setMappingReport(res.mapping);
      setChildApplyMode(res.childApplyMode || mode);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to refresh mappings');
    } finally {
      setBusy(false);
    }
  }

  async function loadSummary() {
    if (!packageId) return;
    setBusy(true);
    try {
      // Persist latest apply mode + mapping before summary
      const mapped = await promotionApi.mappings(packageId, { childApplyMode });
      setMappingReport(mapped.mapping);
      const s = await promotionApi.summary(packageId);
      setSummary(s);
      if (s.conflicts > 0) {
        toast.error('Resolve conflicts before promoting');
        return;
      }
      if (mapped.mapping?.blockers?.length) {
        toast.error('Resolve mapping blockers before continuing');
        setStep('Mapping');
        return;
      }
      setStep('Summary');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load summary');
    } finally {
      setBusy(false);
    }
  }

  async function executePromote() {
    if (!packageId) return;
    setBusy(true);
    try {
      const result = await promotionApi.execute(packageId);
      setPkgDetail(result);
      setStep('Result');
      toast.success(`Promotion ${result.package?.status}`);
    } catch (e: any) {
      toast.error(e?.message || 'Promotion execution failed');
    } finally {
      setBusy(false);
    }
  }

  function severityIcon(sev: string) {
    if (sev === 'ready') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (sev === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  }

  return (
    <PageContent
      title="Create Promotion"
      description="Select supported configuration objects and promote them from Dev to Prod"
      actions={
        <Button variant="outline" onClick={() => navigate('/promotional-transfer')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <Badge
            key={s}
            variant={s === step ? 'default' : i < stepIndex ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {i + 1}. {s}
          </Badge>
        ))}
      </div>

      {step === 'Source & Target' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Source and target</CardTitle>
            <CardDescription>Environments are fixed by configuration. Arbitrary database connections are not allowed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Promotion name</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Incident form + workflow update"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground text-xs uppercase tracking-wide">Source</div>
                <div className="font-medium mt-1">{envs?.source || 'TopsqillITSM_Dev'}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground text-xs uppercase tracking-wide">Target</div>
                <div className="font-medium mt-1">{envs?.target || 'TopsqillITSM_Prod'}</div>
              </div>
            </div>
            <Button onClick={() => setStep('Modules')}>
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'Modules' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Select modules</CardTitle>
            <CardDescription>
              Choose one or more modules for this package (Archer-style). Objects from all selected
              modules appear on the next step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {apiWarning && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {apiWarning}
              </div>
            )}
            <div className="grid gap-2">
              {modules.map((m) => {
                const selectedMod = selectedModules.includes(m.module);
                return (
                  <button
                    key={m.module}
                    type="button"
                    onClick={() => toggleModule(m.module)}
                    className={`text-left rounded-md border px-4 py-3 transition-colors ${
                      selectedMod
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedMod}
                        onCheckedChange={() => toggleModule(m.module)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <div className="font-medium">{m.module}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(m as any).description || `Promotable: ${m.objectTypes.join(', ')}`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!modules.length && (
              <p className="text-sm text-muted-foreground">
                No promotable modules available. Check that the promotion registry is configured.
              </p>
            )}
            {selectedModules.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedModules.join(', ')}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('Source & Target')}>Back</Button>
              <Button disabled={busy || !selectedModules.length} onClick={goSelectObjects}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'Select Objects' && (
        <Card>
          <CardHeader>
            <CardTitle>Select promotable objects</CardTitle>
            <CardDescription>
              Use a module tab, then move items with the listbox (Available → Selected). Search filters each side.
              Unselected objects will not be transferred.
              {currentProject ? ` Scoped to project: ${currentProject.name}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingObjects ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading objects…
              </div>
            ) : !objectsByModule.length ? (
              <p className="text-sm text-muted-foreground">No promotable objects found for these modules/project.</p>
            ) : (
              <Tabs
                value={activeObjectModule || objectsByModule[0]?.module}
                onValueChange={setActiveObjectModule}
                className="w-full"
              >
                <TabsList className="mb-3 flex h-auto w-full flex-wrap justify-start gap-1">
                  {objectsByModule.map(({ module, items }) => {
                    const count = items.filter((o) => selected[`${o.objectType}:${o.objectId}`]).length;
                    return (
                      <TabsTrigger key={module} value={module} className="text-xs sm:text-sm">
                        {module}
                        <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                          {count}/{items.length}
                        </Badge>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {objectsByModule.map(({ module, items }) => (
                  <TabsContent key={module} value={module} className="mt-0 space-y-3">
                    {!items.length ? (
                      <p className="text-sm text-muted-foreground">No objects in {module} for this scope.</p>
                    ) : (
                      <ModuleObjectDualListbox
                        items={items}
                        selected={selected}
                        onChange={setSelected}
                      />
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
            <div className="text-sm text-muted-foreground">{selectedList.length} selected across all modules</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('Modules')}>Back</Button>
              <Button disabled={busy || !selectedList.length} onClick={saveSelectionAndDeps}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Review dependencies
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'Dependencies' && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Dependencies</CardTitle>
            <CardDescription>
              Required dependencies that are not selected are listed below. Include them explicitly — nothing is transferred silently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!missingDeps.length ? (
              <p className="text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> No missing required dependencies.
              </p>
            ) : (
              <div className="rounded-md border divide-y">
                {missingDeps.map((d) => (
                  <label key={`${d.objectType}:${d.stableId}`} className="flex items-start gap-3 px-4 py-3">
                    <Checkbox
                      checked={!!includeDeps[d.stableId]}
                      onCheckedChange={(v) => setIncludeDeps((s) => ({ ...s, [d.stableId]: !!v }))}
                    />
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {d.reason}
                        {d.required ? ' (required)' : ' (optional)'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('Select Objects')}>Back</Button>
              <Button disabled={busy} onClick={includeDepsAndValidate}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Validate promotion
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'Validation' && (
        <Card>
          <CardHeader>
            <CardTitle>Validation results</CardTitle>
            <CardDescription>
              Ready / Warning / Conflict. Conflicts must be resolved before promotion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline" className="bg-emerald-50">
                Ready: {pkgDetail?.package?.validation_summary?.ready ?? 0}
              </Badge>
              <Badge variant="outline" className="bg-amber-50">
                Warnings: {pkgDetail?.package?.validation_summary?.warnings ?? 0}
              </Badge>
              <Badge variant="outline" className="bg-red-50">
                Conflicts: {pkgDetail?.package?.validation_summary?.conflicts ?? 0}
              </Badge>
              <Badge variant="secondary">Status: {pkgDetail?.package?.status}</Badge>
            </div>
            <div className="rounded-md border divide-y max-h-[420px] overflow-auto">
              {(pkgDetail?.validations || []).map((v: any) => (
                <div key={v.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  {severityIcon(v.severity)}
                  <div>
                    <div className="font-medium capitalize">{v.severity} · {v.code}</div>
                    <div className="text-muted-foreground">{v.message}</div>
                  </div>
                </div>
              ))}
              {!pkgDetail?.validations?.length && (
                <p className="p-4 text-sm text-muted-foreground">No validation findings.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('Dependencies')}>Back</Button>
              <Button
                disabled={busy || (pkgDetail?.package?.validation_summary?.conflicts ?? 0) > 0 || pkgDetail?.package?.status !== 'Ready'}
                onClick={loadMappings}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Review mappings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'Mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Object mapping review</CardTitle>
            <CardDescription>
              Archer-style Dev → Prod identity map for selected objects (fields, options, rules, actions, users, roles, form refs).
              Default apply mode is Replace (children refreshed to match Dev). Merge keeps Prod-only extras and appends nested values.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Child apply mode</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={childApplyMode === 'replace' ? 'default' : 'outline'}
                  disabled={busy}
                  onClick={() => refreshMappings('replace')}
                >
                  Replace (default)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={childApplyMode === 'merge' ? 'default' : 'outline'}
                  disabled={busy}
                  onClick={() => refreshMappings('merge')}
                >
                  Merge (forms keep Prod extras)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Replace updates matched objects and replaces nested config. Merge upserts form fields by label+type,
                unions dropdown/radio/multiselect options by value, and merges field/form rules (+ actions) by name —
                Prod-only fields, options, and rules are kept. Workflows/roles still replace their graphs/permissions.
              </p>
            </div>

            {mappingReport && (
              <>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline" className="bg-emerald-50">Matched: {mappingReport.counts?.matched ?? 0}</Badge>
                  <Badge variant="outline" className="bg-sky-50">New: {mappingReport.counts?.new ?? 0}</Badge>
                  <Badge variant="outline" className="bg-red-50">Unresolved: {mappingReport.counts?.unresolved ?? 0}</Badge>
                  <Badge variant="outline" className="bg-amber-50">Stripped: {mappingReport.counts?.stripped ?? 0}</Badge>
                </div>

                {!!mappingReport.blockers?.length && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 space-y-1">
                    <div className="font-medium">Mapping blockers (must resolve before promote)</div>
                    {mappingReport.blockers.map((b: string, i: number) => (
                      <div key={i}>• {b}</div>
                    ))}
                  </div>
                )}

                <div className="rounded-md border max-h-[420px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Kind</th>
                        <th className="px-3 py-2">Object</th>
                        <th className="px-3 py-2">Label</th>
                        <th className="px-3 py-2">Dev</th>
                        <th className="px-3 py-2">Prod</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(mappingReport.entries || []).map((e: any, idx: number) => (
                        <tr key={`${e.kind}-${e.sourceKey}-${idx}`} className="align-top">
                          <td className="px-3 py-2 text-xs">{e.kind}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{e.objectName}</div>
                            <div className="text-[10px] text-muted-foreground">{e.objectType}</div>
                          </td>
                          <td className="px-3 py-2">{e.label}</td>
                          <td className="px-3 py-2 font-mono text-[11px] break-all">{e.sourceKey}</td>
                          <td className="px-3 py-2 font-mono text-[11px] break-all">{e.targetKey || '—'}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={
                                e.status === 'matched'
                                  ? 'bg-emerald-50'
                                  : e.status === 'new'
                                    ? 'bg-sky-50'
                                    : e.status === 'stripped'
                                      ? 'bg-amber-50'
                                      : 'bg-red-50'
                              }
                            >
                              {e.status}
                            </Badge>
                            {e.detail && (
                              <div className="mt-1 text-[10px] text-muted-foreground">{e.detail}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('Validation')}>Back</Button>
              <Button
                disabled={
                  busy ||
                  !!mappingReport?.blockers?.length
                }
                onClick={loadSummary}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Promotion summary
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'Summary' && summary && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Promotion Summary</CardTitle>
            <CardDescription>Review exactly what will happen before execution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Source</dt><dd className="font-medium">{summary.source}</dd></div>
              <div><dt className="text-muted-foreground">Target</dt><dd className="font-medium">{summary.target}</dd></div>
              <div><dt className="text-muted-foreground">Modules</dt><dd className="font-medium">{summary.module}</dd></div>
              <div><dt className="text-muted-foreground">Apply mode</dt><dd className="font-medium">{summary.childApplyMode || childApplyMode}</dd></div>
              <div><dt className="text-muted-foreground">Selected objects</dt><dd className="font-medium">{summary.selectedObjects}</dd></div>
              <div><dt className="text-muted-foreground">Dependencies</dt><dd className="font-medium">{summary.dependencies}</dd></div>
              <div><dt className="text-muted-foreground">New objects</dt><dd className="font-medium">{summary.newObjects}</dd></div>
              <div><dt className="text-muted-foreground">Objects to update</dt><dd className="font-medium">{summary.objectsToUpdate}</dd></div>
              <div><dt className="text-muted-foreground">Warnings</dt><dd className="font-medium">{summary.warnings}</dd></div>
              <div><dt className="text-muted-foreground">Conflicts</dt><dd className="font-medium">{summary.conflicts}</dd></div>
            </dl>
            <div className="rounded-md border divide-y max-h-60 overflow-auto">
              {(summary.items || []).map((i: any) => (
                <div key={i.id} className="px-3 py-2 text-sm flex justify-between gap-2">
                  <span>{i.object_name} <span className="text-muted-foreground">({i.object_type})</span></span>
                  <span className="text-xs text-muted-foreground">{i.selection_source}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('Mapping')}>Back</Button>
              <Button disabled={busy || summary.conflicts > 0} onClick={executePromote}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Promote to Production
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'Result' && pkgDetail && (
        <Card>
          <CardHeader>
            <CardTitle>Promotion result</CardTitle>
            <CardDescription>
              Status: <strong>{pkgDetail.package?.status}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline" className="bg-emerald-50">
                Succeeded: {pkgDetail.package?.promotion_summary?.succeeded ?? 0}
              </Badge>
              <Badge variant="outline" className="bg-red-50">
                Failed: {pkgDetail.package?.promotion_summary?.failed ?? 0}
              </Badge>
              <Badge variant="outline">
                Skipped: {pkgDetail.package?.promotion_summary?.skipped ?? 0}
              </Badge>
            </div>
            <div className="rounded-md border divide-y">
              {(pkgDetail.items || []).map((i: any) => (
                <div key={i.id} className="px-4 py-3 text-sm flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{i.object_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.object_type} · {i.stable_id}
                      {i.execution_error ? ` · ${i.execution_error}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline">{i.execution_status || '—'}</Badge>
                </div>
              ))}
            </div>
            <Button onClick={() => navigate(`/promotional-transfer/${packageId}`)}>
              Open promotion detail
            </Button>
          </CardContent>
        </Card>
      )}
    </PageContent>
  );
}
