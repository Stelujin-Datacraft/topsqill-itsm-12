import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject } from '@/contexts/ProjectContext';
import {
  reApi,
  type ReFollowUpJob,
  type ReFollowUpRule,
  type ReIngestEvent,
  type ReSourceConfig,
} from '@/lib/re/api';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/services/api/apiClient';

const PROVIDER_LABELS: Record<string, string> = {
  website: 'Website form',
  meta_ads: 'Meta Lead Ads',
  google_ads: 'Google Ads lead forms',
  linkedin: 'LinkedIn Lead Gen Forms',
  portal_99acres: '99acres',
  portal_magicbricks: 'MagicBricks',
  portal_housing: 'Housing.com',
  portal_email: 'Portal email parse',
  call: 'Call / telephony',
};

function webhookUrl(provider: string, pathToken?: string | null) {
  if (!pathToken) return '—';
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/re/ingest/${provider}/${pathToken}`;
}

export default function ReSourcesPage() {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const orgId = currentOrganization?.id;
  const [sources, setSources] = useState<ReSourceConfig[]>([]);
  const [events, setEvents] = useState<ReIngestEvent[]>([]);
  const [rules, setRules] = useState<ReFollowUpRule[]>([]);
  const [jobs, setJobs] = useState<ReFollowUpJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState({
    delayMinutes: 15,
    subjectTemplate: 'Thanks for your interest, {{contact_name}}',
    bodyTemplate:
      'Hi {{contact_name}},\n\nThanks for reaching out. Our team will contact you shortly.\n\n— {{org_name}}',
  });

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      await reApi.ensureSources(orgId, currentProject?.id || null);
      const [src, ev, rl, jb] = await Promise.all([
        reApi.listSources(orgId),
        reApi.listIngestEvents(orgId),
        reApi.listFollowUpRules(orgId),
        reApi.listFollowUpJobs(orgId),
      ]);
      setSources(src.sources || []);
      setEvents(ev.events || []);
      setRules(rl.rules || []);
      setJobs(jb.jobs || []);
      if (rl.rules?.[0]) {
        setRuleDraft({
          delayMinutes: rl.rules[0].delay_minutes,
          subjectTemplate: rl.rules[0].subject_template,
          bodyTemplate: rl.rules[0].body_template,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const sortedSources = useMemo(
    () => [...sources].sort((a, b) => a.provider.localeCompare(b.provider)),
    [sources],
  );

  const toggleSource = async (provider: string, enabled: boolean) => {
    if (!orgId) return;
    try {
      await reApi.updateSource({ organizationId: orgId, provider, enabled });
      toast({ title: enabled ? 'Source enabled' : 'Source disabled' });
      await reload();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const rotateKey = async (provider: string) => {
    if (!orgId) return;
    try {
      await reApi.updateSource({ organizationId: orgId, provider, rotateIngestKey: true });
      toast({ title: 'Ingest key rotated' });
      await reload();
    } catch (e) {
      toast({
        title: 'Rotate failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const testSource = async (provider: string) => {
    if (!orgId) return;
    try {
      const res = await reApi.testIngest(orgId, provider);
      toast({
        title: 'Test lead created',
        description: res.lead?.id ? `Lead ${res.lead.id.slice(0, 8)}…` : 'OK',
      });
      await reload();
    } catch (e) {
      toast({
        title: 'Test failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const saveRule = async () => {
    if (!orgId) return;
    try {
      await reApi.upsertFollowUpRule({
        organizationId: orgId,
        id: rules[0]?.id,
        enabled: true,
        name: rules[0]?.name || 'First-touch email',
        delayMinutes: ruleDraft.delayMinutes,
        subjectTemplate: ruleDraft.subjectTemplate,
        bodyTemplate: ruleDraft.bodyTemplate,
      });
      toast({ title: 'Follow-up rule saved' });
      await reload();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const processNow = async () => {
    try {
      const res = await reApi.processFollowUpsNow();
      toast({
        title: 'Follow-ups processed',
        description: `sent ${res.sent}, failed ${res.failed}`,
      });
      await reload();
    } catch (e) {
      toast({
        title: 'Process failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Lead sources (end-to-end ingest)</h2>
        <p className="text-sm text-muted-foreground">
          Enable a provider, copy its webhook URL + ingest key into Meta / Google / LinkedIn / portal
          tools. Website forms POST JSON to the website URL with header{' '}
          <code>X-Re-Ingest-Key</code>.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSources.map((s) => {
            const url = webhookUrl(s.provider, s.webhook_path_token);
            return (
              <div key={s.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {PROVIDER_LABELS[s.provider] || s.provider}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.provider}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!s.enabled}
                        onCheckedChange={(v) => void toggleSource(s.provider, v)}
                      />
                      <span className="text-sm">{s.enabled ? 'On' : 'Off'}</span>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => void testSource(s.provider)}>
                      Send test lead
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={url} className="font-mono text-xs" />
                    <Button type="button" variant="secondary" onClick={() => void copy(url)}>
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Ingest key</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={s.ingest_key || ''} className="font-mono text-xs" />
                      <Button type="button" variant="secondary" onClick={() => void rotateKey(s.provider)}>
                        Rotate
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Verify token (Meta hub.verify_token)</Label>
                    <Input readOnly value={s.verify_token || ''} className="font-mono text-xs" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3 max-w-3xl">
        <h2 className="text-lg font-semibold">Automated email follow-up</h2>
        <p className="text-sm text-muted-foreground">
          Uses org SMTP from Email configuration. Placeholders: {'{{contact_name}}'}, {'{{org_name}}'},{' '}
          {'{{source}}'}.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Delay (minutes)</Label>
            <Input
              type="number"
              min={0}
              value={ruleDraft.delayMinutes}
              onChange={(e) =>
                setRuleDraft((d) => ({ ...d, delayMinutes: Number(e.target.value) || 0 }))
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Input
            value={ruleDraft.subjectTemplate}
            onChange={(e) => setRuleDraft((d) => ({ ...d, subjectTemplate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Body</Label>
          <Textarea
            rows={5}
            value={ruleDraft.bodyTemplate}
            onChange={(e) => setRuleDraft((d) => ({ ...d, bodyTemplate: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => void saveRule()}>
            Save rule
          </Button>
          <Button type="button" variant="outline" onClick={() => void processNow()}>
            Process due follow-ups now
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Recent ingest events</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lead</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No ingest events yet. Use “Send test lead”.
                </TableCell>
              </TableRow>
            ) : (
              events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">
                    {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>{e.provider}</TableCell>
                  <TableCell>{e.status}</TableCell>
                  <TableCell className="font-mono text-xs">{e.lead_id?.slice(0, 8) || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Follow-up jobs</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run at</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No jobs yet.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-xs">
                    {j.run_at ? new Date(j.run_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>{j.status}</TableCell>
                  <TableCell className="font-mono text-xs">{j.lead_id?.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{j.last_error || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
