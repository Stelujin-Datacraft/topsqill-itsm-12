import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, XCircle, RotateCcw, FileWarning } from 'lucide-react';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';
import { useToast } from '@/hooks/use-toast';

function formatElapsed(startedAt?: string | null, completedAt?: string | null) {
  if (!startedAt) return '—';
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = Math.max(0, end - new Date(startedAt).getTime());
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function VisExecutions() {
  const { id } = useParams();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refreshDetail = useCallback(async () => {
    if (!id) return;
    const d = await visApi.getExecution(id);
    setDetail(d);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    if (id) {
      refreshDetail().finally(() => setLoading(false));
    } else {
      visApi
        .listExecutions()
        .then(setRows)
        .finally(() => setLoading(false));
    }
  }, [id, refreshDetail]);

  // Poll while running
  useEffect(() => {
    if (!id || !detail) return;
    const running = ['QUEUED', 'STARTING', 'RUNNING', 'COMPLETING', 'PAUSING', 'PAUSED'].includes(
      String(detail.status),
    );
    if (!running) return;
    const t = setInterval(() => {
      void refreshDetail();
    }, 1000);
    return () => clearInterval(t);
  }, [id, detail?.status, refreshDetail]);

  async function cancel() {
    if (!id) return;
    setBusy(true);
    try {
      await visApi.cancelExecution(id);
      await refreshDetail();
      toast({ title: 'Cancel requested' });
    } catch (e: any) {
      toast({ title: 'Cancel failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function retryFailed() {
    if (!id) return;
    setBusy(true);
    try {
      const next = await visApi.retryFailedExecution(id);
      toast({ title: 'Retry started', description: `Execution ${next.id}` });
      window.location.href = `/vis/executions/${next.id}`;
    } catch (e: any) {
      toast({ title: 'Retry failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
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

  if (id && detail) {
    const m = detail.metrics || {};
    const rpm =
      m.recordsPerSecond != null
        ? Math.round(Number(m.recordsPerSecond) * 60)
        : null;
    const canCancel = detail.actions?.canCancel;
    const canRetry = detail.actions?.canRetryFailed;
    const dead = detail.deadLetters || [];

    return (
      <VisPageShell>
        <VisPageHeader
          title="Execution Details"
          backTo="/vis/executions"
          backLabel="All executions"
          eyebrow="Versatile Integration Studio"
          actions={
            <>
              <Badge>{detail.status}</Badge>
              <Badge variant="outline" className="font-mono text-[10px] font-normal">
                {detail.correlationId}
              </Badge>
              {canCancel && (
                <Button size="sm" variant="destructive" onClick={cancel} disabled={busy}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              )}
              {canRetry && (
                <Button size="sm" variant="outline" onClick={retryFailed} disabled={busy}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry Failed
                </Button>
              )}
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Elapsed" value={formatElapsed(detail.startedAt, detail.completedAt)} />
          <Stat label="Workers" value={m.activeWorkers ?? '—'} />
          <Stat label="Queue" value={m.queueDepth ?? '—'} />
          <Stat
            label="Throughput"
            value={rpm != null ? `${rpm.toLocaleString()}/min` : '—'}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Stat label="Read" value={detail.recordsRead ?? 0} />
          <Stat label="Processed" value={detail.recordsProcessed ?? m.recordsProcessed ?? 0} />
          <Stat label="Created" value={detail.recordsCreated ?? 0} />
          <Stat label="Updated" value={detail.recordsUpdated ?? 0} />
          <Stat label="Failed" value={detail.recordsFailed ?? 0} />
        </div>

        {detail.errorMessage && (
          <Card className="border-destructive/40 mb-4 shadow-none">
            <CardContent className="px-5 py-3 text-sm text-destructive">
              {detail.errorCode && <span className="font-mono text-xs mr-2">[{detail.errorCode}]</span>}
              {detail.errorMessage}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 text-sm space-y-1.5">
              <Row k="Records/sec" v={m.recordsPerSecond != null ? Number(m.recordsPerSecond).toFixed(1) : '—'} />
              <Row k="Avg latency" v={m.averageLatencyMs != null ? `${Number(m.averageLatencyMs).toFixed(1)} ms` : '—'} />
              <Row k="P95" v={m.p95LatencyMs != null ? `${m.p95LatencyMs} ms` : '—'} />
              <Row k="P99" v={m.p99LatencyMs != null ? `${m.p99LatencyMs} ms` : '—'} />
              <Row k="Rate-limit responses" v={m.rateLimitResponses ?? 0} />
              <Row k="Auth refreshes" v={m.authenticationRefreshes ?? 0} />
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none">
            <CardHeader className="px-5 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Failed records</CardTitle>
              <FileWarning className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-2 max-h-56 overflow-auto">
              {dead.length === 0 && (
                <p className="text-sm text-muted-foreground">No dead-letter records.</p>
              )}
              {dead.map((d: any) => (
                <div key={d.id} className="text-xs border border-border/60 rounded-md px-3 py-2">
                  <div className="font-mono">{d.sourceRecord?.id || d.id}</div>
                  <div className="text-muted-foreground mt-0.5">
                    {d.errorCode}: {d.errorMessage}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-base">Structured logs</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 space-y-2 font-mono text-xs max-h-96 overflow-auto">
            {(detail.logs || []).length === 0 && (
              <p className="text-sm text-muted-foreground font-sans">No logs.</p>
            )}
            {(detail.logs || []).map((l: any) => (
              <div key={l.id} className="border border-border/60 rounded-md px-3 py-2 bg-muted/20">
                <span className="text-muted-foreground">{l.timestamp}</span>{' '}
                <Badge variant="outline" className="text-[10px] mx-1 font-sans">
                  {l.level}
                </Badge>
                <span className="text-muted-foreground">[{l.step}]</span> {l.message}
                {l.recordId && (
                  <span className="text-muted-foreground ml-2">record={l.recordId}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </VisPageShell>
    );
  }

  return (
    <VisPageShell>
      <VisPageHeader
        title="Executions"
        description="Live execution history for Integration Studio."
      />
      <VisSubnav active="executions" />

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground px-5 py-10 text-center">No executions yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/vis/executions/${e.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground truncate">
                        {e.correlationId || e.id}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        read {e.recordsRead ?? 0} · created {e.recordsCreated ?? 0} · failed{' '}
                        {e.recordsFailed ?? 0}
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-normal text-[10px] shrink-0">
                      {e.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </VisPageShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value ?? 0}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}
