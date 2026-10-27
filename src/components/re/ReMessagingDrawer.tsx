import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useOrganization } from '@/contexts/OrganizationContext';
import { reApi, type ReConversation, type ReMessage } from '@/lib/re/api';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConversationId?: string | null;
};

export function ReMessagingDrawer({ open, onOpenChange, initialConversationId }: Props) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [conversations, setConversations] = useState<ReConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ReMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadConversations = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await reApi.listConversations(orgId);
      setConversations(res.conversations || []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (id: string) => {
    if (!orgId) return;
    try {
      const res = await reApi.listMessages(id, orgId);
      setMessages(res.messages || []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    if (open) void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgId]);

  useEffect(() => {
    if (initialConversationId) setActiveId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
    else setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, orgId]);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !activeId || !draft.trim()) return;
    setSending(true);
    try {
      await reApi.sendMessage(activeId, orgId, draft.trim());
      setDraft('');
      await loadMessages(activeId);
      await loadConversations();
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle>Messaging</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 grid grid-rows-[40%_60%]">
          <div className="overflow-y-auto border-b">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No conversations yet. Connect with a professional and start a chat from Network.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors',
                    activeId === c.id && 'bg-muted',
                  )}
                >
                  <div className="text-sm font-medium truncate">
                    {c.title || `Conversation ${c.id.slice(0, 6)}`}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.last_message?.body || 'No messages yet'}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!activeId ? (
                <p className="text-xs text-muted-foreground">Select a conversation.</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">Say hello.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
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
              <Button type="submit" size="icon" disabled={!activeId || sending || !draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
