import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw, Link2, CheckCircle2, AlertTriangle, Play, Eye, History, FileSearch, Cable,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { itamSyncApi, isItamSyncClientMode } from '@/lib/itam/api';

/**
 * ITAM Form Sync UI — discovered assets → existing application Form API.
 * Existing application remains system of record. No secrets in payloads.
 * Uses Nest `/api/itam/sync` when available; falls back to browser client engine.
 */

function statusBadge(status?: string) {
  const s = String(status || '').toUpperCase();
  if (['SUCCESS', 'NO_CHANGE', 'DRY_RUN', 'APPROVED', 'COMPLETED'].includes(s)) {
    return <Badge className="bg-emerald-600/90">{s}</Badge>;
  }
  if (['WOULD_CREATE', 'WOULD_UPDATE', 'DRAFT', 'STALE'].includes(s)) {
    return <Badge variant="secondary">{s}</Badge>;
  }
  if (['AMBIGUOUS_MATCH', 'BLOCKED', 'CONFIGURATION_REQUIRED', 'SCHEMA_CHANGED'].includes(s)) {
    return <Badge className="bg-amber-600/90">{s}</Badge>;
  }
  return <Badge variant="destructive">{s || '—'}</Badge>;
}

export function FormSyncPanel() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.organization_id || '';
  const [tab, setTab] = useState('targets');
  const [loading, setLoading] = useState(false);
  const [clientMode, setClientMode] = useState(false);
  const [targets, setTargets] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedMappingId, setSelectedMappingId] = useState('');
  const [schema, setSchema] = useState<any>(null);
  const [previewRun, setPreviewRun] = useState<any>(null);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [provenanceRows, setProvenanceRows] = useState<any[]>([]);
  const [assetLookup, setAssetLookup] = useState('');

  const [targetForm, setTargetForm] = useState({
    name: 'ITAM Form API',
    baseUrl: '',
    credentialReferenceId: '',
    targetFormId: '',
  });

  const refresh = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      localStorage.setItem('current_organization_id', orgId);
      const [t, m, r, met] = await Promise.all([
        itamSyncApi.listTargets(),
        itamSyncApi.listMappings(),
        itamSyncApi.listRuns(),
        itamSyncApi.metrics(),
      ]);
      setTargets(Array.isArray(t) ? t : []);
      setMappings(Array.isArray(m) ? m : []);
      setRuns(Array.isArray(r) ? r : []);
      setMetrics(met as Record<string, number>);
      setClientMode(isItamSyncClientMode());
      if (!selectedTargetId && Array.isArray(t) && t[0]?.id) setSelectedTargetId(t[0].id);
      if (!selectedMappingId && Array.isArray(m) && m[0]?.id) setSelectedMappingId(m[0].id);
    } catch (e: any) {
      toast({
        title: 'Form Sync API',
        description: e?.message || 'Unable to reach /api/itam/sync endpoints',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useMemo(() => { if (orgId) void refresh(); }, [orgId]);

  const createTarget = async () => {
    try {
      if (!targetForm.credentialReferenceId.trim()) {
        toast({ title: 'credentialReferenceId required', variant: 'destructive' });
        return;
      }
      const row = await itamSyncApi.createTarget(targetForm);
      setSelectedTargetId(String((row as any).id));
      setClientMode(isItamSyncClientMode());
      toast({ title: 'Sync target saved' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const loadSchema = async () => {
    if (!selectedTargetId || !targetForm.targetFormId) return;
    try {
      const s = await itamSyncApi.getSchema(targetForm.targetFormId, selectedTargetId);
      setSchema(s);
      setClientMode(isItamSyncClientMode());
      toast({ title: 'Schema refreshed' });
    } catch (e: any) {
      toast({ title: 'Schema failed', description: e.message, variant: 'destructive' });
    }
  };

  const previewMappings = async () => {
    if (!selectedTargetId) return;
    try {
      const res: any = await itamSyncApi.previewMappings({
        targetId: selectedTargetId,
        formId: targetForm.targetFormId,
        name: `Mapping ${targetForm.targetFormId}`,
      });
      setSchema(res.schema);
      setSelectedMappingId(res.mapping?.id);
      setClientMode(isItamSyncClientMode());
      toast({ title: 'Mapping proposed', description: res.requiresApproval ? 'Requires approval' : 'Ready' });
      await refresh();
      setTab('mappings');
    } catch (e: any) {
      toast({ title: 'Mapping preview failed', description: e.message, variant: 'destructive' });
    }
  };

  const approveMapping = async (id: string) => {
    try {
      await itamSyncApi.approveMapping(id);
      toast({ title: 'Mapping approved' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Approve failed', description: e.message, variant: 'destructive' });
    }
  };

  const runDry = async () => {
    if (!selectedTargetId || !selectedMappingId) return;
    try {
      const run = await itamSyncApi.previewSync({
        targetId: selectedTargetId,
        mappingId: selectedMappingId,
      });
      setPreviewRun(run);
      setSelectedRun(run);
      setClientMode(isItamSyncClientMode());
      toast({ title: 'Dry-run complete', description: 'No writes to the existing application' });
      await refresh();
      setTab('runs');
    } catch (e: any) {
      toast({ title: 'Dry-run failed', description: e.message, variant: 'destructive' });
    }
  };

  const runExecute = async () => {
    if (!selectedTargetId || !selectedMappingId) return;
    try {
      const run: any = await itamSyncApi.executeSync({
        targetId: selectedTargetId,
        mappingId: selectedMappingId,
      });
      setSelectedRun(run);
      setClientMode(isItamSyncClientMode());
      toast({ title: 'Sync executed', description: `Status: ${run.status}` });
      await refresh();
      setTab('runs');
    } catch (e: any) {
      toast({ title: 'Execute failed', description: e.message, variant: 'destructive' });
    }
  };

  const loadHistory = async () => {
    if (!assetLookup.trim()) return;
    try {
      const [h, p] = await Promise.all([
        itamSyncApi.history(assetLookup.trim()),
        itamSyncApi.provenance(assetLookup.trim()),
      ]);
      setHistoryRows(Array.isArray(h) ? h : []);
      setProvenanceRows(Array.isArray(p) ? p : []);
      setTab('history');
    } catch (e: any) {
      toast({ title: 'Lookup failed', description: e.message, variant: 'destructive' });
    }
  };

  const activeMapping = mappings.find((m) => m.id === selectedMappingId) || mappings[0];
  const runItems = selectedRun?.items || previewRun?.items || [];

  const tally = useMemo(() => {
    const items = runItems as any[];
    return {
      create: items.filter((i) => ['CREATE', 'WOULD_CREATE'].includes(i.operation)).length,
      update: items.filter((i) => ['UPDATE', 'WOULD_UPDATE'].includes(i.operation)).length,
      noChange: items.filter((i) => i.operation === 'NO_CHANGE').length,
      ambiguous: items.filter((i) => i.status === 'AMBIGUOUS_MATCH').length,
      validation: items.filter((i) => i.status === 'VALIDATION_FAILED').length,
      api: items.filter((i) => i.status === 'API_ERROR').length,
      blocked: items.filter((i) => ['BLOCKED', 'CONFIGURATION_REQUIRED'].includes(i.status)).length,
    };
  }, [runItems]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Form Sync
          </h2>
          <p className="text-sm text-muted-foreground">
            Sync discovered ITAM assets into application forms. For CrowdStrike Mockoon → Form API
            device sync, use{' '}
            <Link to="/vis/connections" className="underline underline-offset-2 text-foreground">
              Integration Studio
            </Link>{' '}
            instead.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm flex gap-2 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
        Credentials must use credentialReferenceId only. Dry-run never writes to the existing application.
      </div>

      {clientMode && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm flex gap-2 text-muted-foreground">
          <Cable className="h-4 w-4 shrink-0 mt-0.5" />
          Local Form Sync mode — Nest <code className="font-mono text-xs">/api/itam/sync</code> is
          offline. Point the target at your real Form API base URL (not a built-in mock).
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
          {[
            ['Creates', metrics.sync_create_total],
            ['Updates', metrics.sync_update_total],
            ['No change', metrics.sync_no_change_total],
            ['Validation fail', metrics.sync_validation_failure_total],
            ['Ambiguous', metrics.sync_ambiguous_total],
            ['API errors', metrics.sync_api_error_total],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-3">
                <div className="text-muted-foreground text-xs">{label}</div>
                <div className="text-xl font-semibold">{value ?? 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="mappings">Mappings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="history">History / Provenance</TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Existing application target</CardTitle>
              <CardDescription>
                Configure your real Form API base URL and credentialReferenceId (no embedded secrets).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={targetForm.name} onChange={(e) => setTargetForm({ ...targetForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Base URL</Label>
                <Input value={targetForm.baseUrl} onChange={(e) => setTargetForm({ ...targetForm, baseUrl: e.target.value })} />
              </div>
              <div>
                <Label>credentialReferenceId</Label>
                <Input
                  value={targetForm.credentialReferenceId}
                  onChange={(e) => setTargetForm({ ...targetForm, credentialReferenceId: e.target.value })}
                  placeholder="cred-ref-…"
                />
              </div>
              <div>
                <Label>Target form ID</Label>
                <Input
                  value={targetForm.targetFormId}
                  onChange={(e) => setTargetForm({ ...targetForm, targetFormId: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={() => void createTarget()}>Save target</Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {targets.map((t) => (
              <Card key={t.id} className={selectedTargetId === t.id ? 'border-primary' : ''}>
                <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.baseUrl} · ref {t.credentialReferenceId}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedTargetId(t.id)}>Select</Button>
                </CardContent>
              </Card>
            ))}
            {!targets.length && <p className="text-sm text-muted-foreground">No sync targets yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="schema" className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={() => void loadSchema()} disabled={!selectedTargetId}>
              <FileSearch className="h-4 w-4 mr-1" /> Discover schema
            </Button>
            <Button variant="outline" onClick={() => void previewMappings()} disabled={!selectedTargetId}>
              Propose mappings
            </Button>
          </div>
          {schema && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{schema.formName || schema.formId}</CardTitle>
                <CardDescription>
                  Version {schema.version} · fetched {schema.fetchedAt}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-1 pr-2">Name</th>
                        <th className="py-1 pr-2">Label</th>
                        <th className="py-1 pr-2">Type</th>
                        <th className="py-1 pr-2">Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(schema.fields || []).map((f: any) => (
                        <tr key={f.name} className="border-b border-border/50">
                          <td className="py-1 pr-2 font-mono text-xs">{f.name}</td>
                          <td className="py-1 pr-2">{f.label || '—'}</td>
                          <td className="py-1 pr-2">{f.type}</td>
                          <td className="py-1 pr-2">{f.required ? 'yes' : 'no'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mappings" className="space-y-3">
          {mappings.map((m) => (
            <Card key={m.id} className={selectedMappingId === m.id ? 'border-primary' : ''}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{m.name} <span className="text-muted-foreground font-normal">v{m.version}</span></CardTitle>
                  <div className="flex items-center gap-2">
                    {statusBadge(m.status)}
                    <Button size="sm" variant="outline" onClick={() => setSelectedMappingId(m.id)}>Select</Button>
                    {m.status !== 'APPROVED' && (
                      <Button size="sm" onClick={() => void approveMapping(m.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription>
                  Form {m.targetFormId} · {m.mappingSource} · confidence {m.confidence || '—'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-1 text-sm font-mono">
                  {(m.mappings || []).map((row: any, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-muted-foreground">{row.sourceField || row.source}</span>
                      <span>→</span>
                      <span>{row.targetField || row.target}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {!mappings.length && <p className="text-sm text-muted-foreground">Propose mappings from the Schema tab.</p>}
        </TabsContent>

        <TabsContent value="preview" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void runDry()} disabled={!selectedTargetId || !selectedMappingId}>
              <Eye className="h-4 w-4 mr-1" /> Dry-run preview
            </Button>
            <Button onClick={() => void runExecute()} disabled={!selectedTargetId || !selectedMappingId}>
              <Play className="h-4 w-4 mr-1" /> Execute sync
            </Button>
          </div>
          {activeMapping && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active mapping preview</CardTitle>
                <CardDescription>{activeMapping.name} v{activeMapping.version} → {activeMapping.targetFormId}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <div className="font-medium mb-1">MAPPING</div>
                  {(activeMapping.mappings || []).map((row: any, idx: number) => (
                    <div key={idx} className="font-mono text-xs">
                      {row.sourceField || row.source} → {row.targetField || row.target}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="font-medium mb-1">LAST PREVIEW TALLY</div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>New / would create: {tally.create}</li>
                    <li>Updated / would update: {tally.update}</li>
                    <li>Unchanged: {tally.noChange}</li>
                    <li>Ambiguous: {tally.ambiguous}</li>
                    <li>Validation failures: {tally.validation}</li>
                    <li>API failures: {tally.api}</li>
                    <li>Blocked: {tally.blocked}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
          {!!runItems.length && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Item results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {runItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-2 text-sm">
                    <div>
                      <div className="font-medium">{item.externalId || item.hostname || 'asset'}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.operation} · target {item.targetRecordId || '—'}
                        {item.error ? ` · ${item.error}` : ''}
                      </div>
                    </div>
                    {statusBadge(item.status)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-3">
          {runs.map((r) => (
            <Card key={r.id} className={selectedRun?.id === r.id ? 'border-primary' : ''}>
              <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{r.mode} · {r.startedAt}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.executionId || r.id} · mapping v{r.mappingVersion} · schema {r.schemaVersion || '—'}
                    {r.durationMs != null ? ` · ${r.durationMs}ms` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(r.status)}
                  <Button size="sm" variant="outline" onClick={() => setSelectedRun(r)}>View</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!runs.length && <p className="text-sm text-muted-foreground">No sync runs yet.</p>}
          {selectedRun && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Run detail</CardTitle>
                <CardDescription>
                  Totals: {JSON.stringify(selectedRun.totals || {})}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(selectedRun.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between gap-2 border-b border-border/40 py-1">
                    <span>{item.externalId} → {item.operation}</span>
                    {statusBadge(item.status)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="grow min-w-[200px]">
              <Label>Asset external ID</Label>
              <Input value={assetLookup} onChange={(e) => setAssetLookup(e.target.value)} placeholder="GUID-SERVER-01" />
            </div>
            <Button onClick={() => void loadHistory()}>
              <History className="h-4 w-4 mr-1" /> Load
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Sync history</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {historyRows.map((h) => (
                <div key={h.id} className="flex justify-between gap-2 border-b border-border/40 py-1">
                  <span>{h.createdAt || h.timestamp} · {h.operation} · record {h.targetRecordId || '—'}</span>
                  {statusBadge(h.status)}
                </div>
              ))}
              {!historyRows.length && <p className="text-muted-foreground">No history for this asset.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Provenance</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs font-mono">
              {provenanceRows.map((p, idx) => (
                <div key={p.id || idx} className="border-b border-border/40 py-1">
                  {(p.targetField || p.field)} = {String(p.value ?? '')}
                  {' · '}src {p.sourceField || p.source} ({p.discoverySource || p.provider || '—'})
                  {' · '}map {p.mappingVersion != null ? `v${p.mappingVersion}` : '—'}
                </div>
              ))}
              {!provenanceRows.length && <p className="text-muted-foreground font-sans">No provenance rows.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
