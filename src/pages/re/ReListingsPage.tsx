import { FormEvent, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { reApi, type ReListing, type ReProfile } from '@/lib/re/api';
import {
  RE_LISTING_KINDS,
  RE_LISTING_STATUSES,
  RE_LISTING_TYPES,
} from '@/lib/re/constants';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ReListingsPage() {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const orgId = currentOrganization?.id;
  const [rows, setRows] = useState<ReListing[]>([]);
  const [profiles, setProfiles] = useState<ReProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [listingKind, setListingKind] = useState('property');
  const [listingType, setListingType] = useState('sale');
  const [status, setStatus] = useState('draft');
  const [city, setCity] = useState('');
  const [locality, setLocality] = useState('');
  const [price, setPrice] = useState('');
  const [ownerProfileId, setOwnerProfileId] = useState<string>('none');

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setListingKind('property');
    setListingType('sale');
    setStatus('draft');
    setCity('');
    setLocality('');
    setPrice('');
    setOwnerProfileId('none');
  };

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [listingsRes, profilesRes] = await Promise.all([
        reApi.listListings(orgId),
        reApi.listProfiles(orgId),
      ]);
      setRows(listingsRes.listings || []);
      setProfiles(profilesRes.profiles || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load listings');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const startEdit = (row: ReListing) => {
    setEditingId(row.id);
    setTitle(row.title || '');
    setListingKind(row.listing_kind || 'property');
    setListingType(row.listing_type || 'sale');
    setStatus(row.status || 'draft');
    setCity(row.city || '');
    setLocality(row.locality || '');
    setPrice(row.price != null ? String(row.price) : '');
    setOwnerProfileId(row.owner_profile_id || 'none');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !title.trim()) return;
    setSaving(true);
    const payload = {
      organizationId: orgId,
      projectId: currentProject?.id || null,
      title: title.trim(),
      listingKind,
      listingType,
      status,
      city: city || null,
      locality: locality || null,
      price: price === '' ? null : Number(price),
      currency: 'INR',
      ownerProfileId: ownerProfileId === 'none' ? null : ownerProfileId,
    };
    try {
      if (editingId) {
        await reApi.updateListing(editingId, payload);
        toast({ title: 'Listing updated' });
      } else {
        await reApi.createListing(payload);
        toast({ title: 'Listing created' });
      }
      resetForm();
      await reload();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const ownerName = (id?: string | null) => {
    if (!id) return '—';
    const p = profiles.find((x) => x.id === id);
    return p?.display_name || id.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end max-w-6xl">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="re-listing-title">Title</Label>
          <Input
            id="re-listing-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 3BHK in Andheri West"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kind</Label>
          <Select value={listingKind} onValueChange={setListingKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RE_LISTING_KINDS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={listingType} onValueChange={setListingType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RE_LISTING_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RE_LISTING_STATUSES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-listing-city">City</Label>
          <Input id="re-listing-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-listing-locality">Locality</Label>
          <Input
            id="re-listing-locality"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-listing-price">Price (INR)</Label>
          <Input
            id="re-listing-price"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Owner profile</Label>
          <Select value={ownerProfileId} onValueChange={setOwnerProfileId}>
            <SelectTrigger>
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name} ({p.profile_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!orgId || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? 'Update' : 'Add listing'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>

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
              <TableHead>Price</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No listings yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>
                    {row.listing_kind}
                    {row.listing_type ? ` / ${row.listing_type}` : ''}
                  </TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.city || '—'}</TableCell>
                  <TableCell>
                    {row.price != null
                      ? `${row.currency || 'INR'} ${Number(row.price).toLocaleString()}`
                      : '—'}
                  </TableCell>
                  <TableCell>{ownerName(row.owner_profile_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(row)}>
                      Edit
                    </Button>
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
