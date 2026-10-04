import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { visApi, LANGUAGES } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STEPS = ['Form & Schema', 'Mapping', 'Dry Run', 'Run'] as const;

/** Remap bookmarks/links from the old 9-step wizard onto the simplified flow. */
function normalizeWizardStep(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  // Old: 0 Design, 1 Conn, 2 Form, 3 Map, 4 Trans, 5 Match, 6 Val, 7 Dry, 8 Approval
  const legacy: Record<number, number> = {
    0: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 3, 7: 2, 8: 3,
  };
  if (raw in legacy) return legacy[raw];
  return Math.min(STEPS.length - 1, raw);
}

const CROWDSTRIKE_DEVICE_FIELDS = [
  { name: 'id' },
  { name: 'hostname' },
  { name: 'os' },
  { name: 'serialNumber' },
  { name: 'status' },
];

const CROWDSTRIKE_SAMPLE = `{
  "id": "CS-1001",
  "hostname": "LAPTOP-001",
  "os": "Windows 11",
  "serialNumber": "SN001",
  "status": "active"
}`;

function sourceFieldsFromSampleJson(sampleJson: string): Array<{ name: string }> {
  try {
    const parsed = JSON.parse(sampleJson);
    const row = Array.isArray(parsed)
      ? parsed[0]
      : Array.isArray(parsed?.devices)
        ? parsed.devices[0]
        : parsed;
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      return Object.keys(row)
        .filter((k) => typeof (row as any)[k] !== 'object')
        .map((name) => ({ name }));
    }
  } catch {
    /* ignore */
  }
  return CROWDSTRIKE_DEVICE_FIELDS;
}

function normalizeFormsList(res: any): Array<{ id: string; name: string; description?: string | null }> {
  const raw = Array.isArray(res?.items)
    ? res.items
    : Array.isArray(res?.data?.items)
      ? res.data.items
      : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];
  return raw
    .map((f: any) => ({
      id: String(f?.id || f?.formId || f?.reference_id || '').trim(),
      name: String(f?.name || f?.title || f?.reference_id || f?.id || 'Form'),
      description: f?.description || null,
    }))
    .filter((f: { id: string }) => Boolean(f.id));
}

function normalizeMappingsList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.mappings)) return res.mappings;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

