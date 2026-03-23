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

  // EV / AC / PV Area chart data (per record)
  const evTrendData = useMemo(() => {
    if (!isAllRecords || submissions.length === 0) return [];
    return submissions.slice(0, 20).map((s: any, i: number) => {
      const data = s.submission_data || {};
      const name = s.submission_ref_id || `R${i + 1}`;
      return {
        name: name.length > 10 ? name.slice(0, 10) + '…' : name,
        EV: Number(resolveValue(data, 'Earned Value (EV)') || 0),
        AC: Number(resolveValue(data, 'Actual Cost Value (AC)') || 0),
        PV: Number(resolveValue(data, 'Planned Value (PV)') || 0),
      };
    });
  }, [isAllRecords, submissions, fieldLookup]);

  // Hours comparison (stacked bar)
  const hoursData = useMemo(() => {
    if (!isAllRecords || submissions.length === 0) return [];
    return submissions.slice(0, 20).map((s: any, i: number) => {
      const data = s.submission_data || {};
      const name = s.submission_ref_id || `R${i + 1}`;
      return {
        name: name.length > 10 ? name.slice(0, 10) + '…' : name,
        'Planned Hours': Number(resolveValue(data, 'Planned Hours') || 0),
        'Actual Hours': Number(resolveValue(data, 'Actual Hours') || 0),
        'Overtime': Number(resolveValue(data, 'Overtime Hours') || 0),
      };
    });
  }, [isAllRecords, submissions, fieldLookup]);

  // Risk & prediction line chart per record
  const riskLineData = useMemo(() => {
    if (!isAllRecords || submissions.length === 0) return [];
    return submissions.slice(0, 30).map((s: any, i: number) => {
      const data = s.submission_data || {};
      const name = s.submission_ref_id || `R${i + 1}`;
      return {
        name: name.length > 8 ? name.slice(0, 8) + '…' : name,
        'Risk Score': Number(resolveValue(data, 'Risk Score') || 0),
        'Delay Days': Number(resolveValue(data, 'Predicted Delay Days') || 0),
        'Cost Overrun %': Number(resolveValue(data, 'Predicted Cost Overrun (%)') || 0),
      };
    });
  }, [isAllRecords, submissions, fieldLookup]);

  // Radar chart - portfolio performance indices
  const radarData = useMemo(() => {
    if (!isAllRecords || !portfolioKPIs) return [];
    return [
      { metric: 'CPI', value: Math.min(portfolioKPIs.portfolioCPI * 100, 150), fullMark: 150 },
      { metric: 'SPI', value: Math.min(portfolioKPIs.portfolioSPI * 100, 150), fullMark: 150 },
      { metric: 'Budget Util', value: Math.min(portfolioKPIs.budgetUtilization, 150), fullMark: 150 },
      { metric: 'Risk (inv)', value: Math.max(100 - portfolioKPIs.avgRiskScore, 0), fullMark: 100 },
      { metric: 'On-time (inv)', value: Math.max(100 - portfolioKPIs.avgPredictedDelay * 2, 0), fullMark: 100 },
    ];
  }, [isAllRecords, portfolioKPIs]);

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

        {/* EV / AC / PV Area Chart */}
        {evTrendData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Earned Value Analysis (EV vs AC vs PV)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={evTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Legend />
                  <Area type="monotone" dataKey="PV" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} name="Planned Value" />
                  <Area type="monotone" dataKey="EV" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} name="Earned Value" />
                  <Area type="monotone" dataKey="AC" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} name="Actual Cost" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Risk & Prediction Line Chart + Radar side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Risk Line Chart */}
          {riskLineData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Risk & Predictions per Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={riskLineData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Risk Score" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Delay Days" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Cost Overrun %" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Radar Chart - Performance Health */}
          {radarData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Portfolio Health Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid className="stroke-muted" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fontSize: 9 }} />
                    <Radar name="Performance" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Hours Comparison Stacked Bar */}
        {hoursData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Resource Hours Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hoursData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Legend />
                  <Bar dataKey="Planned Hours" stackId="hours" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Actual Hours" stackId="hours" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Overtime" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Risk Distribution Pie */}
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
  // Derived KPIs for single record
  const singleRecordKPIs = useMemo(() => {
    if (isAllRecords || numericData.length === 0) return null;
    const getVal = (label: string) => numericData.find(d => d.label === label)?.value || 0;
    const plannedBudget = getVal('Planned Budget');
    const actualCost = getVal('Actual Cost');
    const ev = getVal('Earned Value (EV)');
    const ac = getVal('Actual Cost Value (AC)');
    const pv = getVal('Planned Value (PV)');
    const riskScore = getVal('Risk Score');
    const delayDays = getVal('Predicted Delay Days');
    const costOverrun = getVal('Predicted Cost Overrun (%)');
    const plannedHours = getVal('Planned Hours');
    const actualHours = getVal('Actual Hours');
    const defectCount = getVal('Defect Count');

    const cpi = ac > 0 ? ev / ac : 0;
    const spi = pv > 0 ? ev / pv : 0;
    const cv = ev - ac;
    const sv = ev - pv;
    const budgetVariance = plannedBudget > 0 ? ((actualCost - plannedBudget) / plannedBudget) * 100 : 0;
    const eac = cpi > 0 ? plannedBudget / cpi : plannedBudget;
    const etc = eac - actualCost;
    const vac = plannedBudget - eac;
    const resourceUtil = plannedHours > 0 ? (actualHours / plannedHours) * 100 : 0;

    return {
      plannedBudget, actualCost, ev, ac, pv, riskScore, delayDays, costOverrun,
      plannedHours, actualHours, defectCount,
      cpi: Math.round(cpi * 1000) / 1000,
      spi: Math.round(spi * 1000) / 1000,
      cv: Math.round(cv * 100) / 100,
      sv: Math.round(sv * 100) / 100,
      budgetVariance: Math.round(budgetVariance * 100) / 100,
      eac: Math.round(eac * 100) / 100,
      etc: Math.round(etc * 100) / 100,
      vac: Math.round(vac * 100) / 100,
      resourceUtil: Math.round(resourceUtil * 100) / 100,
    };
  }, [isAllRecords, numericData]);

  // Budget breakdown for bar chart
  const singleBudgetData = useMemo(() => {
    if (!singleRecordKPIs) return [];
    return [
      { name: 'Planned Budget', value: singleRecordKPIs.plannedBudget, fill: 'hsl(var(--primary))' },
      { name: 'Actual Cost', value: singleRecordKPIs.actualCost, fill: '#f59e0b' },
      { name: 'EAC', value: singleRecordKPIs.eac, fill: '#8b5cf6' },
      { name: 'ETC', value: singleRecordKPIs.etc, fill: '#06b6d4' },
    ].filter(d => d.value > 0);
  }, [singleRecordKPIs]);

  // EVM data for area chart
  const singleEVMData = useMemo(() => {
    if (!singleRecordKPIs) return [];
    return [
      { name: 'Planned Value (PV)', value: singleRecordKPIs.pv },
      { name: 'Earned Value (EV)', value: singleRecordKPIs.ev },
      { name: 'Actual Cost (AC)', value: singleRecordKPIs.ac },
    ].filter(d => d.value > 0);
  }, [singleRecordKPIs]);

  // Radar data for single record
  const singleRadarData = useMemo(() => {
    if (!singleRecordKPIs) return [];
    return [
      { metric: 'CPI', value: Math.min(singleRecordKPIs.cpi * 100, 150), fullMark: 150 },
      { metric: 'SPI', value: Math.min(singleRecordKPIs.spi * 100, 150), fullMark: 150 },
      { metric: 'Budget Health', value: Math.max(100 - Math.abs(singleRecordKPIs.budgetVariance), 0), fullMark: 100 },
      { metric: 'Risk (inv)', value: Math.max(100 - singleRecordKPIs.riskScore, 0), fullMark: 100 },
      { metric: 'Resource Util', value: Math.min(singleRecordKPIs.resourceUtil, 150), fullMark: 150 },
      { metric: 'Quality', value: Math.max(100 - singleRecordKPIs.defectCount * 5, 0), fullMark: 100 },
    ];
  }, [singleRecordKPIs]);

  // Variance data for bar chart
  const varianceData = useMemo(() => {
    if (!singleRecordKPIs) return [];
    return [
      { name: 'Cost Variance', value: singleRecordKPIs.cv, fill: singleRecordKPIs.cv >= 0 ? '#10b981' : '#ef4444' },
      { name: 'Schedule Variance', value: singleRecordKPIs.sv, fill: singleRecordKPIs.sv >= 0 ? '#10b981' : '#ef4444' },
      { name: 'VAC', value: singleRecordKPIs.vac, fill: singleRecordKPIs.vac >= 0 ? '#10b981' : '#ef4444' },
    ];
  }, [singleRecordKPIs]);

  // Hours breakdown for pie chart
  const hoursBreakdown = useMemo(() => {
    if (!singleRecordKPIs) return [];
    const overtime = numericData.find(d => d.label === 'Overtime Hours')?.value || 0;
    const regularHours = Math.max(singleRecordKPIs.actualHours - overtime, 0);
    const result = [];
    if (regularHours > 0) result.push({ name: 'Regular Hours', value: regularHours });
    if (overtime > 0) result.push({ name: 'Overtime Hours', value: overtime });
    if (singleRecordKPIs.plannedHours > singleRecordKPIs.actualHours) {
      result.push({ name: 'Remaining', value: singleRecordKPIs.plannedHours - singleRecordKPIs.actualHours });
    }
    return result;
  }, [singleRecordKPIs, numericData]);

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

      {/* KPI Summary Cards */}
      {singleRecordKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">CPI</p>
              </div>
              <p className={`text-2xl font-bold ${singleRecordKPIs.cpi >= 1 ? 'text-green-600' : 'text-destructive'}`}>
                {singleRecordKPIs.cpi}
              </p>
              <Badge variant={singleRecordKPIs.cpi >= 1 ? 'secondary' : 'destructive'} className="text-xs mt-1">
                {singleRecordKPIs.cpi >= 1 ? 'Under Budget' : 'Over Budget'}
              </Badge>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">SPI</p>
              </div>
              <p className={`text-2xl font-bold ${singleRecordKPIs.spi >= 1 ? 'text-green-600' : 'text-destructive'}`}>
                {singleRecordKPIs.spi}
              </p>
              <Badge variant={singleRecordKPIs.spi >= 1 ? 'secondary' : 'destructive'} className="text-xs mt-1">
                {singleRecordKPIs.spi >= 1 ? 'On Schedule' : 'Behind Schedule'}
              </Badge>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground">Risk Score</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{singleRecordKPIs.riskScore}</p>
              <Badge variant={singleRecordKPIs.riskScore > 70 ? 'destructive' : singleRecordKPIs.riskScore > 40 ? 'secondary' : 'outline'} className="text-xs mt-1">
                {singleRecordKPIs.riskScore > 70 ? 'High Risk' : singleRecordKPIs.riskScore > 40 ? 'Medium' : 'Low Risk'}
              </Badge>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground">Resource Util</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{singleRecordKPIs.resourceUtil}%</p>
              <Badge variant={singleRecordKPIs.resourceUtil > 100 ? 'destructive' : 'outline'} className="text-xs mt-1">
                {singleRecordKPIs.resourceUtil > 100 ? 'Overloaded' : 'Normal'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Financial Details Row */}
      {singleRecordKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Planned Budget</p>
              <p className="text-lg font-bold text-foreground font-mono">{singleRecordKPIs.plannedBudget.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Actual Cost</p>
              <p className="text-lg font-bold text-foreground font-mono">{singleRecordKPIs.actualCost.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">EAC (Est. at Completion)</p>
              <p className="text-lg font-bold text-foreground font-mono">{singleRecordKPIs.eac.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Budget Variance</p>
              <p className={`text-lg font-bold font-mono ${singleRecordKPIs.budgetVariance <= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {singleRecordKPIs.budgetVariance > 0 ? '+' : ''}{singleRecordKPIs.budgetVariance}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Prediction Row */}
      {singleRecordKPIs && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Predicted Delay</p>
              </div>
              <p className="text-xl font-bold text-foreground">{singleRecordKPIs.delayDays} days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Cost Overrun</p>
              </div>
              <p className="text-xl font-bold text-foreground">{singleRecordKPIs.costOverrun}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Defect Count</p>
              </div>
              <p className="text-xl font-bold text-foreground">{singleRecordKPIs.defectCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Budget Comparison Bar Chart */}
      {singleBudgetData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Financial Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={singleBudgetData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} />
                <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                  {singleBudgetData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* EVM Comparison + Radar side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* EVM Bar Chart */}
        {singleEVMData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Earned Value Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={singleEVMData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]}>
                    <Cell fill="#8b5cf6" />
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Radar Chart - Record Health */}
        {singleRadarData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Record Health Radar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={singleRadarData} cx="50%" cy="50%" outerRadius="65%">
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fontSize: 9 }} />
                  <Radar name="Health" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Variance Analysis + Hours Breakdown side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Variance Bar Chart */}
        {varianceData.some(d => d.value !== 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Variance Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={varianceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="value" name="Variance" radius={[4, 4, 0, 0]}>
                    {varianceData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Hours Breakdown Pie Chart */}
        {hoursBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Resource Hours Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={hoursBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {hoursBreakdown.map((_, i) => <Cell key={i} fill={['#10b981', '#ef4444', '#3b82f6'][i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Full Metrics Table */}
      {numericData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              All Numeric Metrics
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

      {/* Horizontal Bar Chart of all metrics */}
      {numericData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Metric Values Overview
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
