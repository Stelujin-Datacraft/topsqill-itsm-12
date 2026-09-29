import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, ArrowRight } from 'lucide-react';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';

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
        description="All integration designs in this studio."
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

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground mb-3">No integrations yet.</p>
              <Button size="sm" asChild>
                <Link to="/vis/new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create one
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/vis/integrations/${r.id}`}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-sm">{r.name}</div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {r.promptText || r.description || r.design?.summary || r.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.design?.language && (
                        <Badge variant="secondary" className="font-normal text-[10px]">
                          {r.design.language}
                        </Badge>
                      )}
                      <Badge variant="outline" className="font-normal text-[10px]">
                        {r.status}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
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
