import { useState } from 'react';
import { DataFeed } from '@/types/dataFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, MoreVertical, Play, Pencil, Trash2, History, Clock, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DataFeedListProps {
  feeds: DataFeed[];
  loading: boolean;
  onCreateClick: () => void;
  onEditClick: (feed: DataFeed) => void;
  onViewHistory: (feed: DataFeed) => void;
  onExecute: (feedId: string) => Promise<boolean>;
  onToggleActive: (feedId: string, isActive: boolean) => Promise<boolean>;
  onDelete: (feedId: string) => Promise<boolean>;
}

export function DataFeedList({
  feeds,
  loading,
  onCreateClick,
  onEditClick,
  onViewHistory,
  onExecute,
  onToggleActive,
  onDelete,
}: DataFeedListProps) {
  const [executing, setExecuting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DataFeed | null>(null);

  const handleExecute = async (feedId: string) => {
    setExecuting(feedId);
    await onExecute(feedId);
    setExecuting(null);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const getStatusBadge = (feed: DataFeed) => {
    if (!feed.last_run_status) return null;
    
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      success: 'default',
      failed: 'destructive',
      partial: 'secondary',
    };

    return (
      <Badge variant={variants[feed.last_run_status] || 'secondary'}>
        {feed.last_run_status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Data Feeds</h2>
          <p className="text-sm text-muted-foreground">
            Sync data between forms using scheduled or manual feeds
          </p>
        </div>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Create Data Feed
        </Button>
      </div>

      {feeds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data Feeds</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create your first data feed to sync data between forms automatically.
            </p>
            <Button onClick={onCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Create Data Feed
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {feeds.map((feed) => (
            <Card key={feed.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{feed.name}</CardTitle>
                      {getStatusBadge(feed)}
                      {!feed.is_active && (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </div>
                    {feed.description && (
                      <CardDescription className="mt-1">
                        {feed.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={feed.is_active}
                      onCheckedChange={(checked) => onToggleActive(feed.id, checked)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExecute(feed.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          Run Now
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditClick(feed)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onViewHistory(feed)}>
                          <History className="mr-2 h-4 w-4" />
                          View History
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteTarget(feed)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ArrowRightLeft className="h-4 w-4" />
                    <span>{feed.field_mappings.length} field mappings</span>
                  </div>
                  {feed.schedule && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{feed.schedule}</span>
                    </div>
                  )}
                  {feed.last_run_at && (
                    <div className="text-muted-foreground">
                      Last run: {formatDistanceToNow(new Date(feed.last_run_at), { addSuffix: true })}
                    </div>
                  )}
                  {feed.last_run_stats && (
                    <div className="text-muted-foreground">
                      ({feed.last_run_stats.recordsUpdated} updated, {feed.last_run_stats.recordsCreated} created)
                    </div>
                  )}
                </div>
                
                {executing === feed.id && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running...
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Data Feed</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
