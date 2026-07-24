import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';

function buildFallbackAnalysis(
  analysisContext: Record<string, unknown> | null,
  thresholds: Record<string, unknown>[] = [],
  isAllRecords = false,
) {
  const numericSignals: Array<{ metric: string; value: number; avg?: number; stdDev?: number }> = [];

  if (analysisContext?.mappedFields) {
    for (const [label, info] of Object.entries(analysisContext.mappedFields as Record<string, unknown>)) {
      const value = Number((info as Record<string, unknown>)?.value);
      const stats = (analysisContext.portfolioStats as Record<string, Record<string, number>>)?.[label];
      if (!Number.isNaN(value)) {
        numericSignals.push({
          metric: label,
          value,
          avg: typeof stats?.avg === 'number' ? stats.avg : undefined,
          stdDev: typeof stats?.stdDev === 'number' ? stats.stdDev : undefined,
        });
      }
    }
  } else if (analysisContext?.aggregatedMetrics) {
    for (const [label, stats] of Object.entries(analysisContext.aggregatedMetrics as Record<string, unknown>)) {
      const avg = Number((stats as Record<string, unknown>)?.avg);
      if (!Number.isNaN(avg)) {
        numericSignals.push({ metric: label, value: avg, avg });
      }
    }
  }

  const anomalies = numericSignals
    .filter((signal) =>
      typeof signal.avg === 'number' &&
      typeof signal.stdDev === 'number' &&
      signal.stdDev > 0 &&
      Math.abs(signal.value - signal.avg) > signal.stdDev * 2,
    )
    .slice(0, 5)
    .map((signal) => ({
      metric: signal.metric,
      description: `${signal.metric} is ${signal.value}, outside portfolio average ${signal.avg}.`,
      severity: Math.abs(signal.value - (signal.avg ?? 0)) > (signal.stdDev ?? 0) * 3 ? 'high' : 'medium',
      value: signal.value,
      expected_value: signal.avg,
    }));

  const thresholdViolations = (thresholds || [])
    .map((threshold) => {
      const fieldLabel = (threshold.form_field_label || threshold.metric_name) as string;
      const matchingSignal = numericSignals.find(
        (signal) => signal.metric === fieldLabel || signal.metric === threshold.metric_name,
      );
      if (!matchingSignal) return null;

      const actualValue = matchingSignal.value;
      const thresholdValue = Number(threshold.threshold_value);
      if (Number.isNaN(actualValue) || Number.isNaN(thresholdValue)) return null;

      const operator = threshold.operator as string;
      let breached = false;
      switch (operator) {
        case '>': breached = actualValue > thresholdValue; break;
        case '>=': breached = actualValue >= thresholdValue; break;
        case '<': breached = actualValue < thresholdValue; break;
        case '<=': breached = actualValue <= thresholdValue; break;
        case '==': breached = actualValue === thresholdValue; break;
        case '!=': breached = actualValue !== thresholdValue; break;
      }

      if (!breached) return null;
      return {
        metric: fieldLabel,
        actual_value: actualValue,
        threshold_value: thresholdValue,
        operator,
        severity: threshold.severity || 'medium',
      };
    })
    .filter(Boolean);

  return {
    anomalies,
    thresholdViolations,
    summary: `Analyzed ${isAllRecords ? 'portfolio' : 'record'} with ${numericSignals.length} numeric signals.`,
    fallback: true,
  };
}

