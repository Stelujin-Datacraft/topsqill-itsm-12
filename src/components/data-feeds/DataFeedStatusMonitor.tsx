import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ListFilter,
  Inbox,
  CalendarClock,
} from 'lucide-react';
import { backend as supabase } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { parseCronToReadable } from '@/types/dataFeed';

interface RunRow {
  id: string;
  data_feed_id: string;
  status: 'running' | 'completed' | 'failed' | string;
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  records_updated: number;
  records_created: number;
  errors_count: number;
  triggered_by: string;
  error_details: any;
  data_feeds?: { name: string; schedule: string | null; is_active: boolean } | null;
}

interface PendingFeed {
  id: string;
  name: string;
  schedule: string | null;
  last_run_at: string | null;
  is_active: boolean;
}

interface Stats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export function DataFeedStatusMonitor() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [pendingFeeds, setPendingFeeds] = useState<PendingFeed[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const { currentProject } = useProject();
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      setLoading(true);

      // Get feed IDs for this project
      const { data: feeds, error: feedsErr } = await supabase
        .from('data_feeds')
        .select('id, name, schedule, is_active, last_run_at')
        .eq('project_id', currentProject.id);
      if (feedsErr) throw feedsErr;

      const feedIds = (feeds || []).map(f => f.id);
      const feedMap = new Map(
        (feeds || []).map(f => [f.id, { name: f.name, schedule: f.schedule, is_active: f.is_active }])
      );

      // Pending = active feeds with a schedule (waiting for next run)
      const pending: PendingFeed[] = (feeds || [])
        .filter(f => f.is_active && f.schedule)
        .map(f => ({
          id: f.id,
          name: f.name,
          schedule: f.schedule,
          last_run_at: f.last_run_at,
          is_active: f.is_active,
        }));
      setPendingFeeds(pending);

      let runRows: RunRow[] = [];
      if (feedIds.length > 0) {
        const { data: runData, error: runErr } = await supabase
          .from('data_feed_runs')
          .select('*')
          .in('data_feed_id', feedIds)
          .order('started_at', { ascending: false })
          .limit(100);
        if (runErr) throw runErr;
        runRows = (runData || []).map(r => ({
          ...(r as any),
          data_feeds: feedMap.get((r as any).data_feed_id) || null,
        }));
      }
      setRuns(runRows);

      const counts = runRows.reduce(
        (acc, r) => {
          if (r.status === 'running') acc.processing++;
          else if (r.status === 'completed') acc.completed++;
          else if (r.status === 'failed') acc.failed++;
          return acc;
        },
        { pending: pending.length, processing: 0, completed: 0, failed: 0 }
      );
      setStats(counts);
    } catch (error) {
      console.error('Error loading data feed status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data feed status.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, toast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRetry = async (feedId: string) => {
    setRetrying(feedId);
    try {
      const { error } = await supabase.functions.invoke('execute-data-feed', {
        body: { feedId, triggeredBy: 'manual' },
      });
      if (error) throw error;
      toast({ title: 'Retry started', description: 'The data feed is running again.' });
      loadData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Retry failed',
        description: e.message || 'Could not retry the data feed.',
        variant: 'destructive',
      });
    } finally {
      setRetrying(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running': return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (status === 'completed') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'running') return 'secondary';
    return 'outline';
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const filtered = activeTab === 'all'
    ? runs
    : activeTab === 'pending'
      ? []
      : runs.filter(r => (activeTab === 'processing' ? r.status === 'running' : r.status === activeTab));

  if (!currentProject) return null;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-semibold">{stats.pending}</p>
            </div>
            <CalendarClock className="h-6 w-6 text-amber-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Processing</p>
              <p className="text-2xl font-semibold">{stats.processing}</p>
            </div>
            <Loader2 className={`h-6 w-6 text-primary ${stats.processing > 0 ? 'animate-spin' : ''}`} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-semibold">{stats.completed}</p>
            </div>
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-2xl font-semibold">{stats.failed}</p>
            </div>
            <XCircle className="h-6 w-6 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Data Feed Status
            </CardTitle>
            <CardDescription>Monitor data feed executions across all feeds</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <ListFilter className="h-4 w-4" />
                All ({runs.length})
              </TabsTrigger>
              <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
              <TabsTrigger value="processing">Processing ({stats.processing})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
              <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeTab === 'pending' ? (
                pendingFeeds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No scheduled feeds pending</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Feed</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Last Run</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingFeeds.map(f => (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium">{f.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {f.schedule ? parseCronToReadable(f.schedule) : '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {f.last_run_at ? timeAgo(f.last_run_at) : 'Never'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-amber-700 border-amber-300">
                                Pending
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No runs found</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Feed</TableHead>
                        <TableHead>Triggered By</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(r => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {statusIcon(r.status)}
                              <Badge variant={statusBadge(r.status)}>
                                {r.status === 'running' ? 'processing' : r.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{r.data_feeds?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{r.triggered_by}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="text-muted-foreground">Processed:</span> {r.records_processed}
                            {' · '}
                            <span className="text-muted-foreground">Upd:</span> {r.records_updated}
                            {' · '}
                            <span className="text-muted-foreground">New:</span> {r.records_created}
                            {r.errors_count > 0 && (
                              <span className="text-destructive"> · Err: {r.errors_count}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.completed_at
                              ? `${Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{timeAgo(r.started_at)}</TableCell>
                          <TableCell>
                            {r.status === 'failed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetry(r.data_feed_id)}
                                disabled={retrying === r.data_feed_id}
                              >
                                {retrying === r.data_feed_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                                <span className="ml-1">Retry</span>
                              </Button>
                            )}
                            {r.error_details && (
                              <div
                                className="text-xs text-destructive mt-1 max-w-[220px] truncate"
                                title={typeof r.error_details === 'string' ? r.error_details : JSON.stringify(r.error_details)}
                              >
                                {typeof r.error_details === 'string' ? r.error_details : JSON.stringify(r.error_details)}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}