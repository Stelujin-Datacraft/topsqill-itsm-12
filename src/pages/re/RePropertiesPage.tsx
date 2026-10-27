import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';
import { reApi, type ReListing } from '@/lib/re/api';
import { Home, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatPrice(l: ReListing) {
  if (l.price == null) return 'Price on request';
  return `${l.currency || 'INR'} ${Number(l.price).toLocaleString('en-IN')}`;
}

export default function RePropertiesPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [params] = useSearchParams();
  const [listings, setListings] = useState<ReListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [purpose, setPurpose] = useState<string>('all');
  const [city, setCity] = useState('');

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reApi.listListings(orgId, 100);
      setListings(res.listings || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const filtered = useMemo(() => {
    const highlight = params.get('highlight');
    return listings
      .filter((l) => (l.status || 'active') === 'active' || l.status === 'draft')
      .filter((l) => (purpose === 'all' ? true : l.listing_type === purpose))
      .filter((l) =>
        city.trim()
          ? (l.city || '').toLowerCase().includes(city.trim().toLowerCase())
          : true,
      )
      .filter((l) => {
        if (!q.trim()) return true;
        const hay = `${l.title} ${l.locality || ''} ${l.city || ''} ${l.description || ''}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      })
      .sort((a, b) => {
        if (highlight && a.id === highlight) return -1;
        if (highlight && b.id === highlight) return 1;
        return 0;
      });
  }, [listings, q, purpose, city, params]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Properties</h2>
          <p className="text-sm text-muted-foreground">
            Marketplace discovery over your org inventory. Manage drafts in{' '}
            <Link to="/re/listings" className="text-primary underline">
              Listings CRM
            </Link>
            .
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/re/listings">Manage inventory</Link>
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 rounded-lg border bg-white dark:bg-card p-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Keyword"
          aria-label="Keyword search"
        />
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          aria-label="City filter"
        />
        <Select value={purpose} onValueChange={setPurpose}>
          <SelectTrigger>
            <SelectValue placeholder="Purpose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sale & rent</SelectItem>
            <SelectItem value="sale">Sale</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="secondary" onClick={() => void reload()}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading properties…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No properties match these filters.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <article
              key={l.id}
              className={cn(
                'rounded-lg border bg-white dark:bg-card overflow-hidden flex flex-col',
                params.get('highlight') === l.id && 'ring-2 ring-primary',
              )}
            >
              <div className="aspect-[16/10] bg-muted flex items-center justify-center">
                {l.cover_image_url ? (
                  <img
                    src={l.cover_image_url}
                    alt={l.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Home className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="p-3 space-y-1 flex-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {l.listing_type || 'listing'} · {l.status || 'active'}
                </div>
                <h3 className="font-semibold text-sm line-clamp-2">{l.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {[l.locality, l.city].filter(Boolean).join(', ') || 'Location TBD'}
                </p>
                <p className="text-sm font-semibold text-primary">{formatPrice(l)}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    l.bedrooms != null ? `${l.bedrooms} BHK` : null,
                    l.bathrooms != null ? `${l.bathrooms} bath` : null,
                    l.area_value != null ? `${l.area_value} ${l.area_unit || 'sqft'}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Specs TBD'}
                </p>
              </div>
              <div className="p-3 pt-0 flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link to="/re/leads">Enquire / CRM</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
