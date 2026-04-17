import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import {
  FileText,
  Workflow,
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';

export function RecentActivityList() {
  const { activities, loading, refresh } = useRecentActivity();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'form_created':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'form_submission':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'workflow_execution':
        return <Workflow className="h-4 w-4 text-purple-500" />;
      case 'workflow_created':
        return <Workflow className="h-4 w-4 text-purple-400" />;
      case 'report_created':
        return <BarChart3 className="h-4 w-4 text-orange-500" />;
      case 'user_joined':
        return <Users className="h-4 w-4 text-indigo-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const map: Record<string, { variant: any; icon: any; label: string; className?: string }> = {
      completed: { variant: 'default', icon: CheckCircle2, label: 'Completed', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' },
      approved: { variant: 'default', icon: CheckCircle2, label: 'Approved', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
      rejected: { variant: 'destructive', icon: XCircle, label: 'Rejected' },
      running: { variant: 'secondary', icon: Loader2, label: 'Running', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
      waiting: { variant: 'secondary', icon: PauseCircle, label: 'Waiting', className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
      pending: { variant: 'secondary', icon: Clock, label: 'Pending', className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
    };
    const cfg = map[status] || { variant: 'outline', icon: Clock, label: status };
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className={`gap-1 text-[10px] px-1.5 py-0 h-5 ${cfg.className || ''}`}>
        <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
        {cfg.label}
      </Badge>
    );
  };

  const formatDuration = (ms?: number) => {
    if (!ms || ms < 0) return null;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>Recent Activity</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && activities.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity to display</p>
            <p className="text-sm">Activity will appear here as you use the platform</p>
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
                >
                  <div className="mt-0.5 flex-shrink-0">{getActivityIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{activity.title}</p>
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(activity.status)}
                        {activity.duration_ms !== undefined && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            ⏱ {formatDuration(activity.duration_ms)}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground break-words">
                      {activity.description}
                    </p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <p className="text-xs text-muted-foreground truncate">
                        by {activity.owner_name || 'System'}
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
