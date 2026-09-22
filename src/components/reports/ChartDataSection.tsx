import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, TrendingUp, Tag, BarChart3, Calculator, Layers, Info, CheckCircle2, ArrowRight, ListOrdered, GripVertical } from 'lucide-react';
import { 
  UNSUPPORTED_CHART_FIELDS, 
  DIMENSION_FIELD_TYPES, 
  METRIC_FIELD_TYPES 
} from '@/utils/chartConfig';

interface ChartDataSectionProps {
  config: ChartConfig;
  formFields: FormField[];
  onConfigChange: (updates: Partial<ChartConfig>) => void;
}

// Helper to get field type supporting both .type and .field_type
const getFieldType = (field: FormField): string => {
  return (field as any)?.field_type || field?.type || 'unknown';
};

// Get numeric fields that can be used for calculations (metrics)
const getNumericFields = (fields: FormField[]) => {
  return fields.filter(f => {
    const type = getFieldType(f);
    return METRIC_FIELD_TYPES.includes(type);
  });
};

// Get categorical fields that can be used for grouping (dimensions)
const getCategoryFields = (fields: FormField[]) => {
  return fields.filter(f => {
    const type = getFieldType(f);
    // Only include dimension-compatible fields, exclude unsupported ones
    return DIMENSION_FIELD_TYPES.includes(type) && !UNSUPPORTED_CHART_FIELDS.includes(type);
  });
};

// Filter out unsupported fields entirely
const getChartCompatibleFields = (fields: FormField[]) => {
  return fields.filter(f => {
    const type = getFieldType(f);
    return !UNSUPPORTED_CHART_FIELDS.includes(type);
  });
};

type ChartMode = 'count' | 'calculate' | 'compare' | 'grouping';

