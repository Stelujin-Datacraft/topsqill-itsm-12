import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

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
      <div className="flex items-center justify-center p-16 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (id && detail) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/vis/executions">All executions</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Execution</h1>
        <div className="flex gap-2">
          <Badge>{detail.status}</Badge>
          <Badge variant="outline">correlation {detail.correlationId}</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Read" value={detail.recordsRead} />
          <Stat label="Created" value={detail.recordsCreated} />
          <Stat label="Updated" value={detail.recordsUpdated} />
          <Stat label="Failed" value={detail.recordsFailed} />
        </div>
        <h2 className="font-medium pt-4">Structured logs</h2>
        <div className="space-y-2 font-mono text-xs">
          {(detail.logs || []).map((l: any) => (
            <div key={l.id} className="border rounded px-3 py-2">
              <span className="text-muted-foreground">{l.timestamp}</span>{' '}
              <Badge variant="outline" className="text-[10px] mx-1">
                {l.level}
              </Badge>
              <span className="text-muted-foreground">[{l.step}]</span> {l.message}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Executions</h1>
        <Button variant="outline" asChild>
          <Link to="/vis">Dashboard</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No executions yet.</p>
        )}
        {rows.map((e) => (
          <Link
            key={e.id}
            to={`/vis/executions/${e.id}`}
            className="flex justify-between border rounded-lg px-4 py-3 hover:bg-muted/40"
          >
            <span className="font-mono text-xs">{e.correlationId}</span>
            <Badge variant="secondary">{e.status}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value ?? 0}</div>
    </div>
  );
}
