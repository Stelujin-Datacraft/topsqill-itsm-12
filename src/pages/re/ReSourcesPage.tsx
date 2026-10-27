import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  type ReOrgSettings,
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

const META_FIELD_TARGETS = [
  { value: 'full_name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone_number', label: 'Phone' },
  { value: 'city', label: 'City' },
  { value: 'custom:budget', label: 'Custom: budget' },
  { value: 'custom:locality', label: 'Custom: locality' },
  { value: 'custom:bhk', label: 'Custom: BHK' },
  { value: 'custom:timeline', label: 'Custom: timeline' },
  { value: 'custom:other', label: 'Custom: other' },
];

function webhookUrl(provider: string, pathToken?: string | null) {
  if (!pathToken) return '—';
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/re/ingest/${provider}/${pathToken}`;
}

function enrichLabel(status?: string | null) {
  if (!status || status === 'none') return '—';
  return status;
}

export default function ReSourcesPage() {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const orgId = currentOrganization?.id;
  const [sources, setSources] = useState<ReSourceConfig[]>([]);
  const [events, setEvents] = useState<ReIngestEvent[]>([]);
  const [rules, setRules] = useState<ReFollowUpRule[]>([]);
  const [jobs, setJobs] = useState<ReFollowUpJob[]>([]);
  const [orgSettings, setOrgSettings] = useState<ReOrgSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState({
    delayMinutes: 15,
    subjectTemplate: 'Thanks for your interest, {{contact_name}}',
    bodyTemplate:
      'Hi {{contact_name}},\n\nThanks for reaching out. Our team will contact you shortly.\n\n— {{org_name}}',
  });
  const [metaCreds, setMetaCreds] = useState({
    accessToken: '',
    appSecret: '',
    pageId: '',
    formIdExternal: '',
    graphApiVersion: 'v21.0',
  });
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [newQuestion, setNewQuestion] = useState('');
  const [backfill, setBackfill] = useState({ since: '', until: '' });
  const [settingsDraft, setSettingsDraft] = useState({
    defaultCountryCode: '+91',
    dedupeWindowDays: 90,
  });

  const metaSource = useMemo(
    () => sources.find((s) => s.provider === 'meta_ads') || null,
    [sources],
  );

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      await reApi.ensureSources(orgId, currentProject?.id || null);
      const [src, ev, rl, jb, settings] = await Promise.all([
        reApi.listSources(orgId),
        reApi.listIngestEvents(orgId),
        reApi.listFollowUpRules(orgId),
        reApi.listFollowUpJobs(orgId),
        reApi.getOrgSettings(orgId).catch(() => ({ settings: null as ReOrgSettings | null })),
      ]);
      setSources(src.sources || []);
      setEvents(ev.events || []);
      setRules(rl.rules || []);
      setJobs(jb.jobs || []);
      if (settings.settings) {
        setOrgSettings(settings.settings);
        setSettingsDraft({
          defaultCountryCode: settings.settings.default_country_code || '+91',
          dedupeWindowDays: settings.settings.dedupe_window_days || 90,
        });
      }
      const meta = (src.sources || []).find((s) => s.provider === 'meta_ads');
      if (meta) {
        setMetaCreds((d) => ({
          ...d,
          pageId: meta.page_id || '',
          formIdExternal: meta.form_id_external || '',
          graphApiVersion: meta.graph_api_version || 'v21.0',
          accessToken: '',
          appSecret: '',
        }));
        setMappingDraft(meta.field_mappings || {});
      }
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

  const saveMetaConfig = async () => {
    if (!orgId) return;
    try {
      await reApi.updateSource({
        organizationId: orgId,
        provider: 'meta_ads',
        pageId: metaCreds.pageId || null,
        formIdExternal: metaCreds.formIdExternal || null,
        graphApiVersion: metaCreds.graphApiVersion || 'v21.0',
        ...(metaCreds.accessToken ? { accessToken: metaCreds.accessToken } : {}),
        ...(metaCreds.appSecret ? { appSecret: metaCreds.appSecret } : {}),
        clearNeedsReauth: true,
      });
      toast({ title: 'Meta source config saved' });
      setMetaCreds((d) => ({ ...d, accessToken: '', appSecret: '' }));
      await reload();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const saveMappings = async () => {
    if (!orgId) return;
    try {
      await reApi.updateMetaFieldMappings(orgId, mappingDraft);
      toast({ title: 'Field mappings saved' });
      await reload();
    } catch (e) {
      toast({
        title: 'Mapping save failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const fetchMissed = async () => {
    if (!orgId) return;
    try {
      const res = await reApi.fetchMissedMetaLeads({
        organizationId: orgId,
        formId: metaCreds.formIdExternal || undefined,
        since: backfill.since || undefined,
        until: backfill.until || undefined,
      });
      toast({
        title: 'Fetch missed queued',
        description: `Enqueued ${res.enqueued} lead(s) across ${res.pages} page(s)`,
      });
      await reload();
    } catch (e) {
      toast({
        title: 'Fetch missed failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const processEnrichment = async () => {
    try {
      const res = await reApi.processEnrichmentNow();
      toast({
        title: 'Enrichment processed',
        description: `processed ${res.processed}, ok ${res.succeeded}, failed ${res.failed}`,
      });
      await reload();
    } catch (e) {
      toast({
        title: 'Enrichment process failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const saveOrgSettings = async () => {
    if (!orgId) return;
    try {
      await reApi.upsertOrgSettings({
        organizationId: orgId,
        defaultCountryCode: settingsDraft.defaultCountryCode,
        dedupeWindowDays: settingsDraft.dedupeWindowDays,
      });
      toast({ title: 'Org RE settings saved' });
      await reload();
    } catch (e) {
      toast({
        title: 'Settings save failed',
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
                {s.needs_reauth && (
                  <Alert variant="destructive">
                    <AlertTitle>Needs re-authorization</AlertTitle>
                    <AlertDescription>
                      {s.reauth_reason ||
                        'Page access token expired or missing leads_retrieval. Re-paste the token below and save.'}
                    </AlertDescription>
                  </Alert>
                )}
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

      {metaSource && (
        <div className="space-y-4 max-w-3xl rounded-lg border p-4">
          <div>
            <h2 className="text-lg font-semibold">Meta Lead Ads enrichment</h2>
            <p className="text-sm text-muted-foreground">
              Paste Page access token + App Secret. Webhooks return 200 immediately; Graph enrichment
              runs via cron (<code>RE_LEADGEN_META_ENRICH</code>).
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Page access token</Label>
              <Input
                type="password"
                value={metaCreds.accessToken}
                onChange={(e) => setMetaCreds((d) => ({ ...d, accessToken: e.target.value }))}
                placeholder="Paste to update"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>App secret (X-Hub-Signature-256)</Label>
              <Input
                type="password"
                value={metaCreds.appSecret}
                onChange={(e) => setMetaCreds((d) => ({ ...d, appSecret: e.target.value }))}
                placeholder="Paste to update"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Page ID</Label>
              <Input
                value={metaCreds.pageId}
                onChange={(e) => setMetaCreds((d) => ({ ...d, pageId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default form ID</Label>
              <Input
                value={metaCreds.formIdExternal}
                onChange={(e) => setMetaCreds((d) => ({ ...d, formIdExternal: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Graph API version</Label>
              <Input
                value={metaCreds.graphApiVersion}
                onChange={(e) => setMetaCreds((d) => ({ ...d, graphApiVersion: e.target.value }))}
                placeholder="v21.0"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveMetaConfig()}>
              Save Meta config
            </Button>
            <Button type="button" variant="outline" onClick={() => void processEnrichment()}>
              Process enrichment jobs now
            </Button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <h3 className="font-medium">Field mapping</h3>
            <p className="text-xs text-muted-foreground">
              Map each Meta form question to a lead field or custom attribute.
            </p>
            {Object.keys(mappingDraft).length === 0 ? (
              <p className="text-xs text-muted-foreground">No mappings yet — add a question below.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(mappingDraft).map(([q, target]) => (
                  <div key={q} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Meta question</Label>
                      <Input readOnly value={q} className="text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Maps to</Label>
                      <Select
                        value={target}
                        onValueChange={(v) =>
                          setMappingDraft((m) => ({ ...m, [q]: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {META_FIELD_TARGETS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setMappingDraft((m) => {
                          const next = { ...m };
                          delete next[q];
                          return next;
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Add question key</Label>
                <Input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="e.g. what_is_your_budget"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const q = newQuestion.trim();
                  if (!q) return;
                  setMappingDraft((m) => ({ ...m, [q]: m[q] || 'custom:other' }));
                  setNewQuestion('');
                }}
              >
                Add
              </Button>
              <Button type="button" onClick={() => void saveMappings()}>
                Save mappings
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <h3 className="font-medium">Fetch missed leads</h3>
            <p className="text-xs text-muted-foreground">
              Pulls <code>GET /{'{form_id}'}/leads</code> (paginated) and enqueues the same enrichment
              pipeline.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Since (ISO date)</Label>
                <Input
                  value={backfill.since}
                  onChange={(e) => setBackfill((d) => ({ ...d, since: e.target.value }))}
                  placeholder="2026-01-01T00:00:00Z"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Until (ISO date)</Label>
                <Input
                  value={backfill.until}
                  onChange={(e) => setBackfill((d) => ({ ...d, until: e.target.value }))}
                  placeholder="optional"
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => void fetchMissed()}>
              Fetch missed leads
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3 max-w-3xl">
        <h2 className="text-lg font-semibold">Normalisation & de-dupe</h2>
        <p className="text-sm text-muted-foreground">
          Shared E.164 / email / name / budget normalisation for all sources. De-dupe window gated by{' '}
          <code>RE_LEADGEN_DEDUPE</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Default country code</Label>
            <Input
              value={settingsDraft.defaultCountryCode}
              onChange={(e) =>
                setSettingsDraft((d) => ({ ...d, defaultCountryCode: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dedupe window (days)</Label>
            <Input
              type="number"
              min={1}
              value={settingsDraft.dedupeWindowDays}
              onChange={(e) =>
                setSettingsDraft((d) => ({
                  ...d,
                  dedupeWindowDays: Number(e.target.value) || 90,
                }))
              }
            />
          </div>
        </div>
        <Button type="button" onClick={() => void saveOrgSettings()}>
          Save org settings
        </Button>
        {orgSettings && (
          <p className="text-xs text-muted-foreground">
            Current: {orgSettings.default_country_code}, {orgSettings.dedupe_window_days}d window
          </p>
        )}
      </div>

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
              <TableHead>Enrichment</TableHead>
              <TableHead>Lead</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
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
                  <TableCell className="text-xs">
                    <div>{enrichLabel(e.enrichment_status)}</div>
                    {e.enrichment_error ? (
                      <div className="text-destructive max-w-[220px] truncate" title={e.enrichment_error}>
                        {e.enrichment_error}
                      </div>
                    ) : null}
                  </TableCell>
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
