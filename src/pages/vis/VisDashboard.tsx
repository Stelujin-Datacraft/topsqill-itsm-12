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
  Trash2,
} from 'lucide-react';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';
import { useToast } from '@/hooks/use-toast';

async function loadStudio() {
  const [dashboard, integrations] = await Promise.all([
    visApi.dashboard(),
    visApi.listIntegrations(),
  ]);
  return {
    ...dashboard,
    integrations,
    __clientMode: Boolean(dashboard?.__clientMode),
  };
}

export default function VisDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadStudio()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load Integration Studio'))
      .finally(() => setLoading(false));
  }, []);

  async function resetStudioData() {
    if (
      !window.confirm(
        'Reset local Integration Studio cache? You will need to re-create CrowdStrike and Form API connections afterward.',
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await visApi.resetStudio();
      toast({ title: 'Studio reset', description: 'Ready for external third-party testing.' });
      setLoading(true);
      const next = await loadStudio();
      setData(next);
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setResetting(false);
      setLoading(false);
    }
  }

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

  return (
    <VisPageShell>
      <VisPageHeader
        title="Dashboard"
        description="Primary path: Connections → CrowdStrike + Form API → Map & execute. Describe (/vis/new) is optional for natural-language design."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/vis/connections">
                <Cable className="h-4 w-4 mr-1.5" />
                Connections
              </Link>
            </Button>
            {integrations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void resetStudioData()}
                disabled={resetting}
                title="Reset local studio cache"
              >
                {resetting ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1.5" />
                )}
                Reset studio
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
            Browser fallback — Nest <code className="font-mono text-[11px]">/api/vis</code> is
            offline. Connections still call your Mockoon / Form API URLs from this browser.
          </p>
        </div>
      )}

      {integrations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-card px-5 py-8 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Get started</p>
            <p className="text-sm text-muted-foreground max-w-xl">
              1) Add CrowdStrike Mockoon · 2) Add Form API target · 3) Map &amp; execute on the CrowdStrike row.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/vis/connections">
                <Cable className="h-4 w-4 mr-1.5" />
                Open Connections
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/vis/new">
                <Plus className="h-4 w-4 mr-1.5" />
                Describe instead
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </VisPageShell>
  );
}
