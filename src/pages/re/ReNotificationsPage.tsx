import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { reApi, type ReNotification } from '@/lib/re/api';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReNotificationsPage() {
  const [items, setItems] = useState<ReNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await reApi.listNotifications();
      setItems(res.notifications || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const markAll = async () => {
    await reApi.markNotificationsRead();
    await reload();
  };

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Connections, reactions, comments, messages, and CRM alerts.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void markAll()}>
          Mark all read
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">You are all caught up.</p>
      ) : (
        <ul className="rounded-lg border bg-white dark:bg-card divide-y">
          {items.map((n) => (
            <li
              key={n.id}
              className={cn('px-4 py-3', !n.read_at && 'bg-primary/5')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body ? (
                    <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                  ) : null}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                {n.href ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={n.href}>Open</Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
