import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Activity, FileText, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

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
      <div className="flex items-center justify-center p-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading Integration Studio…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-xl space-y-4">
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
    );
  }

  const tiles = [
    { label: 'Total Integrations', value: data.totalIntegrations, icon: FileText },
    { label: 'Active', value: data.active, icon: CheckCircle2 },
    { label: 'Draft', value: data.draft, icon: FileText },
    { label: 'Running', value: data.running, icon: Activity },
    { label: 'Successful', value: data.successful, icon: CheckCircle2 },
    { label: 'Failed', value: data.failed, icon: XCircle },
  ];

  const integrations = Array.isArray(data.integrations) ? data.integrations : [];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Versatile Integration Studio
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Prompt-first orchestration — never the system of record for target forms.
          </p>
        </div>
        <Button asChild>
          <Link to="/vis/new">
            <Plus className="h-4 w-4 mr-2" /> New Integration
          </Link>
        </Button>
      </div>

      {data?.__clientMode && (
        <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/40 px-3 py-2">
          Running in local studio mode — Nest <code className="font-mono">/api/vis</code> is offline.
          Data is kept in this browser until the API is available.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <Card key={t.label} className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tabular-nums">{t.value ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Integrations</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/vis/integrations">
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {integrations.length === 0 && (
            <p className="text-sm text-muted-foreground">No integrations yet.</p>
          )}
          {integrations.map((row: any) => (
            <Link
              key={row.id}
              to={`/vis/integrations/${row.id}`}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-3 px-1 rounded hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{row.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {row.design?.summary || row.promptText || 'No design yet'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.design?.language && (
                  <Badge variant="secondary" className="font-normal">
                    {row.design.language}
                  </Badge>
                )}
                <Badge variant="outline" className="font-normal">
                  {row.status || 'DRAFT'}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent executions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.recentExecutions || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No executions yet.</p>
            )}
            {(data.recentExecutions || []).map((e: any) => (
              <Link
                key={e.id}
                to={`/vis/executions/${e.id}`}
                className="flex justify-between text-sm border-b border-border/40 py-2 hover:bg-muted/40 px-1 rounded"
              >
                <span className="font-mono text-xs">{e.correlationId?.slice(0, 8)}</span>
                <span className="text-muted-foreground">{e.status}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent errors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.recentErrors || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No errors logged.</p>
            )}
            {(data.recentErrors || []).map((l: any) => (
              <div key={l.id} className="text-sm border-b border-border/40 py-2">
                <div className="font-medium text-destructive">{l.message}</div>
                <div className="text-xs text-muted-foreground">{l.step}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link to="/vis/integrations">All integrations</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/vis/connections">Connections</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/vis/executions">Executions</Link>
        </Button>
        {data.sampleIntegrationId && (
          <Button asChild>
            <Link to={`/vis/integrations/${data.sampleIntegrationId}`}>Open demo integration</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
