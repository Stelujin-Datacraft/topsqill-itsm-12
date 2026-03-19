import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  FlaskConical, TrendingUp, TrendingDown, AlertTriangle, ArrowRight,
  Loader2, RefreshCw, Plus, Trash2, BarChart3,
} from 'lucide-react';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface ScenarioVariable {
  id: string;
  name: string;
  baseValue: number;
  adjustedValue: number;
  unit: string;
  min: number;
  max: number;
  step: number;
}

interface ScenarioResult {
  projectedRisk: number;
  projectedHealth: string;
  projectedOutcomes: { metric: string; baseline: number; projected: number; change: number }[];
  timelineData: { period: string; baseline: number; projected: number }[];
  recommendations: string[];
}

interface Props {
  perfProjectId?: string;
}

const DEFAULT_VARIABLES: ScenarioVariable[] = [
  { id: 'budget', name: 'Budget Allocation', baseValue: 100, adjustedValue: 100, unit: '%', min: 50, max: 200, step: 5 },
  { id: 'timeline', name: 'Timeline Extension', baseValue: 0, adjustedValue: 0, unit: 'days', min: -30, max: 90, step: 5 },
  { id: 'resources', name: 'Resource Capacity', baseValue: 100, adjustedValue: 100, unit: '%', min: 50, max: 200, step: 5 },
  { id: 'scope', name: 'Scope Change', baseValue: 0, adjustedValue: 0, unit: '%', min: -30, max: 50, step: 5 },
];

