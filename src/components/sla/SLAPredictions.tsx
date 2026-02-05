 import React, { useState, useEffect } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 import { Loader2, AlertTriangle, Clock, TrendingUp, RefreshCw, Brain, ChevronRight } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useNavigate } from 'react-router-dom';
 import ReactMarkdown from 'react-markdown';
 
 interface Prediction {
   id: string;
   submission_id: string;
   form_name: string;
   submission_ref: string;
   template_name: string;
   status: string;
   due_at: string;
   hours_remaining: number;
   percent_elapsed: number;
   risk_score: number;
   risk_level: 'low' | 'medium' | 'high' | 'critical';
   historical_breach_rate: number;
   avg_resolution_hours: number;
   recommendation: string;
   current_stage?: string;
 }
 
 interface Summary {
   total_active: number;
   critical: number;
   high: number;
   medium: number;
   low: number;
   average_risk_score: number;
 }
 
 export function SLAPredictions() {
   const [predictions, setPredictions] = useState<Prediction[]>([]);
   const [summary, setSummary] = useState<Summary | null>(null);
   const [aiInsights, setAiInsights] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const navigate = useNavigate();
 
   const loadPredictions = async () => {
     setLoading(true);
     setError(null);
     
     try {
       const { data, error } = await supabase.functions.invoke('predict-sla-breach');
       
       if (error) throw error;
       
       if (data.success) {
         setPredictions(data.predictions || []);
         setSummary(data.summary || null);
         setAiInsights(data.ai_insights || null);
       } else {
         throw new Error(data.error || 'Failed to load predictions');
       }
     } catch (err) {
       console.error('Error loading predictions:', err);
       setError(err instanceof Error ? err.message : 'Failed to load predictions');
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     loadPredictions();
   }, []);
 
   const getRiskColor = (level: string) => {
     switch (level) {
       case 'critical': return 'bg-red-500 text-white';
       case 'high': return 'bg-orange-500 text-white';
       case 'medium': return 'bg-amber-500 text-white';
       case 'low': return 'bg-green-500 text-white';
       default: return 'bg-muted';
     }
   };
 
   const getProgressColor = (score: number) => {
     if (score >= 70) return 'bg-red-500';
     if (score >= 50) return 'bg-orange-500';
     if (score >= 30) return 'bg-amber-500';
     return 'bg-green-500';
   };
 
   if (loading) {
     return (
       <div className="flex items-center justify-center h-64">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (error) {
     return (
       <Alert variant="destructive">
         <AlertTriangle className="h-4 w-4" />
         <AlertTitle>Error</AlertTitle>
         <AlertDescription>{error}</AlertDescription>
       </Alert>
     );
   }
 
   return (
     <div className="space-y-6">
       {/* Summary Cards */}
       <div className="flex items-center justify-between">
         <h3 className="text-lg font-semibold flex items-center gap-2">
           <Brain className="h-5 w-5 text-primary" />
           AI-Powered SLA Predictions
         </h3>
         <Button variant="outline" size="sm" onClick={loadPredictions}>
           <RefreshCw className="h-4 w-4 mr-2" />
           Refresh
         </Button>
       </div>
 
       {summary && (
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
           <Card>
             <CardHeader className="pb-2">
               <CardDescription>Total Active</CardDescription>
               <CardTitle className="text-2xl">{summary.total_active}</CardTitle>
             </CardHeader>
           </Card>
           <Card className="border-red-200 dark:border-red-900">
             <CardHeader className="pb-2">
               <CardDescription className="text-red-600">Critical</CardDescription>
               <CardTitle className="text-2xl text-red-600">{summary.critical}</CardTitle>
             </CardHeader>
           </Card>
           <Card className="border-orange-200 dark:border-orange-900">
             <CardHeader className="pb-2">
               <CardDescription className="text-orange-600">High Risk</CardDescription>
               <CardTitle className="text-2xl text-orange-600">{summary.high}</CardTitle>
             </CardHeader>
           </Card>
           <Card className="border-amber-200 dark:border-amber-900">
             <CardHeader className="pb-2">
               <CardDescription className="text-amber-600">Medium</CardDescription>
               <CardTitle className="text-2xl text-amber-600">{summary.medium}</CardTitle>
             </CardHeader>
           </Card>
           <Card className="border-green-200 dark:border-green-900">
             <CardHeader className="pb-2">
               <CardDescription className="text-green-600">Low Risk</CardDescription>
               <CardTitle className="text-2xl text-green-600">{summary.low}</CardTitle>
             </CardHeader>
           </Card>
         </div>
       )}
 
       {/* AI Insights */}
       {aiInsights && (
         <Alert className="border-primary/30 bg-primary/5">
           <Brain className="h-4 w-4 text-primary" />
           <AlertTitle className="text-primary">AI Insights</AlertTitle>
           <AlertDescription className="prose prose-sm dark:prose-invert max-w-none">
             <ReactMarkdown>{aiInsights}</ReactMarkdown>
           </AlertDescription>
         </Alert>
       )}
 
       {/* Predictions List */}
       {predictions.length === 0 ? (
         <Card>
           <CardContent className="py-8 text-center text-muted-foreground">
             <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
             <p>No active SLAs to analyze</p>
           </CardContent>
         </Card>
       ) : (
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Risk Assessment</CardTitle>
             <CardDescription>Sorted by breach probability</CardDescription>
           </CardHeader>
           <CardContent className="p-0">
             <ScrollArea className="h-[400px]">
               <div className="divide-y">
                 {predictions.map((prediction) => (
                   <div
                     key={prediction.id}
                     className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                     onClick={() => navigate(`/submissions/${prediction.submission_id}`)}
                   >
                     <div className="flex items-start justify-between gap-4">
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                           <span className="font-medium truncate">{prediction.form_name}</span>
                           <Badge variant="outline" className="text-xs">
                             {prediction.submission_ref}
                           </Badge>
                           <Badge className={getRiskColor(prediction.risk_level)}>
                             {prediction.risk_level.toUpperCase()}
                           </Badge>
                         </div>
                         <div className="text-sm text-muted-foreground mb-2">
                           {prediction.template_name}
                           {prediction.current_stage && (
                             <span className="ml-2">• Stage: {prediction.current_stage}</span>
                           )}
                         </div>
                         <div className="flex items-center gap-4 text-xs text-muted-foreground">
                           <span className="flex items-center gap-1">
                             <Clock className="h-3 w-3" />
                             {prediction.hours_remaining.toFixed(1)}h remaining
                           </span>
                           <span>
                             Historical breach rate: {prediction.historical_breach_rate}%
                           </span>
                           <span>
                             Avg resolution: {prediction.avg_resolution_hours}h
                           </span>
                         </div>
                       </div>
                       <div className="flex flex-col items-end gap-2">
                         <div className="text-right">
                           <div className="text-2xl font-bold">{prediction.risk_score}%</div>
                           <div className="text-xs text-muted-foreground">Risk Score</div>
                         </div>
                         <div className="w-24">
                           <Progress
                             value={prediction.risk_score}
                             className="h-2"
                             style={{
                               ['--progress-background' as any]: getProgressColor(prediction.risk_score)
                             }}
                           />
                         </div>
                       </div>
                     </div>
                     <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                       💡 {prediction.recommendation}
                     </div>
                   </div>
                 ))}
               </div>
             </ScrollArea>
           </CardContent>
         </Card>
       )}
     </div>
   );
 }