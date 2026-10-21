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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { promotionApi } from '@/lib/promotion/api';
import { DEFAULT_PROMOTION_ENVIRONMENTS, PROMOTION_MODULES } from '@/lib/promotion/registry';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  'Source & Target',
  'Module',
  'Select Objects',
  'Dependencies',
  'Validation',
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
  const [module, setModule] = useState('');
  // Always seed from the static registry so the dropdown is never blank if Nest is down.
  const [modules, setModules] = useState(PROMOTION_MODULES);
  const [envs, setEnvs] = useState<any>(DEFAULT_PROMOTION_ENVIRONMENTS);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [objects, setObjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [packageId, setPackageId] = useState<string | null>(null);
  const [pkgDetail, setPkgDetail] = useState<any>(null);
  const [missingDeps, setMissingDeps] = useState<any[]>([]);
  const [includeDeps, setIncludeDeps] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<any>(null);
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

  const loadObjects = useCallback(async (mod: string) => {
    setLoadingObjects(true);
    try {
      const res = await promotionApi.objects({
        module: mod,
        projectId: currentProject?.id,
      });
      setObjects(res.objects || []);
      setSelected({});
    } catch (e: any) {
      toast.error(e?.message || 'Failed to list promotable objects');
    } finally {
      setLoadingObjects(false);
    }
  }, [currentProject?.id]);

  if (userProfile && userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const stepIndex = STEPS.indexOf(step);

  async function goSelectObjects() {
    if (!name.trim()) {
      toast.error('Enter a promotion name');
      return;
    }
    if (!module) {
      toast.error('Select a module');
      return;
    }
    setBusy(true);
    try {
      const created = await promotionApi.createPackage({
        name: name.trim(),
        module,
        projectId: currentProject?.id,
        organizationId: userProfile?.organization_id || undefined,
      });
      setPackageId(created.package.id);
      await loadObjects(module);
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

  async function loadSummary() {
    if (!packageId) return;
    setBusy(true);
    try {
      const s = await promotionApi.summary(packageId);
      setSummary(s);
      if (s.conflicts > 0) {
        toast.error('Resolve conflicts before promoting');
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
            <Button onClick={() => setStep('Module')}>
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'Module' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Select module</CardTitle>
            <CardDescription>Only modules that contain registered promotable objects are listed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {apiWarning && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {apiWarning}
              </div>
            )}
            <div className="grid gap-2">
              {modules.map((m) => {
                const selectedMod = module === m.module;
                return (
                  <button
                    key={m.module}
                    type="button"
                    onClick={() => setModule(m.module)}
                    className={`text-left rounded-md border px-4 py-3 transition-colors ${
                      selectedMod
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-medium">{m.module}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(m as any).description || `Promotable: ${m.objectTypes.join(', ')}`}
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('Source & Target')}>Back</Button>
              <Button disabled={busy || !module} onClick={goSelectObjects}>
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
              Only registered promotable objects appear. Unselected objects will not be transferred.
              {currentProject ? ` Scoped to project: ${currentProject.name}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingObjects ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading objects…
              </div>
            ) : !objects.length ? (
              <p className="text-sm text-muted-foreground">No promotable objects found for this module/project.</p>
            ) : (
              <div className="rounded-md border divide-y max-h-[480px] overflow-auto">
                {objects.map((o) => {
                  const key = `${o.objectType}:${o.objectId}`;
                  return (
                    <label key={key} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30">
                      <Checkbox
                        checked={!!selected[key]}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [key]: !!v }))}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{o.name}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                          <span>{o.objectTypeName || o.objectType}</span>
                          <span>·</span>
                          <span>Dev: {o.devVersion || '—'}</span>
                          <span>·</span>
                          <span>Prod: {o.prodVersion || 'not present'}</span>
                          <span>·</span>
                          <span>{o.conflictStatus}</span>
                          {o.hasDependencies && <Badge variant="outline" className="text-[10px]">has dependencies</Badge>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="text-sm text-muted-foreground">{selectedList.length} selected</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('Module')}>Back</Button>
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
              <div><dt className="text-muted-foreground">Module</dt><dd className="font-medium">{summary.module}</dd></div>
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
              <Button variant="outline" onClick={() => setStep('Validation')}>Back</Button>
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
