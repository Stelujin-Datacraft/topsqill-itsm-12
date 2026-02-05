 import React, { useEffect, useState } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { formatDistanceToNow } from 'date-fns';
 
 interface SLAInstanceWithDetails {
   id: string;
   submission_id: string;
   field_id: string;
   form_id: string;
   current_stage: string;
   status: string;
   priority: string;
   started_at: string;
   warning_at: string | null;
   breach_at: string | null;
   escalation_count: number;
   current_escalation_level: string | null;
   form?: { name: string; reference_id: string };
   submission?: { submission_ref_id: string };
 }
 
 export function SLADashboardTab() {
   const { userProfile } = useAuth();
   const [instances, setInstances] = useState<SLAInstanceWithDetails[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchInstances = async () => {
     if (!userProfile?.organization_id) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('sla_instances')
         .select(`
           *,
           form:forms(name, reference_id),
           submission:form_submissions(submission_ref_id)
         `)
         .in('status', ['on_track', 'warning', 'breached'])
         .order('breach_at', { ascending: true })
         .limit(50);
 
       if (error) throw error;
       setInstances((data as any[]) || []);
     } catch (err) {
       console.error('Error fetching SLA instances:', err);
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchInstances();
   }, [userProfile?.organization_id]);
 
   const getStatusBadge = (status: string) => {
     switch (status) {
       case 'on_track':
         return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><CheckCircle className="h-3 w-3 mr-1" />On Track</Badge>;
       case 'warning':
         return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>;
       case 'breached':
         return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"><XCircle className="h-3 w-3 mr-1" />Breached</Badge>;
       default:
         return <Badge variant="secondary">{status}</Badge>;
     }
   };
 
   const getPriorityBadge = (priority: string) => {
     switch (priority) {
       case 'high':
         return <Badge variant="destructive" className="text-xs">High</Badge>;
       case 'medium':
         return <Badge variant="default" className="text-xs bg-amber-500">Medium</Badge>;
       case 'low':
         return <Badge variant="secondary" className="text-xs">Low</Badge>;
       default:
         return <Badge variant="outline" className="text-xs">{priority}</Badge>;
     }
   };
 
   const getTimeRemaining = (breachAt: string | null, status: string) => {
     if (!breachAt || status === 'breached') return null;
     const breach = new Date(breachAt);
     const now = new Date();
     if (breach <= now) return 'Overdue';
     return formatDistanceToNow(breach, { addSuffix: false }) + ' remaining';
   };
 
   const getProgress = (startedAt: string, breachAt: string | null, status: string) => {
     if (!breachAt || status === 'breached') return 100;
     const start = new Date(startedAt).getTime();
     const breach = new Date(breachAt).getTime();
     const now = Date.now();
     const total = breach - start;
     const elapsed = now - start;
     return Math.min(100, Math.max(0, (elapsed / total) * 100));
   };
 
   if (loading) {
     return (
       <Card>
         <CardContent className="flex items-center justify-center h-48">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
         </CardContent>
       </Card>
     );
   }
 
   const atRiskInstances = instances.filter(i => i.status === 'warning' || i.status === 'breached');
   const healthyInstances = instances.filter(i => i.status === 'on_track');
 
   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <h2 className="text-lg font-semibold">Active SLA Tracking</h2>
         <Button variant="outline" size="sm" onClick={fetchInstances}>
           <RefreshCw className="h-4 w-4 mr-2" />
           Refresh
         </Button>
       </div>
 
       {/* At Risk Section */}
       {atRiskInstances.length > 0 && (
         <Card className="border-red-200 dark:border-red-800">
           <CardHeader className="pb-3 bg-red-50 dark:bg-red-900/20">
             <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-300">
               <AlertTriangle className="h-5 w-5" />
               At Risk ({atRiskInstances.length})
             </CardTitle>
             <CardDescription>These items require immediate attention</CardDescription>
           </CardHeader>
           <CardContent className="divide-y">
             {atRiskInstances.map((instance) => (
               <div key={instance.id} className="py-3 flex items-center justify-between gap-4">
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="font-medium truncate">
                       {instance.submission?.submission_ref_id || instance.submission_id.slice(0, 8)}
                     </span>
                     {getStatusBadge(instance.status)}
                     {getPriorityBadge(instance.priority)}
                   </div>
                   <div className="text-sm text-muted-foreground flex items-center gap-2">
                     <span>{instance.form?.name || 'Unknown Form'}</span>
                     <span>•</span>
                     <span>Stage: {instance.current_stage}</span>
                     {instance.current_escalation_level && (
                       <>
                         <span>•</span>
                         <Badge variant="outline" className="text-xs">{instance.current_escalation_level}</Badge>
                       </>
                     )}
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="text-sm font-medium text-red-600 dark:text-red-400">
                     {instance.status === 'breached' ? 'SLA Breached' : getTimeRemaining(instance.breach_at, instance.status)}
                   </div>
                   <Progress 
                     value={getProgress(instance.started_at, instance.breach_at, instance.status)} 
                     className="w-24 h-2 mt-1"
                   />
                 </div>
               </div>
             ))}
           </CardContent>
         </Card>
       )}
 
       {/* Healthy Section */}
       <Card>
         <CardHeader className="pb-3">
           <CardTitle className="text-base flex items-center gap-2">
             <CheckCircle className="h-5 w-5 text-green-600" />
             On Track ({healthyInstances.length})
           </CardTitle>
           <CardDescription>Items within SLA thresholds</CardDescription>
         </CardHeader>
         <CardContent>
           {healthyInstances.length === 0 ? (
             <p className="text-center text-muted-foreground py-8">
               No active SLA instances being tracked
             </p>
           ) : (
             <div className="divide-y">
               {healthyInstances.slice(0, 10).map((instance) => (
                 <div key={instance.id} className="py-3 flex items-center justify-between gap-4">
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-1">
                       <span className="font-medium truncate">
                         {instance.submission?.submission_ref_id || instance.submission_id.slice(0, 8)}
                       </span>
                       {getPriorityBadge(instance.priority)}
                     </div>
                     <div className="text-sm text-muted-foreground">
                       {instance.form?.name || 'Unknown Form'} • Stage: {instance.current_stage}
                     </div>
                   </div>
                   <div className="text-right">
                     <div className="text-sm text-green-600 dark:text-green-400">
                       {getTimeRemaining(instance.breach_at, instance.status)}
                     </div>
                     <Progress 
                       value={getProgress(instance.started_at, instance.breach_at, instance.status)} 
                       className="w-24 h-2 mt-1"
                     />
                   </div>
                 </div>
               ))}
               {healthyInstances.length > 10 && (
                 <p className="text-center text-muted-foreground py-2 text-sm">
                   +{healthyInstances.length - 10} more items
                 </p>
               )}
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }