import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { reApi, type ReAvailability, type ReOverview } from '@/lib/re/api';
import { Loader2 } from 'lucide-react';

export default function ReDashboard() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [availability, setAvailability] = useState<ReAvailability | null>(null);
  const [overview, setOverview] = useState<ReOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const avail = await reApi.availability();
        if (cancelled) return;
        setAvailability(avail);
        if (avail.enabled && avail.schemaReady && orgId) {
          const ov = await reApi.overview(orgId);
          if (!cancelled) setOverview(ov);
        } else {
          setOverview(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {availability && availability.schemaReady === false && (
        <Alert>
          <AlertTitle>Schema not applied yet</AlertTitle>
          <AlertDescription>
            Apply migration <code>20261027120000_re_leadgen_foundation.sql</code> on this
            environment’s Supabase. Until then, existing TopSqill features keep working;
            only Real Estate data APIs stay unavailable.
          </AlertDescription>
        </Alert>
      )}

      {!orgId && (
        <Alert>
          <AlertTitle>Select an organization</AlertTitle>
          <AlertDescription>Choose an organization to view lead-gen counts.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Open leads', value: overview?.openLeads },
          { label: 'All leads', value: overview?.leads },
          { label: 'Listings', value: overview?.listings },
          { label: 'Profiles', value: overview?.profiles },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {item.value === undefined || item.value === null ? '—' : item.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
