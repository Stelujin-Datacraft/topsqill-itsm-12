import { useState } from "react";
import { LdapSyncLog, LdapConfiguration } from "@/hooks/useLdapConfiguration";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  History, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  UserPlus,
  UserMinus,
  XCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface LdapSyncLogsProps {
  syncLogs: LdapSyncLog[];
  configurations: LdapConfiguration[];
  onRefresh: (configId?: string) => void;
  selectedConfigId?: string;
  onConfigChange?: (configId: string) => void;
}

export function LdapSyncLogs({ 
  syncLogs, 
  configurations,
  onRefresh, 
  selectedConfigId,
  onConfigChange
}: LdapSyncLogsProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState<LdapSyncLog | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed_with_errors':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500">Running</Badge>;
      case 'completed_with_errors':
        return <Badge className="bg-yellow-500">Completed with Errors</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getConfigName = (configId: string) => {
    return configurations.find(c => c.id === configId)?.name || 'Unknown';
  };

  const filteredLogs = selectedConfigId 
    ? syncLogs.filter(log => log.ldap_config_id === selectedConfigId)
    : syncLogs;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Sync History
            </CardTitle>
            <CardDescription>
              View LDAP synchronization logs and results
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {configurations.length > 1 && (
              <Select 
                value={selectedConfigId || 'all'}
                onValueChange={(value) => onConfigChange?.(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All configurations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All configurations</SelectItem>
                  {configurations.map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => onRefresh(selectedConfigId)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sync logs available</p>
            <p className="text-sm">Sync logs will appear here after running a synchronization</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="border rounded-lg overflow-hidden"
              >
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(log.status)}
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.started_at), 'MMM d, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      {configurations.length > 1 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {getConfigName(log.ldap_config_id)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1" title="Users Found">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{log.users_found}</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-600" title="Created">
                        <UserPlus className="h-4 w-4" />
                        <span>{log.users_created}</span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-600" title="Updated">
                        <RefreshCw className="h-4 w-4" />
                        <span>{log.users_updated}</span>
                      </div>
                      {log.users_disabled > 0 && (
                        <div className="flex items-center gap-1 text-orange-600" title="Disabled">
                          <UserMinus className="h-4 w-4" />
                          <span>{log.users_disabled}</span>
                        </div>
                      )}
                      {log.errors_count > 0 && (
                        <div className="flex items-center gap-1 text-destructive" title="Errors">
                          <AlertCircle className="h-4 w-4" />
                          <span>{log.errors_count}</span>
                        </div>
                      )}
                    </div>
                    {expandedLogId === log.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedLogId === log.id && (
                  <div className="border-t bg-muted/30 p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Started:</span>
                        <p className="font-medium">{format(new Date(log.started_at), 'HH:mm:ss')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Completed:</span>
                        <p className="font-medium">
                          {log.completed_at 
                            ? format(new Date(log.completed_at), 'HH:mm:ss')
                            : 'In progress...'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <p className="font-medium">
                          {log.completed_at 
                            ? formatDistanceToNow(new Date(log.started_at), { addSuffix: false })
                            : 'Running...'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Groups Synced:</span>
                        <p className="font-medium">{log.groups_synced}</p>
                      </div>
                    </div>

                    {log.error_details && Array.isArray(log.error_details) && log.error_details.length > 0 && (
                      <div>
                        <span className="text-sm text-destructive font-medium">Errors:</span>
                        <div className="mt-2 space-y-1">
                          {(log.error_details as string[]).slice(0, 5).map((error, idx) => (
                            <p key={idx} className="text-sm text-destructive bg-destructive/10 px-3 py-1 rounded">
                              {error}
                            </p>
                          ))}
                          {(log.error_details as string[]).length > 5 && (
                            <p className="text-sm text-muted-foreground">
                              ...and {(log.error_details as string[]).length - 5} more errors
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {log.sync_log && Array.isArray(log.sync_log) && log.sync_log.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Sync Log:</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDetailsDialog(log);
                            }}
                          >
                            View Full Log
                          </Button>
                        </div>
                        <ScrollArea className="h-32 rounded border bg-background p-2">
                          <div className="space-y-1 text-xs font-mono">
                            {(log.sync_log as string[]).slice(0, 10).map((entry, idx) => (
                              <p key={idx} className="text-muted-foreground">{entry}</p>
                            ))}
                            {(log.sync_log as string[]).length > 10 && (
                              <p className="text-primary">
                                ...{(log.sync_log as string[]).length - 10} more entries
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Full Log Details Dialog */}
      <Dialog open={!!showDetailsDialog} onOpenChange={(open) => !open && setShowDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Sync Log Details</DialogTitle>
            <DialogDescription>
              {showDetailsDialog && (
                <>
                  {format(new Date(showDetailsDialog.started_at), 'MMMM d, yyyy HH:mm:ss')} - {getStatusBadge(showDetailsDialog.status)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {showDetailsDialog && (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
                  <div>
                    <span className="text-muted-foreground">Users Found</span>
                    <p className="text-2xl font-bold">{showDetailsDialog.users_found}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created</span>
                    <p className="text-2xl font-bold text-green-600">{showDetailsDialog.users_created}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated</span>
                    <p className="text-2xl font-bold text-blue-600">{showDetailsDialog.users_updated}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Errors</span>
                    <p className="text-2xl font-bold text-destructive">{showDetailsDialog.errors_count}</p>
                  </div>
                </div>

                {showDetailsDialog.error_details && Array.isArray(showDetailsDialog.error_details) && (
                  <div>
                    <h4 className="font-medium text-destructive mb-2">Errors</h4>
                    <div className="space-y-1">
                      {(showDetailsDialog.error_details as string[]).map((error, idx) => (
                        <p key={idx} className="text-sm bg-destructive/10 px-3 py-2 rounded">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {showDetailsDialog.sync_log && Array.isArray(showDetailsDialog.sync_log) && (
                  <div>
                    <h4 className="font-medium mb-2">Full Sync Log</h4>
                    <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-1">
                      {(showDetailsDialog.sync_log as string[]).map((entry, idx) => (
                        <p key={idx} className="text-muted-foreground">{entry}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
