import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, X, TrendingUp, Tag, Info, BarChart3, Calculator, Layers, HelpCircle, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getChartMetricCapabilities, getMetricCompatibleFields, getDimensionCompatibleFields, getCompatibleAggregations } from '@/utils/chartConfig';

interface ChartDataSectionProps {
  config: ChartConfig;
  formFields: FormField[];
  onConfigChange: (updates: Partial<ChartConfig>) => void;
}

// Helper to get field type supporting both .type and .field_type
const getFieldType = (field: FormField): string => {
  return (field as any)?.field_type || field?.type || 'unknown';
};

type ChartMode = 'count' | 'aggregate' | 'compare';

export function ChartDataSection({ config, formFields, onConfigChange }: ChartDataSectionProps) {
  const chartType = config.chartType || 'bar';
  const capabilities = getChartMetricCapabilities(chartType);
  
  const metricCompatibleFields = getMetricCompatibleFields(formFields);
  const dimensionCompatibleFields = getDimensionCompatibleFields(formFields);
  
  const selectedMetrics = config.metrics || [];
  const selectedDimensions = config.dimensions || [];
  const metricAggregations = config.metricAggregations || [];

  // Determine current mode based on config
  const getCurrentMode = (): ChartMode => {
    if (!config.aggregationEnabled && selectedMetrics.length === 0) {
      return 'count';
    }
    if (selectedMetrics.length === 2 && !config.aggregationEnabled) {
      return 'compare';
    }
    return 'aggregate';
  };

  const [mode, setMode] = useState<ChartMode>(getCurrentMode);

  // Update mode when config changes
  useEffect(() => {
    setMode(getCurrentMode());
  }, [config.aggregationEnabled, selectedMetrics.length]);

  // Handle mode change
  const handleModeChange = (newMode: ChartMode) => {
    setMode(newMode);
    
    if (newMode === 'count') {
      // Count mode: no metrics, just count records by dimension
      onConfigChange({
        aggregationEnabled: false,
        metrics: [],
        metricAggregations: []
      });
    } else if (newMode === 'aggregate') {
      // Aggregate mode: select one metric and apply aggregation
      onConfigChange({
        aggregationEnabled: true,
        metrics: selectedMetrics.slice(0, 1),
        metricAggregations: metricAggregations.slice(0, 1)
      });
    } else if (newMode === 'compare') {
      // Compare mode: select two fields to compare directly
      onConfigChange({
        aggregationEnabled: false,
        metrics: selectedMetrics.slice(0, 2),
        metricAggregations: []
      });
    }
  };

  // Add metric
  const addMetric = (fieldId: string) => {
    const maxAllowed = mode === 'compare' ? 2 : (mode === 'aggregate' ? 1 : 0);
    if (selectedMetrics.length >= maxAllowed || selectedMetrics.includes(fieldId)) return;
    
    const newMetrics = [...selectedMetrics, fieldId];
    const field = metricCompatibleFields.find(f => f.id === fieldId);
    const fieldType = field ? getFieldType(field) : 'number';
    const defaultAggregation = ['number', 'currency', 'slider'].includes(fieldType) ? 'sum' : 'count';
    
    const updates: Partial<ChartConfig> = { metrics: newMetrics };
    
    if (mode === 'aggregate') {
      updates.metricAggregations = [
        ...metricAggregations,
        { field: fieldId, aggregation: defaultAggregation as any }
      ];
      updates.aggregationEnabled = true;
    }
    
    onConfigChange(updates);
  };

  // Remove metric
  const removeMetric = (fieldId: string) => {
    const newMetrics = selectedMetrics.filter(id => id !== fieldId);
    const newAggregations = metricAggregations.filter(agg => agg.field !== fieldId);
    onConfigChange({ 
      metrics: newMetrics, 
      metricAggregations: newAggregations 
    });
  };

  // Update aggregation
  const updateAggregation = (fieldId: string, aggregation: string) => {
    const existing = metricAggregations.find(agg => agg.field === fieldId);
    let newAggregations;
    if (existing) {
      newAggregations = metricAggregations.map(agg =>
        agg.field === fieldId ? { ...agg, aggregation: aggregation as any } : agg
      );
    } else {
      newAggregations = [...metricAggregations, { field: fieldId, aggregation: aggregation as any }];
    }
    onConfigChange({ metricAggregations: newAggregations });
  };

  // Add dimension
  const addDimension = (fieldId: string) => {
    if (selectedDimensions.length < capabilities.maxDimensions && !selectedDimensions.includes(fieldId)) {
      const newDimensions = [...selectedDimensions, fieldId];
      onConfigChange({ dimensions: newDimensions });
    }
  };

  // Remove dimension
  const removeDimension = (fieldId: string) => {
    const newDimensions = selectedDimensions.filter(id => id !== fieldId);
    onConfigChange({ dimensions: newDimensions });
  };

  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || 'Unknown Field';
  };

  const getFieldTypeLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field ? getFieldType(field) : 'unknown';
  };

  const getAggregationLabel = (agg: string) => {
    const labels: Record<string, string> = {
      count: 'Count',
      sum: 'Sum',
      avg: 'Average',
      min: 'Minimum',
      max: 'Maximum',
      median: 'Median',
      stddev: 'Std Dev'
    };
    return labels[agg] || agg;
  };

  const availableMetricFields = metricCompatibleFields.filter(f => !selectedMetrics.includes(f.id));
  const availableDimensionFields = dimensionCompatibleFields.filter(f => !selectedDimensions.includes(f.id));

  if (formFields.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
        <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No Form Selected</p>
        <p className="text-sm mt-1">Please select a data source (form) in the Basic tab first.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Step 1: Choose Chart Purpose */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">What do you want to show?</CardTitle>
                <CardDescription className="text-xs">
                  Choose how you want to visualize your data
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup value={mode} onValueChange={(v) => handleModeChange(v as ChartMode)} className="space-y-3">
              <div className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === 'count' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <RadioGroupItem value="count" id="count" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="count" className="font-medium cursor-pointer">
                    Count Records
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Show how many records exist in each category (e.g., "How many orders per status?")
                  </p>
                </div>
              </div>
              
              <div className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === 'aggregate' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <RadioGroupItem value="aggregate" id="aggregate" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="aggregate" className="font-medium cursor-pointer">
                    Calculate Values
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sum, average, or analyze a numeric field (e.g., "Total sales by region")
                  </p>
                </div>
              </div>
              
              <div className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === 'compare' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <RadioGroupItem value="compare" id="compare" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="compare" className="font-medium cursor-pointer">
                    Compare Two Fields
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Show two numeric values side by side (e.g., "Budget vs Actual spending")
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Step 2: Configure based on mode */}
        {mode === 'aggregate' && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  2
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Select the value to calculate</CardTitle>
                  <CardDescription className="text-xs">
                    Choose a numeric field and how to calculate it
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedMetrics.length > 0 ? (
                <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{getFieldLabel(selectedMetrics[0])}</span>
                    <Badge variant="secondary" className="text-xs">
                      {getFieldTypeLabel(selectedMetrics[0])}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(selectedMetrics[0])}
                      className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Label className="text-sm whitespace-nowrap">Calculate:</Label>
                    <Select
                      value={metricAggregations.find(a => a.field === selectedMetrics[0])?.aggregation || 'sum'}
                      onValueChange={(v) => updateAggregation(selectedMetrics[0], v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getCompatibleAggregations(getFieldTypeLabel(selectedMetrics[0])).map((agg) => (
                          <SelectItem key={agg.value} value={agg.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{agg.label}</span>
                              {agg.description && (
                                <span className="text-xs text-muted-foreground">{agg.description}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <Select onValueChange={addMetric}>
                  <SelectTrigger className="border-dashed">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Plus className="h-4 w-4" />
                      <span>Select a numeric field...</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {metricCompatibleFields.length > 0 ? (
                      metricCompatibleFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          <div className="flex items-center gap-2">
                            <span>{field.label}</span>
                            <Badge variant="outline" className="text-xs">{getFieldType(field)}</Badge>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        No numeric fields in this form. Try "Count Records" mode instead.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {mode === 'compare' && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  2
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Select two fields to compare</CardTitle>
                  <CardDescription className="text-xs">
                    Choose two numeric fields to show side by side
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* First field */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">First Value</Label>
                {selectedMetrics[0] ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm flex-1">{getFieldLabel(selectedMetrics[0])}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(selectedMetrics[0])}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Select onValueChange={addMetric}>
                    <SelectTrigger className="border-dashed">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
                        <span>Select first field...</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {metricCompatibleFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedMetrics.length >= 1 && (
                <div className="flex justify-center">
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">vs</div>
                </div>
              )}

              {/* Second field */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Second Value</Label>
                {selectedMetrics[1] ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                    <TrendingUp className="h-4 w-4 text-secondary-foreground" />
                    <span className="font-medium text-sm flex-1">{getFieldLabel(selectedMetrics[1])}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(selectedMetrics[1])}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Select onValueChange={addMetric} disabled={selectedMetrics.length < 1}>
                    <SelectTrigger className="border-dashed">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
                        <span>{selectedMetrics.length < 1 ? 'Select first field first' : 'Select second field...'}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {availableMetricFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Group By (for all modes) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {mode === 'count' ? '2' : '3'}
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Group data by category</CardTitle>
                <CardDescription className="text-xs">
                  {mode === 'count' 
                    ? 'Choose how to categorize the records to count'
                    : 'Optional: Organize your data by categories'}
                </CardDescription>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs">
                    {selectedDimensions.length}/{capabilities.maxDimensions}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum {capabilities.maxDimensions} grouping(s) for {chartType} chart</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Selected Dimensions */}
            {selectedDimensions.length > 0 && (
              <div className="space-y-2">
                {selectedDimensions.map((fieldId, index) => (
                  <div key={fieldId} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                    <Tag className="h-4 w-4 text-secondary-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        <span className="text-muted-foreground mr-1">
                          {index === 0 ? 'Group by:' : 'Then by:'}
                        </span>
                        {getFieldLabel(fieldId)}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDimension(fieldId)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Dimension */}
            {selectedDimensions.length < capabilities.maxDimensions && (
              <Select onValueChange={addDimension}>
                <SelectTrigger className="border-dashed">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                    <span>
                      {selectedDimensions.length === 0 
                        ? 'Select grouping field...' 
                        : 'Add another grouping...'}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableDimensionFields.length > 0 ? (
                    availableDimensionFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        <div className="flex items-center gap-2">
                          <span>{field.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {getFieldType(field)}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      No category fields available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Your chart will show:</p>
                <p className="text-sm text-muted-foreground">
                  {mode === 'count' && selectedDimensions.length > 0 && (
                    <>Number of records grouped by <strong>{getFieldLabel(selectedDimensions[0])}</strong></>
                  )}
                  {mode === 'count' && selectedDimensions.length === 0 && (
                    <>Total count of all records</>
                  )}
                  {mode === 'aggregate' && selectedMetrics.length > 0 && (
                    <>
                      <strong>{getAggregationLabel(metricAggregations.find(a => a.field === selectedMetrics[0])?.aggregation || 'sum')}</strong>
                      {' of '}
                      <strong>{getFieldLabel(selectedMetrics[0])}</strong>
                      {selectedDimensions.length > 0 && (
                        <> grouped by <strong>{getFieldLabel(selectedDimensions[0])}</strong></>
                      )}
                    </>
                  )}
                  {mode === 'aggregate' && selectedMetrics.length === 0 && (
                    <>Select a numeric field to calculate</>
                  )}
                  {mode === 'compare' && selectedMetrics.length === 2 && (
                    <>
                      <strong>{getFieldLabel(selectedMetrics[0])}</strong>
                      {' vs '}
                      <strong>{getFieldLabel(selectedMetrics[1])}</strong>
                      {selectedDimensions.length > 0 && (
                        <> by <strong>{getFieldLabel(selectedDimensions[0])}</strong></>
                      )}
                    </>
                  )}
                  {mode === 'compare' && selectedMetrics.length < 2 && (
                    <>Select two fields to compare</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
