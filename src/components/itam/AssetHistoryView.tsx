import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Clock, History } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface HistoryEntry {
  id: string;
  event_type: string;
  description?: string;
  old_value?: any;
  new_value?: any;
  performed_at: string;
  asset_name?: string;
  asset_tag?: string;
}

export function AssetHistoryView() {
  const { userProfile } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!userProfile?.organization_id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('asset_history')
          .select(`
            *,
            it_assets!inner(display_name, asset_tag, organization_id)
          `)
          .order('performed_at', { ascending: false })
          .limit(200);

        if (error) throw error;

        const entries: HistoryEntry[] = ((data as any[]) || [])
          .filter(d => d.it_assets?.organization_id === userProfile.organization_id)
          .map(d => ({
            ...d,
            asset_name: d.it_assets?.display_name,
            asset_tag: d.it_assets?.asset_tag,
          }));

        setHistory(entries);
      } catch (e) {
        console.error('Error loading history:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userProfile?.organization_id]);

  const filtered = history.filter(h =>
    !search ||
    h.event_type.toLowerCase().includes(search.toLowerCase()) ||
    h.description?.toLowerCase().includes(search.toLowerCase()) ||
    h.asset_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getEventColor = (type: string) => {
    if (type.includes('create') || type.includes('register')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (type.includes('delete') || type.includes('dispose')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (type.includes('update') || type.includes('report')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Asset Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search history..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading history...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No activity history yet.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Clock className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${getEventColor(entry.event_type)}`}>{entry.event_type}</Badge>
                      {entry.asset_name && (
                        <span className="text-sm font-medium">{entry.asset_name}</span>
                      )}
                      {entry.asset_tag && (
                        <span className="text-xs font-mono text-muted-foreground">{entry.asset_tag}</span>
                      )}
                    </div>
                    {entry.description && <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(entry.performed_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
