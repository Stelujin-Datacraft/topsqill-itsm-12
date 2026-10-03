import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Loader2, Plus, Plug } from 'lucide-react';
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
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
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
        description: res.error || `HTTP ${res.status ?? 'n/a'}`,
        variant: res.ok ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    }
  }

  function applyMockoonCrowdStrikePreset() {
    setForm({
      name: 'CrowdStrike Mockoon',
      kind: 'REST_API',
      environment: 'DEV',
      baseUrl: 'http://127.0.0.1:3000',
      authType: 'API_KEY',
      secret: 'mock-crowdstrike-token',
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

  async function bootstrapDemo() {
    setBootstrapping(true);
    try {
      const res = await visApi.bootstrapDemo();
      toast({
        title: res.created ? 'Demo connections ready' : 'Demo connections already exist',
        description: res.mockBaseUrl ? `Mock base: ${res.mockBaseUrl}` : undefined,
      });
      await reload();
    } catch (e: any) {
      toast({
        title: 'Bootstrap failed',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setBootstrapping(false);
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
        description="Add REST or Form API endpoints here (including local Mockoon). New Integration on the dashboard is the AI prompt flow — connections are managed on this page."
        actions={
          <>
            <Button variant="outline" onClick={bootstrapDemo} disabled={bootstrapping}>
              {bootstrapping ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 mr-1.5" />
              )}
              Demo connections
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

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center space-y-4">
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                No connections yet. Create one for Mockoon / CrowdStrike / Form API, or load the built-in demo pair.
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
                <Button variant="outline" onClick={bootstrapDemo} disabled={bootstrapping}>
                  Demo connections
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
                  <div className="flex items-center gap-2 shrink-0">
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
