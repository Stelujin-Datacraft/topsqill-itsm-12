import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';
import { getFormApiUrl } from '@/services/api/apiClient';

const KINDS = [
  { value: 'REST_API', label: 'REST API (external source — e.g. CrowdStrike)' },
  { value: 'INTERNAL_APPLICATION_API', label: 'Form API (TopSqill target — where records are written)' },
] as const;

const AUTH_TYPES = [
  { value: 'NONE', label: 'None' },
  { value: 'API_KEY', label: 'API Key / Bearer' },
  { value: 'BASIC', label: 'Basic' },
] as const;

type FormState = {
  name: string;
  kind: string;
  environment: string;
  baseUrl: string;
  authType: string;
  secret: string;
  allowPrivateNetwork: boolean;
  listPath: string;
};

type PresetId = 'crowdstrike' | 'form-api' | null;

const EMPTY_FORM: FormState = {
  name: '',
  kind: 'REST_API',
  environment: 'DEV',
  baseUrl: '',
  authType: 'NONE',
  secret: '',
  allowPrivateNetwork: true,
  listPath: '',
};

/** Absolute Form API base — never CrowdStrike/Mockoon host. */
function resolveFormApiBaseUrl(): string {
  const configured = getFormApiUrl(); // e.g. /api/form-api or http://host/api/form-api
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    const path = configured.startsWith('/') ? configured : `/${configured}`;
    return `${window.location.origin}${path}`.replace(/\/$/, '');
  }
  return configured.replace(/\/$/, '');
}

