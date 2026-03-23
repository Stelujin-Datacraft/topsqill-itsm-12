import React, { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Loader2, BarChart3, TrendingUp, FileText, DollarSign, Clock, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { ChartExportButton } from '@/components/reports/ChartExportButton';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const NUMERIC_FIELD_LABELS = [
  'Planned Budget', 'Actual Cost', 'Earned Value (EV)', 'Actual Cost Value (AC)',
  'Planned Value (PV)', 'Risk Score', 'Predicted Delay Days', 'Predicted Cost Overrun (%)',
  'Planned Hours', 'Actual Hours', 'Defect Count', 'Forecasted Cost',
  'Passed Controls', 'Total Controls', 'Task Delay Days', 'Overtime Hours',
  'Risk Prediction Score',
];

const SUM_FIELDS = ['Planned Budget', 'Actual Cost', 'Earned Value (EV)', 'Actual Cost Value (AC)', 'Planned Value (PV)', 'Planned Hours', 'Actual Hours', 'Defect Count', 'Forecasted Cost', 'Passed Controls', 'Total Controls', 'Overtime Hours'];
const AVG_FIELDS = ['Risk Score', 'Predicted Delay Days', 'Predicted Cost Overrun (%)', 'Task Delay Days', 'Risk Prediction Score'];

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
  const isAllRecords = selectedRecordId === '__all__';

  const { data: submissions = [] } = useQuery({
    queryKey: ['perf-analytics-submissions', selectedRecordId, formId],
    queryFn: async () => {
      if (!formId) return [];
      if (isAllRecords) {
        const { data, error } = await supabase
          .from('form_submissions')
          .select('id, submission_data, submitted_at, submission_ref_id')
          .eq('form_id', formId)
          .order('submitted_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        return data || [];
      } else {
        if (!selectedRecordId) return [];
        const { data, error } = await supabase
          .from('form_submissions')
          .select('id, submission_data, submitted_at, submission_ref_id')
          .eq('id', selectedRecordId)
          .single();
        if (error) throw error;
        return data ? [data] : [];
      }
    },
    enabled: !!formId && !!selectedRecordId,
  });

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

  // Aggregated numeric data - SUM for totals, AVG for rates/scores
  const numericData = useMemo(() => {
    if (submissions.length === 0) return [];
    if (isAllRecords) {
      return NUMERIC_FIELD_LABELS.map(label => {
        const values = submissions.map((s: any) => {
          const val = resolveValue(s.submission_data || {}, label);
          return val != null && !isNaN(Number(val)) ? Number(val) : null;
        }).filter((v): v is number => v !== null);
        if (values.length === 0) return null;
        const isSumField = SUM_FIELDS.includes(label);
        const result = isSumField
          ? values.reduce((a, b) => a + b, 0)
          : values.reduce((a, b) => a + b, 0) / values.length;
        return { label, value: Math.round(result * 100) / 100, type: isSumField ? 'SUM' : 'AVG', count: values.length };
      }).filter(Boolean) as { label: string; value: number; type: string; count: number }[];
    }
    const submissionData = submissions[0]?.submission_data || {};
    return NUMERIC_FIELD_LABELS
      .map(label => {
        const val = resolveValue(submissionData, label);
        if (val == null || isNaN(Number(val))) return null;
        return { label, value: Number(val), type: 'RAW', count: 1 };
      })
      .filter(Boolean) as { label: string; value: number; type: string; count: number }[];
  }, [submissions, fieldLookup, isAllRecords]);

  // Category distribution for all records
  const categoryDistribution = useMemo(() => {
    if (submissions.length === 0) return {};
    const dist: Record<string, Record<string, number>> = {};
    CATEGORY_FIELD_LABELS.forEach(label => { dist[label] = {}; });

    submissions.forEach((s: any) => {
      const data = s.submission_data || {};
      CATEGORY_FIELD_LABELS.forEach(label => {
        const val = resolveValue(data, label);
        if (val && String(val).trim()) {
          const key = String(val).trim();
          dist[label][key] = (dist[label][key] || 0) + 1;
        }
      });
    });
    return dist;
  }, [submissions, fieldLookup]);

  // Single record category data
  const categoryData = useMemo(() => {
    if (submissions.length === 0 || isAllRecords) return [];
    const submissionData = submissions[0]?.submission_data || {};
    return CATEGORY_FIELD_LABELS
      .map(label => {
        const val = resolveValue(submissionData, label);
        if (!val || String(val).trim() === '') return null;
        return { label, value: String(val) };
      })
      .filter(Boolean) as { label: string; value: string }[];
  }, [submissions, fieldLookup, isAllRecords]);

  // Portfolio KPIs for all records
  const portfolioKPIs = useMemo(() => {
    if (!isAllRecords || submissions.length === 0) return null;
    const getSum = (label: string) => {
      const item = numericData.find(d => d.label === label);
      return item?.value || 0;
    };
    const getAvg = (label: string) => {
      const item = numericData.find(d => d.label === label);
      return item?.value || 0;
    };

    const totalBudget = getSum('Planned Budget');
    const totalActualCost = getSum('Actual Cost');
    const totalEV = getSum('Earned Value (EV)');
    const totalAC = getSum('Actual Cost Value (AC)');
    const totalPV = getSum('Planned Value (PV)');

    const budgetUtil = totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : 0;
    const cpi = totalAC > 0 ? totalEV / totalAC : 0;
    const spi = totalPV > 0 ? totalEV / totalPV : 0;

    // Count statuses
    const statusDist = categoryDistribution['Project Status'] || {};
    const totalProjects = submissions.length;
    const activeProjects = statusDist['In Progress'] || 0;
    const completedProjects = statusDist['Completed'] || 0;

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalBudget,
      totalActualCost,
      budgetUtilization: Math.round(budgetUtil * 100) / 100,
      portfolioCPI: Math.round(cpi * 1000) / 1000,
      portfolioSPI: Math.round(spi * 1000) / 1000,
      avgRiskScore: getAvg('Risk Score'),
      avgPredictedDelay: getAvg('Predicted Delay Days'),
      avgCostOverrun: getAvg('Predicted Cost Overrun (%)'),
    };
  }, [isAllRecords, submissions, numericData, categoryDistribution]);

  // Budget comparison chart data
  const budgetChartData = useMemo(() => {
    if (!isAllRecords || submissions.length === 0) return [];
    return submissions.slice(0, 20).map((s: any, i: number) => {
      const data = s.submission_data || {};
      const planned = resolveValue(data, 'Planned Budget');
      const actual = resolveValue(data, 'Actual Cost');
      const name = s.submission_ref_id || `Record ${i + 1}`;
      return {
        name: name.length > 12 ? name.slice(0, 12) + '…' : name,
        'Planned Budget': planned != null ? Number(planned) : 0,
        'Actual Cost': actual != null ? Number(actual) : 0,
      };
    });
  }, [isAllRecords, submissions, fieldLookup]);

  // Risk distribution for all records
  const riskDistribution = useMemo(() => {
    if (!isAllRecords || submissions.length === 0) return [];
    const buckets = { 'Low (0-30)': 0, 'Medium (31-60)': 0, 'High (61-80)': 0, 'Critical (81+)': 0 };
    submissions.forEach((s: any) => {
      const val = resolveValue(s.submission_data || {}, 'Risk Score');
      if (val == null) return;
      const score = Number(val);
      if (score <= 30) buckets['Low (0-30)']++;
      else if (score <= 60) buckets['Medium (31-60)']++;
      else if (score <= 80) buckets['High (61-80)']++;
      else buckets['Critical (81+)']++;
    });
    return Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [isAllRecords, submissions, fieldLookup]);

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

  if (submissions.length === 0 && selectedRecordId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">Loading record data...</p>
        </CardContent>
      </Card>
    );
  }

  // ========== ALL RECORDS PORTFOLIO REPORT ==========
  if (isAllRecords && portfolioKPIs) {
    return (
      <div className="space-y-6" ref={chartContainerRef}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Portfolio Report — All Records
            </h2>
            <p className="text-sm text-muted-foreground">
              Aggregated analysis across {submissions.length} records
            </p>
          </div>
          <ChartExportButton
            chartRef={chartContainerRef as React.RefObject<HTMLDivElement>}
            filename="portfolio-report"
            title="Portfolio Performance Report"
          />
        </div>

        {/* Portfolio Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{portfolioKPIs.totalProjects}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{portfolioKPIs.activeProjects}</p>
              <p className="text-xs text-muted-foreground">{portfolioKPIs.completedProjects} completed</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">Budget Utilization</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{portfolioKPIs.budgetUtilization}%</p>
              <Badge variant={portfolioKPIs.budgetUtilization > 100 ? 'destructive' : 'secondary'} className="text-xs mt-1">
                {portfolioKPIs.budgetUtilization > 100 ? 'Over Budget' : 'Within Budget'}
              </Badge>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground">Avg Risk Score</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{portfolioKPIs.avgRiskScore}</p>
            </CardContent>
          </Card>
        </div>

        {/* CPI / SPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Portfolio CPI</p>
              <p className={`text-2xl font-bold ${portfolioKPIs.portfolioCPI >= 1 ? 'text-green-600' : 'text-destructive'}`}>
                {portfolioKPIs.portfolioCPI}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Portfolio SPI</p>
              <p className={`text-2xl font-bold ${portfolioKPIs.portfolioSPI >= 1 ? 'text-green-600' : 'text-destructive'}`}>
                {portfolioKPIs.portfolioSPI}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total Planned Budget</p>
              <p className="text-lg font-bold text-foreground font-mono">{portfolioKPIs.totalBudget.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total Actual Cost</p>
              <p className="text-lg font-bold text-foreground font-mono">{portfolioKPIs.totalActualCost.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Predictive Averages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Avg Predicted Delay</p>
              </div>
              <p className="text-xl font-bold text-foreground">{portfolioKPIs.avgPredictedDelay} days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Avg Cost Overrun</p>
              </div>
              <p className="text-xl font-bold text-foreground">{portfolioKPIs.avgCostOverrun}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Alerts / Predictions</p>
              </div>
              <p className="text-xl font-bold text-foreground">{alerts.length} / {predictions.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Distribution Pie Charts */}
        {Object.entries(categoryDistribution).some(([, dist]) => Object.keys(dist).length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(categoryDistribution).map(([label, dist]) => {
              const chartData = Object.entries(dist).map(([name, value]) => ({ name, value }));
              if (chartData.length === 0) return null;
              return (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{label} Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Budget Comparison Bar Chart */}
        {budgetChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Budget vs Actual Cost (per record)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Legend />
                  <Bar dataKey="Planned Budget" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Risk Distribution */}
        {riskDistribution.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Risk Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {riskDistribution.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444', '#7c2d12'][i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Full Metrics Table */}
        {numericData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Aggregated Metrics ({submissions.length} records)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Metric</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Value</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Aggregation</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {numericData.map(d => (
                      <tr key={d.label} className="border-b border-border/50">
                        <td className="py-2 px-3 font-medium text-foreground">{d.label}</td>
                        <td className="py-2 px-3 text-right text-foreground font-mono">{d.value.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          <Badge variant="outline" className="text-xs">{d.type}</Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aggregated Metrics Bar Chart */}
        {numericData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Metric Values Chart
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(300, numericData.length * 30)}>
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

  // ========== SINGLE RECORD REPORT ==========
  return (
    <div className="space-y-6" ref={chartContainerRef}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Record Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Data for record: {submissions[0]?.submission_ref_id || submissions[0]?.id?.slice(0, 8)}
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

      {/* Bar Chart */}
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
