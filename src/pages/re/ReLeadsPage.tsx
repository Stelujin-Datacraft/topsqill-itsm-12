import { FormEvent, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject } from '@/contexts/ProjectContext';
import { reApi, type ReLead } from '@/lib/re/api';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ReLeadsPage() {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const orgId = currentOrganization?.id;
  const [leads, setLeads] = useState<ReLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reApi.listLeads(orgId);
      setLeads(res.leads || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    try {
      await reApi.createLead({
        organizationId: orgId,
        projectId: currentProject?.id || null,
        source: 'manual',
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
      });
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      toast({ title: 'Lead created' });
      await reload();
    } catch (err) {
      toast({
        title: 'Could not create lead',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-4 items-end max-w-4xl">
        <div className="space-y-1.5">
          <Label htmlFor="re-lead-name">Name</Label>
          <Input
            id="re-lead-name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-lead-email">Email</Label>
          <Input
            id="re-lead-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-lead-phone">Phone</Label>
          <Input
            id="re-lead-phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+91…"
          />
        </div>
        <Button type="submit" disabled={!orgId || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add lead'}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No leads yet. Create one above after the RE migration is applied.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-medium">{lead.contact_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {[lead.contact_email, lead.contact_phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </TableCell>
                  <TableCell>{lead.source}</TableCell>
                  <TableCell>{lead.status}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {lead.created_at ? new Date(lead.created_at).toLocaleString() : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
