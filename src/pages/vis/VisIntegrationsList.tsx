import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus } from 'lucide-react';

export default function VisIntegrationsList() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    visApi
      .listIntegrations()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <Button asChild>
          <Link to="/vis/new">
            <Plus className="h-4 w-4 mr-2" /> New
          </Link>
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No integrations yet.</p>
        )}
        {rows.map((r) => (
          <Link
            key={r.id}
            to={`/vis/integrations/${r.id}`}
            className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-muted/40"
          >
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">
                {r.promptText || r.description || r.id}
              </div>
            </div>
            <Badge variant="secondary">{r.status}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
