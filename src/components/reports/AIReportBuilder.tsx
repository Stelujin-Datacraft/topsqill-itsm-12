import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { backend as supabase } from '@/services/api';
import { useReports } from '@/hooks/useReports';
import { FormField } from '@/types/form';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AIReportBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  onComponentGenerated: (componentData: { type: string; config: any }) => void;
}

interface GeneratedConfig {
  title: string;
  description?: string;
  chartType: string;
  formId: string;
  xAxis?: string;
  yAxis?: string;
  dimensions?: string[];
  metrics?: string[];
  aggregationType?: string;
  aggregationEnabled?: boolean;
  compareMode?: boolean;
  metricAggregations?: Array<{ field: string; aggregation: string }>;
  colorTheme?: string;
  filters?: Array<{ field: string; operator: string; value: any }>;
  drilldownConfig?: { enabled: boolean; levels: string[] };
  maxDataPoints?: number;
  reasoning?: string;
}

const AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max'] as const;
const CHART_TYPES = ['bar', 'line', 'area', 'pie', 'donut', 'scatter', 'bubble', 'heatmap'] as const;

function normLabel(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Map AI field id/label/hint onto a real form field id. */
function resolveFieldId(ref: string | undefined | null, fields: FormField[]): string {
  const raw = String(ref || '').trim();
  if (!raw || !fields.length) return '';
  if (fields.some((f) => f.id === raw)) return raw;

  const key = normLabel(raw);
  if (!key) return '';

  const exact = fields.find((f) => normLabel(f.label) === key);
  if (exact) return exact.id;

  const partial = fields.find((f) => {
    const label = normLabel(f.label);
    return label.includes(key) || key.includes(label);
  });
  return partial?.id || '';
}

function normalizeGeneratedConfig(
  config: GeneratedConfig,
  fields: FormField[],
  formId: string,
): GeneratedConfig {
  const metrics = (config.metrics || [])
    .map((m) => resolveFieldId(m, fields))
    .filter(Boolean);
  const dimensions = (config.dimensions || [])
    .map((d) => resolveFieldId(d, fields))
    .filter(Boolean);
  const xAxis = resolveFieldId(config.xAxis, fields) || dimensions[0] || '';
  const yAxis = resolveFieldId(config.yAxis, fields) || metrics[0] || '';

  // Prefer explicit axes when AI omitted metrics/dimensions
  const nextMetrics = metrics.length
    ? metrics
    : [yAxis, resolveFieldId(config.metrics?.[1], fields)].filter(Boolean);
  const nextDimensions = dimensions.length
    ? dimensions
    : [xAxis].filter(Boolean);

  const filters = (config.filters || []).map((f) => ({
    ...f,
    field: resolveFieldId(f.field, fields) || f.field,
  }));

  const levels = (config.drilldownConfig?.levels || [])
    .map((lvl) => resolveFieldId(lvl, fields))
    .filter(Boolean);

  const metricAggregations = (config.metricAggregations || []).map((m) => ({
    ...m,
    field: resolveFieldId(m.field, fields) || m.field,
  }));

  return {
    ...config,
    formId,
    xAxis: xAxis || undefined,
    yAxis: yAxis || undefined,
    metrics: nextMetrics,
    dimensions: nextDimensions,
    filters,
    metricAggregations,
    drilldownConfig: {
      enabled: Boolean(config.drilldownConfig?.enabled && levels.length),
      levels,
    },
  };
}

function FieldSelect({
  label,
  value,
  onChange,
  fields,
  allowNone = false,
  unresolvedHint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  fields: FormField[];
  allowNone?: boolean;
  unresolvedHint?: string;
}) {
  const matched = Boolean(value && fields.some((f) => f.id === value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {value ? (
          matched ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Matched
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
              <AlertTriangle className="h-3 w-3" /> Pick a field
            </span>
          )
        ) : unresolvedHint ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
            <AlertTriangle className="h-3 w-3" /> {unresolvedHint}
          </span>
        ) : null}
      </div>
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && (
            <SelectItem value="__none__" className="text-xs">
              None
            </SelectItem>
          )}
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.id} className="text-xs">
              {field.label}
              <span className="ml-1 text-muted-foreground">({field.type})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AIReportBuilder({ open, onOpenChange, reportId, onComponentGenerated }: AIReportBuilderProps) {
  const [selectedFormId, setSelectedFormId] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null);
  const [showFieldRef, setShowFieldRef] = useState(false);
  const { forms } = useReports();

  useEffect(() => {
    if (selectedFormId) {
      fetchFields(selectedFormId);
    } else {
      setFormFields([]);
    }
  }, [selectedFormId]);

  // Reset preview when form changes
  useEffect(() => {
    setGeneratedConfig(null);
  }, [selectedFormId]);

  const fetchFields = async (formId: string) => {
    setLoadingFields(true);
    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('field_order', { ascending: true });

      if (error) throw error;

      const transformed: FormField[] = (fields || []).map((f) => ({
        id: f.id,
        type: f.field_type as FormField['type'],
        label: f.label,
        placeholder: f.placeholder || '',
        required: f.required || false,
        options: Array.isArray(f.options) ? (f.options as any) : [],
        validation: {},
        customConfig: {},
        tooltip: f.tooltip || '',
        isVisible: f.is_visible !== false,
        isEnabled: f.is_enabled !== false,
      }));
      setFormFields(transformed);
    } catch (err) {
      console.error('Error fetching fields:', err);
    } finally {
      setLoadingFields(false);
    }
  };

  const insertFieldIntoPrompt = (field: FormField) => {
    setPrompt((prev) => {
      const next = prev.trim();
      if (!next) return field.label;
      if (next.toLowerCase().includes(field.label.toLowerCase())) return prev;
      return `${next}${/[,\s]$/.test(next) ? ' ' : ' '}${field.label}`;
    });
  };

  const handleGenerate = async () => {
    if (!selectedFormId) {
      toast.error('Please select a form first');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Please describe what you want to visualize');
      return;
    }

    setIsGenerating(true);
    try {
      const selectedForm = forms.find((f) => f.id === selectedFormId);
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'generate-report-component',
          context: {
            userInput: prompt,
            selectedFormId,
            selectedFormName: selectedForm?.name || 'Form',
            availableFields: formFields.map((f) => ({
              id: f.id,
              label: f.label,
              type: f.type,
            })),
          },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'AI generation failed');

      const config = normalizeGeneratedConfig(
        data.result as GeneratedConfig,
        formFields,
        selectedFormId,
      );
      setGeneratedConfig(config);
      toast.success('Chart draft ready — confirm fields below');
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error('Failed to generate chart configuration');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateConfig = (patch: Partial<GeneratedConfig>) => {
    setGeneratedConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const setPrimaryDimension = (fieldId: string) => {
    if (!generatedConfig) return;
    updateConfig({
      xAxis: fieldId || undefined,
      dimensions: fieldId ? [fieldId] : [],
    });
  };

  const setPrimaryMetric = (fieldId: string) => {
    if (!generatedConfig) return;
    const second = generatedConfig.metrics?.[1];
    const nextMetrics = fieldId
      ? [fieldId, ...(second && second !== fieldId ? [second] : [])]
      : (generatedConfig.metrics || []).slice(1);
    updateConfig({
      yAxis: fieldId || undefined,
      metrics: nextMetrics,
      metricAggregations: generatedConfig.compareMode
        ? []
        : fieldId
          ? [{
              field: fieldId,
              aggregation: generatedConfig.aggregationType || 'count',
            }]
          : [],
    });
  };

  const setCompareMetric = (fieldId: string) => {
    if (!generatedConfig) return;
    const first = generatedConfig.metrics?.[0] || generatedConfig.yAxis || '';
    updateConfig({
      metrics: first
        ? (fieldId ? [first, fieldId] : [first])
        : (fieldId ? [fieldId] : []),
    });
  };

  const setDrilldownLevel = (index: number, fieldId: string) => {
    if (!generatedConfig) return;
    const levels = [...(generatedConfig.drilldownConfig?.levels || [])];
    if (!fieldId) {
      levels.splice(index, 1);
    } else {
      levels[index] = fieldId;
    }
    updateConfig({
      drilldownConfig: {
        enabled: levels.length > 0,
        levels,
      },
    });
  };

  const setFilterField = (index: number, fieldId: string) => {
    if (!generatedConfig?.filters) return;
    const filters = generatedConfig.filters.map((f, i) => (
      i === index ? { ...f, field: fieldId } : f
    ));
    updateConfig({ filters });
  };

  const unresolvedRequired = useMemo(() => {
    if (!generatedConfig) return [] as string[];
    const missing: string[] = [];
    const dim = generatedConfig.dimensions?.[0] || generatedConfig.xAxis || '';
    const metric = generatedConfig.metrics?.[0] || generatedConfig.yAxis || '';
    if (!dim || !formFields.some((f) => f.id === dim)) missing.push('grouping / X-axis field');
    if (!metric || !formFields.some((f) => f.id === metric)) missing.push('metric / Y-axis field');
    if (generatedConfig.compareMode) {
      const second = generatedConfig.metrics?.[1] || '';
      if (!second || !formFields.some((f) => f.id === second)) missing.push('compare field');
    }
    return missing;
  }, [generatedConfig, formFields]);

  const handleApply = () => {
    if (!generatedConfig) return;
    if (unresolvedRequired.length) {
      toast.error(`Confirm these fields first: ${unresolvedRequired.join(', ')}`);
      return;
    }

    const { reasoning, ...chartConfig } = generatedConfig;
    const isCompare = chartConfig.compareMode === true;
    const dimension = chartConfig.dimensions?.[0] || chartConfig.xAxis || '';
    const metric = chartConfig.metrics?.[0] || chartConfig.yAxis || '';
    const finalConfig = {
      ...chartConfig,
      formId: selectedFormId,
      xAxis: dimension || chartConfig.xAxis,
      yAxis: metric || chartConfig.yAxis,
      compareMode: isCompare,
      aggregationEnabled: !isCompare && (chartConfig.aggregationEnabled !== false),
      dimensions: isCompare ? [] : (chartConfig.dimensions || []).filter(Boolean),
      metrics: (chartConfig.metrics || []).filter(Boolean),
      metricAggregations: isCompare
        ? []
        : (chartConfig.metricAggregations?.length
          ? chartConfig.metricAggregations
          : metric
            ? [{ field: metric, aggregation: chartConfig.aggregationType || 'count' }]
            : []),
      drilldownEnabled: chartConfig.drilldownConfig?.enabled || false,
      drilldownLevels: chartConfig.drilldownConfig?.levels || [],
    };

    onComponentGenerated({ type: 'chart', config: finalConfig });
    setGeneratedConfig(null);
    setPrompt('');
  };

  const primaryDimension = generatedConfig?.dimensions?.[0] || generatedConfig?.xAxis || '';
  const primaryMetric = generatedConfig?.metrics?.[0] || generatedConfig?.yAxis || '';
  const compareMetric = generatedConfig?.metrics?.[1] || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="icon-lg text-module-query" />
            AI Report Builder
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </DialogTitle>
          <DialogDescription>
            Describe the chart in plain language — you can confirm or change fields after generate.
            Exact field names are optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form Selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Select Form</label>
            <Select value={selectedFormId} onValueChange={setSelectedFormId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a form to build chart from" />
              </SelectTrigger>
              <SelectContent>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    <div className="flex items-center gap-2">
                      <span>{form.name}</span>
                      <Badge variant="outline" className="text-xs">{form.fields.length} fields</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field Reference — click to insert into prompt */}
          {selectedFormId && formFields.length > 0 && (
            <Collapsible open={showFieldRef} onOpenChange={setShowFieldRef}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="icon-xs" />
                  <span>Available Fields ({formFields.length}) — click to add to prompt</span>
                  {showFieldRef ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-md bg-muted/50 border">
                  <TooltipProvider delayDuration={200}>
                    {formFields.map((field) => (
                      <Tooltip key={field.id}>
                        <TooltipTrigger asChild>
                          <button type="button" onClick={() => insertFieldIntoPrompt(field)}>
                            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                              {field.label}
                              <span className="ml-1 text-muted-foreground opacity-60">({field.type})</span>
                            </Badge>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          <p>Click to add "<strong>{field.label}</strong>" to your prompt</p>
                          <p className="text-muted-foreground">Or skip names — confirm fields after generate</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {loadingFields && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="icon-xs animate-spin" />
              Loading fields...
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Describe your chart</label>
            <Textarea
              placeholder={selectedFormId
                ? 'e.g., "Bar chart of ticket counts by priority" or "Compare amount vs age"'
                : 'Select a form first to see available fields...'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={!selectedFormId}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Simple prompts are fine. After generate, pick the exact fields from the form list.
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedFormId || !prompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="icon-md mr-2 animate-spin" />
                Generating Chart Config...
              </>
            ) : (
              <>
                <Sparkles className="icon-md mr-2" />
                Generate Chart
              </>
            )}
          </Button>

          {/* Generated Config Preview + field confirm */}
          {generatedConfig && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-sm">{generatedConfig.title}</h4>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    <Badge variant={generatedConfig.compareMode ? 'default' : 'secondary'} className="text-xs">
                      {generatedConfig.compareMode ? 'Compare Fields' : 'Calculate Values'}
                    </Badge>
                    <Badge variant="secondary" className="capitalize text-xs">{generatedConfig.chartType}</Badge>
                  </div>
                </div>

                {generatedConfig.description && (
                  <p className="text-xs text-muted-foreground">{generatedConfig.description}</p>
                )}

                <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">Confirm fields</p>
                    {unresolvedRequired.length > 0 ? (
                      <span className="text-[10px] text-amber-600">
                        {unresolvedRequired.length} field{unresolvedRequired.length > 1 ? 's' : ''} need review
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600">All required fields matched</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldSelect
                      label={generatedConfig.compareMode ? 'X-Axis field' : 'Group by (dimension)'}
                      value={primaryDimension}
                      onChange={setPrimaryDimension}
                      fields={formFields}
                      unresolvedHint="Required"
                    />
                    <FieldSelect
                      label={generatedConfig.compareMode ? 'Y-Axis field' : 'Metric field'}
                      value={primaryMetric}
                      onChange={setPrimaryMetric}
                      fields={formFields}
                      unresolvedHint="Required"
                    />

                    {generatedConfig.compareMode ? (
                      <FieldSelect
                        label="Compare field (2nd metric)"
                        value={compareMetric}
                        onChange={setCompareMetric}
                        fields={formFields}
                        unresolvedHint="Required"
                      />
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Aggregation</Label>
                        <Select
                          value={generatedConfig.aggregationType || 'count'}
                          onValueChange={(v) => updateConfig({
                            aggregationType: v,
                            aggregationEnabled: true,
                            compareMode: false,
                            metricAggregations: primaryMetric
                              ? [{ field: primaryMetric, aggregation: v }]
                              : [],
                          })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AGGREGATIONS.map((agg) => (
                              <SelectItem key={agg} value={agg} className="text-xs capitalize">
                                {agg}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Chart type</Label>
                      <Select
                        value={generatedConfig.chartType}
                        onValueChange={(v) => updateConfig({ chartType: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHART_TYPES.map((type) => (
                            <SelectItem key={type} value={type} className="text-xs capitalize">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {generatedConfig.filters && generatedConfig.filters.length > 0 && (
                    <div className="space-y-2 pt-1 border-t">
                      <p className="text-xs text-muted-foreground">Filters</p>
                      {generatedConfig.filters.map((f, i) => (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                          <FieldSelect
                            label={`Filter field (${f.operator} ${String(f.value)})`}
                            value={resolveFieldId(f.field, formFields) || f.field}
                            onChange={(fieldId) => setFilterField(i, fieldId)}
                            fields={formFields}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {generatedConfig.drilldownConfig?.levels?.length ? (
                    <div className="space-y-2 pt-1 border-t">
                      <p className="text-xs text-muted-foreground">Drilldown levels</p>
                      {generatedConfig.drilldownConfig.levels.map((lvl, i) => (
                        <FieldSelect
                          key={i}
                          label={`Level ${i + 1}`}
                          value={lvl}
                          onChange={(fieldId) => setDrilldownLevel(i, fieldId)}
                          fields={formFields}
                          allowNone
                        />
                      ))}
                    </div>
                  ) : null}
                </div>

                {generatedConfig.colorTheme && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Theme:</span>{' '}
                    <span className="font-medium capitalize">{generatedConfig.colorTheme}</span>
                  </div>
                )}

                {generatedConfig.reasoning && (
                  <p className="text-xs text-muted-foreground italic border-t pt-2">
                    {generatedConfig.reasoning}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setGeneratedConfig(null)} className="flex-1">
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApply}
                    className="flex-1"
                    disabled={unresolvedRequired.length > 0}
                  >
                    Add to Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
