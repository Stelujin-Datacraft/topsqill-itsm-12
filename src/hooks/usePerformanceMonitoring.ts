import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/hooks/use-toast';


export interface PerformanceAlert {
  id: string;
  project_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  ai_generated: boolean;
  ai_confidence?: number;
  ai_reasoning?: string;
  ai_recommendation?: string;
  metric_name?: string;
  threshold_value?: number;
  actual_value?: number;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface PerformancePrediction {
  id: string;
  project_id: string;
  prediction_type: string;
  prediction_date: string;
  predicted_value?: number;
  confidence_level?: number;
  prediction_range_low?: number;
  prediction_range_high?: number;
  reasoning?: string;
  created_at: string;
}

export interface PerformanceThreshold {
  id: string;
  project_id: string;
  metric_name: string;
  operator: string;
  threshold_value: number;
  severity: string;
  is_active: boolean;
  send_email: boolean;
  data_source_id?: string;
  form_field_id?: string;
  form_field_label?: string;
  data_limit?: number;
}

export interface AIAnalysis {
  risk_score: number;
  health_status: string;
  summary: string;
  anomalies: Array<{
    metric: string;
    description: string;
    severity: string;
    value?: number;
    expected_value?: number;
  }>;
  predictions: Array<{
    type: string;
    description: string;
    predicted_value?: number;
    confidence: number;
    timeframe?: string;
  }>;
  recommendations: Array<{
    priority: string;
    title: string;
    description: string;
    impact?: string;
  }>;
  threshold_violations?: Array<{
    metric_name: string;
    threshold_value?: number;
    actual_value: number;
    severity?: string;
  }>;
}

export function usePerformanceMonitoring() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const projectId = currentProject?.id;

  // Fetch alerts
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ['performance-alerts', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('performance_alerts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as PerformanceAlert[];
    },
    enabled: !!projectId,
  });

  // Fetch predictions
  const { data: predictions = [], isLoading: loadingPredictions } = useQuery({
    queryKey: ['performance-predictions', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('performance_predictions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as PerformancePrediction[];
    },
    enabled: !!projectId,
  });

  // Fetch thresholds
  const { data: thresholds = [], isLoading: loadingThresholds } = useQuery({
    queryKey: ['performance-thresholds', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('performance_thresholds')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PerformanceThreshold[];
    },
    enabled: !!projectId,
  });

  // Update alert status
  const updateAlertStatus = useMutation({
    mutationFn: async ({ alertId, status }: { alertId: string; status: string }) => {
      const updates: any = { status };
      if (status === 'acknowledged') {
        updates.acknowledged_by = userProfile?.id;
        updates.acknowledged_at = new Date().toISOString();
      } else if (status === 'resolved') {
        updates.resolved_by = userProfile?.id;
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('performance_alerts')
        .update(updates)
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-alerts', projectId] });
    },
  });

  // Create threshold
  const createThreshold = useMutation({
    mutationFn: async (thresholdData: Partial<PerformanceThreshold>) => {
      if (!projectId || !userProfile) throw new Error('Project required');
      const insertData: any = {
        metric_name: thresholdData.metric_name || '',
        operator: thresholdData.operator || '>',
        threshold_value: thresholdData.threshold_value || 0,
        severity: thresholdData.severity || 'medium',
        is_active: thresholdData.is_active ?? true,
        send_email: thresholdData.send_email ?? false,
        project_id: projectId,
        organization_id: userProfile.organization_id,
        created_by: userProfile.id,
      };
      if (thresholdData.data_source_id) insertData.data_source_id = thresholdData.data_source_id;
      if (thresholdData.form_field_id) insertData.form_field_id = thresholdData.form_field_id;
      if (thresholdData.form_field_label) insertData.form_field_label = thresholdData.form_field_label;
      if (thresholdData.data_limit) insertData.data_limit = thresholdData.data_limit;
      const { data, error } = await supabase
        .from('performance_thresholds')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-thresholds', projectId] });
      toast({ title: 'Threshold Created' });
    },
  });

  // Delete threshold
  const deleteThreshold = useMutation({
    mutationFn: async (thresholdId: string) => {
      const { error } = await supabase
        .from('performance_thresholds')
        .delete()
        .eq('id', thresholdId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-thresholds', projectId] });
    },
  });

  // Run AI analysis
  const runAnalysis = useMutation({
    mutationFn: async (): Promise<AIAnalysis> => {
      if (!projectId) throw new Error('Project required');

      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: { project_id: projectId, action: 'analyze' },
      });

      if (error) throw new Error(error.message || 'Analysis failed');
      if (data?.error) throw new Error(data.error);

      return data as AIAnalysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-alerts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['performance-predictions', projectId] });
      toast({ title: 'AI Analysis Complete', description: 'Insights and predictions have been generated.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Analysis Failed', description: err.message, variant: 'destructive' });
    },
  });

  return {
    snapshots,
    alerts,
    predictions,
    thresholds,
    loading: loadingSnapshots || loadingAlerts || loadingPredictions || loadingThresholds,
    createSnapshot,
    updateAlertStatus,
    createThreshold,
    deleteThreshold,
    runAnalysis,
  };
}
