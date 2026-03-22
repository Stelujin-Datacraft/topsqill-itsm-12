import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  FlaskConical, TrendingUp, AlertTriangle, ArrowRight,
  Loader2, RefreshCw, BarChart3, FileText,
} from 'lucide-react';

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
  selectedRecordId?: string;
}

const METRIC_LABELS = [
  'Planned Budget', 'Actual Cost', 'Earned Value (EV)', 'Actual Cost Value (AC)',
  'Planned Value (PV)', 'Risk Score', 'Predicted Delay Days',
];

const DEFAULT_VARIABLES: ScenarioVariable[] = [
  { id: 'budget', name: 'Budget Allocation', baseValue: 100, adjustedValue: 100, unit: '%', min: 50, max: 200, step: 5 },
  { id: 'timeline', name: 'Timeline Extension', baseValue: 0, adjustedValue: 0, unit: 'days', min: -30, max: 90, step: 5 },
  { id: 'resources', name: 'Resource Capacity', baseValue: 100, adjustedValue: 100, unit: '%', min: 50, max: 200, step: 5 },
  { id: 'scope', name: 'Scope Change', baseValue: 0, adjustedValue: 0, unit: '%', min: -30, max: 50, step: 5 },
];

export function ScenarioSimulator({ perfProjectId, selectedRecordId }: Props) {
  const { alerts } = usePerformanceMonitoring(perfProjectId);
  const { currentProject } = useProject();
  const [variables, setVariables] = useState<ScenarioVariable[]>(DEFAULT_VARIABLES);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);

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

  // Fetch the selected submission
  const { data: submission } = useQuery({
    queryKey: ['scenario-submission', selectedRecordId],
    queryFn: async () => {
      if (!selectedRecordId) return null;
      const { data } = await supabase.from('form_submissions')
        .select('id, submission_data, submitted_at, submission_ref_id')
        .eq('id', selectedRecordId)
        .single();
      return data || null;
    },
    enabled: !!selectedRecordId,
  });

  // Fetch form fields
  const { data: formFields = [] } = useQuery({
    queryKey: ['scenario-form-fields', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data } = await supabase.from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId);
      return data || [];
    },
    enabled: !!formId,
  });

  const fieldLookup = useMemo(() => {
    const map: Record<string, string> = {};
    formFields.forEach((f: any) => { map[f.label] = f.id; });
    return map;
  }, [formFields]);

  const resolveValue = (data: any, label: string): number => {
    const id = fieldLookup[label];
    if (!id) return 0;
    const raw = data?.[id];
    if (raw == null) return 0;
    const v = typeof raw === 'object' && raw.value !== undefined ? raw.value : raw;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  const updateVariable = (id: string, value: number) => {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, adjustedValue: value } : v));
    setResult(null);
  };

  const resetVariables = () => {
    setVariables(DEFAULT_VARIABLES);
    setResult(null);
  };

  const runSimulation = async () => {
    if (!submission) return;
    setIsSimulating(true);
    await new Promise(r => setTimeout(r, 800));

    const submissionData = submission.submission_data || {};
    const budgetVar = variables.find(v => v.id === 'budget')!;
    const timelineVar = variables.find(v => v.id === 'timeline')!;
    const resourceVar = variables.find(v => v.id === 'resources')!;
    const scopeVar = variables.find(v => v.id === 'scope')!;

    const budgetFactor = budgetVar.adjustedValue / 100;
    const resourceFactor = resourceVar.adjustedValue / 100;
    const scopeFactor = 1 + (scopeVar.adjustedValue / 100);

    const activeAlerts = alerts.filter(a => a.status === 'active');
    const riskScore = resolveValue(submissionData, 'Risk Score');
    const baseRisk = riskScore > 0 ? riskScore : (activeAlerts.length > 5 ? 75 : activeAlerts.length > 2 ? 50 : activeAlerts.length > 0 ? 30 : 10);

    const riskReduction = (budgetFactor - 1) * 20 + (resourceFactor - 1) * 25 + (timelineVar.adjustedValue > 0 ? -10 : 5);
    const riskIncrease = (scopeFactor - 1) * 30;
    const projectedRisk = Math.max(0, Math.min(100, Math.round(baseRisk - riskReduction + riskIncrease)));
    const projectedHealth = projectedRisk > 70 ? 'Critical' : projectedRisk > 50 ? 'At Risk' : projectedRisk > 25 ? 'Fair' : 'Healthy';

    // Build projected outcomes from the selected record's data
    const projectedOutcomes: { metric: string; baseline: number; projected: number; change: number }[] = [];
    METRIC_LABELS.forEach(label => {
      const baseline = resolveValue(submissionData, label);
      if (baseline === 0 && !fieldLookup[label]) return;
      const projectedChange = (budgetFactor * 0.3 + resourceFactor * 0.4 + (1 / scopeFactor) * 0.3 - 1) * (baseline || 100);
      const projected = Math.round((baseline + projectedChange) * 100) / 100;
      projectedOutcomes.push({
        metric: label,
        baseline: Math.round(baseline * 100) / 100,
        projected,
        change: Math.round(((projected - (baseline || 1)) / (baseline || 1)) * 10000) / 100,
      });
    });

    if (projectedOutcomes.length === 0) {
      const defaults = [
        { metric: 'Delivery Rate', baseline: 85 },
        { metric: 'Quality Score', baseline: 78 },
        { metric: 'Efficiency Index', baseline: 72 },
      ];
      defaults.forEach(d => {
        const projected = Math.round(d.baseline * budgetFactor * resourceFactor / scopeFactor);
        projectedOutcomes.push({ ...d, projected, change: Math.round(((projected - d.baseline) / d.baseline) * 10000) / 100 });
      });
    }

    const timelineData = Array.from({ length: 6 }, (_, i) => ({
      period: `Period ${i + 1}`,
      baseline: Math.min(100, baseRisk + (i * 2)),
      projected: Math.max(0, Math.min(100, projectedRisk + (i * (projectedRisk > baseRisk ? 3 : -1)))),
    }));

    const recommendations: string[] = [];
    if (budgetFactor < 0.8) recommendations.push('⚠️ Budget reduction exceeds 20% — high risk of delayed deliverables.');
    if (budgetFactor > 1.2) recommendations.push('✅ Budget increase will allow for better quality assurance.');
    if (resourceFactor < 0.8) recommendations.push('⚠️ Reducing resources below 80% may cause bottlenecks.');
    if (resourceFactor > 1.3) recommendations.push('✅ Additional resources will accelerate delivery.');
    if (scopeVar.adjustedValue > 20) recommendations.push('⚠️ Scope increase >20% without matching resources will likely cause delays.');
    if (timelineVar.adjustedValue > 30) recommendations.push('✅ Extended timeline provides buffer for risk mitigation.');
    if (timelineVar.adjustedValue < -15) recommendations.push('⚠️ Compressing timeline by >15 days increases defect probability.');
    if (projectedRisk < baseRisk) recommendations.push(`📉 Risk reduced from ${baseRisk}% to ${projectedRisk}%.`);
    if (projectedRisk > baseRisk) recommendations.push(`📈 Risk increased from ${baseRisk}% to ${projectedRisk}% — consider adjustments.`);
    if (recommendations.length === 0) recommendations.push('✅ Current scenario maintains baseline performance.');

    setResult({ projectedRisk, projectedHealth, projectedOutcomes, timelineData, recommendations });
    setIsSimulating(false);
  };

  const hasChanges = variables.some(v => v.adjustedValue !== v.baseValue);

  if (!selectedRecordId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">Select a Record</p>
          <p className="text-sm text-muted-foreground mt-1">Choose a record from the selector above to run what-if simulations.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          What-If Scenario Simulator
        </h2>
        <p className="text-sm text-muted-foreground">
          Adjust variables to project outcomes for record: {submission?.submission_ref_id || selectedRecordId.slice(0, 8)}
        </p>
      </div>

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

          <Button onClick={runSimulation} disabled={isSimulating || !submission} className="w-full gap-2 mt-2">
            {isSimulating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Simulating...</>
            ) : (
              <><FlaskConical className="h-4 w-4" /> Run Simulation</>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
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
                        <span className="text-xs text-muted-foreground">{o.baseline.toLocaleString()}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-semibold">{o.projected.toLocaleString()}</span>
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
                    <YAxis type="category" dataKey="metric" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="baseline" fill="hsl(var(--muted-foreground))" fillOpacity={0.4} name="Baseline" radius={[0, 2, 2, 0]} />
                    <Bar dataKey="projected" fill="hsl(var(--primary))" name="Projected" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Risk Trajectory Projection
              </CardTitle>
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Scenario Insights
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
