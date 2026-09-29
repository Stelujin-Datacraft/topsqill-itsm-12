import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function VisConnections() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setRows(await visApi.listConnections());
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function test(id: string) {
    try {
      const res = await visApi.testConnection(id);
      toast({
        title: res.ok ? 'Connection OK' : 'Connection failed',
        description: res.error || `HTTP ${res.status ?? 'n/a'}`,
        variant: res.ok ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    }
  }

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
        <div>
          <h1 className="text-2xl font-semibold">Connections</h1>
          <p className="text-sm text-muted-foreground">
            Credentials are referenced by opaque handles — never returned by the API.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/vis">Back</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No connections yet. Create demo connections from an integration design page.
          </p>
        )}
        {rows.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 border rounded-lg px-4 py-3"
          >
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {c.kind} · {c.authType} · {c.baseUrl}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{c.environment}</Badge>
              {c.hasCredential && <Badge variant="secondary">credential</Badge>}
              <Button size="sm" variant="outline" onClick={() => test(c.id)}>
                Test
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
