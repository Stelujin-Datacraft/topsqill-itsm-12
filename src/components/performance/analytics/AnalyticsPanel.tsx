import React, { useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { Loader2, BarChart3, PieChart as PieChartIcon, TrendingUp, Activity, Brain } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { ChartExportButton } from '@/components/reports/ChartExportButton';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

// Known numeric fields from the form
const NUMERIC_FIELD_LABELS = [
  'Planned Budget', 'Actual Cost', 'Earned Value (EV)', 'Actual Cost Value (AC)',
  'Planned Value (PV)', 'Risk Score', 'Predicted Delay Days', 'Predicted Cost Overrun (%)',
  'Planned Hours', 'Actual Hours', 'Defect Count', 'Forecasted Cost',
  'Passed Controls', 'Total Controls', 'Task Delay Days', 'Overtime Hours',
  'Risk Prediction Score',
];

const CATEGORY_FIELD_LABELS = [
  'Project Status', 'Task Status', 'Risk Status', 'Priority',
];

interface Props {
  perfProjectId?: string;
}

export function AnalyticsPanel({ perfProjectId }: Props) {
  const { alerts, predictions, thresholds, loading } = usePerformanceMonitoring(perfProjectId);
  const { currentProject } = useProject();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data: dataSources = [] } = useQuery({
    queryKey: ['performance-data-sources', currentProject?.id, perfProjectId],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      let query = supabase
        .from('performance_data_sources')
        .select('*')
        .eq('project_id', currentProject.id)
        .eq('is_active', true);
      if (perfProjectId) query = query.eq('performance_project_id', perfProjectId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProject?.id,
  });

  const formId = dataSources[0]?.source_form_id;

  // Fetch ALL submissions for the linked form
  const { data: submissions = [] } = useQuery({
    queryKey: ['perf-analytics-submissions', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submission_data, submitted_at')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Fetch form fields to map IDs to labels
  const { data: formFields = [] } = useQuery({
    queryKey: ['perf-analytics-form-fields', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Build field lookup: label -> fieldId
  const fieldLookup = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {};
    formFields.forEach((f: any) => {
      map[f.label] = { id: f.id, label: f.label };
    });
    return map;
  }, [formFields]);

  // Resolve value from submission_data by field label
  const resolveValue = (submissionData: any, label: string): any => {
    const field = fieldLookup[label];
    if (!field) return undefined;
    const raw = submissionData?.[field.id];
    if (raw == null) return undefined;
    if (typeof raw === 'object' && raw.value !== undefined) return raw.value;
    return raw;
  };

  // Auto-detect numeric fields present in submissions
  const detectedNumericFields = useMemo(() => {
    if (!submissions.length || !formFields.length) return [];
    const found: { label: string; fieldId: string }[] = [];
    const sample = submissions.slice(0, 5);

    NUMERIC_FIELD_LABELS.forEach(label => {
      const field = fieldLookup[label];
      if (!field) return;
      const hasData = sample.some((s: any) => {
        const v = resolveValue(s.submission_data, label);
        return v != null && !isNaN(Number(v));
      });
      if (hasData) found.push({ label, fieldId: field.id });
    });
    return found;
  }, [submissions, formFields, fieldLookup]);

  // Auto-detect category fields
  const detectedCategoryFields = useMemo(() => {
    if (!submissions.length || !formFields.length) return [];
    const found: { label: string; fieldId: string }[] = [];
    const sample = submissions.slice(0, 5);

    CATEGORY_FIELD_LABELS.forEach(label => {
      const field = fieldLookup[label];
      if (!field) return;
      const hasData = sample.some((s: any) => {
        const v = resolveValue(s.submission_data, label);
        return v != null && String(v).trim() !== '';
      });
      if (hasData) found.push({ label, fieldId: field.id });
    });
    return found;
  }, [submissions, formFields, fieldLookup]);

  // 1. Alert Severity Distribution (Pie)
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach(a => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [alerts]);

  // 2. Alerts Over Time (Area)
  const alertsOverTime = useMemo(() => {
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 13 - i));
      return { date: format(date, 'MMM dd'), count: 0, ts: date.getTime() };
    });
    alerts.forEach(a => {
      const aDate = startOfDay(new Date(a.created_at)).getTime();
      const bucket = last14.find(d => d.ts === aDate);
      if (bucket) bucket.count++;
    });
    return last14.map(({ date, count }) => ({ date, count }));
  }, [alerts]);

  // 3. Prediction Confidence (Bar)
  const predictionData = useMemo(() => {
    return predictions.slice(0, 10).map(p => ({
      type: p.prediction_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      confidence: p.confidence_level != null
        ? (Number(p.confidence_level) > 1 ? Number(p.confidence_level) : Number(p.confidence_level) * 100)
        : 0,
      value: p.predicted_value ?? 0,
    }));
  }, [predictions]);

  // 4. Numeric Metric Trends across ALL submissions
  const metricTrendData = useMemo(() => {
    if (!submissions.length || !detectedNumericFields.length) return [];
    // Pick top 6 numeric fields for readability
    const fields = detectedNumericFields.slice(0, 6);
    return submissions.map((s: any, idx: number) => {
      const row: any = {
        index: idx + 1,
        date: s.submitted_at ? format(new Date(s.submitted_at), 'MMM dd') : `#${idx + 1}`,
      };
      fields.forEach(f => {
        const val = resolveValue(s.submission_data, f.label);
        row[f.label] = val != null ? Number(val) : 0;
      });
      return row;
    });
  }, [submissions, detectedNumericFields]);

  // 5. Category Distribution across ALL submissions
  const categoryData = useMemo(() => {
    if (!submissions.length || !detectedCategoryFields.length) return [];
    const firstCat = detectedCategoryFields[0];
    const counts: Record<string, number> = {};
    submissions.forEach((s: any) => {
      const val = String(resolveValue(s.submission_data, firstCat.label) || 'Unknown');
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [submissions, detectedCategoryFields]);

  // 6. Threshold Status (Radar)
  const thresholdRadar = useMemo(() => {
    if (!thresholds.length) return [];
    return thresholds.filter(t => t.is_active).slice(0, 8).map(t => ({
      metric: t.form_field_label || t.metric_name,
      threshold: t.threshold_value,
      severity: t.severity === 'critical' ? 100 : t.severity === 'high' ? 75 : t.severity === 'medium' ? 50 : 25,
    }));
  }, [thresholds]);

  // 7. Summary stats across all submissions
  const summaryStats = useMemo(() => {
    if (!submissions.length || !detectedNumericFields.length) return [];
    return detectedNumericFields.slice(0, 8).map(f => {
      const values = submissions.map((s: any) => {
        const v = resolveValue(s.submission_data, f.label);
        return v != null ? Number(v) : NaN;
      }).filter(v => !isNaN(v));

      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const max = values.length ? Math.max(...values) : 0;
      const min = values.length ? Math.min(...values) : 0;
      return { label: f.label, avg: Math.round(avg * 100) / 100, max, min, count: values.length };
    });
  }, [submissions, detectedNumericFields]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const hasData = alerts.length > 0 || predictions.length > 0 || submissions.length > 0;

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">No analytics data yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Configure data sources and submit form data to generate reports.
          </p>
        </CardContent>
      </Card>
    );
  }

  const trendFields = detectedNumericFields.slice(0, 6);

  return (
    <div className="space-y-6" ref={chartContainerRef}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Reports & Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Aggregated insights across all {submissions.length} submissions
          </p>
        </div>
        <ChartExportButton
          chartRef={chartContainerRef as React.RefObject<HTMLDivElement>}
          filename="performance-analytics-report"
          title="Performance Analytics Report"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Submissions</p>
            <p className="text-2xl font-bold text-foreground">{submissions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Alerts</p>
            <p className="text-2xl font-bold text-orange-500">{alerts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">AI Predictions</p>
            <p className="text-2xl font-bold text-primary">{predictions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Metrics Detected</p>
            <p className="text-2xl font-bold text-foreground">{detectedNumericFields.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Numeric Summary Table */}
      {summaryStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Key Metrics Summary (All Submissions)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Metric</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Average</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Min</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Max</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryStats.map(s => (
                    <tr key={s.label} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium text-foreground">{s.label}</td>
                      <td className="py-2 px-3 text-right text-foreground">{s.avg.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{s.min.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{s.max.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        {categoryData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                {detectedCategoryFields[0]?.label || 'Category'} Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Alert Severity Distribution */}
        {severityData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Alert Severity Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {severityData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Alerts Over Time */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Alerts Over Time (14 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={alertsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Alerts" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Prediction Confidence */}
        {predictionData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                AI Prediction Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={predictionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="type" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `${Math.round(v)}%`} />
                  <Bar dataKey="confidence" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Confidence %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Threshold Radar */}
        {thresholdRadar.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Active Thresholds Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={thresholdRadar} cx="50%" cy="50%" outerRadius={90}>
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fontSize: 9 }} />
                  <Radar name="Threshold" dataKey="threshold" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Metric Trends - Full Width */}
      {metricTrendData.length > 0 && trendFields.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Metric Trends Across All Submissions
            </CardTitle>
            <CardDescription className="text-xs">
              Tracking {trendFields.length} numeric fields across {submissions.length} records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {trendFields.map((f, i) => (
                  <Line key={f.fieldId} type="monotone" dataKey={f.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} name={f.label} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Metric Comparison Bar Chart */}
      {metricTrendData.length > 0 && trendFields.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Metric Comparison (Latest 20)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metricTrendData.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {trendFields.map((f, i) => (
                  <Bar key={f.fieldId} dataKey={f.label} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} name={f.label} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
