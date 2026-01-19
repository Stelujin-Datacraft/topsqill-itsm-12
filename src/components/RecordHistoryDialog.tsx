import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { fetchRecordHistory } from '@/utils/recordHistoryLogger';
import { History, ArrowRight, User, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface RecordHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  submissionRefId?: string;
}

interface HistoryEntry {
  id: string;
  field_id: string | null;
  field_label: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
  change_type: string;
}

interface UserInfo {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export const RecordHistoryDialog: React.FC<RecordHistoryDialogProps> = ({
  open,
  onOpenChange,
  submissionId,
  submissionRefId
}) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && submissionId) {
      loadHistory();
    }
  }, [open, submissionId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await fetchRecordHistory(submissionId);
      
      if (error) {
        console.error('Error loading history:', error);
        setHistory([]);
        return;
      }

      setHistory(data || []);

      // Fetch user info for all changed_by users (handle both direct user IDs and workflow:/datafeed: format)
      const rawUserIds = (data || []).map(h => h.changed_by).filter(Boolean) as string[];
      const extractedUserIds = rawUserIds.map(id => {
        // Extract user ID from workflow format if present
        if (id.startsWith('workflow:')) {
          const extracted = id.replace('workflow:', '');
          return extracted === 'system' ? null : extracted;
        }
        // Extract user ID from datafeed format if present
        if (id.startsWith('datafeed:')) {
          const extracted = id.replace('datafeed:', '');
          return extracted === 'system' ? null : extracted;
        }
        return id;
      }).filter(Boolean) as string[];
      
      const userIds = [...new Set(extractedUserIds)];
      
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name')
          .in('id', userIds);

        if (usersData) {
          const usersMap: Record<string, UserInfo> = {};
          usersData.forEach(u => {
            usersMap[u.id] = u;
          });
          setUsers(usersMap);
        }
      }
    } catch (error) {
      console.error('Exception loading history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Check if changed_by is a workflow identifier (format: "workflow:<userId>" or "workflow:system")
  const isWorkflowChange = (changedBy: string | null) => {
    return changedBy?.startsWith('workflow:') || false;
  };

  // Check if changed_by is a data feed identifier (format: "datafeed:<userId>")
  const isDataFeedChange = (changedBy: string | null) => {
    return changedBy?.startsWith('datafeed:') || false;
  };

  // Extract user ID from workflow changed_by format
  const getWorkflowUserId = (changedBy: string | null) => {
    if (!changedBy?.startsWith('workflow:')) return null;
    const userId = changedBy.replace('workflow:', '');
    return userId === 'system' ? null : userId;
  };

  // Extract user ID from datafeed changed_by format
  const getDataFeedUserId = (changedBy: string | null) => {
    if (!changedBy?.startsWith('datafeed:')) return null;
    const userId = changedBy.replace('datafeed:', '');
    return userId === 'system' ? null : userId;
  };

  const getUserDisplayName = (changedBy: string | null) => {
    if (!changedBy) return 'System';
    
    // Handle workflow changes
    if (isWorkflowChange(changedBy)) {
      const userId = getWorkflowUserId(changedBy);
      if (!userId) return 'System';
      const user = users[userId];
      if (!user) return 'Unknown User';
      if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
      }
      return user.email;
    }

    // Handle data feed changes
    if (isDataFeedChange(changedBy)) {
      const userId = getDataFeedUserId(changedBy);
      if (!userId) return 'System';
      const user = users[userId];
      if (!user) return 'Unknown User';
      if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
      }
      return user.email;
    }
    
    // Regular user changes
    const user = users[changedBy];
    if (!user) return 'Unknown User';
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  const getChangeTypeBadge = (changeType: string, changedBy: string | null) => {
    // Show Data Feed badge for data feed-initiated changes
    if (isDataFeedChange(changedBy)) {
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Data Feed</Badge>;
    }

    // Show Workflow badge for workflow-initiated changes
    if (isWorkflowChange(changedBy)) {
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Workflow</Badge>;
    }
    
    switch (changeType) {
      case 'created':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Created</Badge>;
      case 'updated':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Updated</Badge>;
      case 'deleted':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Deleted</Badge>;
      default:
        return <Badge variant="outline">{changeType}</Badge>;
    }
  };

  // Group history entries by timestamp (same second = same update action)
  const groupedHistory = history.reduce((groups, entry) => {
    const key = entry.changed_at;
    if (!groups[key]) {
      groups[key] = {
        timestamp: entry.changed_at,
        changedBy: entry.changed_by,
        changeType: entry.change_type,
        fields: []
      };
    }
    groups[key].fields.push(entry);
    return groups;
  }, {} as Record<string, { timestamp: string; changedBy: string | null; changeType: string; fields: HistoryEntry[] }>);

  const sortedGroups = Object.values(groupedHistory).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Record History
          </DialogTitle>
          <DialogDescription>
            View all changes made to {submissionRefId ? `record ${submissionRefId}` : 'this record'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p>No history recorded for this record</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedGroups.map((group, groupIndex) => (
                <div key={group.timestamp} className="relative">
                  {groupIndex > 0 && <Separator className="mb-4" />}
                  
                  {/* Header with user and timestamp */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="font-medium text-foreground">
                        {getUserDisplayName(group.changedBy)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{format(new Date(group.timestamp), 'MMM d, yyyy h:mm:ss a')}</span>
                    </div>
                    {getChangeTypeBadge(group.changeType, group.changedBy)}
                  </div>

                  {/* Field changes */}
                  <div className="ml-4 space-y-3">
                    {group.fields.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg bg-muted/50 border"
                      >
                        <div className="font-medium text-sm mb-2">
                          {entry.field_label}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="flex-1 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                            <span className="text-xs text-muted-foreground block mb-1">Old Value</span>
                            <span className="text-red-700 dark:text-red-300">
                              {entry.old_value || <em className="text-muted-foreground">Empty</em>}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 p-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                            <span className="text-xs text-muted-foreground block mb-1">New Value</span>
                            <span className="text-green-700 dark:text-green-300">
                              {entry.new_value || <em className="text-muted-foreground">Empty</em>}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