/** Safe label list for schema choice columns — never call .map on non-arrays. */
function formatFieldChoices(raw: unknown): string {
  if (raw == null) return '—';
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.choices)
      ? (raw as any).choices
      : Array.isArray((raw as any)?.options)
        ? (raw as any).options
        : null;
  if (!list || !list.length) {
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
    return '—';
  }
  const labels = list.map((c: any) => {
    if (c == null) return '';
    if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') return String(c);
    return String(c.label ?? c.name ?? c.value ?? '');
  }).filter(Boolean);
  return labels.length ? labels.join(', ') : '—';
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'PASS') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (severity === 'WARNING' || severity === 'warning') {
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  }
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export default function VisIntegrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const initialStep = normalizeWizardStep(
    Number(searchParams.get('step') || 0) || 0,
  );
  const [step, setStep] = useState(initialStep);
  const [integration, setIntegration] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [sourceConnectionId, setSourceConnectionId] = useState('');
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');
  const [schema, setSchema] = useState<any>(null);
  const [mappings, setMappings] = useState<any[]>([]);
  const [mapFilter, setMapFilter] = useState<'ALL' | 'HIGH' | 'NEEDS_REVIEW'>('ALL');
  const [nlInstruction, setNlInstruction] = useState('');
  const [sampleJson, setSampleJson] = useState(CROWDSTRIKE_SAMPLE);
  const [openApiText, setOpenApiText] = useState('');
  const [openApiEndpoints, setOpenApiEndpoints] = useState<any[]>([]);
  const [validation, setValidation] = useState<any>(null);
  const [dryRun, setDryRun] = useState<any>(null);
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!id) return;
    const [integ, conns, auditRows] = await Promise.all([
      visApi.getIntegration(id),
      visApi.listConnections(),
      visApi.listAuditFor(id).catch(() => []),
    ]);
    setIntegration(integ);
    setConnections(Array.isArray(conns) ? conns : []);
    setAudits(Array.isArray(auditRows) ? auditRows : []);
    setMappings(normalizeMappingsList(integ?.directions?.[0]?.mappings));
    setSourceConnectionId(integ.directions?.[0]?.sourceConnectionId || '');
    setTargetConnectionId(integ.directions?.[0]?.targetConnectionId || '');
    setSelectedFormId(integ.directions?.[0]?.selectedFormId || '');
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .then(async () => {
        const stepParam = searchParams.get('step');
        if (stepParam != null && !Number.isNaN(Number(stepParam))) {
          setStep(normalizeWizardStep(Number(stepParam)));
        }
        // If opened from Connections "Map & execute", ensure forms load for bound target
        const integ = id ? await visApi.getIntegration(id) : null;
        const targetId = integ?.directions?.[0]?.targetConnectionId;
        if (targetId) {
          try {
            const res = await visApi.discoverForms(targetId);
            setForms(normalizeFormsList(res));
          } catch {
            setForms([]);
          }
        }
        // Prefill CrowdStrike sample when source looks like Falcon/Mockoon
        const sourceId = integ?.directions?.[0]?.sourceConnectionId;
        if (sourceId) {
          const conns = await visApi.listConnections();
          const source = conns.find((c: any) => c.id === sourceId);
          if (source && /crowdstrike|falcon|mockoon|device/i.test(String(source.name || ''))) {
            setSampleJson(CROWDSTRIKE_SAMPLE);
          }
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const design = integration?.design;
  const direction = integration?.directions?.[0];
  const matching = direction?.matchingStrategy;

  const filteredMappings = useMemo(() => {
    const list = Array.isArray(mappings) ? mappings : [];
    if (mapFilter === 'HIGH') {
      return list.filter((m) => m.confidence === 'HIGH' || (m.confidencePercent || 0) >= 90);
    }
    if (mapFilter === 'NEEDS_REVIEW') {
      return list.filter(
        (m) => m.confidence !== 'HIGH' || (m.confidencePercent || 100) < 90 || m.enabled === false,
      );
    }
    return list;
  }, [mappings, mapFilter]);

  // Radix Select crashes the whole page if value is set but not present in items
  const formSelectValue = forms.some((f: any) => f.id === selectedFormId)
    ? selectedFormId
    : undefined;
  const sourceSelectValue = connections.some((c: any) => c.id === sourceConnectionId)
    ? sourceConnectionId
    : undefined;
  const targetSelectValue = connections.some((c: any) => c.id === targetConnectionId)
    ? targetConnectionId
    : undefined;
  const schemaFields = Array.isArray(schema?.fields) ? schema.fields : [];
  const schemaAdded = Array.isArray(schema?.schemaDiff?.added) ? schema.schemaDiff.added : [];
  const schemaRemoved = Array.isArray(schema?.schemaDiff?.removed) ? schema.schemaDiff.removed : [];
  const safeMappings = Array.isArray(mappings) ? mappings : [];

  async function changeLanguage(language: string) {
    if (!id) return;
    setBusy(true);
    try {
      const updated = await visApi.setLanguage(id, language);
      setIntegration(updated);
      toast({ title: 'Language updated', description: language });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function refreshBoundConnections() {
    setBusy(true);
    try {
      const list = await visApi.listConnections();
      setConnections(list);
      const source =
        list.find(
          (c: any) =>
            c.kind === 'REST_API'
            && /crowdstrike|falcon|mockoon|device/i.test(String(c.name || '')),
        )
        || list.find((c: any) => c.kind === 'REST_API' && !String(c.baseUrl || '').startsWith('client://'));
      const target = list.find((c: any) => {
        if (c.kind !== 'INTERNAL_APPLICATION_API') return false;
        const base = String(c.baseUrl || '');
        return !base.startsWith('client://') && !base.includes('/vis/mocks');
      });
      if (id && source && target) {
        const updated = await visApi.bindConnections(id, {
          sourceConnectionId: source.id,
          targetConnectionId: target.id,
        });
        setIntegration(updated);
        setSourceConnectionId(source.id);
        setTargetConnectionId(target.id);
        if (/crowdstrike|falcon|mockoon|device/i.test(String(source.name || ''))) {
          setSampleJson(CROWDSTRIKE_SAMPLE);
        }
        await loadForms(target.id);
        toast({
          title: 'Connections bound',
          description: `Source: ${source.name} → Target: ${target.name}`,
        });
      } else {
        toast({
          title: 'Add real connections first',
          description: 'Create CrowdStrike (REST) + Form API (Internal Application) under Connections.',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function loadForms(connectionId: string) {
    setTargetConnectionId(connectionId);
    setBusy(true);
    try {
      if (id) {
        await visApi.bindConnections(id, { targetConnectionId: connectionId });
      }
      const res = await visApi.discoverForms(connectionId);
      const normalized = normalizeFormsList(res);
      setForms(normalized);
      // Keep selection only if it still exists; otherwise clear to avoid Select crash
      setSelectedFormId((prev) => (normalized.some((f) => f.id === prev) ? prev : ''));
      if (!normalized.length) {
        toast({
          title: 'No forms found',
          description: 'Create a form in Form builder for this project, then Discover Forms again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Forms loaded',
          description: `${normalized.length} form(s) — select one, then Discover Schema.`,
        });
      }
    } catch (e: any) {
      setForms([]);
      toast({
        title: 'Discover forms failed',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function rematchFromSchema() {
    if (!id || !targetConnectionId || !selectedFormId) {
      toast({
        title: 'Discover schema first',
        description: 'Go to Form & Schema, select your form, Discover Schema, then remap.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const suggested = await visApi.suggestMappings(id, {
        connectionId: targetConnectionId,
        formId: selectedFormId,
        sourceFields: sourceFieldsFromSampleJson(sampleJson),
      });
      const normalized = normalizeMappingsList(suggested);
      setMappings(normalized);
      if (normalized.length) await visApi.saveMappings(id, normalized);
      toast({
        title: 'Mappings refreshed from form schema',
        description: `${normalized.length} field(s) mapped to your selected form.`,
      });
    } catch (e: any) {
      toast({
        title: 'Remap failed',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function selectFormAndDiscover(formId: string) {
    setSelectedFormId(formId);
    if (!id || !targetConnectionId || !formId) return;
    setBusy(true);
    try {
      await visApi.bindConnections(id, {
        sourceConnectionId: sourceConnectionId || undefined,
        targetConnectionId,
        selectedFormId: formId,
      });
      const result = await visApi.discoverSchema(id, {
        connectionId: targetConnectionId,
        formId,
      });
      const safeSchema = result && typeof result === 'object'
        ? {
            ...result,
            fields: Array.isArray((result as any).fields) ? (result as any).fields : [],
          }
        : { fields: [] };
      setSchema(safeSchema);
      const suggested = await visApi.suggestMappings(id, {
        connectionId: targetConnectionId,
        formId,
        sourceFields: sourceFieldsFromSampleJson(sampleJson),
      });
      const normalized = normalizeMappingsList(suggested);
      setMappings(normalized);
      if (normalized.length) {
        try {
          await visApi.saveMappings(id, normalized);
        } catch {
          /* keep UI */
        }
      }
      toast({
        title: 'Form ready',
        description: `${(safeSchema.fields || []).length} field(s), ${normalized.length} mapping(s). Continue to Mapping or Dry Run.`,
      });
    } catch (e: any) {
      toast({
        title: 'Could not load form schema',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function discoverSchema(refresh = false) {
    if (!id || !targetConnectionId || !selectedFormId) {
      toast({
        title: 'Select a form first',
        description: 'Discover Forms, pick a form, then Discover Schema.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      await visApi.bindConnections(id, {
        sourceConnectionId: sourceConnectionId || undefined,
        targetConnectionId,
        selectedFormId,
      });
      const result = refresh
        ? await visApi.refreshSchema(id, { connectionId: targetConnectionId, formId: selectedFormId })
        : await visApi.discoverSchema(id, { connectionId: targetConnectionId, formId: selectedFormId });
      const safeSchema = result && typeof result === 'object'
        ? {
            ...result,
            fields: Array.isArray((result as any).fields) ? (result as any).fields : [],
          }
        : { fields: [] };
      setSchema(safeSchema);
      try {
        const suggested = await visApi.suggestMappings(id, {
          connectionId: targetConnectionId,
          formId: selectedFormId,
          sourceFields: sourceFieldsFromSampleJson(sampleJson),
        });
        const normalized = normalizeMappingsList(suggested);
        setMappings(normalized);
        // Persist so reload()/Dry Run don't restore old Vulnerability template mappings
        if (normalized.length) {
          try {
            await visApi.saveMappings(id, normalized);
          } catch {
            /* keep UI mappings even if persist fails */
          }
        }
      } catch {
        setMappings([]);
      }
      try {
        await reload();
      } catch {
        /* keep current UI state */
      }
      toast({
        title: safeSchema.changed ? 'Target form schema has changed.' : 'Schema discovered',
        description: safeSchema.changed
          ? `Added: ${(safeSchema.schemaDiff?.added || []).join(', ') || '—'}; Removed: ${(safeSchema.schemaDiff?.removed || []).join(', ') || '—'}`
          : `${(safeSchema.fields || []).length} fields`,
      });
    } catch (e: any) {
      toast({
        title: 'Schema discovery failed',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveMappings() {
    if (!id) return;
    setBusy(true);
    try {
      const saved = await visApi.saveMappings(id, mappings);
      setMappings(saved);
      toast({ title: 'Mappings saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function runNlMapping() {
    if (!id || !nlInstruction.trim()) return;
    setBusy(true);
    try {
      const next = await visApi.nlMapping(id, nlInstruction.trim());
      setMappings(next);
      setNlInstruction('');
      toast({ title: 'Mapping updated from instruction' });
    } catch (e: any) {
      toast({ title: 'NL mapping failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function applySample() {
    if (!id) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(sampleJson);
      await visApi.setSampleSource(id, parsed);
      toast({ title: 'Sample source data saved' });
      await reload();
    } catch (e: any) {
      toast({ title: 'Invalid sample JSON', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function fetchSampleFromSource() {
    if (!id || !sourceConnectionId) {
      toast({
        title: 'Bind a source connection first',
        description: 'Select CrowdStrike / Mockoon on the Connections step.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const conn = connections.find((c) => c.id === sourceConnectionId)
        || (await visApi.listConnections()).find((c: any) => c.id === sourceConnectionId);
      if (!conn) throw new Error('Source connection not found');
      const baseUrl = String(conn.baseUrl || '').replace(/\/$/, '');
      if (!/^https?:\/\//i.test(baseUrl)) {
        throw new Error('Source Base URL must be an http(s) Mockoon/REST endpoint');
      }
      const listPath = String(conn.config?.listPath || '/crowdstrike/devices');
      const url = `${baseUrl}${listPath.startsWith('/') ? listPath : `/${listPath}`}`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) throw new Error(`Mockoon returned HTTP ${res.status} for ${url}`);
      const data = await res.json();
      // CrowdStrike-style resources array or plain object/array
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.resources)
          ? data.resources
          : Array.isArray(data?.devices)
            ? data.devices
            : Array.isArray(data?.items)
              ? data.items
              : [data];
      const first = rows[0];
      if (!first || typeof first !== 'object') {
        throw new Error('No device records in Mockoon response — check list path');
      }
      setSampleJson(JSON.stringify(first, null, 2));
      await visApi.setSampleSource(id, first);
      toast({ title: 'Fetched sample from source', description: url });
      await reload();
    } catch (e: any) {
      toast({
        title: 'Fetch from Mockoon failed',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function parseOpenApi() {
    if (!id) return;
    setBusy(true);
    try {
      const document = JSON.parse(openApiText);
      const discovered = await visApi.discoverOpenApi(id, { document });
      setOpenApiEndpoints(discovered.endpoints || []);
      toast({ title: `Discovered ${(discovered.endpoints || []).length} endpoints` });
    } catch (e: any) {
      toast({ title: 'OpenAPI parse failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function runValidate() {
    if (!id) return;
    setBusy(true);
    try {
      const res = await visApi.validate(id);
      setValidation(res);
      setIntegration(res.integration || (await visApi.getIntegration(id)));
      toast({
        title: res.ok ? 'Validation passed' : 'Validation needs attention',
        variant: res.ok ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Validate failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function runDryRun() {
    if (!id) return;
    setBusy(true);
    try {
      let sample: Record<string, unknown>[] | undefined;
      try {
        const parsed = JSON.parse(sampleJson);
        sample = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        sample = undefined;
      }
      const res = await visApi.dryRun(id, sample);
      setDryRun(res);
      toast({ title: 'Dry run complete — no records written' });
    } catch (e: any) {
      toast({ title: 'Dry run failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!id) return;
    setBusy(true);
    try {
      const updated = await visApi.approve(id);
      setIntegration(updated);
      const auditRows = await visApi.listAuditFor(id).catch(() => []);
      setAudits(Array.isArray(auditRows) ? auditRows : []);
      toast({ title: 'Design approved', description: 'You can start an execution from this page.' });
    } catch (e: any) {
      toast({ title: 'Approve failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!id) return;
    setBusy(true);
    try {
      await visApi.saveDraft(id, {});
      await saveMappings();
      toast({ title: 'Draft saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function removeIntegration() {
    if (!id) return;
    if (
      !window.confirm(
        `Delete integration “${integration?.name || id}”? Connections stay; this design and its runs are removed.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await visApi.deleteIntegration(id);
      toast({ title: 'Integration deleted' });
      navigate('/vis/integrations');
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
      setBusy(false);
    }
  }

  async function saveMatching(patch: Partial<{ sourceFields: string; targetFields: string; mode: string }>) {
    if (!id) return;
    const strategy = {
      mode: (patch.mode as any) || matching?.mode || 'SINGLE',
      sourceFields: (patch.sourceFields ?? (matching?.sourceFields || ['id']).join(', '))
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean),
      targetFields: (patch.targetFields ?? (matching?.targetFields || ['external_id']).join(', '))
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean),
      ifFound: 'UPDATE' as const,
      ifNotFound: 'CREATE' as const,
    };
    setBusy(true);
    try {
      const updated = await visApi.setMatchingStrategy(id, strategy);
      setIntegration(updated);
      toast({ title: 'Matching strategy saved' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading design…
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error || 'Not found'}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/vis">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full overflow-y-auto">
      <div className="w-full max-w-[1400px] mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1 h-8 px-2 text-muted-foreground">
            <Link to="/vis/integrations">
              <ArrowLeft className="h-4 w-4 mr-1" /> Integrations
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{integration.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline">{integration.status}</Badge>
            {design?.language && <Badge variant="secondary">{design.language}</Badge>}
            {integration.__clientMode && <Badge variant="outline">Local studio</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void removeIntegration()}
            title="Delete this integration"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button variant="outline" size="sm" disabled={busy || step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            size="sm"
            disabled={busy || step >= STEPS.length - 1}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((label, idx) => (
          <Button
            key={label}
            type="button"
            size="sm"
            variant={idx === step ? 'default' : 'outline'}
            className="rounded-full h-8 text-xs shrink-0"
            onClick={() => setStep(idx)}
          >
            {idx + 1}. {label}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Step {step + 1} of {STEPS.length}: <span className="text-foreground font-medium">{STEPS[step]}</span>
        {' — '}
        Pick your form, review mappings, dry-run, then run. Connections live under Integration Studio → Connections.
      </p>

      {false && !design && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No design yet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Analyze a requirement first, or go to Connections and choose your CrowdStrike / Mockoon
              source, then continue the wizard.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/vis/new">Describe integration</Link>
            </Button>
            <Button onClick={() => setStep(1)}>Go to Connections step</Button>
          </CardContent>
        </Card>
      )}

      {false && design && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Integration Design</CardTitle>
              <p className="text-sm text-muted-foreground">{design.summary}</p>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              {[
                ['SOURCE', `${design.source}${design.sourceHints?.system ? ` · ${design.sourceHints.system}` : ''}`],
                ['TARGET', `${design.target}${design.targetHints?.formName || design.targetHints?.formHint ? ` · ${design.targetHints.formName || design.targetHints.formHint}` : ''}`],
                ['DIRECTION', design.direction],
                ['EXECUTION', `${design.executionMode}${design.frequency ? ` · ${design.frequency}` : ''}`],
                ['OPERATIONS', (design.operations || []).join(', ')],
                ['AUTHENTICATION', design.authHint || '—'],
                ['LANGUAGE', design.language],
                ['PERFORMANCE', `workers ${design.workers} · batch ${design.batchSize} · concurrency ${design.concurrency || design.workers}`],
                ['RELIABILITY', `${design.retryPolicy || 'EXPONENTIAL'} · rate ${design.rateLimitPerMinute || '—'}/min`],
                ['SECURITY / IDEMPOTENCY', design.idempotencyStrategy || 'EXTERNAL_ID'],
              ].map(([k, v]) => (
                <div key={k} className="border border-border/50 rounded-md p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
                  <div className="font-medium mt-1">{v}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {(design.recommendations || []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {design.recommendations.map((r: any) => (
                  <div key={r.area} className="border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.area}</span>
                      <Badge variant="secondary">{r.confidence}</Badge>
                    </div>
                    <div className="text-sm mt-1">{r.recommendation}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.reason}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Programming language</CardTitle>
              <p className="text-sm text-muted-foreground">{design.languageReason}</p>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={design.language}
                onValueChange={changeLanguage}
                className="grid sm:grid-cols-2 gap-3"
                disabled={busy}
              >
                {LANGUAGES.map((l) => (
                  <div key={l.value} className="flex items-center space-x-2 border rounded-md p-3">
                    <RadioGroupItem value={l.value} id={`lang-${l.value}`} />
                    <Label htmlFor={`lang-${l.value}`}>{l.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {false && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Connections</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select your external source and Internal Application (Form API) connections.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/vis/connections">Manage connections</Link>
                </Button>
                <Button size="sm" onClick={refreshBoundConnections} disabled={busy}>
                  Bind from Connections
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source connection (REST)</Label>
                <Select
                  value={sourceSelectValue}
                  onValueChange={async (v) => {
                    setSourceConnectionId(v);
                    if (id) {
                      const updated = await visApi.bindConnections(id, { sourceConnectionId: v });
                      setIntegration(updated);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections
                      .filter((c) => c.kind === 'REST_API' || c.kind === 'DATABASE')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.baseUrl ? ` · ${c.baseUrl}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target connection (Internal Application)</Label>
                <Select
                  value={targetSelectValue}
                  onValueChange={(v) => loadForms(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections
                      .filter((c) => c.kind === 'INTERNAL_APPLICATION_API')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advanced: OpenAPI discovery</CardTitle>
              <p className="text-sm text-muted-foreground">
                Optional — skip for CrowdStrike Mockoon presets.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={6}
                value={openApiText}
                onChange={(e) => setOpenApiText(e.target.value)}
                placeholder='Paste OpenAPI JSON…'
                className="font-mono text-xs"
              />
              <Button size="sm" variant="outline" onClick={parseOpenApi} disabled={busy || !openApiText.trim()}>
                Discover APIs
              </Button>
              {openApiEndpoints.length > 0 && (
                <div className="space-y-1 text-sm">
                  {openApiEndpoints.map((e) => (
                    <button
                      key={`${e.method}${e.path}`}
                      type="button"
                      className="block w-full text-left border-b border-border/40 py-2 hover:bg-muted/40 px-1 rounded"
                      onClick={async () => {
                        if (!id) return;
                        await visApi.selectOpenApiEndpoint(id, { path: e.path, method: e.method });
                        toast({ title: `Selected ${e.method} ${e.path}` });
                      }}
                    >
                      <span className="font-mono text-xs mr-2">{e.method}</span>
                      {e.path}
                      {e.summary ? <span className="text-muted-foreground"> — {e.summary}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sample source JSON</CardTitle>
              <p className="text-sm text-muted-foreground">
                Used for mapping suggestions and dry-run. Prefer Fetch from Mockoon when the source is reachable.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={8}
                value={sampleJson}
                onChange={(e) => setSampleJson(e.target.value)}
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void fetchSampleFromSource()} disabled={busy || !sourceConnectionId}>
                  Fetch from Mockoon
                </Button>
                <Button size="sm" variant="outline" onClick={applySample} disabled={busy}>
                  Use sample for mapping
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSampleJson(CROWDSTRIKE_SAMPLE)}
                  disabled={busy}
                >
                  CrowdStrike device sample
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Target form & schema</CardTitle>
              <p className="text-sm text-muted-foreground">
                Discover Forms, then select a form — schema and mappings load automatically.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!targetConnectionId || busy} onClick={() => loadForms(targetConnectionId)}>
                Discover Forms
              </Button>
              <Button size="sm" variant="outline" disabled={!selectedFormId || busy} onClick={() => discoverSchema(true)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh Schema
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
              <div className="space-y-2">
                <Label>Source connection</Label>
                <Select
                  value={sourceSelectValue}
                  onValueChange={async (v) => {
                    setSourceConnectionId(v);
                    if (id) {
                      const updated = await visApi.bindConnections(id, { sourceConnectionId: v });
                      setIntegration(updated);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="CrowdStrike / Mockoon" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections
                      .filter((c) => c.kind === 'REST_API' || c.kind === 'DATABASE')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target connection</Label>
                <Select
                  value={targetSelectValue}
                  onValueChange={(v) => loadForms(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Form API" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections
                      .filter((c) => c.kind === 'INTERNAL_APPLICATION_API')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 max-w-md">
              <Label>Form</Label>
              <Select
                value={formSelectValue}
                onValueChange={(v) => void selectFormAndDiscover(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={forms.length ? 'Select form' : 'Discover Forms first'} />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!forms.length && (
                <p className="text-xs text-muted-foreground">
                  No forms loaded yet. Click Discover Forms (requires at least one form in Form builder).
                </p>
              )}
            </div>
            {schema?.changed && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Target form schema has changed. Added: {schemaAdded.join(', ') || '—'}.
                Removed: {schemaRemoved.join(', ') || '—'}. Existing mappings were not
                silently cleared.
              </p>
            )}
            {schemaFields.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-3">Field</th>
                      <th className="py-2 pr-3">Label</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Required</th>
                      <th className="py-2 pr-3">Unique</th>
                      <th className="py-2">Reference / Choices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemaFields.map((f: any, idx: number) => (
                      <tr key={f.name || f.id || `field-${idx}`} className="border-b border-border/40">
                        <td className="py-2 pr-3 font-mono text-xs">{f.name}</td>
                        <td className="py-2 pr-3">{f.label}</td>
                        <td className="py-2 pr-3">{f.type}</td>
                        <td className="py-2 pr-3">{f.required ? 'Yes' : '—'}</td>
                        <td className="py-2 pr-3">{f.unique ? 'Yes' : '—'}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {f.reference
                            ? `ref:${f.reference.formId || '—'}`
                            : formatFieldChoices(f.choices ?? f.options)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">AI field mapping</CardTitle>
              <p className="text-sm text-muted-foreground">
                Mockoon/CrowdStrike source fields → your discovered form fields (not Vulnerability defaults).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['ALL', 'HIGH', 'NEEDS_REVIEW'] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={mapFilter === f ? 'default' : 'outline'}
                  onClick={() => setMapFilter(f)}
                >
                  {f === 'NEEDS_REVIEW' ? 'Needs Review' : f === 'HIGH' ? 'High Confidence' : 'All'}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={rematchFromSchema} disabled={busy || !selectedFormId}>
                Remap from form
              </Button>
              <Button size="sm" onClick={saveMappings} disabled={busy}>
                Save mappings
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {filteredMappings.map((m, idx) => {
                const realIdx = safeMappings.findIndex((x) => x.id === m.id);
                return (
                  <div
                    key={m.id || idx}
                    className="grid md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center border border-border/50 rounded-md p-3"
                  >
                    <Input
                      value={m.sourceField}
                      onChange={(e) => {
                        if (realIdx < 0) return;
                        const next = [...safeMappings];
                        next[realIdx] = { ...next[realIdx], sourceField: e.target.value };
                        setMappings(next);
                      }}
                      placeholder="Source field"
                    />
                    <span className="text-muted-foreground text-center">→</span>
                    <Input
                      value={m.targetField}
                      onChange={(e) => {
                        if (realIdx < 0) return;
                        const next = [...safeMappings];
                        next[realIdx] = { ...next[realIdx], targetField: e.target.value };
                        setMappings(next);
                      }}
                      placeholder="Target field"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Badge variant={m.confidence === 'LOW' ? 'destructive' : 'secondary'}>
                        {m.confidencePercent != null ? `${m.confidencePercent}%` : m.confidence}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (realIdx < 0) return;
                          const next = [...safeMappings];
                          next[realIdx] = { ...next[realIdx], enabled: next[realIdx].enabled === false };
                          setMappings(next);
                        }}
                      >
                        {m.enabled === false ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                    {m.reason && (
                      <p className="md:col-span-4 text-xs text-muted-foreground">{m.reason}</p>
                    )}
                    {m.lookup && (
                      <p className="md:col-span-4 text-xs text-amber-700">
                        Reference lookup: match target where {m.lookup.matchBy || 'name'} = source.
                        {m.lookup.sourceField || m.sourceField}. Multiple matches require user choice.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[220px] space-y-1">
                <Label>Natural language mapping change</Label>
                <Input
                  value={nlInstruction}
                  onChange={(e) => setNlInstruction(e.target.value)}
                  placeholder='e.g. "Map hostname to Host Name" or "Don&apos;t map the status field"'
                />
              </div>
              <Button onClick={runNlMapping} disabled={busy || !nlInstruction.trim()}>
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {false && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transformations</CardTitle>
            <p className="text-sm text-muted-foreground">
              AI-proposed transforms — review and approve before use.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {safeMappings
              .filter((m) => m.transformation && m.enabled !== false)
              .map((m) => (
                <div key={m.id} className="border border-border/50 rounded-md p-3 space-y-2">
                  <div className="text-sm font-medium">
                    {m.sourceField} → {m.targetField}
                  </div>
                  <Input
                    value={m.transformation || ''}
                    onChange={(e) => {
                      const next = safeMappings.map((x) =>
                        x.id === m.id ? { ...x, transformation: e.target.value } : x,
                      );
                      setMappings(next);
                    }}
                    className="font-mono text-xs"
                  />
                  {m.reason && <p className="text-xs text-muted-foreground">{m.reason}</p>}
                </div>
              ))}
            {safeMappings.filter((m) => m.transformation && m.enabled !== false).length === 0 && (
              <p className="text-sm text-muted-foreground">No transformations proposed yet.</p>
            )}
            <Button size="sm" onClick={saveMappings} disabled={busy}>
              Save transformations
            </Button>
          </CardContent>
        </Card>
      )}

      {false && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CREATE / UPDATE matching strategy</CardTitle>
            <p className="text-sm text-muted-foreground">
              IF FOUND → UPDATE · IF NOT FOUND → CREATE. Support single or composite keys.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select
                value={matching?.mode || 'SINGLE'}
                onValueChange={(mode) =>
                  saveMatching({
                    mode,
                    sourceFields: (matching?.sourceFields || ['id']).join(', '),
                    targetFields: (matching?.targetFields || ['external_id']).join(', '),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">Single key</SelectItem>
                  <SelectItem value="COMPOSITE">Composite key</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source field(s)</Label>
              <Input
                defaultValue={(matching?.sourceFields || ['id']).join(', ')}
                id="match-source"
                placeholder="id  or  asset_id, vulnerability_id"
              />
            </div>
            <div className="space-y-2">
              <Label>Target field(s)</Label>
              <Input
                defaultValue={(matching?.targetFields || ['external_id']).join(', ')}
                id="match-target"
                placeholder="external_id"
              />
            </div>
            <Button
              onClick={() => {
                const sourceFields = (document.getElementById('match-source') as HTMLInputElement)?.value;
                const targetFields = (document.getElementById('match-target') as HTMLInputElement)?.value;
                saveMatching({
                  mode: matching?.mode || 'SINGLE',
                  sourceFields,
                  targetFields,
                });
              }}
              disabled={busy}
            >
              Save matching strategy
            </Button>
          </CardContent>
        </Card>
      )}

      {false && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Design validation</CardTitle>
            <Button onClick={runValidate} disabled={busy}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Validate
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(validation?.issues || []).length === 0 && (
              <p className="text-sm text-muted-foreground">Run validation to see PASS / WARNING / ERROR.</p>
            )}
            {(validation?.issues || []).map((issue: any, i: number) => (
              <div key={`${issue.code}-${i}`} className="flex items-start gap-2 text-sm border-b border-border/40 py-2">
                <SeverityIcon severity={issue.severity} />
                <div>
                  <div className="font-medium">
                    {issue.severity} · {issue.code}
                  </div>
                  <div className="text-muted-foreground">{issue.message}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Dry run</CardTitle>
              <p className="text-sm text-muted-foreground">
                Applies mappings and transforms to sample source data. Does not create records.
              </p>
            </div>
            <Button onClick={runDryRun} disabled={busy}>
              <Play className="h-4 w-4 mr-1" /> Run Dry Run
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {(dryRun?.previews || []).map((p: any, i: number) => (
              <div key={i} className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Source</div>
                  <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto">
                    {JSON.stringify(p.source, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Target preview</div>
                  <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto">
                    {JSON.stringify(p.target, null, 2)}
                  </pre>
                  {(p.warnings || []).map((w: string) => (
                    <p key={w} className="text-xs text-amber-700 mt-1">{w}</p>
                  ))}
                  {(p.errors || []).map((w: string) => (
                    <p key={w} className="text-xs text-destructive mt-1">{w}</p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run</CardTitle>
              <p className="text-sm text-muted-foreground">
                Writes mapped CrowdStrike devices into your selected form. Dry Run never writes — this step does.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                disabled={busy || !selectedFormId}
                onClick={async () => {
                  if (!id) return;
                  setBusy(true);
                  try {
                    // Soft validate so status moves forward, then execute
                    try {
                      const res = await visApi.validate(id);
                      setValidation(res);
                      if (res.integration) setIntegration(res.integration);
                    } catch {
                      /* client validate is best-effort */
                    }
                    const exec = await visApi.createExecution(id, { awaitCompletion: false });
                    toast({
                      title: 'Execution started',
                      description: exec.correlationId || exec.id,
                    });
                    navigate(`/vis/executions/${exec.id}`);
                  } catch (e: any) {
                    toast({
                      title: 'Execution failed to start',
                      description: e?.message || 'Unable to start',
                      variant: 'destructive',
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Play className="h-4 w-4 mr-1" /> Start Execution
              </Button>
              <Button variant="outline" onClick={saveDraft} disabled={busy}>
                Save Draft
              </Button>
              {!integration.__clientMode && (
                <Button
                  variant="outline"
                  disabled={busy || !['APPROVED', 'PAUSED', 'DISABLED', 'VALIDATED'].includes(integration.status)}
                  onClick={async () => {
                    if (!id) return;
                    setBusy(true);
                    try {
                      await visApi.activateIntegration(id);
                      const st = await visApi.getRealtimeStatus(id);
                      toast({
                        title: 'Integration activated',
                        description: `Health: ${st.health || 'ACTIVE'}`,
                      });
                      const updated = await visApi.getIntegration(id);
                      setIntegration(updated);
                    } catch (e: any) {
                      toast({
                        title: 'Activate failed',
                        description: e?.message,
                        variant: 'destructive',
                      });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Activate Real-Time
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-80">
                {JSON.stringify(
                  {
                    status: integration.status,
                    selectedFormId: direction?.selectedFormId,
                    mappings: direction?.mappings,
                    matchingStrategy: direction?.matchingStrategy,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit trail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {audits.length === 0 && (
                <p className="text-sm text-muted-foreground">No audit events yet.</p>
              )}
              {audits.slice(0, 30).map((a: any) => (
                <div key={a.id} className="text-sm border-b border-border/40 py-2 flex justify-between gap-3">
                  <span className="font-medium">{a.action}</span>
                  <span className="text-xs text-muted-foreground">{a.createdAt}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {busy && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
        </p>
      )}
      </div>
    </div>
  );
}
