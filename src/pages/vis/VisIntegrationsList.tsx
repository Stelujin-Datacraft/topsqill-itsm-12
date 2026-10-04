import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, ArrowRight, Trash2 } from 'lucide-react';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';
import { useToast } from '@/hooks/use-toast';

export default function VisIntegrationsList() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function reload() {
    setRows(await visApi.listIntegrations());
  }

  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function removeIntegration(id: string, name?: string) {
    if (
      !window.confirm(
        `Delete integration${name ? ` “${name}”` : ''}? This removes the design, mappings, and local execution history. Connections are kept.`,
      )
    ) {
      return;
    }
    setDeletingId(id);
    try {
      await visApi.deleteIntegration(id);
      toast({ title: 'Integration deleted' });
      await reload();
    } catch (e: any) {
      toast({
        title: 'Delete failed',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
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
        title="Integrations"
        description="An Integration is the runnable job (map fields → dry-run → execute). Connections are only the endpoints it uses."
        actions={
          <Button asChild>
            <Link to="/vis/new">
              <Plus className="h-4 w-4 mr-1.5" />
              New Integration
            </Link>
          </Button>
        }
      />
      <VisSubnav active="integrations" />
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="rounded-md border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
        Tip: create Connections first (CrowdStrike + Form API), then use{' '}
        <span className="text-foreground font-medium">Map &amp; execute</span> on the source — or start
        from New Integration here. Use the trash icon to delete a bad/test integration.
      </div>

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center space-y-3">
              <p className="text-sm text-muted-foreground mb-1">No integrations yet.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/vis/connections">Go to Connections</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/vis/new">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create one
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                >
                  <Link
                    to={`/vis/integrations/${r.id}`}
                    className="min-w-0 flex-1 space-y-1 hover:opacity-90"
                  >
                    <div className="font-medium text-sm">{r.name}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {r.promptText || r.description || r.design?.summary || r.id}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.design?.language && (
                      <Badge variant="secondary" className="font-normal text-[10px]">
                        {r.design.language}
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-normal text-[10px]">
                      {r.status}
                    </Badge>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/vis/integrations/${r.id}`}>
                        Open
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete integration"
                      disabled={deletingId === r.id}
                      onClick={() => void removeIntegration(r.id, r.name)}
                    >
                      {deletingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
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
