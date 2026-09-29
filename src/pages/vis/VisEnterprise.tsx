import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Activity, Boxes, Sparkles } from 'lucide-react';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';

export default function VisEnterprise() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    visApi
      .enterpriseDashboard()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load enterprise ops'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <VisPageShell>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading enterprise ops…
        </div>
      </VisPageShell>
    );
  }

  if (error) {
    return (
      <VisPageShell>
        <VisSubnav active="enterprise" />
        <p className="text-destructive font-medium py-8">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            setLoading(true);
            visApi
              .enterpriseDashboard()
              .then(setData)
              .catch((e) => setError(e.message || 'Failed'))
              .finally(() => setLoading(false));
          }}
        >
          Retry
        </Button>
      </VisPageShell>
    );
  }

  const health = data?.health?.status || 'UNKNOWN';
  const healthTone =
    health === 'HEALTHY'
      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
      : health === 'DEGRADED'
        ? 'bg-amber-500/15 text-amber-800 border-amber-500/30'
        : health === 'FAILING'
          ? 'bg-red-500/15 text-red-700 border-red-500/30'
          : 'bg-muted text-muted-foreground border-border';

  return (
    <VisPageShell>
      <VisPageHeader
        title="Enterprise operations"
        description="Governance, observability, drift, marketplace, and controlled AI recovery — Phases 5–10."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/vis">Studio home</Link>
          </Button>
        }
      />
      <VisSubnav active="enterprise" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" /> Platform health
          </div>
          <Badge variant="outline" className={healthTone}>
            {health}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {(data?.health?.reasons || []).join(' · ') || 'No issues reported'}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" /> Open alerts
          </div>
          <p className="text-2xl font-semibold tabular-nums">{data?.alerts?.length || 0}</p>
        </div>
        <div className="rounded-lg border border-border/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Boxes className="h-4 w-4" /> Connectors
          </div>
          <p className="text-2xl font-semibold tabular-nums">{data?.connectors || 0}</p>
        </div>
        <div className="rounded-lg border border-border/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" /> AI recommendations
          </div>
          <p className="text-2xl font-semibold tabular-nums">{data?.recommendations?.length || 0}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Recent AI recommendations</h2>
        {(data?.recommendations || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendations yet.</p>
        ) : (
          <ul className="space-y-2">
            {(data.recommendations as any[]).slice(0, 8).map((r) => (
              <li key={r.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.type}</span>
                  <Badge variant="outline">{r.status}</Badge>
                  <Badge variant="secondary">{r.confidence}</Badge>
                </div>
                <p className="text-muted-foreground mt-1">{r.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Drift findings</h2>
        {(data?.drift || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No drift reports stored.</p>
        ) : (
          <ul className="space-y-2">
            {(data.drift as any[]).slice(0, 5).map((d) => (
              <li key={d.id} className="text-sm border border-border/60 rounded-md px-3 py-2">
                Severity <Badge variant="outline">{d.maxSeverity || 'n/a'}</Badge>
                <span className="text-muted-foreground ml-2">
                  {Array.isArray(d.findings) ? d.findings.length : 0} finding(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </VisPageShell>
  );
}
