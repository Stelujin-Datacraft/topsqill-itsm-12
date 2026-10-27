import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { reApi, type ReListing, type RePost, type ReProfile } from '@/lib/re/api';
import { toast } from '@/hooks/use-toast';
import { Heart, Loader2, MessageCircle, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

function PropertyCardMini({ listing }: { listing: ReListing }) {
  return (
    <Link
      to={`/re/properties?highlight=${listing.id}`}
      className="mt-3 flex gap-3 rounded-lg border bg-background overflow-hidden hover:bg-muted/40"
    >
      <div className="w-28 h-24 bg-muted shrink-0 flex items-center justify-center">
        {listing.cover_image_url ? (
          <img src={listing.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Home className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="py-2 pr-3 min-w-0">
        <div className="font-medium text-sm truncate">{listing.title}</div>
        <div className="text-xs text-muted-foreground truncate">
          {[listing.locality, listing.city].filter(Boolean).join(', ') || '—'}
        </div>
        <div className="text-sm font-semibold text-primary mt-1">
          {listing.price != null
            ? `${listing.currency || 'INR'} ${Number(listing.price).toLocaleString('en-IN')}`
            : 'Price on request'}
        </div>
      </div>
    </Link>
  );
}

export default function ReHomeFeed() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const orgId = currentOrganization?.id;
  const [posts, setPosts] = useState<RePost[]>([]);
  const [profiles, setProfiles] = useState<ReProfile[]>([]);
  const [listings, setListings] = useState<ReListing[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, { id: string; body: string; created_at: string }[]>>({});

  const myProfile = profiles.find((p) => p.user_id === user?.id) || profiles[0];

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [feed, prof, list] = await Promise.all([
        reApi.networkFeed(orgId),
        reApi.listProfiles(orgId),
        reApi.listListings(orgId),
      ]);
      setPosts(feed.posts || []);
      setProfiles(prof.profiles || []);
      setListings((list.listings || []).filter((l) => l.status === 'active').slice(0, 5));
    } catch (e) {
      toast({
        title: 'Could not load feed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const onPost = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !draft.trim()) return;
    setPosting(true);
    try {
      await reApi.createPost({
        organizationId: orgId,
        body: draft.trim(),
        authorProfileId: myProfile?.id || null,
      });
      setDraft('');
      toast({ title: 'Post published' });
      await reload();
    } catch (err) {
      toast({
        title: 'Post failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setPosting(false);
    }
  };

  const onReact = async (postId: string) => {
    if (!orgId) return;
    try {
      await reApi.reactToPost(postId, orgId);
      await reload();
    } catch (err) {
      toast({
        title: 'Reaction failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const toggleComments = async (postId: string) => {
    const next = !openComments[postId];
    setOpenComments((s) => ({ ...s, [postId]: next }));
    if (next && orgId) {
      try {
        const res = await reApi.listComments(postId, orgId);
        setComments((c) => ({ ...c, [postId]: res.comments || [] }));
      } catch {
        /* ignore */
      }
    }
  };

  const submitComment = async (postId: string) => {
    if (!orgId) return;
    const body = (commentDrafts[postId] || '').trim();
    if (!body) return;
    try {
      await reApi.addComment(postId, orgId, body);
      setCommentDrafts((d) => ({ ...d, [postId]: '' }));
      const res = await reApi.listComments(postId, orgId);
      setComments((c) => ({ ...c, [postId]: res.comments || [] }));
      await reload();
    } catch (err) {
      toast({
        title: 'Comment failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
      {/* Left profile column */}
      <aside className="space-y-3 hidden lg:block">
        <div className="rounded-lg border bg-white dark:bg-card overflow-hidden">
          <div className="h-14 bg-gradient-to-r from-primary/30 to-primary/10" />
          <div className="px-4 pb-4 -mt-6">
            <div className="h-14 w-14 rounded-full border-2 border-white bg-muted grid place-items-center text-lg font-semibold">
              {(myProfile?.display_name || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="mt-2 font-semibold text-sm">
              {myProfile?.display_name || user?.email || 'Your profile'}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {myProfile?.headline || 'Complete your professional profile'}
            </div>
            {myProfile && (
              <Link to={`/re/u/${myProfile.id}`} className="text-xs text-primary mt-2 inline-block">
                View profile
              </Link>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-white dark:bg-card p-3 text-xs space-y-2">
          <div className="font-medium text-sm">Shortcuts</div>
          <Link className="block text-muted-foreground hover:text-foreground" to="/re/leads">
            CRM inbox
          </Link>
          <Link className="block text-muted-foreground hover:text-foreground" to="/re/listings">
            Manage listings
          </Link>
          <Link className="block text-muted-foreground hover:text-foreground" to="/re/sources">
            Lead sources
          </Link>
          <Link className="block text-muted-foreground hover:text-foreground" to="/re/network">
            Grow your network
          </Link>
        </div>
      </aside>

      {/* Center feed */}
      <section className="space-y-3 min-w-0">
        <form onSubmit={onPost} className="rounded-lg border bg-white dark:bg-card p-3 space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Start a post about a listing, market update, or open house…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={posting || !draft.trim()}>
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading feed…
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border bg-white dark:bg-card p-8 text-center text-sm text-muted-foreground">
            No posts yet. Share your first update or publish a property listing.
          </div>
        ) : (
          posts.map((p) => (
            <article key={p.id} className="rounded-lg border bg-white dark:bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-muted grid place-items-center text-sm font-semibold shrink-0">
                  {(p.author?.display_name || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">
                    {p.author?.display_name || 'Professional'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.author?.headline || p.post_type}
                    {' · '}
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{p.body}</p>
              {p.listing ? <PropertyCardMini listing={p.listing} /> : null}
              <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-foreground',
                    p.my_reaction && 'text-primary',
                  )}
                  onClick={() => void onReact(p.id)}
                >
                  <Heart className={cn('h-4 w-4', p.my_reaction && 'fill-current')} />
                  {p.reaction_count || 0}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => void toggleComments(p.id)}
                >
                  <MessageCircle className="h-4 w-4" />
                  {p.comment_count || 0}
                </button>
              </div>
              {openComments[p.id] && (
                <div className="space-y-2 border-t pt-2">
                  {(comments[p.id] || []).map((c) => (
                    <div key={c.id} className="text-xs bg-muted/50 rounded px-2 py-1.5">
                      {c.body}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Textarea
                      rows={2}
                      value={commentDrafts[p.id] || ''}
                      onChange={(e) =>
                        setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                      }
                      placeholder="Add a comment…"
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void submitComment(p.id)}
                      disabled={!commentDrafts[p.id]?.trim()}
                    >
                      Reply
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </section>

      {/* Right rail */}
      <aside className="space-y-3 hidden lg:block">
        <div className="rounded-lg border bg-white dark:bg-card p-3">
          <h3 className="font-semibold text-sm mb-2">Trending properties</h3>
          {listings.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active listings yet.</p>
          ) : (
            <ul className="space-y-2">
              {listings.map((l) => (
                <li key={l.id}>
                  <Link to="/re/properties" className="text-xs hover:underline">
                    <span className="font-medium">{l.title}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {[l.locality, l.city].filter(Boolean).join(', ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-white dark:bg-card p-3">
          <h3 className="font-semibold text-sm mb-2">Suggested professionals</h3>
          <ul className="space-y-2">
            {profiles.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link to={`/re/u/${p.id}`} className="text-xs hover:underline">
                  {p.display_name}
                  {p.headline ? (
                    <span className="text-muted-foreground"> — {p.headline}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/re/network" className="text-xs text-primary mt-2 inline-block">
            See all
          </Link>
        </div>
      </aside>
    </div>
  );
}
