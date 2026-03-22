import React, { useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Loader2, BarChart3, TrendingUp, Brain, FileText } from 'lucide-react';
import { ChartExportButton } from '@/components/reports/ChartExportButton';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

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
  selectedRecordId?: string;
}

export function AnalyticsPanel({ perfProjectId, selectedRecordId }: Props) {
  const { alerts, predictions, loading } = usePerformanceMonitoring(perfProjectId);
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

  // Fetch selected submission only
  const { data: submission } = useQuery({
    queryKey: ['perf-analytics-submission', selectedRecordId],
    queryFn: async () => {
      if (!selectedRecordId) return null;
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submission_data, submitted_at, submission_ref_id')
        .eq('id', selectedRecordId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRecordId,
  });

  // Fetch form fields
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

  const fieldLookup = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {};
    formFields.forEach((f: any) => { map[f.label] = { id: f.id, label: f.label }; });
    return map;
  }, [formFields]);

  const resolveValue = (data: any, label: string): any => {
    const field = fieldLookup[label];
    if (!field) return undefined;
    const raw = data?.[field.id];
    if (raw == null) return undefined;
    if (typeof raw === 'object' && raw.value !== undefined) return raw.value;
    return raw;
  };

  // Build record data for display
  const numericData = useMemo(() => {
    if (!submission) return [];
    const submissionData = submission.submission_data || {};
    return NUMERIC_FIELD_LABELS
      .map(label => {
        const val = resolveValue(submissionData, label);
        if (val == null || isNaN(Number(val))) return null;
        return { label, value: Number(val) };
      })
      .filter(Boolean) as { label: string; value: number }[];
  }, [submission, fieldLookup]);

  const categoryData = useMemo(() => {
    if (!submission) return [];
    const submissionData = submission.submission_data || {};
    return CATEGORY_FIELD_LABELS
      .map(label => {
        const val = resolveValue(submissionData, label);
        if (!val || String(val).trim() === '') return null;
        return { label, value: String(val) };
      })
      .filter(Boolean) as { label: string; value: string }[];
  }, [submission, fieldLookup]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!selectedRecordId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">Select a Record</p>
          <p className="text-sm text-muted-foreground mt-1">Choose a record from the selector above to view its report.</p>
        </CardContent>
      </Card>
    );
  }

  if (!submission) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">Loading record data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" ref={chartContainerRef}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Record Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Data for record: {submission.submission_ref_id || submission.id.slice(0, 8)}
          </p>
        </div>
        <ChartExportButton
          chartRef={chartContainerRef as React.RefObject<HTMLDivElement>}
          filename="performance-record-report"
          title="Performance Record Report"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Numeric Fields</p>
            <p className="text-2xl font-bold text-foreground">{numericData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Category Fields</p>
            <p className="text-2xl font-bold text-primary">{categoryData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Alerts</p>
            <p className="text-2xl font-bold text-orange-500">{alerts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">AI Predictions</p>
            <p className="text-2xl font-bold text-foreground">{predictions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Fields */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status & Category Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {categoryData.map(c => (
                <div key={c.label} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card">
                  <span className="text-xs text-muted-foreground">{c.label}:</span>
                  <Badge variant="secondary">{c.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Numeric Data Table */}
      {numericData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Numeric Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Metric</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {numericData.map(d => (
                    <tr key={d.label} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium text-foreground">{d.label}</td>
                      <td className="py-2 px-3 text-right text-foreground font-mono">{d.value.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bar Chart of Numeric Data */}
      {numericData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Metric Values Chart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={numericData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
