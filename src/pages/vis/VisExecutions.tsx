import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';

export default function VisExecutions() {
  const { id } = useParams();
  const [rows, setRows] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (id) {
      visApi
        .getExecution(id)
        .then(setDetail)
        .finally(() => setLoading(false));
    } else {
      visApi
        .listExecutions()
        .then(setRows)
        .finally(() => setLoading(false));
    }
  }, [id]);

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
    return (
      <VisPageShell>
        <VisPageHeader
          title="Execution"
          backTo="/vis/executions"
          backLabel="All executions"
          eyebrow="Versatile Integration Studio"
          actions={
            <>
              <Badge>{detail.status}</Badge>
              <Badge variant="outline" className="font-mono text-[10px] font-normal">
                {detail.correlationId?.slice(0, 12)}
              </Badge>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Read" value={detail.recordsRead} />
          <Stat label="Created" value={detail.recordsCreated} />
          <Stat label="Updated" value={detail.recordsUpdated} />
          <Stat label="Failed" value={detail.recordsFailed} />
        </div>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-base">Structured logs</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 space-y-2 font-mono text-xs">
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
        description="Stub and dry-run execution history for Integration Studio."
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
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {e.correlationId || e.id}
                    </span>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value ?? 0}</div>
    </div>
  );
}
