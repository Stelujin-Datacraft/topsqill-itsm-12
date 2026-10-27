import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrganization } from '@/contexts/OrganizationContext';
import { reApi } from '@/lib/re/api';
import { Loader2 } from 'lucide-react';

export default function ReListingsPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await reApi.listListings(orgId);
        if (!cancelled) setRows(res.listings || []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load listings');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Inventory shell. Listing create/edit and form-engine linking land in the next slice —
        this list only reads <code>re_listings</code>.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>City</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No listings yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell>{String(row.title ?? '—')}</TableCell>
                  <TableCell>{String(row.listing_kind ?? '—')}</TableCell>
                  <TableCell>{String(row.status ?? '—')}</TableCell>
                  <TableCell>{String(row.city ?? '—')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
