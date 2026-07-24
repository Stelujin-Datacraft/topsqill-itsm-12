import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PerformanceService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async analyze(body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { projectId, organizationId, analysisType } = body as Record<string, string>;

    const { data: snapshots } = await supabase
      .from('performance_snapshots')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: thresholds } = await supabase
      .from('performance_thresholds')
      .select('*')
      .eq('project_id', projectId);

    const alerts: { snapshot_id: string; metric: string; value: unknown; threshold: unknown; severity: string }[] = [];
    for (const snapshot of snapshots || []) {
      for (const threshold of thresholds || []) {
        const value = snapshot.metrics?.[threshold.metric_name];
        if (value !== undefined && value > threshold.critical_threshold) {
          alerts.push({
            snapshot_id: snapshot.id,
            metric: threshold.metric_name,
            value,
            threshold: threshold.critical_threshold,
            severity: 'critical',
          });
        }
      }
    }

    const { data: result } = await supabase
      .from('performance_analysis_results')
      .insert({
        project_id: projectId,
        organization_id: organizationId,
        analysis_type: analysisType || 'kpi',
        results: { alerts, snapshot_count: snapshots?.length || 0 },
      })
      .select()
      .single();

    return { success: true, alerts, analysis: result };
  }
}
