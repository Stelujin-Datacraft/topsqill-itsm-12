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
  FlaskConical, Loader2, RefreshCw, FileText,
  TrendingUp, TrendingDown, Minus, ArrowRight,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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

interface Props {
  perfProjectId?: string;
  selectedRecordId?: string;
}

const FIELD_LABELS = [
  'Planned Budget', 'Actual Cost', 'Earned Value (EV)', 'Actual Cost Value (AC)',
  'Planned Value (PV)', 'Planned Start Date', 'Planned End Date', 'Actual Start Date',
  'Planned Hours', 'Actual Hours', 'Risk Score', 'Predicted Delay Days',
];

const DEFAULT_VARIABLES: ScenarioVariable[] = [
  { id: 'budget', name: 'Budget Allocation', baseValue: 100, adjustedValue: 100, unit: '%', min: 50, max: 200, step: 25 },
  { id: 'timeline', name: 'Timeline Extension', baseValue: 0, adjustedValue: 0, unit: ' days', min: -30, max: 90, step: 30 },
  { id: 'resources', name: 'Resource Capacity', baseValue: 100, adjustedValue: 100, unit: '%', min: 50, max: 150, step: 25 },
  { id: 'scope', name: 'Scope Change', baseValue: 0, adjustedValue: 0, unit: '%', min: -20, max: 60, step: 20 },
];

interface SimulationResult {
  metric: string;
  baseValue: number;
  scenarioValue: number;
  changePct: number;
  unit: string;
}

