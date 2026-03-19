import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/hooks/use-toast';

export interface PerformanceSnapshot {
  id: string;
  project_id: string;
  organization_id?: string;
  created_by: string;
  snapshot_date: string;
  planned_budget: number;
  actual_budget: number;
  budget_variance: number;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  projected_end_date?: string;
  schedule_variance_days: number;
  planned_resources: number;
  actual_resources: number;
  resource_utilization_pct: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  completion_pct: number;
  total_milestones: number;
  completed_milestones: number;
  overdue_milestones: number;
  risk_score: number;
  health_status: 'green' | 'yellow' | 'orange' | 'red';
  custom_metrics?: Record<string, any>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

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

  // Fetch snapshots
  const { data: snapshots = [], isLoading: loadingSnapshots } = useQuery({
    queryKey: ['performance-snapshots', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('performance_snapshots')
        .select('*')
        .eq('project_id', projectId)
        .order('snapshot_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as PerformanceSnapshot[];
    },
    enabled: !!projectId,
  });

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

  // Create snapshot
  const createSnapshot = useMutation({
    mutationFn: async (snapshotData: Partial<PerformanceSnapshot>) => {
      if (!projectId || !userProfile) throw new Error('Project required');
      const insertData = {
        project_id: projectId,
        organization_id: userProfile.organization_id,
        created_by: userProfile.id,
        snapshot_date: snapshotData.snapshot_date || new Date().toISOString().split('T')[0],
        planned_budget: snapshotData.planned_budget || 0,
        actual_budget: snapshotData.actual_budget || 0,
        planned_start_date: snapshotData.planned_start_date || null,
        planned_end_date: snapshotData.planned_end_date || null,
        actual_start_date: snapshotData.actual_start_date || null,
        projected_end_date: snapshotData.projected_end_date || null,
        schedule_variance_days: snapshotData.schedule_variance_days || 0,
        planned_resources: snapshotData.planned_resources || 0,
        actual_resources: snapshotData.actual_resources || 0,
        resource_utilization_pct: snapshotData.resource_utilization_pct || 0,
        total_tasks: snapshotData.total_tasks || 0,
        completed_tasks: snapshotData.completed_tasks || 0,
        in_progress_tasks: snapshotData.in_progress_tasks || 0,
        blocked_tasks: snapshotData.blocked_tasks || 0,
        total_milestones: snapshotData.total_milestones || 0,
        completed_milestones: snapshotData.completed_milestones || 0,
        overdue_milestones: snapshotData.overdue_milestones || 0,
        risk_score: snapshotData.risk_score || 0,
        health_status: snapshotData.health_status || 'green',
        notes: snapshotData.notes || null,
      };
      const { data, error } = await supabase
        .from('performance_snapshots')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-snapshots', projectId] });
      toast({ title: 'Snapshot Created', description: 'Performance data recorded successfully.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
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
