import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, X, TrendingUp, Tag, BarChart3, Calculator, Info, CheckCircle2, PieChart, LineChart, ScatterChart, Grid3X3, CircleDot } from 'lucide-react';

interface ChartDataSectionProps {
  config: ChartConfig;
  formFields: FormField[];
  onConfigChange: (updates: Partial<ChartConfig>) => void;
}

// Helper to get field type supporting both .type and .field_type
const getFieldType = (field: FormField): string => {
  return (field as any)?.field_type || field?.type || 'unknown';
};

// Get numeric fields that can be used for calculations
const getNumericFields = (fields: FormField[]) => {
  return fields.filter(f => {
    const type = getFieldType(f);
    return ['number', 'currency', 'slider', 'rating', 'calculated'].includes(type);
  });
};

// Get categorical fields that can be used for grouping
const getCategoryFields = (fields: FormField[]) => {
  return fields.filter(f => {
    const type = getFieldType(f);
    return [
      'select', 'multi-select', 'radio', 'checkbox', 'text', 'date', 'datetime',
      'status', 'dropdown', 'country', 'tags', 'email', 'phone', 'phone-number',
      'user-select', 'user-picker', 'submission-access', 'yes-no', 'toggle',
      'address', 'rating', 'star-rating', 'slider', 'number', 'currency',
      'time', 'short-text', 'long-text', 'textarea', 'assignee', 'group-picker'
    ].includes(type);
  });
};

// Chart type configuration definitions
interface ChartTypeConfig {
  name: string;
  icon: React.ReactNode;
  description: string;
  requirements: {
    metrics: { min: number; max: number; label: string; description: string };
    dimensions: { min: number; max: number; label: string; description: string };
  };
  aggregationRequired: boolean;
  example: string;
}

const CHART_TYPE_CONFIGS: Record<string, ChartTypeConfig> = {
  bar: {
    name: 'Bar Chart',
    icon: <BarChart3 className="h-5 w-5" />,
    description: 'Compare values across categories with horizontal bars',
    requirements: {
      metrics: { min: 1, max: 5, label: 'Values (Y-axis)', description: 'Numeric fields to measure' },
      dimensions: { min: 1, max: 2, label: 'Categories (X-axis)', description: 'How to group the data' }
    },
    aggregationRequired: true,
    example: 'Example: Total sales by region'
  },
  column: {
    name: 'Column Chart',
    icon: <BarChart3 className="h-5 w-5 rotate-90" />,
    description: 'Compare values across categories with vertical bars',
    requirements: {
      metrics: { min: 1, max: 5, label: 'Values (Y-axis)', description: 'Numeric fields to measure' },
      dimensions: { min: 1, max: 2, label: 'Categories (X-axis)', description: 'How to group the data' }
    },
    aggregationRequired: true,
    example: 'Example: Revenue by month'
  },
  line: {
    name: 'Line Chart',
    icon: <LineChart className="h-5 w-5" />,
    description: 'Show trends over time or continuous data',
    requirements: {
      metrics: { min: 1, max: 5, label: 'Values (Y-axis)', description: 'Numeric fields to track' },
      dimensions: { min: 1, max: 1, label: 'Time/Sequence (X-axis)', description: 'Date or ordered category field' }
    },
    aggregationRequired: true,
    example: 'Example: Website visits over time'
  },
  area: {
    name: 'Area Chart',
    icon: <LineChart className="h-5 w-5" />,
    description: 'Like line chart but with filled area below',
    requirements: {
      metrics: { min: 1, max: 5, label: 'Values (Y-axis)', description: 'Numeric fields to track' },
      dimensions: { min: 1, max: 1, label: 'Time/Sequence (X-axis)', description: 'Date or ordered category field' }
    },
    aggregationRequired: true,
    example: 'Example: Revenue growth over quarters'
  },
  pie: {
    name: 'Pie Chart',
    icon: <PieChart className="h-5 w-5" />,
    description: 'Show parts of a whole as slices',
    requirements: {
      metrics: { min: 1, max: 1, label: 'Value', description: 'Numeric field for slice sizes' },
      dimensions: { min: 1, max: 1, label: 'Slices', description: 'Category field for each slice' }
    },
    aggregationRequired: true,
    example: 'Example: Sales distribution by product'
  },
  donut: {
    name: 'Donut Chart',
    icon: <CircleDot className="h-5 w-5" />,
    description: 'Pie chart with hollow center',
    requirements: {
      metrics: { min: 1, max: 1, label: 'Value', description: 'Numeric field for slice sizes' },
      dimensions: { min: 1, max: 1, label: 'Slices', description: 'Category field for each slice' }
    },
    aggregationRequired: true,
    example: 'Example: Budget allocation by department'
  },
  scatter: {
    name: 'Scatter Plot',
    icon: <ScatterChart className="h-5 w-5" />,
    description: 'Show correlation between two numeric values',
    requirements: {
      metrics: { min: 2, max: 2, label: 'X & Y Values', description: 'Two numeric fields for X and Y coordinates' },
      dimensions: { min: 0, max: 1, label: 'Color By (Optional)', description: 'Category to color-code points' }
    },
    aggregationRequired: false,
    example: 'Example: Price vs Quantity relationship'
  },
  bubble: {
    name: 'Bubble Chart',
    icon: <ScatterChart className="h-5 w-5" />,
    description: 'Scatter plot where point size represents a third value',
    requirements: {
      metrics: { min: 3, max: 3, label: 'X, Y & Size', description: 'Three numeric fields: X position, Y position, and bubble size' },
      dimensions: { min: 0, max: 1, label: 'Color By (Optional)', description: 'Category to color-code bubbles' }
    },
    aggregationRequired: false,
    example: 'Example: Sales vs Profit with deal size'
  },
  heatmap: {
    name: 'Heatmap',
    icon: <Grid3X3 className="h-5 w-5" />,
    description: 'Show intensity values across two dimensions',
    requirements: {
      metrics: { min: 1, max: 1, label: 'Intensity Value', description: 'Numeric field for color intensity' },
      dimensions: { min: 2, max: 2, label: 'Row & Column', description: 'Two category fields for rows and columns' }
    },
    aggregationRequired: true,
    example: 'Example: Sales by product and region'
  }
};

