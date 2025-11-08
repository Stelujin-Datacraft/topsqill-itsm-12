import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Clock, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { QueryHistoryItem } from '@/hooks/useQueryHistory';
import { formatDistanceToNow } from 'date-fns';

interface QueryHistoryProps {
  history: QueryHistoryItem[];
  onSelectQuery: (query: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function QueryHistory({ history, onSelectQuery, onRemove, onClear }: QueryHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No query history yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Query History</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 text-xs"
        >
          Clear All
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="group p-3 rounded-md border border-border hover:border-primary/50 cursor-pointer transition-colors"
              onClick={() => onSelectQuery(item.query)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {item.success ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(item.executedAt, { addSuffix: true })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              
              <code className="text-xs block mb-2 line-clamp-2 text-foreground/80">
                {item.query}
              </code>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{item.rowCount} rows</span>
                <span>•</span>
                <span>{item.executionTime}ms</span>
              </div>
              
              {item.error && (
                <div className="mt-2 text-xs text-destructive line-clamp-1">
                  {item.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