export function ScenarioSimulator({ perfProjectId }: Props) {
  const { alerts, predictions, thresholds } = usePerformanceMonitoring(perfProjectId);
  const { currentProject } = useProject();
  const [variables, setVariables] = useState<ScenarioVariable[]>(DEFAULT_VARIABLES);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  // Fetch submission data for baseline metrics
  const { data: dataSources = [] } = useQuery({
    queryKey: ['scenario-data-sources', currentProject?.id, perfProjectId],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      let q = supabase.from('performance_data_sources').select('*')
        .eq('project_id', currentProject.id).eq('is_active', true);
      if (perfProjectId) q = q.eq('performance_project_id', perfProjectId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!currentProject?.id,
  });

  const formId = dataSources[0]?.source_form_id;
  const fieldMappings: any[] = dataSources[0]?.field_mappings
    ? (Array.isArray(dataSources[0].field_mappings) ? dataSources[0].field_mappings : [])
    : [];

  const { data: submissions = [] } = useQuery({
    queryKey: ['scenario-submissions', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data } = await supabase.from('form_submissions')
        .select('id, submission_data, submitted_at')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: true })
        .limit(200);
      return data || [];
    },
    enabled: !!formId,
  });

  const numericMappings = fieldMappings.filter((m: any) => m.metricRole === 'numeric_metric');

  const updateVariable = (id: string, value: number) => {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, adjustedValue: value } : v));
    setResult(null);
  };

  const resetVariables = () => {
    setVariables(DEFAULT_VARIABLES);
    setResult(null);
  };

  const runSimulation = async () => {
    setIsSimulating(true);

    // Simulate processing delay
    await new Promise(r => setTimeout(r, 800));

    const budgetVar = variables.find(v => v.id === 'budget')!;
    const timelineVar = variables.find(v => v.id === 'timeline')!;
    const resourceVar = variables.find(v => v.id === 'resources')!;
    const scopeVar = variables.find(v => v.id === 'scope')!;

    const budgetFactor = budgetVar.adjustedValue / 100;
    const timelineFactor = 1 + (timelineVar.adjustedValue / 100);
    const resourceFactor = resourceVar.adjustedValue / 100;
    const scopeFactor = 1 + (scopeVar.adjustedValue / 100);

    // Calculate base risk from existing alerts
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const baseRisk = activeAlerts.length > 5 ? 75 : activeAlerts.length > 2 ? 50 : activeAlerts.length > 0 ? 30 : 10;

    // Project risk based on variable changes
    const riskReduction = (budgetFactor - 1) * 20 + (resourceFactor - 1) * 25 + (timelineVar.adjustedValue > 0 ? -10 : 5);
    const riskIncrease = (scopeFactor - 1) * 30;
    const projectedRisk = Math.max(0, Math.min(100, Math.round(baseRisk - riskReduction + riskIncrease)));

    const projectedHealth = projectedRisk > 70 ? 'Critical' : projectedRisk > 50 ? 'At Risk' : projectedRisk > 25 ? 'Fair' : 'Healthy';

    // Build projected outcomes from numeric metrics
    const projectedOutcomes = numericMappings.slice(0, 5).map((m: any) => {
      const values = submissions.map((s: any) => Number(s.submission_data?.[m.formFieldId] || 0)).filter(v => !isNaN(v));
      const baseline = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 100;
      const projectedChange = (budgetFactor * 0.3 + resourceFactor * 0.4 + (1 / scopeFactor) * 0.3 - 1) * baseline;
      const projected = Math.round((baseline + projectedChange) * 100) / 100;
      return {
        metric: m.label || m.formFieldLabel || 'Metric',
        baseline: Math.round(baseline * 100) / 100,
        projected,
        change: Math.round(((projected - baseline) / (baseline || 1)) * 10000) / 100,
      };
    });

    // If no numeric mappings, use default outcomes
    if (projectedOutcomes.length === 0) {
      projectedOutcomes.push(
        { metric: 'Delivery Rate', baseline: 85, projected: Math.round(85 * budgetFactor * resourceFactor / scopeFactor), change: 0 },
        { metric: 'Quality Score', baseline: 78, projected: Math.round(78 * (resourceFactor * 0.7 + budgetFactor * 0.3)), change: 0 },
        { metric: 'Efficiency Index', baseline: 72, projected: Math.round(72 * resourceFactor * (1 / scopeFactor)), change: 0 },
      );
      projectedOutcomes.forEach(o => { o.change = Math.round(((o.projected - o.baseline) / o.baseline) * 10000) / 100; });
    }

    // Timeline projection (6 periods)
    const timelineData = Array.from({ length: 6 }, (_, i) => {
      const period = `Period ${i + 1}`;
      const baseline = baseRisk + (i * 2);
      const projected = projectedRisk + (i * (projectedRisk > baseRisk ? 3 : -1));
      return { period, baseline: Math.min(100, baseline), projected: Math.max(0, Math.min(100, projected)) };
    });

    // Generate recommendations
    const recommendations: string[] = [];
    if (budgetFactor < 0.8) recommendations.push('⚠️ Budget reduction exceeds 20% — high risk of delayed deliverables.');
    if (budgetFactor > 1.2) recommendations.push('✅ Budget increase will allow for better quality assurance and contingency planning.');
    if (resourceFactor < 0.8) recommendations.push('⚠️ Reducing resources below 80% may cause bottlenecks in critical tasks.');
    if (resourceFactor > 1.3) recommendations.push('✅ Additional resources will accelerate delivery and reduce burnout risk.');
    if (scopeVar.adjustedValue > 20) recommendations.push('⚠️ Scope increase >20% without matching resources will likely cause delays.');
    if (timelineVar.adjustedValue > 30) recommendations.push('✅ Extended timeline provides buffer for risk mitigation and quality checks.');
    if (timelineVar.adjustedValue < -15) recommendations.push('⚠️ Compressing timeline by >15 days increases defect probability by ~25%.');
    if (projectedRisk < baseRisk) recommendations.push(`📉 Scenario reduces risk from ${baseRisk}% to ${projectedRisk}% — a net improvement.`);
    if (projectedRisk > baseRisk) recommendations.push(`📈 Scenario increases risk from ${baseRisk}% to ${projectedRisk}% — consider adjustments.`);
    if (recommendations.length === 0) recommendations.push('✅ Current scenario maintains baseline performance with no significant risk changes.');

    setResult({ projectedRisk, projectedHealth, projectedOutcomes, timelineData, recommendations });
    setIsSimulating(false);
  };

  const hasChanges = variables.some(v => v.adjustedValue !== v.baseValue);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          What-If Scenario Simulator
        </h2>
        <p className="text-sm text-muted-foreground">
          Adjust project variables to see projected outcomes and risk impact
        </p>
      </div>

      {/* Variable Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Scenario Variables</CardTitle>
            <Button variant="ghost" size="sm" onClick={resetVariables} disabled={!hasChanges} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          <CardDescription className="text-xs">Drag sliders to adjust variables and simulate outcomes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {variables.map(v => (
            <div key={v.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{v.name}</Label>
                <div className="flex items-center gap-2">
                  <Badge variant={v.adjustedValue !== v.baseValue ? 'default' : 'secondary'} className="text-xs font-mono">
                    {v.adjustedValue > 0 && v.id !== 'budget' && v.id !== 'resources' ? '+' : ''}{v.adjustedValue}{v.unit}
                  </Badge>
                  {v.adjustedValue !== v.baseValue && (
                    <span className={`text-xs ${v.adjustedValue > v.baseValue ? 'text-green-600' : 'text-red-500'}`}>
                      ({v.adjustedValue > v.baseValue ? '+' : ''}{v.adjustedValue - v.baseValue}{v.unit})
                    </span>
                  )}
                </div>
              </div>
              <Slider
                value={[v.adjustedValue]}
                onValueChange={([val]) => updateVariable(v.id, val)}
                min={v.min}
                max={v.max}
                step={v.step}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{v.min}{v.unit}</span>
                <span>Base: {v.baseValue}{v.unit}</span>
                <span>{v.max}{v.unit}</span>
              </div>
            </div>
          ))}

          <Button onClick={runSimulation} disabled={isSimulating} className="w-full gap-2 mt-2">
            {isSimulating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Simulating...</>
            ) : (
              <><FlaskConical className="h-4 w-4" /> Run Simulation</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Risk Impact Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Projected Risk Score</p>
                <p className={`text-3xl font-bold ${
                  result.projectedRisk > 70 ? 'text-red-500' : result.projectedRisk > 40 ? 'text-orange-500' : 'text-green-600'
                }`}>{result.projectedRisk}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Projected Health</p>
                <Badge variant={result.projectedHealth === 'Healthy' ? 'default' : result.projectedHealth === 'Critical' ? 'destructive' : 'secondary'}
                  className="text-lg px-3 py-1 mt-1">
                  {result.projectedHealth}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Variables Changed</p>
                <p className="text-3xl font-bold text-foreground">
                  {variables.filter(v => v.adjustedValue !== v.baseValue).length}/{variables.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Metric Impact */}
          {result.projectedOutcomes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Metric Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-4">
                  {result.projectedOutcomes.map((o, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                      <span className="text-sm font-medium">{o.metric}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{o.baseline}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-semibold">{o.projected}</span>
                        <Badge variant={o.change >= 0 ? 'default' : 'destructive'} className="text-xs">
                          {o.change >= 0 ? '+' : ''}{o.change}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={result.projectedOutcomes} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="metric" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="baseline" fill="hsl(var(--muted-foreground))" fillOpacity={0.4} name="Baseline" radius={[0, 2, 2, 0]} />
                    <Bar dataKey="projected" fill="hsl(var(--primary))" name="Projected" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Risk Timeline Projection */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Risk Trajectory Projection
              </CardTitle>
              <CardDescription className="text-xs">Projected risk over future periods vs. baseline</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={result.timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="baseline" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} name="Baseline Risk" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="projected" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Projected Risk" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* AI Recommendations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Scenario Insights & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-foreground p-2 rounded bg-muted/40">{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
