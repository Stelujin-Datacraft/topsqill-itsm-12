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

export default function ReProfilesPage() {
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
        const res = await reApi.listProfiles(orgId);
        if (!cancelled) setRows(res.profiles || []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load profiles');
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
        Persona shell (buyer / seller / dealer / builder). Create flows and form templates come next;
        Access Control users remain the system of record for login accounts.
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
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No RE profiles yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell>{String(row.display_name ?? '—')}</TableCell>
                  <TableCell>{String(row.profile_type ?? '—')}</TableCell>
                  <TableCell>{String(row.email ?? '—')}</TableCell>
                  <TableCell>{String(row.status ?? '—')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
