 import React, { useState, useEffect, useCallback } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
   Activity
 } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 import { useProject } from '@/contexts/ProjectContext';
 
 interface QueueItem {
   id: string;
   workflow_id: string;
   submission_id: string | null;
   status: string;
   priority: number;
   retry_count: number;
   max_retries: number;
   last_error: string | null;
   next_retry_at: string | null;
   created_at: string;
   started_at: string | null;
   completed_at: string | null;
   trigger_source: string;
   execution_id: string | null;
   workflows?: { name: string };
 }
 
 interface QueueStats {
   pending: number;
   processing: number;
   completed: number;
   failed: number;
 }
 
 export function WorkflowQueueMonitor() {
   const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
   const [stats, setStats] = useState<QueueStats>({ pending: 0, processing: 0, completed: 0, failed: 0 });
   const [loading, setLoading] = useState(true);
   const [retrying, setRetrying] = useState<string | null>(null);
   const [activeTab, setActiveTab] = useState('all');
   const { currentProject } = useProject();
   const { toast } = useToast();
 
   const loadQueueData = useCallback(async () => {
     if (!currentProject?.id) return;
 
     try {
       setLoading(true);
       
       // Load queue items with workflow names
       const { data: items, error } = await supabase
         .from('workflow_queue')
         .select(`
           *,
           workflows:workflow_id (name)
         `)
         .eq('project_id', currentProject.id)
         .order('created_at', { ascending: false })
         .limit(100);
 
       if (error) throw error;
 
       setQueueItems(items || []);
 
       // Calculate stats
       const newStats = (items || []).reduce((acc, item) => {
         if (item.status === 'pending') acc.pending++;
         else if (item.status === 'processing') acc.processing++;
         else if (item.status === 'completed') acc.completed++;
         else if (item.status === 'failed') acc.failed++;
         return acc;
       }, { pending: 0, processing: 0, completed: 0, failed: 0 });
 
       setStats(newStats);
     } catch (error) {
       console.error('Error loading queue data:', error);
       toast({
         title: "Error",
         description: "Failed to load queue data.",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   }, [currentProject?.id, toast]);
 
   useEffect(() => {
     loadQueueData();
     
     // Auto-refresh every 30 seconds
     const interval = setInterval(loadQueueData, 30000);
     return () => clearInterval(interval);
   }, [loadQueueData]);
 
   const handleRetry = async (itemId: string) => {
     setRetrying(itemId);
     try {
       // Reset the queue item for retry
       const { error } = await supabase
         .from('workflow_queue')
         .update({
           status: 'pending',
           retry_count: 0,
           last_error: null,
           next_retry_at: null
         })
         .eq('id', itemId);
 
       if (error) throw error;
 
       toast({
         title: "Retry Queued",
         description: "Item has been reset and will be processed shortly.",
       });
 
       loadQueueData();
     } catch (error) {
       console.error('Error retrying item:', error);
       toast({
         title: "Retry Failed",
         description: "Could not retry the queue item.",
         variant: "destructive",
       });
     } finally {
       setRetrying(null);
     }
   };
 
   const getStatusIcon = (status: string) => {
     switch (status) {
       case 'completed':
         return <CheckCircle className="h-4 w-4 text-emerald-600" />;
       case 'failed':
         return <XCircle className="h-4 w-4 text-destructive" />;
       case 'processing':
         return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
       case 'pending':
         return <Clock className="h-4 w-4 text-amber-600" />;
       default:
         return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
     }
   };
 
   const getStatusBadgeVariant = (status: string) => {
     switch (status) {
       case 'completed':
         return 'default';
       case 'failed':
         return 'destructive';
       case 'processing':
         return 'secondary';
       case 'pending':
         return 'outline';
       default:
         return 'outline';
     }
   };
 
   const formatTimeAgo = (dateStr: string) => {
     const date = new Date(dateStr);
     const now = new Date();
     const diffMs = now.getTime() - date.getTime();
     const diffMins = Math.floor(diffMs / 60000);
     
     if (diffMins < 1) return 'Just now';
     if (diffMins < 60) return `${diffMins}m ago`;
     const diffHours = Math.floor(diffMins / 60);
     if (diffHours < 24) return `${diffHours}h ago`;
     const diffDays = Math.floor(diffHours / 24);
     return `${diffDays}d ago`;
   };
 
   const filteredItems = activeTab === 'all' 
     ? queueItems 
     : queueItems.filter(item => item.status === activeTab);
 
   if (!currentProject) {
     return null;
   }
 
   return (
     <div className="space-y-4">
      {/* Queue Table */}
       <Card>
         <CardHeader className="flex flex-row items-center justify-between">
           <div>
             <CardTitle className="flex items-center gap-2">
               <Inbox className="h-5 w-5" />
               Workflow Queue
             </CardTitle>
             <CardDescription>
               Monitor and manage queued workflow executions
             </CardDescription>
           </div>
           <Button 
             variant="outline" 
             size="sm" 
             onClick={loadQueueData}
             disabled={loading}
           >
             <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
             Refresh
           </Button>
         </CardHeader>
         <CardContent>
           <Tabs value={activeTab} onValueChange={setActiveTab}>
             <TabsList className="mb-4">
               <TabsTrigger value="all" className="flex items-center gap-2">
                 <ListFilter className="h-4 w-4" />
                 All ({queueItems.length})
               </TabsTrigger>
               <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
               <TabsTrigger value="processing">Processing ({stats.processing})</TabsTrigger>
               <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
             </TabsList>
 
             <TabsContent value={activeTab} className="mt-0">
               {loading ? (
                 <div className="flex items-center justify-center py-8">
                   <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                 </div>
               ) : filteredItems.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                   <p>No queue items found</p>
                 </div>
               ) : (
                 <div className="rounded-md border">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Status</TableHead>
                         <TableHead>Workflow</TableHead>
                         <TableHead>Source</TableHead>
                         <TableHead>Priority</TableHead>
                         <TableHead>Retries</TableHead>
                         <TableHead>Created</TableHead>
                         <TableHead>Actions</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {filteredItems.map((item) => (
                         <TableRow key={item.id}>
                           <TableCell>
                             <div className="flex items-center gap-2">
                               {getStatusIcon(item.status)}
                               <Badge variant={getStatusBadgeVariant(item.status)}>
                                 {item.status}
                               </Badge>
                             </div>
                           </TableCell>
                           <TableCell>
                             <span className="font-medium">
                               {item.workflows?.name || 'Unknown'}
                             </span>
                           </TableCell>
                           <TableCell>
                             <Badge variant="outline" className="text-xs">
                               {item.trigger_source}
                             </Badge>
                           </TableCell>
                           <TableCell>
                             <span className="text-sm">{item.priority}</span>
                           </TableCell>
                           <TableCell>
                             <span className={`text-sm ${item.retry_count > 0 ? 'text-amber-700' : ''}`}>
                               {item.retry_count}/{item.max_retries}
                             </span>
                           </TableCell>
                           <TableCell>
                             <span className="text-sm text-muted-foreground">
                               {formatTimeAgo(item.created_at)}
                             </span>
                           </TableCell>
                           <TableCell>
                             {item.status === 'failed' && (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => handleRetry(item.id)}
                                 disabled={retrying === item.id}
                               >
                                 {retrying === item.id ? (
                                   <Loader2 className="h-4 w-4 animate-spin" />
                                 ) : (
                                   <RotateCcw className="h-4 w-4" />
                                 )}
                                 <span className="ml-1">Retry</span>
                               </Button>
                             )}
                             {item.last_error && (
                               <div className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={item.last_error}>
                                 {item.last_error}
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