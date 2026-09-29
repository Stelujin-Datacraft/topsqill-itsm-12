import { useEffect, useState } from 'react';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';

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
      <VisPageShell>
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </VisPageShell>
    );
  }

  return (
    <VisPageShell>
      <VisPageHeader
        title="Connections"
        description="Credentials are referenced by opaque handles — never returned by the API."
      />
      <VisSubnav active="connections" />

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground px-5 py-10 text-center">
              No connections yet. Create demo connections from an integration design page.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground break-all">
                      {c.kind} · {c.authType}
                      {c.baseUrl ? ` · ${c.baseUrl}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="font-normal text-[10px]">
                      {c.environment}
                    </Badge>
                    {c.hasCredential && (
                      <Badge variant="secondary" className="font-normal text-[10px]">
                        credential
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => test(c.id)}>
                      Test
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </VisPageShell>
  );
}
