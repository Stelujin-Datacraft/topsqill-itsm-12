import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Clock, User, MessageSquare, ArrowRight, Circle, Check } from 'lucide-react';
import { format } from 'date-fns';

interface LifecycleHistoryEntry {
  id: string;
  submission_id: string;
  field_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_at: string;
  comment: string | null;
  duration_in_previous_stage: string | null;
  changed_by_name?: string;
}

interface LifecycleHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  history: LifecycleHistoryEntry[];
  loading: boolean;
  fieldLabel: string;
}

export function LifecycleHistoryDialog({
  open,
  onClose,
  history,
  loading,
  fieldLabel
}: LifecycleHistoryDialogProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  const getStageColor = (stage: string) => {
    const label = stage.toLowerCase();
    if (label.includes('complete') || label.includes('done') || label.includes('approved')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (label.includes('reject') || label.includes('cancel') || label.includes('fail')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (label.includes('pending') || label.includes('wait') || label.includes('new')) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    if (label.includes('progress') || label.includes('review') || label.includes('active')) {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Stage History - {fieldLabel}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No history available</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-border" />
              
              <div className="space-y-4">
                {history.map((entry, index) => (
                  <div key={entry.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                      index === 0 ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border'
                    }`}>
                      {index === 0 ? (
                        <Circle className="h-3 w-3 fill-current" />
                      ) : (
                        <Check className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    
                    {/* Content card */}
                    <div className={`flex-1 rounded-lg border p-3 ${
                      index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-card'
                    }`}>
                      {/* Stage transition */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {entry.from_stage ? (
                          <>
                            <Badge variant="outline" className={getStageColor(entry.from_stage)}>
                              {entry.from_stage}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground mr-1">Started at</span>
                        )}
                        <Badge variant="outline" className={getStageColor(entry.to_stage)}>
                          {entry.to_stage}
                        </Badge>
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(entry.changed_at)}
                        </span>
                        
                        {entry.changed_by_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {entry.changed_by_name}
                          </span>
                        )}
                        
                        {entry.duration_in_previous_stage && (
                          <span className="text-amber-600">
                            Duration: {entry.duration_in_previous_stage}
                          </span>
                        )}
                      </div>
                      
                      {/* Comment */}
                      {entry.comment && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-3 w-3 mt-0.5 text-primary" />
                            <p className="text-sm italic text-foreground">"{entry.comment}"</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
