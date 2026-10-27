import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { reApi, type ReListing, type RePost, type ReProfile } from '@/lib/re/api';
import { toast } from '@/hooks/use-toast';
import {
  Home,
  ImageIcon,
  Loader2,
  MessageCircle,
  Repeat2,
  Send,
  ThumbsUp,
  Video,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function prettyName(profile: ReProfile | undefined, fallback: string) {
  const raw = profile?.display_name?.trim() || '';
  if (raw && !raw.includes('@')) return raw;
  return fallback;
}

function PropertyEmbed({ listing }: { listing: ReListing }) {
  return (
    <Link
      to={`/re/properties?highlight=${listing.id}`}
      className="mt-3 flex overflow-hidden rounded-lg border border-[#e6e4e1] bg-[#faf9f7] hover:bg-[#f3f2ef]"
    >
      <div className="flex h-[92px] w-[128px] shrink-0 items-center justify-center bg-[#e9e5df]">
        {listing.cover_image_url ? (
          <img src={listing.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Home className="h-6 w-6 text-[#666]" />
        )}
      </div>
      <div className="min-w-0 px-3 py-2">
        <div className="truncate text-sm font-semibold">{listing.title}</div>
        <div className="truncate text-xs text-[#666]">
          {[listing.locality, listing.city].filter(Boolean).join(', ') || 'Location TBD'}
        </div>
        <div className="mt-1 text-sm font-semibold text-primary">
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
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const orgId = currentOrganization?.id;
  const [posts, setPosts] = useState<RePost[]>([]);
  const [profiles, setProfiles] = useState<ReProfile[]>([]);
  const [listings, setListings] = useState<ReListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [postType, setPostType] = useState('text');
  const [listingId, setListingId] = useState<string>('');
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, { id: string; body: string }[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const accountName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim();
  const myProfile = profiles.find((p) => p.user_id === user?.id) || null;
  const displayName = prettyName(myProfile || undefined, accountName || 'Your profile');

  const activeListings = useMemo(
    () => listings.filter((l) => (l.status || 'active') === 'active').slice(0, 5),
    [listings],
  );
  const suggestions = useMemo(
    () => profiles.filter((p) => p.user_id !== user?.id).slice(0, 4),
    [profiles, user?.id],
  );

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [feed, prof, list] = await Promise.all([
        reApi.networkFeed(orgId),
        reApi.listProfiles(orgId),
        reApi.listListings(orgId, 50),
      ]);
      setPosts(feed.posts || []);
      setProfiles(prof.profiles || []);
      setListings(list.listings || []);
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

  const openComposer = (type = 'text') => {
    setPostType(type);
    setComposerOpen(true);
  };

  const onPost = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!orgId || !draft.trim()) return;
    setPosting(true);
    try {
      await reApi.createPost({
        organizationId: orgId,
        body: draft.trim(),
        postType: listingId ? 'property' : postType,
        listingId: listingId || null,
        authorProfileId: myProfile?.id || null,
      });
      setDraft('');
      setListingId('');
      setComposerOpen(false);
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

  const onRepost = async (post: RePost) => {
    if (!orgId) return;
    try {
      await reApi.createPost({
        organizationId: orgId,
        body: post.body,
        postType: 'text',
        listingId: post.listing_id || null,
        authorProfileId: myProfile?.id || null,
      });
      toast({ title: 'Reposted to your feed' });
      await reload();
    } catch (err) {
      toast({
        title: 'Repost failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const onSend = async (post: RePost) => {
    if (!orgId || !post.author_user_id || post.author_user_id === user?.id) {
      toast({ title: 'This is your post' });
      return;
    }
    try {
      const res = await reApi.openDirectConversation(orgId, post.author_user_id);
      navigate(`/re/messages?c=${res.conversation.id}`);
    } catch (err) {
      toast({
        title: 'Could not open chat',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const toggleComments = async (postId: string) => {
    const next = !openComments[postId];
    setOpenComments((s) => ({ ...s, [postId]: next }));
    if (next && orgId) {
      const res = await reApi.listComments(postId, orgId).catch(() => ({ comments: [] }));
      setComments((c) => ({ ...c, [postId]: res.comments || [] }));
    }
  };

  const submitComment = async (postId: string) => {
    if (!orgId) return;
    const body = (commentDrafts[postId] || '').trim();
    if (!body) return;
    await reApi.addComment(postId, orgId, body);
    setCommentDrafts((d) => ({ ...d, [postId]: '' }));
    const res = await reApi.listComments(postId, orgId);
    setComments((c) => ({ ...c, [postId]: res.comments || [] }));
    await reload();
  };

  return (
    <div className="grid w-full items-start gap-6 lg:grid-cols-[225px_minmax(0,1fr)_300px]">
      <aside className="hidden space-y-2 lg:block">
        <div className="overflow-hidden rounded-lg border border-[#e6e4e1] bg-white">
          <div className="h-14 bg-gradient-to-r from-primary/25 to-[#e7f3ef]" />
          <div className="px-3 pb-3">
            <div className="-mt-8 grid h-16 w-16 place-items-center rounded-full border-2 border-white bg-[#dce6e3] text-xl font-semibold text-primary">
              {initials(displayName)}
            </div>
            <div className="mt-2 truncate text-[16px] font-semibold" title={displayName}>
              {displayName}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[#666]">
              {myProfile?.headline || 'Add a headline so clients know what you specialise in.'}
            </p>
            {myProfile ? (
              <Link to={`/re/u/${myProfile.id}`} className="mt-2 inline-block text-xs font-semibold text-primary">
                View profile
              </Link>
            ) : (
              <Link to="/re/profiles" className="mt-2 inline-block text-xs font-semibold text-primary">
                Create your profile
              </Link>
            )}
            <div className="mt-3 space-y-2 border-t border-[#e6e4e1] pt-3 text-xs">
              <div className="flex items-center justify-between text-[#666]">
                <span>Profile viewers</span>
                <span className="font-semibold text-primary">—</span>
              </div>
              <div className="flex items-center justify-between text-[#666]">
                <span>Post impressions</span>
                <span className="font-semibold text-primary">{posts.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#e6e4e1] bg-white p-3">
          <div className="mb-2 text-xs font-semibold text-[#666]">Shortcuts</div>
          <div className="space-y-2 text-sm">
            <Link className="block font-semibold text-[#191919] hover:underline" to="/re/leads">CRM inbox</Link>
            <Link className="block font-semibold text-[#191919] hover:underline" to="/re/listings">Manage listings</Link>
            <Link className="block font-semibold text-[#191919] hover:underline" to="/re/sources">Lead sources</Link>
            <Link className="block font-semibold text-[#191919] hover:underline" to="/re/network">Grow your network</Link>
          </div>
        </div>
      </aside>

      <section className="min-w-0 space-y-2">
        <div className="rounded-lg border border-[#e6e4e1] bg-white px-4 pb-1 pt-3">
          <div className="flex items-center gap-2">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#dce6e3] text-sm font-semibold text-primary">
              {initials(displayName)}
            </div>
            <button
              type="button"
              onClick={() => openComposer('text')}
              className="h-12 flex-1 rounded-full border border-[#b2b2b2] px-4 text-left text-sm font-semibold text-[#666] hover:bg-[#f3f2ef]"
            >
              Start a post
            </button>
          </div>
          <div className="mt-1 grid grid-cols-3">
            <button type="button" onClick={() => openComposer('image')} className="flex items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-[#666] hover:bg-[#f3f2ef]">
              <ImageIcon className="h-5 w-5 text-[#378fe9]" /> Photo
            </button>
            <button type="button" onClick={() => openComposer('video')} className="flex items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-[#666] hover:bg-[#f3f2ef]">
              <Video className="h-5 w-5 text-[#5f9b41]" /> Video
            </button>
            <button type="button" onClick={() => openComposer('article')} className="flex items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-[#666] hover:bg-[#f3f2ef]">
              <FileText className="h-5 w-5 text-[#e16745]" /> Write article
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 py-1 text-xs text-[#666]">
          <div className="h-px flex-1 bg-[#e6e4e1]" />
          <span>Sort by: Top</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#e6e4e1] bg-white p-6 text-sm text-[#666]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading feed…
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-[#e6e4e1] bg-white px-6 py-12 text-center">
            <h3 className="text-base font-semibold">No posts yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#666]">
              Share a listing, an open house, or a market note. Posts from your organisation appear here.
            </p>
            <button
              type="button"
              onClick={() => openComposer('text')}
              className="mt-4 rounded-full bg-primary px-5 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              Start a post
            </button>
          </div>
        ) : (
          posts.map((p) => {
            const authorName = prettyName(p.author || undefined, 'Professional');
            return (
              <article key={p.id} className="rounded-lg border border-[#e6e4e1] bg-white">
                <div className="flex gap-3 px-4 pt-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#dce6e3] text-sm font-semibold text-primary">
                    {initials(authorName)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{authorName}</div>
                    <div className="truncate text-xs text-[#666]">{p.author?.headline || p.post_type}</div>
                    <div className="text-xs text-[#666]">{new Date(p.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-5">{p.body}</p>
                {p.listing ? (
                  <div className="px-4 pb-3">
                    <PropertyEmbed listing={p.listing} />
                  </div>
                ) : null}
                <div className="flex items-center justify-between px-4 pb-1 text-xs text-[#666]">
                  <span>{p.reaction_count || 0} reactions</span>
                  <span>
                    {p.comment_count || 0} comments · {p.repost_count || 0} reposts
                  </span>
                </div>
                <div className="mx-4 border-t border-[#e6e4e1]" />
                <div className="grid grid-cols-4 px-2 py-1">
                  <button type="button" onClick={() => void onReact(p.id)} className={cn('flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold text-[#666] hover:bg-[#f3f2ef]', p.my_reaction && 'text-primary')}>
                    <ThumbsUp className={cn('h-5 w-5', p.my_reaction && 'fill-current')} /> Like
                  </button>
                  <button type="button" onClick={() => void toggleComments(p.id)} className="flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold text-[#666] hover:bg-[#f3f2ef]">
                    <MessageCircle className="h-5 w-5" /> Comment
                  </button>
                  <button type="button" onClick={() => void onRepost(p)} className="flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold text-[#666] hover:bg-[#f3f2ef]">
                    <Repeat2 className="h-5 w-5" /> Repost
                  </button>
                  <button type="button" onClick={() => void onSend(p)} className="flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold text-[#666] hover:bg-[#f3f2ef]">
                    <Send className="h-5 w-5" /> Send
                  </button>
                </div>
                {openComments[p.id] && (
                  <div className="space-y-2 border-t border-[#e6e4e1] px-4 py-3">
                    {(comments[p.id] || []).map((c) => (
                      <div key={c.id} className="rounded-lg bg-[#f3f2ef] px-3 py-2 text-sm">{c.body}</div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        value={commentDrafts[p.id] || ''}
                        onChange={(e) => setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                        placeholder="Add a comment…"
                        className="h-10 flex-1 rounded-full border border-[#b2b2b2] px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        disabled={!commentDrafts[p.id]?.trim()}
                        onClick={() => void submitComment(p.id)}
                        className="rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      <aside className="hidden space-y-2 lg:block">
        <div className="rounded-lg border border-[#e6e4e1] bg-white p-4">
          <h3 className="text-base font-semibold">Trending properties</h3>
          {activeListings.length === 0 ? (
            <p className="mt-3 text-xs text-[#666]">No active listings yet. Publish one from Listings.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {activeListings.map((l) => (
                <li key={l.id}>
                  <Link to={`/re/properties?highlight=${l.id}`} className="block hover:underline">
                    <div className="text-sm font-semibold leading-5">{l.title}</div>
                    <div className="text-xs text-[#666]">
                      {[l.locality, l.city].filter(Boolean).join(', ') || 'Location TBD'}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/re/properties" className="mt-3 inline-block text-sm font-semibold text-[#666] hover:text-primary">
            Show more
          </Link>
        </div>

        <div className="rounded-lg border border-[#e6e4e1] bg-white p-4">
          <h3 className="text-base font-semibold">Suggested professionals</h3>
          {suggestions.length === 0 ? (
            <p className="mt-3 text-xs text-[#666]">Add teammate profiles to grow the network.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {suggestions.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2">
                  <Link to={`/re/u/${p.id}`} className="min-w-0">
                    <div className="truncate text-sm font-semibold hover:underline">{prettyName(p, p.display_name)}</div>
                    <div className="line-clamp-2 text-xs text-[#666]">{p.headline || p.profile_type}</div>
                  </Link>
                  <Link to="/re/network" className="shrink-0 text-sm font-semibold text-[#666] hover:text-primary">
                    Connect
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/re/network" className="mt-3 inline-block text-sm font-semibold text-[#666] hover:text-primary">
            See all
          </Link>
        </div>
      </aside>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-[552px] gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="border-b border-[#e6e4e1] px-4 py-3">
            <DialogTitle className="text-center text-base font-semibold">
              {postType === 'article' ? 'Write an article' : postType === 'image' ? 'Photo post' : postType === 'video' ? 'Video post' : 'Create a post'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onPost} className="px-4 pb-4 pt-3">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#dce6e3] text-sm font-semibold text-primary">
                {initials(displayName)}
              </div>
              <div>
                <div className="text-sm font-semibold">{displayName}</div>
                <div className="text-xs text-[#666]">Post to anyone in your organisation</div>
              </div>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              autoFocus
              placeholder="What do you want to talk about?"
              className="w-full resize-none border-0 text-base outline-none placeholder:text-[#666]"
            />
            {listings.length > 0 && (
              <label className="mt-2 block text-xs text-[#666]">
                Attach a listing
                <select
                  value={listingId}
                  onChange={(e) => setListingId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-[#e6e4e1] bg-white px-2 text-sm text-[#191919]"
                >
                  <option value="">None</option>
                  {listings.slice(0, 30).map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-[#e6e4e1] pt-3">
              <div className="flex gap-1 text-[#666]">
                <ImageIcon className="h-5 w-5" />
                <Video className="h-5 w-5" />
                <FileText className="h-5 w-5" />
              </div>
              <button
                type="submit"
                disabled={posting || !draft.trim()}
                className="rounded-full bg-primary px-5 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
