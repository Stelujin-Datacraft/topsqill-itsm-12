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

const KINDS = [
  { value: 'REST_API', label: 'REST API (external source)' },
  { value: 'INTERNAL_APPLICATION_API', label: 'Internal Application API (TopSqill forms)' },
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

  async function reload() {
    setRows(await visApi.listConnections());
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
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
            'Create an Internal Application connection pointing at your real Form API, then click Map & execute again.',
          variant: 'destructive',
        });
        setOpen(true);
        applyInternalFormApiPreset();
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
        q_source: isCrowd ? 'REST API' : 'REST API',
        q_frequency: '15_MINUTES',
      });
      const integrationId = analyzed?.id || analyzed?.integration?.id || created.id;
      await visApi.bindConnections(integrationId, {
        sourceConnectionId: source.id,
        targetConnectionId: target.id,
        selectedFormId: 'form-vulnerability',
      });
      toast({
        title: 'Integration ready',
        description: 'Continue the wizard: Form & Schema → Mapping → Dry Run → Approval → Execute',
      });
      navigate(`/vis/integrations/${integrationId}?step=1`);
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
    setForm({
      name: 'TopSqill Form API',
      kind: 'INTERNAL_APPLICATION_API',
      environment: 'DEV',
      baseUrl: '',
      authType: 'API_KEY',
      secret: '',
      allowPrivateNetwork: true,
      listPath: '',
    });
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

  async function clearLabData() {
    if (!window.confirm('Remove leftover lab/demo connections and wipe local studio cache?')) return;
    setClearing(true);
    try {
      await visApi.resetStudio();
      toast({ title: 'Lab data cleared', description: 'Add your external connections to continue.' });
      await reload();
    } catch (e: any) {
      toast({ title: 'Clear failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  }

  async function create() {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      toast({
        title: 'Name and Base URL required',
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
      toast({ title: 'Connection created' });
      setOpen(false);
      setForm(EMPTY_FORM);
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
        description="Add external REST sources (CrowdStrike Mockoon, etc.) and your real TopSqill Form API target. Built-in demo stubs are disabled."
        actions={
          <>
            <Button variant="ghost" onClick={() => void clearLabData()} disabled={clearing}>
              {clearing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Clear lab data
            </Button>
            <Button
              onClick={() => {
                setForm(EMPTY_FORM);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Connection
            </Button>
          </>
        }
      />
      <VisSubnav active="connections" />

      <div className="rounded-md border border-border bg-muted/30 px-3.5 py-3 text-sm space-y-2">
        <p className="font-medium text-foreground">Proper external test flow</p>
        <ol className="list-decimal pl-5 text-muted-foreground space-y-1 text-xs sm:text-sm">
          <li>New Connection → CrowdStrike Mockoon (source) with your real Mockoon base URL.</li>
          <li>New Connection → TopSqill Form API (target) with your Form API base URL + credential.</li>
          <li>
            On the source row click <span className="text-foreground font-medium">Map &amp; execute</span>,
            then walk Form &amp; Schema → Mapping → Dry Run → Approval → Start Execution.
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
                <Button
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Connection
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/vis/new">Or describe an integration (AI)</Link>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Connection</DialogTitle>
            <DialogDescription>
              Point at a real API or a local Mockoon sandbox. Secrets are stored as opaque credential
              handles — they are never returned by the API.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={applyMockoonCrowdStrikePreset}>
              CrowdStrike Mockoon preset
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={applyInternalFormApiPreset}>
              Form API preset
            </Button>
          </div>

          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="conn-name">Name</Label>
              <Input
                id="conn-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="CrowdStrike Mockoon"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}
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
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="http://127.0.0.1:3000"
              />
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
              Allow private / localhost URLs (required for Mockoon)
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