export default function VisConnections() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activePreset, setActivePreset] = useState<PresetId>(null);

  async function reload() {
    setRows(await visApi.listConnections());
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Drop leftover built-in mock stubs from earlier lab testing
        await visApi.purgeLabConnections();
      } catch {
        /* Nest may be offline — client purge still runs via fallback */
      }
      if (!cancelled) {
        try {
          await reload();
        } finally {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function test(id: string) {
    try {
      const res = await visApi.testConnection(id);
      toast({
        title: res.ok ? 'Connection OK' : 'Connection failed',
        description: res.error || res.data?.note || `HTTP ${res.status ?? 'n/a'}`,
        variant: res.ok ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    }
  }

  /**
   * Connections alone do not map/execute. Start (or reopen) an integration wizard
   * with this REST connection bound as source + Internal App as target.
   */
  async function useAsSource(connectionId: string) {
    setStartingId(connectionId);
    try {
      let list = await visApi.listConnections();
      let source = list.find((c: any) => c.id === connectionId);
      if (!source) throw new Error('Connection not found');
      if (source.kind !== 'REST_API' && source.kind !== 'DATABASE') {
        throw new Error('Only REST/Database connections can be used as source');
      }

      let target = list.find((c: any) => {
        if (c.kind !== 'INTERNAL_APPLICATION_API') return false;
        const base = String(c.baseUrl || '');
        const name = String(c.name || '').toLowerCase();
        // Prefer real Form API targets — skip leftover lab stubs
        if (base.startsWith('client://') || base.includes('/vis/mocks')) return false;
        if (name.includes('mock internal')) return false;
        return true;
      });
      if (!target) {
        toast({
          title: 'Form API connection required',
          description:
            'First create a Form API target (not CrowdStrike). The Form API preset fills the correct …/api/form-api URL.',
          variant: 'destructive',
        });
        openNewConnection('form-api');
        return;
      }

      const isCrowd =
        /crowdstrike|falcon|mockoon|device/i.test(String(source.name || ''))
        || /crowdstrike|falcon/i.test(String(source.baseUrl || ''));
      const prompt = isCrowd
        ? `Sync CrowdStrike Falcon devices from ${source.name} at ${source.baseUrl || 'REST'} every 15 minutes into our internal Vulnerability form. Create or update by device_id / external_id. Map hostname into description and keep status.`
        : `Sync records from ${source.name} (${source.baseUrl || 'REST API'}) into our internal form. Create or update by external id every 15 minutes.`;

      const created = await visApi.createIntegration({
        name: `${source.name} → Internal Form`,
        promptText: prompt,
      });
      const analyzed: any = await visApi.analyze(created.id, prompt, {
        q_source: 'REST API',
        q_frequency: '15_MINUTES',
      });
      const integrationId = analyzed?.id || analyzed?.integration?.id || created.id;
      // Bind connections only — do not hardcode a form id; user must Discover Forms
      await visApi.bindConnections(integrationId, {
        sourceConnectionId: source.id,
        targetConnectionId: target.id,
      });
      if (isCrowd) {
        await visApi.setMatchingStrategy(integrationId, {
          mode: 'SINGLE',
          sourceFields: ['device_id'],
          targetFields: ['external_id'],
          ifFound: 'UPDATE',
          ifNotFound: 'CREATE',
        });
      }
      toast({
        title: 'Integration ready',
        description: 'Next: Discover Forms on Form & Schema, then Mapping → Dry Run → Execute',
      });
      navigate(`/vis/integrations/${integrationId}?step=2`);
    } catch (e: any) {
      toast({
        title: 'Could not start integration',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setStartingId(null);
    }
  }

  function applyMockoonCrowdStrikePreset() {
    setActivePreset('crowdstrike');
    setForm({
      name: 'CrowdStrike Mockoon',
      kind: 'REST_API',
      environment: 'DEV',
      baseUrl: 'http://127.0.0.1:3000',
      authType: 'API_KEY',
      secret: '',
      allowPrivateNetwork: true,
      listPath: '/devices/queries/devices/v1',
    });
  }

  function applyInternalFormApiPreset() {
    setActivePreset('form-api');
    const baseUrl = resolveFormApiBaseUrl();
    setForm({
      name: 'TopSqill Form API',
      kind: 'INTERNAL_APPLICATION_API',
      environment: 'DEV',
      baseUrl,
      authType: 'API_KEY',
      secret: '',
      // Form API is usually same-origin / public HTTPS — only allow private if URL is localhost
      allowPrivateNetwork: /localhost|127\.0\.0\.1/.test(baseUrl),
      listPath: '',
    });
  }

  function openNewConnection(preset?: PresetId) {
    setOpen(true);
    if (preset === 'crowdstrike') {
      applyMockoonCrowdStrikePreset();
      return;
    }
    if (preset === 'form-api') {
      applyInternalFormApiPreset();
      return;
    }
    setForm(EMPTY_FORM);
    setActivePreset(null);
  }

  async function removeConnection(id: string) {
    setDeletingId(id);
    try {
      await visApi.deleteConnection(id);
      toast({ title: 'Connection deleted' });
      await reload();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  async function resetStudio() {
    if (!window.confirm('Reset local Integration Studio cache (connections, integrations, executions)? You will need to re-create your CrowdStrike and Form API connections.')) return;
    setClearing(true);
    try {
      await visApi.resetStudio();
      toast({ title: 'Studio reset', description: 'Add your external connections to continue.' });
      await reload();
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  }

  async function create() {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      toast({
        title: 'Name and Base URL required',
        description:
          form.kind === 'INTERNAL_APPLICATION_API'
            ? 'Use Form API preset — Base URL should be your TopSqill Form API (…/api/form-api), not the CrowdStrike Mockoon port.'
            : 'Use CrowdStrike Mockoon preset or enter the Mockoon base URL (e.g. http://127.0.0.1:3000).',
        variant: 'destructive',
      });
      return;
    }
    // Guard: Form API target must not point at the CrowdStrike Mockoon host by mistake
    if (
      form.kind === 'INTERNAL_APPLICATION_API'
      && /:3000\b|:3002\b/.test(form.baseUrl)
      && !/form-api/i.test(form.baseUrl)
    ) {
      toast({
        title: 'Wrong Base URL for Form API',
        description:
          'That looks like CrowdStrike Mockoon. Click “Form API preset” again — it fills …/api/form-api automatically.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const config: Record<string, unknown> = {};
      if (form.kind === 'REST_API' && form.listPath.trim()) {
        config.listPath = form.listPath.trim();
      }
      if (form.kind === 'INTERNAL_APPLICATION_API') {
        config.apiVersion = 'v1';
        config.paths = {
          formsPath: '/forms',
          formFieldsPath: '/forms/{formId}/fields',
          recordsPath: '/forms/{formId}/records',
          recordByIdPath: '/forms/{formId}/records/{recordId}',
        };
      }
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        kind: form.kind,
        environment: form.environment,
        baseUrl: form.baseUrl.trim().replace(/\/$/, ''),
        authType: form.authType,
        allowPrivateNetwork: form.allowPrivateNetwork,
        config,
      };
      if (form.authType !== 'NONE' && form.secret.trim()) {
        body.secret = form.secret.trim();
      }
      await visApi.createConnection(body);
      toast({
        title: 'Connection saved',
        description:
          form.kind === 'REST_API'
            ? 'Source ready. Next: add Form API target (if missing), then Map & execute.'
            : 'Form API target ready. On your CrowdStrike row, click Map & execute.',
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      setActivePreset(null);
      await reload();
    } catch (e: any) {
      toast({
        title: 'Create failed',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <VisPageShell>
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </VisPageShell>
    );
  }

  return (
    <VisPageShell>
      <VisPageHeader
        title="Connections"
        description="A Connection is the endpoint/login to a system. An Integration is the job that reads from one connection and writes to another."
        actions={
          <>
            <Button variant="ghost" onClick={() => void resetStudio()} disabled={clearing}>
              {clearing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Reset studio
            </Button>
            <Button onClick={() => openNewConnection()}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Connection
            </Button>
          </>
        }
      />
      <VisSubnav active="connections" />

      <div className="rounded-md border border-border bg-muted/30 px-3.5 py-3 text-sm space-y-2">
        <p className="font-medium text-foreground">Setup order</p>
        <ol className="list-decimal pl-5 text-muted-foreground space-y-1 text-xs sm:text-sm">
          <li>
            <button type="button" className="underline underline-offset-2 text-foreground" onClick={() => openNewConnection('crowdstrike')}>
              CrowdStrike Mockoon
            </button>{' '}
            — source REST API (usually http://127.0.0.1:3000).
          </li>
          <li>
            <button type="button" className="underline underline-offset-2 text-foreground" onClick={() => openNewConnection('form-api')}>
              TopSqill Form API
            </button>{' '}
            — target where records are saved (auto-fills …/api/form-api — not port 3000). Paste a Bearer token from{' '}
            <Link to="/integrations?tab=api-keys" className="underline underline-offset-2 text-foreground">
              API keys &amp; connectors
            </Link>{' '}
            if required.
          </li>
          <li>
            On the CrowdStrike row click <span className="text-foreground font-medium">Map &amp; execute</span>,
            then Discover Forms and pick your real form.
          </li>
        </ol>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center space-y-4">
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                No connections yet. Add your CrowdStrike Mockoon source and TopSqill Form API target to begin.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => openNewConnection('crowdstrike')}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  CrowdStrike source
                </Button>
                <Button variant="outline" onClick={() => openNewConnection('form-api')}>
                  Form API target
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground break-all">
                      {c.kind} · {c.authType}
                      {c.baseUrl ? ` · ${c.baseUrl}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Badge variant="outline" className="font-normal text-[10px]">
                      {c.environment}
                    </Badge>
                    {c.hasCredential && (
                      <Badge variant="secondary" className="font-normal text-[10px]">
                        credential
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => test(c.id)}>
                      Test
                    </Button>
                    {(c.kind === 'REST_API' || c.kind === 'DATABASE') && (
                      <Button
                        size="sm"
                        onClick={() => void useAsSource(c.id)}
                        disabled={startingId === c.id}
                      >
                        {startingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 mr-1" />
                        )}
                        Map &amp; execute
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void removeConnection(c.id)}
                      disabled={deletingId === c.id}
                      title="Delete connection"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setActivePreset(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Connection</DialogTitle>
            <DialogDescription>
              Pick a preset first. CrowdStrike = where data comes from. Form API = where TopSqill stores
              records. Secrets are stored as opaque handles and never shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={activePreset === 'crowdstrike' ? 'default' : 'outline'}
              onClick={applyMockoonCrowdStrikePreset}
            >
              1. CrowdStrike Mockoon
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activePreset === 'form-api' ? 'default' : 'outline'}
              onClick={applyInternalFormApiPreset}
            >
              2. Form API target
            </Button>
          </div>

          {activePreset === 'form-api' && (
            <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
              Form API Base URL is auto-filled to <code className="font-mono">{resolveFormApiBaseUrl()}</code>.
              Do <span className="font-medium text-foreground">not</span> use Mockoon port 3000 here.
            </p>
          )}
          {activePreset === 'crowdstrike' && (
            <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
              Point Base URL at your Mockoon CrowdStrike host (default http://127.0.0.1:3000). Keep Kind =
              REST API.
            </p>
          )}

          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="conn-name">Name</Label>
              <Input
                id="conn-name"
                value={form.name}
                onChange={(e) => {
                  setActivePreset(null);
                  setForm((f) => ({ ...f, name: e.target.value }));
                }}
                placeholder="CrowdStrike Mockoon"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => {
                    setActivePreset(null);
                    setForm((f) => ({ ...f, kind: v }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select
                  value={form.environment}
                  onValueChange={(v) => setForm((f) => ({ ...f, environment: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEV">DEV</SelectItem>
                    <SelectItem value="UAT">UAT</SelectItem>
                    <SelectItem value="PROD">PROD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conn-base">Base URL</Label>
              <Input
                id="conn-base"
                value={form.baseUrl}
                onChange={(e) => {
                  setActivePreset(null);
                  setForm((f) => ({ ...f, baseUrl: e.target.value }));
                }}
                placeholder={
                  form.kind === 'INTERNAL_APPLICATION_API'
                    ? resolveFormApiBaseUrl()
                    : 'http://127.0.0.1:3000'
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {form.kind === 'INTERNAL_APPLICATION_API'
                  ? 'Must end with /form-api (or your Form API gateway). Not the same as Mockoon.'
                  : 'Mockoon / external REST root only — no /form-api path.'}
              </p>
            </div>
            {form.kind === 'REST_API' && (
              <div className="space-y-1.5">
                <Label htmlFor="conn-list">List path (optional)</Label>
                <Input
                  id="conn-list"
                  value={form.listPath}
                  onChange={(e) => setForm((f) => ({ ...f, listPath: e.target.value }))}
                  placeholder="/devices/queries/devices/v1"
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Auth</Label>
                <Select
                  value={form.authType}
                  onValueChange={(v) => setForm((f) => ({ ...f, authType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conn-secret">Secret (optional)</Label>
                <Input
                  id="conn-secret"
                  type="password"
                  value={form.secret}
                  onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                  placeholder="API key or token"
                  disabled={form.authType === 'NONE'}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={form.allowPrivateNetwork}
                onChange={(e) =>
                  setForm((f) => ({ ...f, allowPrivateNetwork: e.target.checked }))
                }
              />
              Allow private / localhost URLs (required for Mockoon on your PC)
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Create connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VisPageShell>
  );
}