export function ScenarioSimulator({ perfProjectId, selectedRecordId }: Props) {
  const { currentProject } = useProject();
  const [variables, setVariables] = useState<ScenarioVariable[]>(DEFAULT_VARIABLES);
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<SimulationResult[] | null>(null);

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

  const { data: submission } = useQuery({
    queryKey: ['scenario-submission', selectedRecordId],
    queryFn: async () => {
      if (!selectedRecordId) return null;
      const { data } = await supabase.from('form_submissions')
        .select('id, submission_data, submitted_at, submission_ref_id')
        .eq('id', selectedRecordId).single();
      return data || null;
    },
    enabled: !!selectedRecordId,
  });

  const { data: formFields = [] } = useQuery({
    queryKey: ['scenario-form-fields', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data } = await supabase.from('form_fields')
        .select('id, label, field_type').eq('form_id', formId);
      return data || [];
    },
    enabled: !!formId,
  });

  const fieldLookup = useMemo(() => {
    const map: Record<string, string> = {};
    formFields.forEach((f: any) => { map[f.label] = f.id; });
    return map;
  }, [formFields]);

  const resolveNum = (data: any, label: string): number => {
    const id = fieldLookup[label];
    if (!id) return 0;
    const raw = data?.[id];
    if (raw == null) return 0;
    const v = typeof raw === 'object' && raw.value !== undefined ? raw.value : raw;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  const resolveDate = (data: any, label: string): Date | null => {
    const id = fieldLookup[label];
    if (!id) return null;
    const raw = data?.[id];
    if (!raw) return null;
    const v = typeof raw === 'object' && raw.value !== undefined ? raw.value : raw;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const updateVariable = (id: string, value: number) => {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, adjustedValue: value } : v));
    setResults(null);
  };

  const resetVariables = () => {
    setVariables(DEFAULT_VARIABLES);
    setResults(null);
  };

  const runSimulation = async () => {
    if (!submission) return;
    setIsSimulating(true);
    await new Promise(r => setTimeout(r, 500));

    const d = submission.submission_data || {};

    // Extract base fields
    const plannedBudget = resolveNum(d, 'Planned Budget');
    const actualCost = resolveNum(d, 'Actual Cost');
    const ev = resolveNum(d, 'Earned Value (EV)');
    const ac = resolveNum(d, 'Actual Cost Value (AC)');
    const pv = resolveNum(d, 'Planned Value (PV)');
    const plannedHours = resolveNum(d, 'Planned Hours');
    const actualHours = resolveNum(d, 'Actual Hours');
    const riskScore = resolveNum(d, 'Risk Score');
    const predictedDelayDays = resolveNum(d, 'Predicted Delay Days');

    const plannedStart = resolveDate(d, 'Planned Start Date');
    const plannedEnd = resolveDate(d, 'Planned End Date');

    // Scenario input factors
    const budgetAllocation = variables.find(v => v.id === 'budget')!.adjustedValue / 100;
    const timelineExtension = variables.find(v => v.id === 'timeline')!.adjustedValue;
    const resourceCapacity = variables.find(v => v.id === 'resources')!.adjustedValue / 100;
    const scopeChange = variables.find(v => v.id === 'scope')!.adjustedValue / 100;

    // STEP 1: Adjusted base fields
    const scenPlannedBudget = plannedBudget * budgetAllocation;
    const scenPlannedHours = plannedHours * (1 + scopeChange);
    const scenRiskScore = riskScore * (1 + scopeChange);

    let baseDurationDays = 0;
    if (plannedStart && plannedEnd) {
      baseDurationDays = Math.max(0, (plannedEnd.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24));
    }
    const scenDuration = resourceCapacity > 0 ? baseDurationDays / resourceCapacity : baseDurationDays;

    // STEP 2: Recalculate KPIs
    // Base KPIs
    const baseBudgetUtil = plannedBudget > 0 ? (actualCost / plannedBudget) * 100 : 0;
    const baseCPI = ac > 0 ? ev / ac : 0;
    const baseSPI = pv > 0 ? ev / pv : 0;
    const baseEAC = baseCPI > 0 ? plannedBudget / baseCPI : 0;
    const baseVAC = plannedBudget - baseEAC;
    const baseResourceUtil = plannedHours > 0 ? (actualHours / plannedHours) * 100 : 0;

    // Scenario KPIs
    const scenBudgetUtil = scenPlannedBudget > 0 ? (actualCost / scenPlannedBudget) * 100 : 0;
    const scenCPI = ac > 0 ? ev / ac : 0; // CPI doesn't change with scenario (based on actuals)
    const scenSPI = pv > 0 ? ev / pv : 0; // SPI doesn't change with scenario
    const scenEAC = scenCPI > 0 ? scenPlannedBudget / scenCPI : 0;
    const scenVAC = scenPlannedBudget - scenEAC;

    const scenDelayAdjustment = (resourceCapacity > 0 ? baseDurationDays * (1 / resourceCapacity - 1) : 0) + timelineExtension;
    const scenPredictedDelay = predictedDelayDays + scenDelayAdjustment;

    const scenResourceUtil = scenPlannedHours > 0 ? (actualHours / scenPlannedHours) * 100 : 0;

    // STEP 3: Build results with delta
    const calcDelta = (base: number, scen: number): number => {
      if (base === 0) return scen === 0 ? 0 : 100;
      return ((scen - base) / Math.abs(base)) * 100;
    };

    const metrics: SimulationResult[] = [
      { metric: 'Planned Budget', baseValue: round2(plannedBudget), scenarioValue: round2(scenPlannedBudget), changePct: round2(calcDelta(plannedBudget, scenPlannedBudget)), unit: '' },
      { metric: 'Budget Utilization', baseValue: round2(baseBudgetUtil), scenarioValue: round2(scenBudgetUtil), changePct: round2(calcDelta(baseBudgetUtil, scenBudgetUtil)), unit: '%' },
      { metric: 'CPI', baseValue: round2(baseCPI), scenarioValue: round2(scenCPI), changePct: round2(calcDelta(baseCPI, scenCPI)), unit: '' },
      { metric: 'SPI', baseValue: round2(baseSPI), scenarioValue: round2(scenSPI), changePct: round2(calcDelta(baseSPI, scenSPI)), unit: '' },
      { metric: 'Estimate at Completion (EAC)', baseValue: round2(baseEAC), scenarioValue: round2(scenEAC), changePct: round2(calcDelta(baseEAC, scenEAC)), unit: '' },
      { metric: 'Variance at Completion (VAC)', baseValue: round2(baseVAC), scenarioValue: round2(scenVAC), changePct: round2(calcDelta(baseVAC, scenVAC)), unit: '' },
      { metric: 'Predicted Delay Days', baseValue: round2(predictedDelayDays), scenarioValue: round2(scenPredictedDelay), changePct: round2(calcDelta(predictedDelayDays, scenPredictedDelay)), unit: ' days' },
      { metric: 'Risk Score', baseValue: round2(riskScore), scenarioValue: round2(scenRiskScore), changePct: round2(calcDelta(riskScore, scenRiskScore)), unit: '' },
      { metric: 'Resource Utilization', baseValue: round2(baseResourceUtil), scenarioValue: round2(scenResourceUtil), changePct: round2(calcDelta(baseResourceUtil, scenResourceUtil)), unit: '%' },
    ];

    setResults(metrics);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Scenario Controls */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Scenario Controls</CardTitle>
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

        {/* Right Panel: Simulation Results */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Simulation Results</CardTitle>
            <CardDescription className="text-xs">
              {results ? 'Recalculated KPI metrics based on scenario inputs' : 'Run a simulation to see projected outcomes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!results ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FlaskConical className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">Adjust variables and click "Run Simulation"</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Metric</TableHead>
                    <TableHead className="text-xs text-right">Base Value</TableHead>
                    <TableHead className="text-xs text-right">Scenario Value</TableHead>
                    <TableHead className="text-xs text-right">Change (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => {
                    const isPositiveGood = ['CPI', 'SPI', 'Planned Budget', 'Variance at Completion (VAC)'].includes(r.metric);
                    const isNegativeGood = ['Budget Utilization', 'Predicted Delay Days', 'Risk Score', 'Resource Utilization'].includes(r.metric);
                    const isGood = isPositiveGood ? r.changePct > 0 : isNegativeGood ? r.changePct < 0 : false;
                    const isBad = isPositiveGood ? r.changePct < 0 : isNegativeGood ? r.changePct > 0 : false;
                    const changeColor = r.changePct === 0 ? 'text-muted-foreground' : isGood ? 'text-green-600' : isBad ? 'text-red-500' : 'text-muted-foreground';

                    return (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium py-2.5">{r.metric}</TableCell>
                        <TableCell className="text-sm text-right py-2.5 text-muted-foreground font-mono">
                          {formatValue(r.baseValue, r.unit)}
                        </TableCell>
                        <TableCell className="text-sm text-right py-2.5 font-mono font-semibold">
                          {formatValue(r.scenarioValue, r.unit)}
                        </TableCell>
                        <TableCell className={`text-sm text-right py-2.5 font-mono font-semibold ${changeColor}`}>
                          <span className="inline-flex items-center gap-1">
                            {r.changePct === 0 ? (
                              <Minus className="h-3 w-3" />
                            ) : r.changePct > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {r.changePct > 0 ? '+' : ''}{r.changePct}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatValue(val: number, unit: string): string {
  if (unit === '%') return `${val.toLocaleString()}%`;
  if (unit === ' days') return `${val.toLocaleString()} days`;
  return val.toLocaleString();
}
