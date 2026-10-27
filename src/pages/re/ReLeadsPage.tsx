import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  reApi,
  type ReActivity,
  type ReAssignee,
  type ReLead,
  type ReListing,
} from '@/lib/re/api';
import { RE_LEAD_STATUSES } from '@/lib/re/constants';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

function assigneeLabel(u: ReAssignee) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return name || u.email || u.id.slice(0, 8);
}

export default function ReLeadsPage() {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const orgId = currentOrganization?.id;
  const [leads, setLeads] = useState<ReLead[]>([]);
  const [assignees, setAssignees] = useState<ReAssignee[]>([]);
  const [listings, setListings] = useState<ReListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ReActivity[]>([]);
  const [duplicates, setDuplicates] = useState<ReLead[]>([]);
  const [note, setNote] = useState('');
  const [busyLead, setBusyLead] = useState(false);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) || null,
    [leads, selectedId],
  );

  const assigneeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of assignees) m.set(u.id, assigneeLabel(u));
    return m;
  }, [assignees]);

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [leadsRes, assigneesRes, listingsRes] = await Promise.all([
        reApi.listLeads(orgId),
        reApi.listAssignees(orgId),
        reApi.listListings(orgId),
      ]);
      setLeads(leadsRes.leads || []);
      setAssignees(assigneesRes.users || []);
      setListings(listingsRes.listings || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async (leadId: string) => {
    if (!orgId) return;
    try {
      const res = await reApi.listLeadActivities(leadId, orgId);
      setActivities(res.activities || []);
    } catch {
      setActivities([]);
    }
  };

  const loadDuplicates = async (leadId: string) => {
    if (!orgId) return;
    try {
      const res = await reApi.listPossibleDuplicates(leadId, orgId);
      setDuplicates(res.duplicates || []);
    } catch {
      setDuplicates([]);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (selectedId) {
      void loadActivities(selectedId);
      void loadDuplicates(selectedId);
    } else {
      setActivities([]);
      setDuplicates([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, orgId]);

  const onMerge = async (mergedLeadId: string) => {
    if (!orgId || !selectedId) return;
    setBusyLead(true);
    try {
      await reApi.mergeLeads({
        organizationId: orgId,
        survivorLeadId: selectedId,
        mergedLeadId,
      });
      toast({ title: 'Leads merged' });
      await reload();
      await loadActivities(selectedId);
      await loadDuplicates(selectedId);
    } catch (err) {
      toast({
        title: 'Merge failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setBusyLead(false);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    try {
      const res = await reApi.createLead({
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
      if (res.lead?.id) setSelectedId(res.lead.id);
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

  const patchLead = async (patch: {
    status?: string;
    assignedTo?: string | null;
    listingId?: string | null;
  }) => {
    if (!orgId || !selectedId) return;
    setBusyLead(true);
    try {
      await reApi.updateLead(selectedId, { organizationId: orgId, ...patch });
      toast({ title: 'Lead updated' });
      await reload();
      await loadActivities(selectedId);
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setBusyLead(false);
    }
  };

  const onAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedId || !note.trim()) return;
    setBusyLead(true);
    try {
      const res = await reApi.addLeadNote(selectedId, orgId, note.trim());
      setActivities(res.activities || []);
      setNote('');
      toast({ title: 'Note added' });
      await reload();
    } catch (err) {
      toast({
        title: 'Could not add note',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setBusyLead(false);
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No leads yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className={
                        selectedId === lead.id
                          ? 'bg-muted/60 cursor-pointer'
                          : 'cursor-pointer hover:bg-muted/40'
                      }
                      onClick={() => setSelectedId(lead.id)}
                    >
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          <span>{lead.contact_name || '—'}</span>
                          {lead.is_re_enquiry ? (
                            <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              Re-enquired
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[lead.contact_email, lead.phone_e164 || lead.contact_phone]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{lead.status}</TableCell>
                      <TableCell>
                        {lead.assigned_to
                          ? assigneeMap.get(lead.assigned_to) || lead.assigned_to.slice(0, 8)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div>{lead.latest_source || lead.source}</div>
                        {lead.first_source && lead.first_source !== (lead.latest_source || lead.source) ? (
                          <div className="text-[10px] text-muted-foreground">
                            first: {lead.first_source}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-lg border p-4 space-y-4 min-h-[280px]">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a lead to update stage, assignee, and notes.</p>
          ) : (
            <>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <span>{selected.contact_name || 'Lead'}</span>
                  {selected.is_re_enquiry ? (
                    <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      Re-enquired
                    </span>
                  ) : null}
                </h3>
                <p className="text-xs text-muted-foreground break-all">{selected.id}</p>
                {(selected.first_source || selected.latest_source) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Attribution: first {selected.first_source || '—'} · latest{' '}
                    {selected.latest_source || selected.source}
                  </p>
                )}
                {selected.campaign_name && (
                  <p className="text-xs text-muted-foreground">
                    Campaign: {selected.campaign_name}
                    {selected.ad_name ? ` / ${selected.ad_name}` : ''}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Pipeline stage</Label>
                <Select
                  value={selected.status}
                  disabled={busyLead}
                  onValueChange={(status) => void patchLead({ status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RE_LEAD_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Select
                  value={selected.assigned_to || 'none'}
                  disabled={busyLead}
                  onValueChange={(v) =>
                    void patchLead({ assignedTo: v === 'none' ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {assignees.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {assigneeLabel(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Linked listing</Label>
                <Select
                  value={selected.listing_id || 'none'}
                  disabled={busyLead}
                  onValueChange={(v) =>
                    void patchLead({ listingId: v === 'none' ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {listings.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <form onSubmit={onAddNote} className="space-y-2">
                <Label htmlFor="re-lead-note">Add note</Label>
                <Textarea
                  id="re-lead-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Call summary, next step…"
                />
                <Button type="submit" size="sm" disabled={busyLead || !note.trim()}>
                  Save note
                </Button>
              </form>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Possible duplicates</h4>
                {duplicates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No fuzzy matches on name + locality.</p>
                ) : (
                  <ul className="space-y-2">
                    {duplicates.map((d) => (
                      <li
                        key={d.id}
                        className="text-xs flex items-start justify-between gap-2 border rounded p-2"
                      >
                        <div>
                          <div className="font-medium">{d.contact_name || '—'}</div>
                          <div className="text-muted-foreground">
                            {[d.contact_email, d.phone_e164 || d.contact_phone]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {d.id.slice(0, 8)}…
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyLead}
                          onClick={() => void onMerge(d.id)}
                        >
                          Merge
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Timeline</h4>
                {activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No activity yet.</p>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {activities.map((a) => (
                      <li key={a.id} className="text-xs border-l-2 pl-2">
                        <div className="font-medium capitalize">{a.activity_type.replace('_', ' ')}</div>
                        <div className="text-muted-foreground">{a.body}</div>
                        <div className="text-muted-foreground/80">
                          {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
