import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { reApi, type ReConnection, type ReProfile } from '@/lib/re/api';
import { toast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, UserPlus } from 'lucide-react';
import { ReMessagingDrawer } from '@/components/re/ReMessagingDrawer';

export default function ReNetworkPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const orgId = currentOrganization?.id;
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [profiles, setProfiles] = useState<ReProfile[]>([]);
  const [connections, setConnections] = useState<ReConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);

  const pendingIncoming = useMemo(
    () =>
      connections.filter(
        (c) => c.status === 'pending' && c.addressee_user_id === user?.id,
      ),
    [connections, user?.id],
  );

  const reload = async (query = q) => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [prof, conn] = await Promise.all([
        reApi.searchProfessionals(orgId, query),
        reApi.listConnections(orgId),
      ]);
      setProfiles(prof.profiles || []);
      setConnections(conn.connections || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load network');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload(params.get('q') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    void reload(q);
  };

  const connectionState = (profile: ReProfile) => {
    if (!user?.id || !profile.user_id) return 'none' as const;
    if (profile.user_id === user.id) return 'self' as const;
    const row = connections.find(
      (c) =>
        (c.requester_user_id === user.id && c.addressee_user_id === profile.user_id) ||
        (c.addressee_user_id === user.id && c.requester_user_id === profile.user_id),
    );
    if (!row) return 'none' as const;
    if (row.status === 'accepted') return 'connected' as const;
    if (row.status === 'pending') {
      return row.requester_user_id === user.id ? 'pending_out' : 'pending_in';
    }
    return 'none' as const;
  };

  const connect = async (addresseeUserId: string) => {
    if (!orgId) return;
    try {
      await reApi.requestConnection(orgId, addresseeUserId);
      toast({ title: 'Connection request sent' });
      await reload();
    } catch (e) {
      toast({
        title: 'Request failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const respond = async (id: string, accept: boolean) => {
    if (!orgId) return;
    try {
      await reApi.respondConnection(id, orgId, accept);
      toast({ title: accept ? 'Connected' : 'Declined' });
      await reload();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  const message = async (otherUserId: string) => {
    if (!orgId) return;
    try {
      const res = await reApi.openDirectConversation(orgId, otherUserId);
      setActiveConv(res.conversation.id);
      setMsgOpen(true);
    } catch (e) {
      toast({
        title: 'Could not open chat',
        description: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold">My Network</h2>
        <p className="text-sm text-muted-foreground">
          Find agents, brokers, builders, and channel partners in your organization.
        </p>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, headline, or city"
        />
        <Button type="submit">Search</Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {pendingIncoming.length > 0 && (
        <div className="rounded-lg border bg-white dark:bg-card p-4 space-y-3">
          <h3 className="font-medium text-sm">Pending requests</h3>
          {pendingIncoming.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-mono text-xs">{c.requester_user_id.slice(0, 8)}…</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void respond(c.id, true)}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => void respond(c.id, false)}>
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No professionals found.</p>
          ) : (
            profiles.map((p) => {
              const state = connectionState(p);
              return (
                <div
                  key={p.id}
                  className="rounded-lg border bg-white dark:bg-card p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <Link to={`/re/u/${p.id}`} className="font-semibold text-sm hover:underline">
                      {p.display_name}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">
                      {[p.headline, p.location_text, p.profile_type].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {state === 'none' && p.user_id && (
                      <Button size="sm" onClick={() => void connect(p.user_id!)}>
                        <UserPlus className="h-4 w-4 mr-1" /> Connect
                      </Button>
                    )}
                    {state === 'pending_out' && (
                      <Button size="sm" variant="secondary" disabled>
                        Pending
                      </Button>
                    )}
                    {state === 'connected' && p.user_id && (
                      <Button size="sm" variant="outline" onClick={() => void message(p.user_id!)}>
                        <MessageSquare className="h-4 w-4 mr-1" /> Message
                      </Button>
                    )}
                    {state === 'self' && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/re/u/${p.id}`}>You</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <ReMessagingDrawer
        open={msgOpen}
        onOpenChange={setMsgOpen}
        initialConversationId={activeConv}
      />
    </div>
  );
}
