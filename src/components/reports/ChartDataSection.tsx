import React from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, X, TrendingUp, Tag, Info, BarChart3, Calculator, Layers } from 'lucide-react';
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

export function ChartDataSection({ config, formFields, onConfigChange }: ChartDataSectionProps) {
  const chartType = config.chartType || 'bar';
  const capabilities = getChartMetricCapabilities(chartType);
  
  const metricCompatibleFields = getMetricCompatibleFields(formFields);
  const dimensionCompatibleFields = getDimensionCompatibleFields(formFields);
  
  const selectedMetrics = config.metrics || [];
  const selectedDimensions = config.dimensions || [];
  const metricAggregations = config.metricAggregations || [];

  // Add metric
  const addMetric = (fieldId: string) => {
    if (selectedMetrics.length < capabilities.maxMetrics && !selectedMetrics.includes(fieldId)) {
      const newMetrics = [...selectedMetrics, fieldId];
      const field = metricCompatibleFields.find(f => f.id === fieldId);
      const fieldType = field ? getFieldType(field) : 'number';
      const defaultAggregation = ['number', 'currency', 'slider'].includes(fieldType) ? 'sum' : 'count';
      
      const newAggregations = [
        ...metricAggregations,
        { field: fieldId, aggregation: defaultAggregation as any }
      ];
      
      onConfigChange({ 
        metrics: newMetrics, 
        metricAggregations: newAggregations,
        aggregationEnabled: true 
      });
    }
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
        <p className="text-sm mt-1">Please select a data source (form) in the Basic tab to configure chart data.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Quick Guide */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-sm">How to configure your chart data</p>
                <p className="text-xs text-muted-foreground">
                  <strong>Step 1:</strong> Select what you want to measure (numeric values like sales, ratings, amounts).<br />
                  <strong>Step 2:</strong> Choose how to calculate it (sum, average, count, etc.).<br />
                  <strong>Step 3:</strong> Pick how to group/categorize the data (by date, category, status, etc.).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* STEP 1: What to Measure (Metrics) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Step 1: What do you want to measure?</CardTitle>
                <CardDescription className="text-xs">
                  Select numeric fields (like sales, amount, rating) that you want to visualize
                </CardDescription>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs">
                    {selectedMetrics.length}/{capabilities.maxMetrics}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum {capabilities.maxMetrics} metric(s) for {chartType} chart</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Selected Metrics */}
            {selectedMetrics.length > 0 && (
              <div className="space-y-2">
                {selectedMetrics.map((fieldId) => {
                  const aggregation = metricAggregations.find(agg => agg.field === fieldId);
                  const fieldType = getFieldTypeLabel(fieldId);
                  
                  return (
                    <div key={fieldId} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                      <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{getFieldLabel(fieldId)}</div>
                        <Badge variant="secondary" className="text-xs mt-0.5">
                          {fieldType}
                        </Badge>
                      </div>
                      
                      {/* Aggregation Selector */}
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5">
                              <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                              <Select
                                value={aggregation?.aggregation || 'sum'}
                                onValueChange={(value) => updateAggregation(fieldId, value)}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {getCompatibleAggregations(fieldType).map((agg) => (
                                    <SelectItem key={agg.value} value={agg.value} className="text-xs">
                                      <div className="flex flex-col">
                                        <span>{agg.label}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p className="font-medium mb-1">How to calculate:</p>
                            <ul className="text-xs space-y-0.5">
                              <li><strong>Sum:</strong> Total of all values</li>
                              <li><strong>Average:</strong> Mean value</li>
                              <li><strong>Count:</strong> Number of records</li>
                              <li><strong>Min/Max:</strong> Lowest/highest value</li>
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMetric(fieldId)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Metric */}
            {selectedMetrics.length < capabilities.maxMetrics && (
              <Select onValueChange={addMetric}>
                <SelectTrigger className="border-dashed">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                    <span>Add a measurement field...</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableMetricFields.length > 0 ? (
                    availableMetricFields.map((field) => (
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
                      No numeric fields available in this form
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}

            {metricCompatibleFields.length === 0 && (
              <div className="p-3 text-center text-muted-foreground text-sm bg-muted/30 rounded-md border border-dashed">
                <p>No numeric fields found in this form.</p>
                <p className="text-xs mt-1">Charts will show record counts instead.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* STEP 2: How to Group (Dimensions) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-secondary/50">
                <Layers className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Step 2: How do you want to group the data?</CardTitle>
                <CardDescription className="text-xs">
                  Select category fields (like status, date, department) to organize your chart
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
                          {index === 0 ? 'Group by:' : index === 1 ? 'Then by:' : 'Also by:'}
                        </span>
                        {getFieldLabel(fieldId)}
                      </div>
                      <Badge variant="secondary" className="text-xs mt-0.5">
                        {getFieldTypeLabel(fieldId)}
                      </Badge>
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

            {dimensionCompatibleFields.length === 0 && (
              <div className="p-3 text-center text-muted-foreground text-sm bg-muted/30 rounded-md border border-dashed">
                No category fields found in this form for grouping.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Summary */}
        {(selectedMetrics.length > 0 || selectedDimensions.length > 0) && (
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="text-sm">
                <span className="font-medium">Your chart will show: </span>
                <span className="text-muted-foreground">
                  {selectedMetrics.length > 0 ? (
                    <>
                      {selectedMetrics.map((fieldId, index) => {
                        const agg = metricAggregations.find(a => a.field === fieldId);
                        return (
                          <span key={fieldId}>
                            {index > 0 && ', '}
                            <span className="text-foreground font-medium">
                              {getAggregationLabel(agg?.aggregation || 'sum')}
                            </span>
                            {' of '}
                            <span className="text-foreground">{getFieldLabel(fieldId)}</span>
                          </span>
                        );
                      })}
                    </>
                  ) : (
                    <span className="text-foreground font-medium">Count of records</span>
                  )}
                  {selectedDimensions.length > 0 && (
                    <>
                      {' grouped by '}
                      {selectedDimensions.map((fieldId, index) => (
                        <span key={fieldId}>
                          {index > 0 && ' → '}
                          <span className="text-foreground">{getFieldLabel(fieldId)}</span>
                        </span>
                      ))}
                    </>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart Type Hint */}
        <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 border">
          <strong className="text-foreground">{chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart Tips:</strong>{' '}
          {chartType === 'bar' || chartType === 'column' 
            ? 'Great for comparing values across categories. Add multiple metrics to compare different measurements side by side.'
            : chartType === 'line' || chartType === 'area'
            ? 'Perfect for showing trends over time. Use a date field as your grouping for best results.'
            : chartType === 'pie' || chartType === 'donut'
            ? 'Shows proportions of a whole. Works best with a single metric and one grouping field.'
            : chartType === 'scatter'
            ? 'Shows correlation between two metrics. Add two numeric fields to see their relationship.'
            : chartType === 'bubble'
            ? 'Like scatter but with a third metric shown as bubble size. Great for 3-dimensional data.'
            : chartType === 'heatmap'
            ? 'Shows intensity across two dimensions. Best with two grouping fields and one metric.'
            : 'Configure your data using the options above.'}
        </div>
      </div>
    </TooltipProvider>
  );
}
