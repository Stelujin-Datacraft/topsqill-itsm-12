import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganization } from '@/contexts/OrganizationContext';
import { reApi, type ReConversation, type ReMessage } from '@/lib/re/api';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReMessagesPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [conversations, setConversations] = useState<ReConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ReMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await reApi.listConversations(orgId);
      setConversations(res.conversations || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !activeId) {
      setMessages([]);
      return;
    }
    void reApi.listMessages(activeId, orgId).then((r) => setMessages(r.messages || []));
  }, [activeId, orgId]);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !activeId || !draft.trim()) return;
    setSending(true);
    try {
      await reApi.sendMessage(activeId, orgId, draft.trim());
      setDraft('');
      const r = await reApi.listMessages(activeId, orgId);
      setMessages(r.messages || []);
      await reload();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white dark:bg-card overflow-hidden grid md:grid-cols-[280px_1fr] min-h-[480px]">
      <div className="border-r overflow-y-auto max-h-[70vh]">
        <div className="p-3 border-b font-semibold text-sm">Inbox</div>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground flex gap-2 items-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No conversations. Start one from Network → Message.
          </p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={cn(
                'w-full text-left px-3 py-3 border-b hover:bg-muted/40',
                activeId === c.id && 'bg-muted',
              )}
            >
              <div className="text-sm font-medium truncate">
                {c.title || `Chat ${c.id.slice(0, 6)}`}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {c.last_message?.body || '—'}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="flex flex-col min-h-[480px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!activeId ? (
            <p className="text-sm text-muted-foreground">Select a conversation.</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="rounded-lg bg-muted/50 px-3 py-2 text-sm max-w-lg">
                <div>{m.body}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
        <form onSubmit={onSend} className="p-3 border-t flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            disabled={!activeId || sending}
          />
          <Button type="submit" disabled={!activeId || sending || !draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