export function ChartDataSection({ config, formFields, onConfigChange }: ChartDataSectionProps) {
  const chartType = config.chartType || 'bar';
  const chartConfig = CHART_TYPE_CONFIGS[chartType] || CHART_TYPE_CONFIGS.bar;
  
  const selectedMetrics = config.metrics || [];
  const selectedDimensions = config.dimensions || [];
  const metricAggregations = config.metricAggregations || [];

  const numericFields = getNumericFields(formFields);
  const categoryFields = getCategoryFields(formFields);

  // Add a metric field
  const addMetric = (fieldId: string) => {
    if (selectedMetrics.includes(fieldId)) return;
    if (selectedMetrics.length >= chartConfig.requirements.metrics.max) return;
    
    const newMetrics = [...selectedMetrics, fieldId];
    const updates: Partial<ChartConfig> = { metrics: newMetrics };
    
    if (chartConfig.aggregationRequired) {
      updates.metricAggregations = [
        ...metricAggregations,
        { field: fieldId, aggregation: 'sum' }
      ];
      updates.aggregationEnabled = true;
    }
    
    onConfigChange(updates);
  };

  // Remove a metric field
  const removeMetric = (fieldId: string) => {
    const newMetrics = selectedMetrics.filter(id => id !== fieldId);
    const newAggregations = metricAggregations.filter(agg => agg.field !== fieldId);
    onConfigChange({ 
      metrics: newMetrics, 
      metricAggregations: newAggregations 
    });
  };

  // Update aggregation for a metric
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
    onConfigChange({ 
      metricAggregations: newAggregations,
      aggregation: aggregation as any
    });
  };

  // Add a dimension field
  const addDimension = (fieldId: string) => {
    if (selectedDimensions.includes(fieldId)) return;
    if (selectedDimensions.length >= chartConfig.requirements.dimensions.max) return;
    
    const newDimensions = [...selectedDimensions, fieldId];
    onConfigChange({ dimensions: newDimensions });
  };

  // Remove a dimension field
  const removeDimension = (fieldId: string) => {
    const newDimensions = selectedDimensions.filter(id => id !== fieldId);
    onConfigChange({ dimensions: newDimensions });
  };

  // Get field label by ID
  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || 'Unknown Field';
  };

  // Get field type label
  const getFieldTypeLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field ? getFieldType(field) : 'unknown';
  };

  const availableNumericFields = numericFields.filter(f => !selectedMetrics.includes(f.id));
  const availableCategoryFields = categoryFields.filter(f => !selectedDimensions.includes(f.id));

  // Check if configuration is complete
  const isConfigComplete = () => {
    const metricsValid = selectedMetrics.length >= chartConfig.requirements.metrics.min;
    const dimensionsValid = selectedDimensions.length >= chartConfig.requirements.dimensions.min;
    return metricsValid && dimensionsValid;
  };

  // Show empty state if no form selected
  if (formFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Data Source Selected</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Please go to the <strong>Basic</strong> tab and select a form as your data source. 
          Once selected, you can configure how your chart displays the data here.
        </p>
      </div>
    );
  }

  // Get specific metric labels based on chart type
  const getMetricLabels = () => {
    if (chartType === 'scatter') {
      return ['X-Axis Value', 'Y-Axis Value'];
    }
    if (chartType === 'bubble') {
      return ['X-Axis Value', 'Y-Axis Value', 'Bubble Size'];
    }
    return [];
  };

  // Get specific dimension labels based on chart type
  const getDimensionLabels = () => {
    if (chartType === 'heatmap') {
      return ['Row Category', 'Column Category'];
    }
    return ['Primary Category', 'Secondary Category'];
  };

  const metricLabels = getMetricLabels();
  const dimensionLabels = getDimensionLabels();

  return (
    <div className="space-y-6">
      {/* Chart Type Info Banner */}
      <Alert className="bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="text-primary mt-0.5">{chartConfig.icon}</div>
          <div className="flex-1">
            <div className="font-semibold text-sm">{chartConfig.name}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{chartConfig.description}</p>
            <p className="text-xs text-primary/80 mt-1 italic">{chartConfig.example}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-xs">
              {chartConfig.requirements.metrics.min === chartConfig.requirements.metrics.max 
                ? `${chartConfig.requirements.metrics.min}` 
                : `${chartConfig.requirements.metrics.min}-${chartConfig.requirements.metrics.max}`} Metric{chartConfig.requirements.metrics.max !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {chartConfig.requirements.dimensions.min === chartConfig.requirements.dimensions.max 
                ? `${chartConfig.requirements.dimensions.min}` 
                : `${chartConfig.requirements.dimensions.min}-${chartConfig.requirements.dimensions.max}`} Dimension{chartConfig.requirements.dimensions.max !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </Alert>

      {/* Metrics Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{chartConfig.requirements.metrics.label}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {chartConfig.requirements.metrics.description}
                {chartConfig.requirements.metrics.min > 0 && (
                  <span className="text-primary ml-1">
                    (Required: {chartConfig.requirements.metrics.min === chartConfig.requirements.metrics.max 
                      ? `exactly ${chartConfig.requirements.metrics.min}` 
                      : `${chartConfig.requirements.metrics.min}-${chartConfig.requirements.metrics.max}`})
                  </span>
                )}
              </CardDescription>
            </div>
            <Badge 
              variant={selectedMetrics.length >= chartConfig.requirements.metrics.min ? 'default' : 'secondary'}
              className="text-xs"
            >
              {selectedMetrics.length}/{chartConfig.requirements.metrics.max}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Selected Metrics */}
          {selectedMetrics.length > 0 && (
            <div className="space-y-2">
              {selectedMetrics.map((metricId, index) => (
                <div key={metricId} className="p-3 bg-muted/50 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="font-medium">{getFieldLabel(metricId)}</span>
                      <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(metricId)}</Badge>
                      {metricLabels[index] && (
                        <Badge variant="outline" className="text-xs">{metricLabels[index]}</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(metricId)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Aggregation selector for charts that need it */}
                  {chartConfig.aggregationRequired && (
                    <div className="flex items-center gap-3">
                      <Label className="text-sm whitespace-nowrap font-medium">Aggregate:</Label>
                      <Select
                        value={metricAggregations.find(a => a.field === metricId)?.aggregation || 'sum'}
                        onValueChange={(v) => updateAggregation(metricId, v)}
                      >
                        <SelectTrigger className="flex-1 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum (Total)</SelectItem>
                          <SelectItem value="avg">Average (Mean)</SelectItem>
                          <SelectItem value="min">Minimum</SelectItem>
                          <SelectItem value="max">Maximum</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Metric */}
          {selectedMetrics.length < chartConfig.requirements.metrics.max && (
            <div>
              {numericFields.length > 0 ? (
                <Select onValueChange={addMetric}>
                  <SelectTrigger className="border-dashed border-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Plus className="h-4 w-4" />
                      <span>
                        {selectedMetrics.length === 0 
                          ? `Select ${metricLabels[0] || 'a numeric field'}...`
                          : metricLabels[selectedMetrics.length] 
                            ? `Select ${metricLabels[selectedMetrics.length]}...`
                            : 'Add another metric...'
                        }
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {availableNumericFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        <div className="flex items-center gap-2">
                          <span>{field.label}</span>
                          <Badge variant="outline" className="text-xs">{getFieldType(field)}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No numeric fields found in this form. Add number, currency, or rating fields to use this chart type.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Metric requirement info */}
          {selectedMetrics.length < chartConfig.requirements.metrics.min && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Please select {chartConfig.requirements.metrics.min - selectedMetrics.length} more metric{chartConfig.requirements.metrics.min - selectedMetrics.length !== 1 ? 's' : ''} for this chart type.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dimensions Section */}
      {(chartConfig.requirements.dimensions.max > 0 || chartConfig.requirements.dimensions.min > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                2
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">{chartConfig.requirements.dimensions.label}</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {chartConfig.requirements.dimensions.description}
                  {chartConfig.requirements.dimensions.min > 0 ? (
                    <span className="text-primary ml-1">
                      (Required: {chartConfig.requirements.dimensions.min === chartConfig.requirements.dimensions.max 
                        ? `exactly ${chartConfig.requirements.dimensions.min}` 
                        : `${chartConfig.requirements.dimensions.min}-${chartConfig.requirements.dimensions.max}`})
                    </span>
                  ) : (
                    <span className="text-muted-foreground ml-1">(Optional)</span>
                  )}
                </CardDescription>
              </div>
              <Badge 
                variant={selectedDimensions.length >= chartConfig.requirements.dimensions.min ? 'default' : 'secondary'}
                className="text-xs"
              >
                {selectedDimensions.length}/{chartConfig.requirements.dimensions.max}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Selected Dimensions */}
            {selectedDimensions.length > 0 && (
              <div className="space-y-2">
                {selectedDimensions.map((dimId, index) => (
                  <div key={dimId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="font-medium">{getFieldLabel(dimId)}</span>
                      <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(dimId)}</Badge>
                      <Badge variant="outline" className="text-xs">{dimensionLabels[index] || `Dimension ${index + 1}`}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDimension(dimId)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Dimension */}
            {selectedDimensions.length < chartConfig.requirements.dimensions.max && (
              <div>
                {categoryFields.length > 0 ? (
                  <Select onValueChange={addDimension}>
                    <SelectTrigger className={`border-dashed border-2 ${chartConfig.requirements.dimensions.min === 0 && selectedDimensions.length === 0 ? 'border-muted' : ''}`}>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
                        <span>
                          {selectedDimensions.length === 0 
                            ? `Select ${dimensionLabels[0] || 'a category field'}...`
                            : dimensionLabels[selectedDimensions.length]
                              ? `Select ${dimensionLabels[selectedDimensions.length]}...`
                              : 'Add another dimension...'
                          }
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategoryFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          <div className="flex items-center gap-2">
                            <span>{field.label}</span>
                            <Badge variant="outline" className="text-xs">{getFieldType(field)}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No category fields found. Add select, radio, text, or date fields to group your data.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Dimension requirement info */}
            {chartConfig.requirements.dimensions.min > 0 && selectedDimensions.length < chartConfig.requirements.dimensions.min && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Please select {chartConfig.requirements.dimensions.min - selectedDimensions.length} more dimension{chartConfig.requirements.dimensions.min - selectedDimensions.length !== 1 ? 's' : ''} for this chart type.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Summary */}
      <Card className={isConfigComplete() ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {isConfigComplete() ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${isConfigComplete() ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {isConfigComplete() ? 'Configuration Complete' : 'Configuration Incomplete'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isConfigComplete() ? (
                  <span>
                    Your {chartConfig.name.toLowerCase()} is ready! 
                    {selectedMetrics.length > 0 && ` Showing ${selectedMetrics.map(m => getFieldLabel(m)).join(', ')}`}
                    {selectedDimensions.length > 0 && ` grouped by ${selectedDimensions.map(d => getFieldLabel(d)).join(' and ')}`}.
                  </span>
                ) : (
                  <span>
                    {selectedMetrics.length < chartConfig.requirements.metrics.min && (
                      <>Select {chartConfig.requirements.metrics.min - selectedMetrics.length} more metric{chartConfig.requirements.metrics.min - selectedMetrics.length !== 1 ? 's' : ''}. </>
                    )}
                    {chartConfig.requirements.dimensions.min > 0 && selectedDimensions.length < chartConfig.requirements.dimensions.min && (
                      <>Select {chartConfig.requirements.dimensions.min - selectedDimensions.length} more dimension{chartConfig.requirements.dimensions.min - selectedDimensions.length !== 1 ? 's' : ''}.</>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
