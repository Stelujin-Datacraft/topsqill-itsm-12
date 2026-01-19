import { DataFeed } from '@/types/dataFeed';
import { useDataFeedRuns } from '@/hooks/useDataFeeds';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface DataFeedHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: DataFeed | null;
}

export function DataFeedHistoryDialog({ open, onOpenChange, feed }: DataFeedHistoryDialogProps) {
  const { runs, loading } = useDataFeedRuns(feed?.id || '', open);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-destructive';
      case 'success':
        return 'text-green-600';
      case 'info':
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Run History: {feed?.name}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No runs yet. Execute the feed to see history.
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {runs.map((run) => (
                <AccordionItem key={run.id} value={run.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full pr-4">
                      {getStatusIcon(run.status)}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {format(new Date(run.started_at), 'MMM d, yyyy HH:mm')}
                          </span>
                          <Badge variant={run.triggered_by === 'schedule' ? 'secondary' : 'outline'}>
                            {run.triggered_by}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Processed: {run.records_processed} | Updated: {run.records_updated} | Created: {run.records_created}
                          {run.errors_count > 0 && (
                            <span className="text-destructive"> | Errors: {run.errors_count}</span>
                          )}
                        </div>
                      </div>
                      {run.completed_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-7">
                      {run.run_log && run.run_log.length > 0 ? (
                        run.run_log.map((log, index) => (
                          <div key={index} className={`text-sm ${getLogTypeColor(log.type)}`}>
                            <span className="text-xs opacity-70">
                              {format(new Date(log.timestamp), 'HH:mm:ss')}
                            </span>{' '}
                            {log.message}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No detailed logs available</p>
                      )}

                      {run.error_details && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                          Error: {typeof run.error_details === 'string' ? run.error_details : JSON.stringify(run.error_details)}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
