import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { visApi, LANGUAGES } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft, ShieldCheck, Play, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function VisIntegrationDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [integration, setIntegration] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [schema, setSchema] = useState<any>(null);
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!id) return;
    const [integ, conns] = await Promise.all([
      visApi.getIntegration(id),
      visApi.listConnections(),
    ]);
    setIntegration(integ);
    setConnections(conns);
    setMappings(integ.directions?.[0]?.mappings || []);
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const design = integration?.design;

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

  async function createInternalConnection() {
    setBusy(true);
    try {
      // Point at mock internal app on same API host
      const apiBase = (import.meta as any).env?.VITE_API_URL || `${window.location.origin}/api`;
      const conn = await visApi.createConnection({
        name: 'Mock Internal Application',
        kind: 'INTERNAL_APPLICATION_API',
        baseUrl: `${apiBase}/vis/mocks`,
        authType: 'NONE',
        allowPrivateNetwork: true,
        environment: 'DEV',
        config: {
          apiVersion: 'v1',
          paths: {
            formsPath: '/forms',
            formFieldsPath: '/forms/{formId}/fields',
            recordsPath: '/forms/{formId}/records',
            recordByIdPath: '/forms/{formId}/records/{recordId}',
          },
        },
      });
      await visApi.createConnection({
        name: 'Mock Vulnerability Source',
        kind: 'REST_API',
        baseUrl: `${apiBase}/vis/mocks`,
        authType: 'NONE',
        allowPrivateNetwork: true,
        environment: 'DEV',
        config: { listPath: '/vulnerabilities' },
      });
      setSelectedConnectionId(conn.id);
      await reload();
      toast({ title: 'Demo connections created' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function loadForms(connectionId: string) {
    setSelectedConnectionId(connectionId);
    setBusy(true);
    try {
      const res = await visApi.discoverForms(connectionId);
      setForms(res.items || res.data?.items || res.data || []);
    } catch (e: any) {
      toast({ title: 'Discover forms failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function discoverSchema() {
    if (!id || !selectedConnectionId || !selectedFormId) return;
    setBusy(true);
    try {
      const result = await visApi.discoverSchema(id, {
        connectionId: selectedConnectionId,
        formId: selectedFormId,
      });
      setSchema(result);
      const suggested = await visApi.suggestMappings(id, {
        connectionId: selectedConnectionId,
        formId: selectedFormId,
      });
      setMappings(suggested);
      toast({
        title: 'Schema discovered',
        description: result.changed ? 'Remote schema changed since last cache' : 'Cached schema ready',
      });
    } catch (e: any) {
      toast({ title: 'Schema discovery failed', description: e.message, variant: 'destructive' });
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
      toast({ title: 'Mappings saved (DRAFT)' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function validate() {
    if (!id) return;
    setBusy(true);
    try {
      const res = await visApi.validate(id);
      setIntegration(res.integration);
      toast({
        title: res.ok ? 'Validated' : 'Validation issues',
        description: res.ok ? 'Status → VALIDATED' : res.issues?.map((i: any) => i.message).join('; '),
        variant: res.ok ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Validate failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function runExecution() {
    if (!id) return;
    setBusy(true);
    try {
      const exec = await visApi.createExecution(id);
      toast({ title: 'Execution created', description: `${exec.status} · ${exec.correlationId}` });
      await reload();
    } catch (e: any) {
      toast({ title: 'Execution failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading design…
      </div>
    );
  }

  if (error || !integration) {
    return <div className="p-8 text-destructive">{error || 'Not found'}</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/vis">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{integration.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary">{integration.status}</Badge>
            <Badge variant="outline">{integration.environment || 'DEV'}</Badge>
            {design && <Badge variant="outline">{design.direction}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={validate} disabled={busy}>
            <ShieldCheck className="h-4 w-4 mr-2" /> Validate
          </Button>
          <Button onClick={runExecution} disabled={busy}>
            <Play className="h-4 w-4 mr-2" /> Create execution
          </Button>
        </div>
      </div>

      {design && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposed architecture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{design.summary}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <Info label="Source" value={design.source} />
              <Info label="Target" value={design.target} />
              <Info label="Execution" value={design.executionMode} />
              <Info label="Frequency" value={design.frequency || '—'} />
              <Info label="Operations" value={(design.operations || []).join(', ')} />
              <Info label="Workers / Batch" value={`${design.workers} / ${design.batchSize}`} />
              <Info label="Retry" value={design.retryPolicy || '—'} />
              <Info label="Idempotency" value={design.idempotencyStrategy || '—'} />
              <Info label="Auth hint" value={design.authHint || '—'} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programming language</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {design?.languageReason && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">AI reason: </span>
              {design.languageReason}
            </p>
          )}
          <RadioGroup
            value={design?.language || 'PYTHON'}
            onValueChange={changeLanguage}
            className="space-y-2"
          >
            {LANGUAGES.map((lang) => (
              <div key={lang.value} className="flex items-center space-x-2">
                <RadioGroupItem value={lang.value} id={`lang-${lang.value}`} />
                <Label htmlFor={`lang-${lang.value}`} className="font-normal cursor-pointer">
                  {integration.directions?.[0]?.languageRecommendedByAi === lang.value
                    ? `AI Recommended — ${lang.label}`
                    : lang.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Connections & target schema</CardTitle>
          <Button variant="outline" size="sm" onClick={createInternalConnection} disabled={busy}>
            Create demo connections
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Internal application connection</Label>
              <Select
                value={selectedConnectionId}
                onValueChange={(v) => loadForms(v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select connection" />
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
            <div>
              <Label className="text-xs text-muted-foreground">Discovered form</Label>
              <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={discoverSchema} disabled={busy || !selectedConnectionId || !selectedFormId}>
            <RefreshCw className="h-4 w-4 mr-2" /> Discover schema
          </Button>
          {schema && (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-medium">
                {schema.formName}{' '}
                <span className="text-muted-foreground font-normal">
                  · hash {schema.schemaHash}
                </span>
              </div>
              <ul className="grid sm:grid-cols-2 gap-1">
                {(schema.fields || []).map((f: any) => (
                  <li key={f.name} className="text-muted-foreground">
                    <span className="text-foreground">{f.label || f.name}</span> ({f.type})
                    {f.required ? ' *' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Field mappings</CardTitle>
          <Button size="sm" onClick={saveMappings} disabled={busy || !mappings.length}>
            Save mappings
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {mappings.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Discover a target schema to load AI-suggested mappings.
            </p>
          )}
          {mappings.map((m, idx) => (
            <div
              key={m.id || idx}
              className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center border-b border-border/40 pb-2"
            >
              <Input
                value={m.sourceField}
                onChange={(e) => {
                  const next = [...mappings];
                  next[idx] = { ...m, sourceField: e.target.value };
                  setMappings(next);
                }}
                placeholder="Source field"
              />
              <Input
                value={m.targetField}
                onChange={(e) => {
                  const next = [...mappings];
                  next[idx] = { ...m, targetField: e.target.value };
                  setMappings(next);
                }}
                placeholder="Target field"
              />
              <Input
                value={m.transformation || ''}
                onChange={(e) => {
                  const next = [...mappings];
                  next[idx] = { ...m, transformation: e.target.value };
                  setMappings(next);
                }}
                placeholder="Transformation"
              />
              <Badge
                variant={
                  m.confidence === 'HIGH'
                    ? 'default'
                    : m.confidence === 'MEDIUM'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {m.confidence || '—'}
                {m.enabled === false ? ' (off)' : ''}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        AI never silently deploys. Status stays DRAFT until you validate / approve / activate.
        Target forms are discovered via the Internal Application API — VIS is not the system of
        record.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}