export function ChartDataSection({ config, formFields, onConfigChange }: ChartDataSectionProps) {
  const selectedMetrics = config.metrics || [];
  const selectedDimensions = config.dimensions || [];
  const metricAggregations = config.metricAggregations || [];

  // Determine initial mode based on config - only used for initial state
  // Note: 'count' mode is hidden, so default to 'calculate'
  const getInitialMode = (): ChartMode => {
    // Check for explicit compareMode flag first
    if (config.compareMode) {
      return 'compare';
    }
    // Dedicated multi-level grouping mode
    if (config.groupingMode) {
      return 'grouping';
    }
    if (config.aggregationEnabled && selectedMetrics.length > 0) {
      return 'calculate';
    }
    if (selectedMetrics.length === 2 && !config.aggregationEnabled) {
      return 'compare';
    }
    // Default to calculate instead of count (count is hidden)
    return 'calculate';
  };

  const [mode, setMode] = useState<ChartMode>(getInitialMode);

  // Keep local tab in sync when config is loaded/changed externally
  useEffect(() => {
    setMode(getInitialMode());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.compareMode, config.groupingMode, config.aggregationEnabled, config.metrics?.length]);

  const numericFields = getNumericFields(formFields);
  const categoryFields = getCategoryFields(formFields);

  const MAX_GROUPING_LEVELS = 5;

  /** Grouping levels drive drilldown automatically (one field per click). */
  const groupingDrilldownConfig = (dims: string[]) => ({
    enabled: dims.length > 0,
    drilldownLevels: dims,
    levels: dims,
  });

  // Handle mode change
  const handleModeChange = (newMode: ChartMode) => {
    setMode(newMode);
    
    if (newMode === 'count') {
      onConfigChange({
        aggregationEnabled: false,
        compareMode: false,
        groupingMode: false,
        metrics: [],
        metricAggregations: [],
        drilldownConfig: { enabled: false, drilldownLevels: [], levels: [] },
      });
    } else if (newMode === 'calculate') {
      onConfigChange({
        aggregationEnabled: true,
        compareMode: false,
        groupingMode: false,
        metrics: selectedMetrics.slice(0, 1),
        metricAggregations: metricAggregations.slice(0, 1),
        // Calculate keeps at most 2 optional group fields
        dimensions: selectedDimensions.slice(0, 2),
        groupByField: undefined,
        // Leaving grouping clears auto-drilldown so the Drilldown tab is free again
        drilldownConfig: { enabled: false, drilldownLevels: [], levels: [] },
      });
    } else if (newMode === 'compare') {
      onConfigChange({
        aggregationEnabled: false,
        compareMode: true,
        groupingMode: false,
        metrics: selectedMetrics.slice(0, 2),
        metricAggregations: [],
        groupByField: undefined,
        drilldownConfig: { enabled: false, drilldownLevels: [], levels: [] },
      });
    } else if (newMode === 'grouping') {
      const nextDimensions = selectedDimensions.length > 0
        ? selectedDimensions
        : (config.groupByField ? [config.groupByField] : []);
      onConfigChange({
        aggregationEnabled: true,
        compareMode: false,
        groupingMode: true,
        // Grouping is always count-of-records — no metric field to pick
        metrics: [],
        metricAggregations: [{ field: 'count', aggregation: 'count' }],
        aggregation: 'count',
        aggregationType: 'count',
        dimensions: nextDimensions,
        groupByField: undefined,
        // Auto-enable drilldown from grouping levels (click chart → next level)
        drilldownConfig: groupingDrilldownConfig(nextDimensions),
      });
    }
  };

  // Add a metric field
  const addMetric = (fieldId: string) => {
    if (selectedMetrics.includes(fieldId)) return;
    
    const maxAllowed = mode === 'compare' ? 2 : 1;
    if (selectedMetrics.length >= maxAllowed) return;
    
    const newMetrics = [...selectedMetrics, fieldId];
    const updates: Partial<ChartConfig> = { metrics: newMetrics };
    
    if (mode === 'calculate') {
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
    // Also update the main aggregation field so ChartPreview uses the correct aggregation
    onConfigChange({ 
      metricAggregations: newAggregations,
      aggregation: aggregation as any
    });
  };

  // Add a dimension (group by) field
  const addDimension = (fieldId: string) => {
    if (selectedDimensions.includes(fieldId)) return;
    const maxDims = mode === 'grouping' ? MAX_GROUPING_LEVELS : 2;
    if (selectedDimensions.length >= maxDims) return;
    
    const newDimensions = [...selectedDimensions, fieldId];
    const updates: Partial<ChartConfig> = { dimensions: newDimensions };
    if (mode === 'grouping') {
      updates.groupByField = undefined;
      updates.drilldownConfig = groupingDrilldownConfig(newDimensions);
    }
    onConfigChange(updates);
  };

  // Remove a dimension field
  const removeDimension = (fieldId: string) => {
    const newDimensions = selectedDimensions.filter(id => id !== fieldId);
    const updates: Partial<ChartConfig> = { dimensions: newDimensions };
    if (mode === 'grouping') {
      updates.groupByField = undefined;
      updates.drilldownConfig = groupingDrilldownConfig(newDimensions);
    }
    onConfigChange(updates);
  };

  // Reorder dimensions via drag and drop
  const handleDimensionDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(selectedDimensions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const updates: Partial<ChartConfig> = { dimensions: items };
    if (mode === 'grouping') {
      updates.groupByField = undefined;
      updates.drilldownConfig = groupingDrilldownConfig(items);
    }
    onConfigChange(updates);
  };

  // Reorder metrics via drag and drop
  const handleMetricDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(selectedMetrics);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Also reorder metricAggregations to match
    const newAggregations = items.map(id => 
      metricAggregations.find(agg => agg.field === id) || { field: id, aggregation: 'sum' as const }
    );
    
    onConfigChange({ 
      metrics: items,
      metricAggregations: newAggregations
    });
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

  const chartCompatibleFields = getChartCompatibleFields(formFields);
  const availableNumericFields = numericFields.filter(f => !selectedMetrics.includes(f.id));
  const availableCategoryFields = categoryFields.filter(f => !selectedDimensions.includes(f.id));
  const availableCompareFields = chartCompatibleFields.filter(f => !selectedMetrics.includes(f.id));
  // Grouping mode: allow every chart-compatible field as a grouping level
  const availableGroupingFields = chartCompatibleFields.filter(f => !selectedDimensions.includes(f.id));

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

  // Check if configuration is complete
  const isConfigComplete = () => {
    if (mode === 'count') {
      // Count mode requires at least X-axis dimension selected
      return selectedDimensions.length >= 1;
    }
    if (mode === 'calculate') {
      // Calculate mode requires at least one metric selected
      return selectedMetrics.length > 0;
    }
    if (mode === 'compare') {
      // Compare mode requires exactly two fields selected
      return selectedMetrics.length === 2;
    }
    if (mode === 'grouping') {
      // Grouping only needs at least one grouping level (always counts records)
      return selectedDimensions.length >= 1;
    }
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="icon-md text-module-overview" />
        <AlertDescription className="text-sm">
          Configure your chart data in 3 simple steps: choose what to show, select your values, and pick how to group them.
        </AlertDescription>
      </Alert>

      {/* STEP 1: Choose Chart Purpose — Calculate | Compare | Grouping */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <CardTitle className="text-base">What do you want to show?</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Choose Calculate, Compare, or multi-level Grouping
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={mode === 'count' ? 'calculate' : mode} onValueChange={(v) => handleModeChange(v as ChartMode)}>
            <TabsList className="grid w-full grid-cols-3 h-auto p-1">
              <TabsTrigger value="calculate" className="flex flex-col gap-1 py-2.5 data-[state=active]:shadow-sm">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Calculator className="h-3.5 w-3.5" />
                  Calculate
                </span>
              </TabsTrigger>
              <TabsTrigger value="compare" className="flex flex-col gap-1 py-2.5 data-[state=active]:shadow-sm">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Layers className="h-3.5 w-3.5" />
                  Compare
                </span>
              </TabsTrigger>
              <TabsTrigger value="grouping" className="flex flex-col gap-1 py-2.5 data-[state=active]:shadow-sm">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <ListOrdered className="h-3.5 w-3.5" />
                  Grouping
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calculate" className="mt-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sum, average, or analyze a numeric field.
                <span className="text-muted-foreground/70 italic"> Example: "Total sales by region"</span>
              </p>
            </TabsContent>
            <TabsContent value="compare" className="mt-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Show two values side by side for comparison.
                <span className="text-muted-foreground/70 italic"> Example: "Budget vs Actual"</span>
              </p>
            </TabsContent>
            <TabsContent value="grouping" className="mt-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Count records level-by-level: click the chart to drill into the next grouping field.
                The last level opens the matching records table. Drilldown is configured automatically.
                <span className="text-muted-foreground/70 italic"> Example: Region → Country → City</span>
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* STEP 2: Select Values/Categories */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              2
            </div>
            <div>
              <CardTitle className="text-base">
                {mode === 'count' 
                  ? 'Select X-axis categories' 
                  : mode === 'calculate' 
                    ? 'Select the value to calculate'
                    : mode === 'grouping'
                      ? 'How records are counted'
                    : 'Select two fields to compare'
                }
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {mode === 'count'
                  ? 'Choose which field to count records by (shown on X-axis)'
                  : mode === 'calculate' 
                    ? 'Choose a numeric field and how to calculate it'
                    : mode === 'grouping'
                      ? 'Grouping always counts form submissions — no value field to select'
                    : 'Pick two fields to show side by side'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* COUNT MODE - X-axis category selection */}
          {mode === 'count' && (
            <>
              {selectedDimensions[0] ? (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Tag className="icon-md text-module-reports" />
                    <span className="font-medium">{getFieldLabel(selectedDimensions[0])}</span>
                    <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(selectedDimensions[0])}</Badge>
                    <Badge variant="outline" className="text-xs">X-axis</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDimension(selectedDimensions[0])}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="icon-md" />
                  </Button>
                </div>
              ) : (
                categoryFields.length > 0 ? (
                  <Select onValueChange={addDimension}>
                    <SelectTrigger className="border-dashed border-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="icon-md" />
                        <span>Select a category field for X-axis...</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {categoryFields.map((field) => (
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
                    <Info className="icon-md" />
                    <AlertDescription>
                      No category fields found. Add fields like select, radio, or text to group your data.
                    </AlertDescription>
                  </Alert>
                )
              )}
              <p className="text-xs text-muted-foreground">
                This field determines the categories on your chart. Each unique value will be shown as a separate segment.
              </p>
            </>
          )}

          {/* GROUPING MODE — fixed count of records (no metric picker) */}
          {mode === 'grouping' && (
            <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="icon-md text-module-reports" />
                <span className="font-medium">Count of records</span>
                <Badge variant="secondary" className="text-xs">Default</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Each category shows how many submissions match that grouping combination.
                Add grouping levels in the next step — any form field can be used.
              </p>
            </div>
          )}

          {/* CALCULATE MODE metric picker */}
          {mode === 'calculate' && (
            <>
              {selectedMetrics.length > 0 ? (
                <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="icon-md text-module-performance" />
                      <span className="font-medium">{getFieldLabel(selectedMetrics[0])}</span>
                      <Badge variant="secondary" className="text-xs">
                        {getFieldTypeLabel(selectedMetrics[0])}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(selectedMetrics[0])}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="icon-md" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Label className="text-sm whitespace-nowrap font-medium">
                      Calculate as:
                    </Label>
                    <Select
                      value={metricAggregations.find(a => a.field === selectedMetrics[0])?.aggregation || 'sum'}
                      onValueChange={(v) => updateAggregation(selectedMetrics[0], v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">Sum (Total)</SelectItem>
                        <SelectItem value="avg">Average (Mean)</SelectItem>
                        <SelectItem value="min">Minimum (Lowest)</SelectItem>
                        <SelectItem value="max">Maximum (Highest)</SelectItem>
                        <SelectItem value="count">Count (Number of records)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div>
                  {numericFields.length > 0 ? (
                    <Select onValueChange={addMetric}>
                      <SelectTrigger className="border-dashed border-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Plus className="icon-md" />
                          <span>Select a numeric field...</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {numericFields.map((field) => (
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
                      <Info className="icon-md" />
                      <AlertDescription>
                        No numeric fields found in this form. Add a number or currency field to aggregate.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </>
          )}

          {/* COMPARE MODE */}
          {mode === 'compare' && (
            <div className="space-y-4">
              {/* X-Axis Field */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block font-medium">X-Axis Field (Categories)</Label>
                {selectedMetrics[0] ? (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="icon-md text-module-performance" />
                      <span className="font-medium">{getFieldLabel(selectedMetrics[0])}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(selectedMetrics[0])}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="icon-md" />
                    </Button>
                  </div>
                ) : (
                  <Select onValueChange={addMetric}>
                    <SelectTrigger className="border-dashed border-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="icon-md" />
                        <span>Select X-axis field...</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {formFields.filter(f => !selectedMetrics.includes(f.id)).map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          <div className="flex items-center gap-2">
                            <span>{field.label}</span>
                            <Badge variant="outline" className="text-xs">{getFieldType(field)}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Arrow Indicator */}
              {selectedMetrics.length >= 1 && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                    <span className="font-medium">X → Y</span>
                  </div>
                </div>
              )}

              {/* Y-Axis Field */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block font-medium">Y-Axis Field (Values)</Label>
                {selectedMetrics[1] ? (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="icon-md text-secondary-foreground" />
                      <span className="font-medium">{getFieldLabel(selectedMetrics[1])}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(selectedMetrics[1])}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="icon-md" />
                    </Button>
                  </div>
                ) : (
                  <Select onValueChange={addMetric} disabled={selectedMetrics.length < 1}>
                    <SelectTrigger className={`border-dashed border-2 ${selectedMetrics.length < 1 ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="icon-md" />
                        <span>{selectedMetrics.length < 1 ? 'Select X-axis field first' : 'Select Y-axis field...'}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {formFields.filter(f => !selectedMetrics.includes(f.id)).map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          <div className="flex items-center gap-2">
                            <span>{field.label}</span>
                            <Badge variant="outline" className="text-xs">{getFieldType(field)}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {/* Info message when Y-axis field is text - auto uses encoded legend */}
              {selectedMetrics.length === 2 && (() => {
                const yAxisField = formFields.find(f => f.id === selectedMetrics[1]);
                const yAxisFieldType = yAxisField ? getFieldType(yAxisField) : '';
                const isTextType = ['text', 'short-text', 'long-text', 'textarea', 'select', 'radio', 'dropdown', 'status', 'country', 'email', 'tags', 'address', 'multi-select', 'checkbox'].includes(yAxisFieldType);
                
                if (isTextType) {
                  return (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 mt-4">
                      <div className="flex items-start gap-2">
                        <ListOrdered className="icon-md text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Encoded Legend Mode (Auto)</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Since "{yAxisField?.label}" is a text field, it will be shown as numbers on Y-axis with a legend.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* STEP 3: Group By / Stack By / Multi-level Grouping - Not shown for Compare mode */}
      {mode !== 'compare' && (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              3
            </div>
            <div>
              <CardTitle className="text-base">
                {mode === 'count'
                  ? 'Stack/Color by (Optional)'
                  : mode === 'grouping'
                    ? 'Grouping levels'
                    : 'Group data by (Optional)'}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {mode === 'count'
                  ? 'Add a secondary field to stack or color-code your chart'
                  : mode === 'grouping'
                    ? 'Add fields in drill order. Click the chart to go level-by-level; the last level opens the records table. The Drilldown tab is managed automatically.'
                    : 'Choose how to categorize your data. Leave empty to show aggregated totals.'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* For Count mode - show secondary dimension selector */}
          {mode === 'count' && (
            <>
              {selectedDimensions[1] ? (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Layers className="icon-md text-module-reports" />
                    <span className="font-medium">{getFieldLabel(selectedDimensions[1])}</span>
                    <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(selectedDimensions[1])}</Badge>
                    <Badge variant="outline" className="text-xs">Stack/Color</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDimension(selectedDimensions[1])}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="icon-md" />
                  </Button>
                </div>
              ) : selectedDimensions.length >= 1 ? (
                availableCategoryFields.length > 0 ? (
                  <Select onValueChange={addDimension}>
                    <SelectTrigger className="border-dashed border-2 border-muted">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="icon-md" />
                        <span>Add secondary field for stacking...</span>
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
                  <p className="text-xs text-muted-foreground">No additional category fields available for stacking.</p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Select an X-axis field first in Step 2.</p>
              )}
              
              {/* Info message when secondary field is text - auto uses encoded legend */}
              {selectedDimensions.length === 2 && (() => {
                const secondaryField = formFields.find(f => f.id === selectedDimensions[1]);
                const secondaryFieldType = secondaryField ? getFieldType(secondaryField) : '';
                const isTextType = ['text', 'short-text', 'long-text', 'textarea', 'select', 'radio', 'dropdown', 'status', 'country', 'email', 'tags', 'address'].includes(secondaryFieldType);
                
                if (isTextType) {
                  return (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-start gap-2">
                        <ListOrdered className="icon-md text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Encoded Legend Mode (Auto)</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Since "{secondaryField?.label}" is a text field, it will be shown as numbers on Y-axis with a legend.
                            <br />
                            <span className="italic">Example: John → 1 (Mumbai), Ria → 2 (Gujarat)</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <p className="text-xs text-muted-foreground">
                Choose a secondary field to see relationships between the two fields.
              </p>
            </>
          )}

          {/* For Calculate mode - optional up to 2 dimensions */}
          {mode === 'calculate' && (
            <>
              {/* Selected Dimensions - Draggable */}
              {selectedDimensions.length > 0 && (
                <DragDropContext onDragEnd={handleDimensionDragEnd}>
                  <Droppable droppableId="dimensions-list">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-2 p-2 rounded-lg border-2 border-dashed transition-colors ${
                          snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-transparent'
                        }`}
                      >
                        {selectedDimensions.map((dimId, index) => (
                          <Draggable key={dimId} draggableId={dimId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg border transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                  >
                                    <GripVertical className="icon-md" />
                                  </div>
                                  <Tag className="icon-md text-module-reports" />
                                  <span className="font-medium">{getFieldLabel(dimId)}</span>
                                  <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(dimId)}</Badge>
                                  <Badge variant="outline" className="text-xs">{index === 0 ? 'Primary' : 'Secondary'}</Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeDimension(dimId)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="icon-md" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {/* Add Dimension */}
              {selectedDimensions.length < 2 && (
                <div>
                  {categoryFields.length > 0 ? (
                    <Select onValueChange={addDimension}>
                      <SelectTrigger className={`border-dashed border-2 ${selectedDimensions.length === 0 ? '' : 'border-muted'}`}>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Plus className="icon-md" />
                          <span>
                            {selectedDimensions.length === 0 
                              ? 'Select a category field to group data...' 
                              : 'Add secondary grouping (optional)...'
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
                      <Info className="icon-md" />
                      <AlertDescription>
                        No category fields found. Add fields like select, radio, or text to group your data.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                The primary group field will be shown on the X-axis. You can add a secondary field for nested grouping.
              </p>
            </>
          )}

          {/* For Grouping mode - required multi-level hierarchy (up to MAX_GROUPING_LEVELS) */}
          {mode === 'grouping' && (
            <>
              {selectedDimensions.length > 0 && (
                <DragDropContext onDragEnd={handleDimensionDragEnd}>
                  <Droppable droppableId="grouping-levels-list">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-2 p-2 rounded-lg border-2 border-dashed transition-colors ${
                          snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-transparent'
                        }`}
                      >
                        {selectedDimensions.map((dimId, index) => {
                          const isLast = index === selectedDimensions.length - 1;
                          const levelLabel =
                            selectedDimensions.length === 1
                              ? 'Level 1 · Click opens records'
                              : index === 0
                                ? `Level ${index + 1} · Start`
                                : isLast
                                  ? `Level ${index + 1} · Opens records`
                                  : `Level ${index + 1} · Drill`;
                          return (
                            <Draggable key={dimId} draggableId={dimId} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg border transition-shadow ${
                                    snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                      <GripVertical className="icon-md" />
                                    </div>
                                    <Tag className="icon-md text-module-reports shrink-0" />
                                    <span className="font-medium truncate">{getFieldLabel(dimId)}</span>
                                    <Badge variant="secondary" className="text-xs shrink-0">{getFieldTypeLabel(dimId)}</Badge>
                                    <Badge variant="outline" className="text-xs shrink-0">{levelLabel}</Badge>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeDimension(dimId)}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                                  >
                                    <X className="icon-md" />
                                  </Button>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {selectedDimensions.length < MAX_GROUPING_LEVELS && (
                <div>
                  {availableGroupingFields.length > 0 ? (
                    <Select onValueChange={addDimension}>
                      <SelectTrigger className={`border-dashed border-2 ${selectedDimensions.length === 0 ? '' : 'border-muted'}`}>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Plus className="icon-md" />
                          <span>
                            {selectedDimensions.length === 0
                              ? 'Add first grouping level...'
                              : `Add level ${selectedDimensions.length + 1} (optional)...`}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {availableGroupingFields.map((field) => (
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
                      <Info className="icon-md" />
                      <AlertDescription>
                        {selectedDimensions.length === 0
                          ? 'No fields available to group by. Select a form with fields first.'
                          : 'All available fields are already used as grouping levels.'}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {selectedDimensions.length >= MAX_GROUPING_LEVELS && (
                <p className="text-xs text-muted-foreground">
                  Maximum of {MAX_GROUPING_LEVELS} grouping levels reached.
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Drag to reorder drill levels. The chart shows one level at a time (count of records).
                Click the chart to drill into the next field; on the last level, the records table opens.
              </p>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Configuration Summary */}
      <Card className={isConfigComplete() ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {isConfigComplete() ? (
              <CheckCircle2 className="icon-lg text-green-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="icon-lg text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${isConfigComplete() ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {isConfigComplete() ? 'Configuration Complete' : 'Configuration Incomplete'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === 'count' && (
                  selectedDimensions.length >= 1
                    ? selectedDimensions.length >= 2
                      ? `Your chart will count records by "${getFieldLabel(selectedDimensions[0])}", stacked/colored by "${getFieldLabel(selectedDimensions[1])}".`
                      : `Your chart will count records grouped by "${getFieldLabel(selectedDimensions[0])}". Add a Stack/Color field to see distribution within each category.`
                    : 'Select an X-axis category field to see record counts per category.'
                )}
                {mode === 'calculate' && (
                  selectedMetrics.length > 0
                    ? selectedDimensions.length > 0
                      ? `Your chart will show the ${metricAggregations[0]?.aggregation || 'sum'} of "${getFieldLabel(selectedMetrics[0])}" grouped by "${getFieldLabel(selectedDimensions[0])}".`
                      : `Your chart will show the ${metricAggregations[0]?.aggregation || 'sum'} of "${getFieldLabel(selectedMetrics[0])}". Add a group field to break down by category.`
                    : 'Select a numeric field to calculate.'
                )}
                {mode === 'compare' && (
                  selectedMetrics.length === 2 
                    ? `Your chart will compare "${getFieldLabel(selectedMetrics[0])}" (X-axis) vs "${getFieldLabel(selectedMetrics[1])}" (Y-axis).`
                    : 'Select two fields to compare.'
                )}
                {mode === 'grouping' && (
                  selectedDimensions.length >= 1
                    ? `Your chart will count records and drill ${selectedDimensions.map(id => `"${getFieldLabel(id)}"`).join(' → ')}. Clicking the last level opens matching records.`
                    : 'Add at least one grouping level.'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
