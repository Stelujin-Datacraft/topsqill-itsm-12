import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { reApi, type ReListing, type ReProfile } from '@/lib/re/api';
import { toast } from '@/hooks/use-toast';
import { Home, Loader2, MessageSquare, UserPlus } from 'lucide-react';

export default function RePublicProfilePage() {
  const { profileId } = useParams<{ profileId: string }>();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const orgId = currentOrganization?.id;
  const [profile, setProfile] = useState<ReProfile | null>(null);
  const [listings, setListings] = useState<ReListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ headline: '', bio: '', location_text: '', website_url: '' });

  const isOwner = !!(user?.id && profile?.user_id && user.id === profile.user_id);

  const reload = async () => {
    if (!orgId || !profileId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reApi.getPublicProfile(profileId, orgId);
      setProfile(res.profile);
      setListings(res.listings || []);
      setDraft({
        headline: res.profile.headline || '',
        bio: res.profile.bio || '',
        location_text: res.profile.location_text || '',
        website_url: res.profile.website_url || '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profile not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, profileId]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !profileId) return;
    try {
      const res = await reApi.updateSocialProfile(profileId, {
        organizationId: orgId,
        ...draft,
      });
      setProfile(res.profile);
      setEditing(false);
      toast({ title: 'Profile updated' });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const connect = async () => {
    if (!orgId || !profile?.user_id) return;
    try {
      await reApi.requestConnection(orgId, profile.user_id);
      toast({ title: 'Connection request sent' });
    } catch (err) {
      toast({
        title: 'Request failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const message = async () => {
    if (!orgId || !profile?.user_id) return;
    try {
      await reApi.openDirectConversation(orgId, profile.user_id);
      toast({ title: 'Conversation ready', description: 'Open Messaging to chat.' });
    } catch (err) {
      toast({
        title: 'Could not open chat',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading profile…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error || 'Not found'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4">
      <div className="rounded-lg border bg-white dark:bg-card overflow-hidden">
        <div
          className="h-28 bg-gradient-to-r from-primary/40 to-primary/10"
          style={
            profile.cover_url
              ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: 'cover' }
              : undefined
          }
        />
        <div className="px-5 pb-5 -mt-8">
          <div className="h-20 w-20 rounded-full border-4 border-white bg-muted grid place-items-center text-2xl font-semibold">
            {profile.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{profile.display_name}</h1>
              <p className="text-sm text-muted-foreground">{profile.headline || profile.profile_type}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {[profile.location_text, ...(profile.service_areas || [])].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex gap-2">
              {isOwner ? (
                <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Cancel' : 'Edit profile'}
                </Button>
              ) : (
                <>
                  {profile.user_id && (
                    <>
                      <Button size="sm" onClick={() => void connect()}>
                        <UserPlus className="h-4 w-4 mr-1" /> Connect
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void message()}>
                        <MessageSquare className="h-4 w-4 mr-1" /> Message
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {profile.bio && !editing ? (
            <p className="text-sm mt-4 whitespace-pre-wrap">{profile.bio}</p>
          ) : null}
          {profile.website_url && !editing ? (
            <a
              href={profile.website_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary mt-2 inline-block"
            >
              {profile.website_url}
            </a>
          ) : null}
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="rounded-lg border bg-white dark:bg-card p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Headline</Label>
            <Input
              value={draft.headline}
              onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={draft.location_text}
              onChange={(e) => setDraft((d) => ({ ...d, location_text: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              value={draft.website_url}
              onChange={(e) => setDraft((d) => ({ ...d, website_url: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>About</Label>
            <Textarea
              rows={4}
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            />
          </div>
          <Button type="submit">Save</Button>
        </form>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold">Active listings</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published listings.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => (
              <Link
                key={l.id}
                to="/re/properties"
                className="rounded-lg border bg-white dark:bg-card overflow-hidden hover:bg-muted/30"
              >
                <div className="h-28 bg-muted flex items-center justify-center">
                  {l.cover_image_url ? (
                    <img src={l.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Home className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium text-sm">{l.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {[l.locality, l.city].filter(Boolean).join(', ')}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
