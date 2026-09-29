import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Plus,
  Activity,
  FileText,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Cable,
} from 'lucide-react';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';

async function loadStudio() {
  const sample = await visApi.ensureSampleStudio();
  const dashboard = sample?.dashboard || (await visApi.dashboard());
  const integrations = sample?.integrations || (await visApi.listIntegrations());
  return {
    ...dashboard,
    integrations,
    sampleIntegrationId: sample?.integration?.id || integrations?.[0]?.id || null,
    __clientMode: Boolean(dashboard?.__clientMode || sample?.__clientMode),
  };
}

export default function VisDashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudio()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load Integration Studio'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <VisPageShell>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading Integration Studio…
        </div>
      </VisPageShell>
    );
  }

  if (error) {
    return (
      <VisPageShell>
        <div className="max-w-lg space-y-4 py-8">
          <p className="text-destructive font-medium">{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              setLoading(true);
              loadStudio()
                .then(setData)
                .catch((e) => setError(e.message || 'Failed to load Integration Studio'))
                .finally(() => setLoading(false));
            }}
          >
            Retry
          </Button>
        </div>
      </VisPageShell>
    );
  }

  const tiles = [
    { label: 'Total', value: data.totalIntegrations, icon: FileText },
    { label: 'Active', value: data.active, icon: CheckCircle2 },
    { label: 'Draft', value: data.draft, icon: FileText },
    { label: 'Running', value: data.running, icon: Activity },
    { label: 'Successful', value: data.successful, icon: CheckCircle2 },
    { label: 'Failed', value: data.failed, icon: XCircle },
  ];

  const integrations = Array.isArray(data.integrations) ? data.integrations : [];
  const primaryIntegrationId = data.sampleIntegrationId || integrations[0]?.id;

  return (
    <VisPageShell>
      <VisPageHeader
        title="Dashboard"
        description="Prompt-first orchestration — never the system of record for target forms."
        actions={
          <>
            {primaryIntegrationId && (
              <Button variant="outline" asChild>
                <Link to={`/vis/integrations/${primaryIntegrationId}`}>
                  Open demo
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link to="/vis/new">
                <Plus className="h-4 w-4 mr-1.5" />
                New Integration
              </Link>
            </Button>
          </>
        }
      />

      <VisSubnav active="dashboard" />

      {data?.__clientMode && (
        <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Cable className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Local studio mode — Nest <code className="font-mono text-[11px]">/api/vis</code> is
            offline. Data stays in this browser until the API is available.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg border border-border/70 bg-card px-3.5 py-3"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
              {t.value ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 py-4 px-5">
            <CardTitle className="text-base font-semibold">Integrations</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-8 text-muted-foreground">
              <Link to="/vis/integrations">
                View all
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            {integrations.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">No integrations yet.</p>
                <Button size="sm" asChild>
                  <Link to="/vis/new">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create one
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/60 -mx-1">
                {integrations.slice(0, 6).map((row: any) => (
                  <li key={row.id}>
                    <Link
                      to={`/vis/integrations/${row.id}`}
                      className="flex items-start gap-3 rounded-md px-1 py-3.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium text-sm leading-snug">{row.name}</div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {row.design?.summary || row.promptText || 'No design yet'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          {row.design?.language && (
                            <Badge variant="secondary" className="font-normal text-[10px] px-1.5">
                              {row.design.language}
                            </Badge>
                          )}
                          <Badge variant="outline" className="font-normal text-[10px] px-1.5">
                            {row.status || 'DRAFT'}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-primary inline-flex items-center gap-0.5">
                          Open
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="py-4 px-5">
              <CardTitle className="text-base font-semibold">Recent executions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {(data.recentExecutions || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No executions yet.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {(data.recentExecutions || []).slice(0, 6).map((e: any) => (
                    <li key={e.id}>
                      <Link
                        to={`/vis/executions/${e.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-muted/40 -mx-1 px-1 rounded transition-colors"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {e.correlationId?.slice(0, 8) || e.id?.slice(0, 8)}
                        </span>
                        <Badge
                          variant={e.status === 'SUCCESS' ? 'secondary' : 'outline'}
                          className="font-normal text-[10px]"
                        >
                          {e.status}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-3 mt-1 border-t border-border/50">
                <Button variant="ghost" size="sm" asChild className="h-8 px-0 text-muted-foreground">
                  <Link to="/vis/executions">
                    All executions
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none">
            <CardHeader className="py-4 px-5">
              <CardTitle className="text-base font-semibold">Recent errors</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {(data.recentErrors || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No errors logged.</p>
              ) : (
                <ul className="space-y-3">
                  {(data.recentErrors || []).slice(0, 5).map((l: any) => (
                    <li key={l.id} className="text-sm">
                      <div className="font-medium text-destructive leading-snug">{l.message}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{l.step}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </VisPageShell>
  );
}
