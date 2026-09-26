import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/contexts/ProjectContext';
import {
  CONNECTOR_AUTH_OPTIONS,
  CONNECTOR_MODE_OPTIONS,
  CONNECTOR_PROVIDER_OPTIONS,
  emptyConnectorForm,
  type ConnectorAuthType,
  type ConnectorProvider,
  type OutboundConnector,
  type OutboundConnectorFormData,
} from '@/types/outboundConnector';

interface ConnectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connector?: OutboundConnector | null;
  onSave: (data: OutboundConnectorFormData) => Promise<boolean>;
}

export function ConnectorDialog({
  open,
  onOpenChange,
  connector,
  onSave,
}: ConnectorDialogProps) {
  const { projects, currentProject } = useProject();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OutboundConnectorFormData>(emptyConnectorForm());

  useEffect(() => {
    if (!open) return;
    if (connector) {
      setForm({
        name: connector.name,
        description: connector.description || '',
        provider: (connector.provider as ConnectorProvider) || 'generic_http',
        mode: connector.mode,
        base_url: connector.base_url || '',
        auth_type: connector.auth_type,
        credentials: { ...connector.credentials },
        headers: { ...connector.headers },
        schedule_cron: connector.schedule_cron || '',
        project_id: connector.project_id,
        is_active: connector.is_active,
      });
      return;
    }
    const blank = emptyConnectorForm();
    blank.project_id = currentProject?.id || null;
    setForm(blank);
    // Only re-seed when dialog opens or the edited connector changes — not when
    // currentProject identity flickers (that was wiping in-progress input).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, connector]);

  const setCred = (patch: Partial<OutboundConnectorFormData['credentials']>) => {
    setForm((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, ...patch },
    }));
  };

  const handleProviderChange = (provider: ConnectorProvider) => {
    const meta = CONNECTOR_PROVIDER_OPTIONS.find((p) => p.value === provider);
    setForm((prev) => ({
      ...prev,
      provider,
      auth_type: meta?.defaultAuth || prev.auth_type,
      base_url: prev.base_url || meta?.defaultUrl || '',
    }));
  };

  const handleAuthChange = (auth_type: ConnectorAuthType) => {
    setForm((prev) => ({ ...prev, auth_type }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const ok = await onSave(form);
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const showApiKey = form.auth_type === 'api_key' || form.auth_type === 'custom';
  const showBasic = form.auth_type === 'basic' || form.auth_type === 'custom';
  const showBearer = form.auth_type === 'bearer' || form.auth_type === 'custom';
  const showOAuth = form.auth_type === 'oauth_client' || form.auth_type === 'custom';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {connector ? 'Edit connector' : 'Add outbound connector'}
          </DialogTitle>
          <DialogDescription>
            Connect Topsqill to a third-party tool. Fields change based on auth type
            (API key, username/password, OAuth client secret, etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="connector-name">Name *</Label>
            <Input
              id="connector-name"
              placeholder="e.g. Salesforce production"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="connector-desc">Description</Label>
            <Textarea
              id="connector-desc"
              placeholder="What this connection is used for"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="min-h-[70px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Third-party tool</Label>
            <Select
              value={form.provider}
              onValueChange={(v) => handleProviderChange(v as ConnectorProvider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTOR_PROVIDER_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex flex-col">
                      <span>{p.label}</span>
                      <span className="text-xs text-muted-foreground">{p.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Integration type</Label>
            <RadioGroup
              value={form.mode}
              onValueChange={(v) => setForm((p) => ({ ...p, mode: v as OutboundConnectorFormData['mode'] }))}
              className="grid gap-3"
            >
              {CONNECTOR_MODE_OPTIONS.map((m) => (
                <label
                  key={m.value}
                  htmlFor={`mode-${m.value}`}
                  className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40"
                >
                  <RadioGroupItem value={m.value} id={`mode-${m.value}`} className="mt-1" />
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {m.label}
                      {form.mode === m.value && <Badge variant="secondary">Selected</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {form.mode === 'batch' && (
            <div className="space-y-2">
              <Label htmlFor="connector-cron">Schedule (cron, optional)</Label>
              <Input
                id="connector-cron"
                placeholder="e.g. 0 */6 * * * (every 6 hours)"
                value={form.schedule_cron}
                onChange={(e) => setForm((p) => ({ ...p, schedule_cron: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="connector-url">Base URL / endpoint</Label>
            <Input
              id="connector-url"
              placeholder="https://api.example.com"
              value={form.base_url}
              onChange={(e) => setForm((p) => ({ ...p, base_url: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Authentication</Label>
            <Select
              value={form.auth_type}
              onValueChange={(v) => handleAuthChange(v as ConnectorAuthType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTOR_AUTH_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label} — {a.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showApiKey && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api-key-header">API key header</Label>
                <Input
                  id="api-key-header"
                  placeholder="x-api-key"
                  value={form.credentials.apiKeyHeader || ''}
                  onChange={(e) => setCred({ apiKeyHeader: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key-value">API key / secret key</Label>
                <Input
                  id="api-key-value"
                  type="password"
                  autoComplete="off"
                  placeholder="••••••••"
                  value={form.credentials.apiKeyValue || ''}
                  onChange={(e) => setCred({ apiKeyValue: e.target.value })}
                />
              </div>
            </div>
          )}

          {showBasic && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conn-username">Username</Label>
                <Input
                  id="conn-username"
                  autoComplete="off"
                  value={form.credentials.username || ''}
                  onChange={(e) => setCred({ username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-password">Password</Label>
                <Input
                  id="conn-password"
                  type="password"
                  autoComplete="off"
                  value={form.credentials.password || ''}
                  onChange={(e) => setCred({ password: e.target.value })}
                />
              </div>
            </div>
          )}

          {showBearer && (
            <div className="space-y-2">
              <Label htmlFor="conn-token">Bearer token</Label>
              <Input
                id="conn-token"
                type="password"
                autoComplete="off"
                value={form.credentials.token || ''}
                onChange={(e) => setCred({ token: e.target.value })}
              />
            </div>
          )}

          {showOAuth && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-id">Client ID</Label>
                <Input
                  id="client-id"
                  autoComplete="off"
                  value={form.credentials.clientId || ''}
                  onChange={(e) => setCred({ clientId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-secret">Client secret</Label>
                <Input
                  id="client-secret"
                  type="password"
                  autoComplete="off"
                  value={form.credentials.clientSecret || ''}
                  onChange={(e) => setCred({ clientSecret: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="token-url">Token URL</Label>
                <Input
                  id="token-url"
                  placeholder="https://.../oauth/token"
                  value={form.credentials.tokenUrl || ''}
                  onChange={(e) => setCred({ tokenUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="scopes">Scopes (optional)</Label>
                <Input
                  id="scopes"
                  placeholder="api refresh_token"
                  value={form.credentials.scopes || ''}
                  onChange={(e) => setCred({ scopes: e.target.value })}
                />
              </div>
            </div>
          )}

          {form.auth_type === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="extra-json">Extra config (JSON, optional)</Label>
              <Textarea
                id="extra-json"
                placeholder='{"tenantId":"..."}'
                className="font-mono text-xs min-h-[70px]"
                value={form.credentials.extraJson || ''}
                onChange={(e) => setCred({ extraJson: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Project (optional)</Label>
            <Select
              value={form.project_id || '__org__'}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, project_id: v === '__org__' ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Organization-wide" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__org__">Organization-wide</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive connectors are ignored by workflows and jobs</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, is_active: checked }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : connector ? 'Save changes' : 'Create connector'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
