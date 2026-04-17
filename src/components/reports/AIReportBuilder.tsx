import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
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

  const fetchFields = async (formId: string) => {
    setLoadingFields(true);
    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('field_order', { ascending: true });

      if (error) throw error;

      const transformed: FormField[] = (fields || []).map(f => ({
        id: f.id,
        type: f.field_type as FormField['type'],
        label: f.label,
        placeholder: f.placeholder || '',
        required: f.required || false,
        options: Array.isArray(f.options) ? f.options as any : [],
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
      const selectedForm = forms.find(f => f.id === selectedFormId);
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'generate-report-component',
          context: {
            userInput: prompt,
            selectedFormId,
            selectedFormName: selectedForm?.name || 'Form',
            availableFields: formFields.map(f => ({
              id: f.id,
              label: f.label,
              type: f.type,
            })),
          },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'AI generation failed');

      const config = data.result as GeneratedConfig;
      setGeneratedConfig(config);
      toast.success('Chart configuration generated!');
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error('Failed to generate chart configuration');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!generatedConfig) return;

    const { reasoning, ...chartConfig } = generatedConfig;
    const isCompare = chartConfig.compareMode === true;
    const finalConfig = {
      ...chartConfig,
      formId: selectedFormId,
      compareMode: isCompare,
      aggregationEnabled: !isCompare && (chartConfig.aggregationEnabled !== false),
      // In compare mode, clear dimensions so raw per-submission data is plotted (no grouping/summing)
      dimensions: isCompare ? [] : (chartConfig.dimensions || []),
      metricAggregations: isCompare ? [] : (chartConfig.metricAggregations || []),
      drilldownEnabled: chartConfig.drilldownConfig?.enabled || false,
      drilldownLevels: chartConfig.drilldownConfig?.levels || [],
    };

    onComponentGenerated({ type: 'chart', config: finalConfig });
    setGeneratedConfig(null);
    setPrompt('');
  };

  const getFieldLabel = (fieldId: string) => {
    return formFields.find(f => f.id === fieldId)?.label || fieldId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Report Builder
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </DialogTitle>
          <DialogDescription>
            Select a form and describe the chart you want to create using natural language.
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
                {forms.map(form => (
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

          {/* Field Reference */}
          {selectedFormId && formFields.length > 0 && (
            <Collapsible open={showFieldRef} onOpenChange={setShowFieldRef}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-3 w-3" />
                  <span>Available Fields ({formFields.length})</span>
                  {showFieldRef ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-md bg-muted/50 border">
                  <TooltipProvider delayDuration={200}>
                    {formFields.map(field => (
                      <Tooltip key={field.id}>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs cursor-default">
                            {field.label}
                            <span className="ml-1 text-muted-foreground opacity-60">({field.type})</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          <p>Use "<strong>{field.label}</strong>" in your prompt</p>
                          <p className="text-muted-foreground">Type: {field.type}</p>
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
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading fields...
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Describe your chart</label>
            <Textarea
              placeholder={selectedFormId
                ? `e.g., "Show a bar chart of ${formFields[0]?.label || 'Status'} counts, filter by ${formFields[1]?.label || 'Priority'} = High, with drilldown by ${formFields[2]?.label || 'Category'}"`
                : 'Select a form first to see available fields...'
              }
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              disabled={!selectedFormId}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Mention: chart type, X/Y axis fields, filters, aggregation (count/sum/avg), and drilldown levels
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Chart Config...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Chart
              </>
            )}
          </Button>

          {/* Generated Config Preview */}
          {generatedConfig && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{generatedConfig.title}</h4>
                  <div className="flex gap-1.5">
                    <Badge variant={generatedConfig.compareMode ? "default" : "secondary"} className="text-xs">
                      {generatedConfig.compareMode ? 'Compare Fields' : 'Calculate Values'}
                    </Badge>
                    <Badge variant="secondary" className="capitalize text-xs">{generatedConfig.chartType}</Badge>
                  </div>
                </div>

                {generatedConfig.description && (
                  <p className="text-xs text-muted-foreground">{generatedConfig.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {generatedConfig.xAxis && (
                    <div>
                      <span className="text-muted-foreground">X-Axis:</span>{' '}
                      <span className="font-medium">{getFieldLabel(generatedConfig.xAxis)}</span>
                    </div>
                  )}
                  {generatedConfig.yAxis && (
                    <div>
                      <span className="text-muted-foreground">Y-Axis:</span>{' '}
                      <span className="font-medium">{getFieldLabel(generatedConfig.yAxis)}</span>
                    </div>
                  )}
                  {generatedConfig.aggregationType && (
                    <div>
                      <span className="text-muted-foreground">Aggregation:</span>{' '}
                      <span className="font-medium capitalize">{generatedConfig.aggregationType}</span>
                    </div>
                  )}
                  {generatedConfig.colorTheme && (
                    <div>
                      <span className="text-muted-foreground">Theme:</span>{' '}
                      <span className="font-medium capitalize">{generatedConfig.colorTheme}</span>
                    </div>
                  )}
                </div>

                {generatedConfig.filters && generatedConfig.filters.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Filters:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {generatedConfig.filters.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {getFieldLabel(f.field)} {f.operator} {String(f.value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {generatedConfig.drilldownConfig?.enabled && generatedConfig.drilldownConfig.levels.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Drilldown:</span>
                    <div className="flex items-center gap-1 mt-1">
                      {generatedConfig.drilldownConfig.levels.map((lvl, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-muted-foreground">→</span>}
                          <Badge variant="outline" className="text-xs">{getFieldLabel(lvl)}</Badge>
                        </React.Fragment>
                      ))}
                    </div>
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
                  <Button size="sm" onClick={handleApply} className="flex-1">
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