@Injectable()
export class PerformanceService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
  ) {}

  async analyze(body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const projectId = (body.project_id || body.projectId) as string;
    const performanceProjectId = (body.performance_project_id || body.performanceProjectId) as string | undefined;
    const submissionId = body.submission_id as string | undefined;
    const action = (body.action as string) || 'analyze';

    if (!projectId) {
      return { success: false, error: 'project_id is required' };
    }

    let thresholdQuery = supabase
      .from('performance_thresholds')
      .select('*')
      .eq('project_id', projectId)
      .limit(200);
    if (performanceProjectId) {
      thresholdQuery = thresholdQuery.eq('performance_project_id', performanceProjectId);
    }
    const { data: thresholds } = await thresholdQuery;

    let dataSourceQuery = supabase
      .from('performance_data_sources')
      .select('*')
      .eq('project_id', projectId)
      .limit(20);
    if (performanceProjectId) {
      dataSourceQuery = dataSourceQuery.eq('performance_project_id', performanceProjectId);
    }
    const { data: dataSources } = await dataSourceQuery;

    const isAllRecords = !submissionId;
    let analysisContext: Record<string, unknown> | null = null;

    if (dataSources?.length) {
      const ds = dataSources[0];
      const fieldMappings = Array.isArray(ds.field_mappings) ? ds.field_mappings : [];

      if (isAllRecords) {
        const { data: allSubs } = await supabase
          .from('form_submissions')
          .select('id, submission_data, submitted_at, submission_ref_id')
          .eq('form_id', ds.source_form_id)
          .order('submitted_at', { ascending: false })
          .limit(500);

        const aggregated: Record<string, unknown> = {};
        for (const mapping of fieldMappings) {
          if (mapping.metricRole !== 'numeric_metric') continue;
          const label = mapping.label || mapping.formFieldLabel;
          const values = (allSubs || [])
            .map((s) => parseFloat(s.submission_data?.[mapping.formFieldId]))
            .filter((v) => !Number.isNaN(v));
          if (!values.length) continue;
          const sum = values.reduce((a, b) => a + b, 0);
          aggregated[label] = {
            avg: Math.round((sum / values.length) * 100) / 100,
            sum: Math.round(sum * 100) / 100,
            min: Math.min(...values),
            max: Math.max(...values),
            count: values.length,
          };
        }

        analysisContext = {
          formName: ds.source_form_name,
          totalRecords: allSubs?.length || 0,
          aggregatedMetrics: aggregated,
        };
      } else if (submissionId) {
        const { data: submission } = await supabase
          .from('form_submissions')
          .select('id, submission_data, submitted_at, submission_ref_id')
          .eq('id', submissionId)
          .eq('form_id', ds.source_form_id)
          .maybeSingle();

        if (submission) {
          const mappedFields: Record<string, unknown> = {};
          for (const mapping of fieldMappings) {
            mappedFields[mapping.label || mapping.formFieldLabel] = {
              value: submission.submission_data?.[mapping.formFieldId],
              role: mapping.metricRole,
            };
          }
          analysisContext = {
            formName: ds.source_form_name,
            submissionRefId: submission.submission_ref_id,
            recordData: submission.submission_data,
            mappedFields,
          };
        }
      }
    }

    const fallback = buildFallbackAnalysis(analysisContext, thresholds || [], isAllRecords);

    let aiInsights: unknown = null;
    const apiKey = this.configService.get<string>('LOVABLE_API_KEY');
    if (apiKey && action === 'analyze') {
      const aiResult = await this.aiService.assistant({
        action: 'analyze_performance',
        prompt: `Analyze performance data: ${JSON.stringify({ analysisContext, thresholds: thresholds?.slice(0, 20) })}`,
        context: analysisContext,
      });
      aiInsights = aiResult;
    }

    const alerts = [
      ...(fallback.anomalies || []).map((a) => ({
        project_id: projectId,
        performance_project_id: performanceProjectId,
        alert_type: 'anomaly',
        severity: a.severity,
        title: `Anomaly: ${a.metric}`,
        description: a.description,
        ai_generated: true,
        metric_name: a.metric,
      })),
      ...(fallback.thresholdViolations || []).map((v) => ({
        project_id: projectId,
        performance_project_id: performanceProjectId,
        alert_type: 'threshold_breach',
        severity: v.severity,
        title: `Threshold breach: ${v.metric}`,
        description: `${v.metric} = ${v.actual_value} (threshold ${v.operator} ${v.threshold_value})`,
        ai_generated: false,
        metric_name: v.metric,
      })),
    ];

    if (alerts.length) {
      await supabase.from('performance_alerts').insert(alerts.slice(0, 50));
    }

    const { data: analysis } = await supabase
      .from('performance_analysis_results')
      .insert({
        project_id: projectId,
        performance_project_id: performanceProjectId,
        analysis_type: isAllRecords ? 'portfolio' : 'single_record',
        results: { fallback, aiInsights, context: analysisContext },
      })
      .select()
      .single();

    return {
      success: true,
      alerts: alerts.length,
      analysis,
      fallback,
      aiInsights,
    };
  }
}
