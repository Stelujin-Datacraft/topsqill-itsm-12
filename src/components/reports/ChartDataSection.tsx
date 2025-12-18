import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, X, TrendingUp, Tag, BarChart3, Calculator, Layers, Info, CheckCircle2, ArrowRight } from 'lucide-react';

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
    // Include most field types that can be used for categorization
    return [
      'select', 'multi-select', 'radio', 'checkbox', 'text', 'date', 'datetime',
      'status', 'dropdown', 'country', 'tags', 'email', 'phone', 'phone-number',
      'user-select', 'user-picker', 'submission-access', 'yes-no', 'toggle',
      'address', 'rating', 'star-rating', 'slider', 'number', 'currency',
      'time', 'short-text', 'long-text', 'textarea', 'assignee', 'group-picker'
    ].includes(type);
  });
};

type ChartMode = 'count' | 'calculate' | 'compare';

export function ChartDataSection({ config, formFields, onConfigChange }: ChartDataSectionProps) {
  const selectedMetrics = config.metrics || [];
  const selectedDimensions = config.dimensions || [];
  const metricAggregations = config.metricAggregations || [];

  // Determine initial mode based on config - only used for initial state
  const getInitialMode = (): ChartMode => {
    // Check for explicit compareMode flag first
    if (config.compareMode) {
      return 'compare';
    }
    if (config.aggregationEnabled && selectedMetrics.length > 0) {
      return 'calculate';
    }
    if (selectedMetrics.length === 2 && !config.aggregationEnabled) {
      return 'compare';
    }
    return 'count';
  };

  const [mode, setMode] = useState<ChartMode>(getInitialMode);

  const numericFields = getNumericFields(formFields);
  const categoryFields = getCategoryFields(formFields);

  // Handle mode change
  const handleModeChange = (newMode: ChartMode) => {
    setMode(newMode);
    
    if (newMode === 'count') {
      onConfigChange({
        aggregationEnabled: false,
        compareMode: false,
        metrics: [],
        metricAggregations: []
      });
    } else if (newMode === 'calculate') {
      onConfigChange({
        aggregationEnabled: true,
        compareMode: false,
        metrics: selectedMetrics.slice(0, 1),
        metricAggregations: metricAggregations.slice(0, 1)
      });
    } else if (newMode === 'compare') {
      onConfigChange({
        aggregationEnabled: false,
        compareMode: true,
        metrics: selectedMetrics.slice(0, 2),
        metricAggregations: []
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
    if (selectedDimensions.length >= 2) return;
    
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
  const availableCompareFields = formFields.filter(f => !selectedMetrics.includes(f.id));

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
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          Configure your chart data in 3 simple steps: choose what to show, select your values, and pick how to group them.
        </AlertDescription>
      </Alert>

      {/* STEP 1: Choose Chart Purpose */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <CardTitle className="text-base">What do you want to show?</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Choose the type of data visualization
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={mode} 
            onValueChange={(v) => handleModeChange(v as ChartMode)} 
            className="grid gap-3"
          >
            {/* Count Records Option */}
            <div 
              onClick={() => handleModeChange('count')}
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                mode === 'count' 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
              }`}
            >
              <RadioGroupItem value="count" id="mode-count" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Count Records</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Count how many records exist in each category.
                  <br />
                  <span className="text-muted-foreground/70 italic">Example: "How many orders per status?" or "Users by country"</span>
                </p>
              </div>
            </div>
            
            {/* Calculate Values Option */}
            <div 
              onClick={() => handleModeChange('calculate')}
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                mode === 'calculate' 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
              }`}
            >
              <RadioGroupItem value="calculate" id="mode-calculate" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Calculate Values</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sum, average, or analyze a numeric field.
                  <br />
                  <span className="text-muted-foreground/70 italic">Example: "Total sales by region" or "Average rating by product"</span>
                </p>
              </div>
            </div>
            
            {/* Compare Two Fields Option */}
            <div 
              onClick={() => handleModeChange('compare')}
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                mode === 'compare' 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
              }`}
            >
              <RadioGroupItem value="compare" id="mode-compare" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Compare Two Fields</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Show two values side by side for comparison.
                  <br />
                  <span className="text-muted-foreground/70 italic">Example: "Budget vs Actual" or "Revenue vs Expenses"</span>
                </p>
              </div>
            </div>
          </RadioGroup>
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
                    : 'Select two fields to compare'
                }
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {mode === 'count'
                  ? 'Choose which field to count records by (shown on X-axis)'
                  : mode === 'calculate' 
                    ? 'Choose a numeric field and how to calculate it' 
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
                    <Tag className="h-4 w-4 text-primary" />
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
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                categoryFields.length > 0 ? (
                  <Select onValueChange={addDimension}>
                    <SelectTrigger className="border-dashed border-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
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
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No category fields found. Add fields like select, radio, or text to group your data.
                    </AlertDescription>
                  </Alert>
                )
              )}
              <p className="text-xs text-muted-foreground">
                This field determines the bars/categories on your chart. Each unique value will be shown as a separate bar.
              </p>
            </>
          )}

          {/* CALCULATE MODE */}
          {mode === 'calculate' && (
            <>
              {selectedMetrics.length > 0 ? (
                <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
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
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Label className="text-sm whitespace-nowrap font-medium">Calculate as:</Label>
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
                          <Plus className="h-4 w-4" />
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
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No numeric fields found in this form. Use <strong>Count Records</strong> mode instead.
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
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="font-medium">{getFieldLabel(selectedMetrics[0])}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(selectedMetrics[0])}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Select onValueChange={addMetric}>
                    <SelectTrigger className="border-dashed border-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
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
                      <TrendingUp className="h-4 w-4 text-secondary-foreground" />
                      <span className="font-medium">{getFieldLabel(selectedMetrics[1])}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(selectedMetrics[1])}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Select onValueChange={addMetric} disabled={selectedMetrics.length < 1}>
                    <SelectTrigger className={`border-dashed border-2 ${selectedMetrics.length < 1 ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* STEP 3: Group By / Stack By */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              3
            </div>
            <div>
              <CardTitle className="text-base">
                {mode === 'count' ? 'Stack/Color by (Optional)' : 'Group data by (Optional)'}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {mode === 'count'
                  ? 'Add a secondary field to stack or color-code your bars'
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
                    <Layers className="h-4 w-4 text-primary" />
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
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : selectedDimensions.length >= 1 ? (
                availableCategoryFields.length > 0 ? (
                  <Select onValueChange={addDimension}>
                    <SelectTrigger className="border-dashed border-2 border-muted">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
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
              <p className="text-xs text-muted-foreground">
                This creates stacked or grouped bars where each segment/bar color represents a different value.
                <br />
                <span className="italic">Example: X-axis = Location, Stack by = Name → Shows names within each location</span>
              </p>
            </>
          )}

          {/* For Calculate and Compare modes - show dimension selector */}
          {mode !== 'count' && (
            <>
              {/* Selected Dimensions */}
              {selectedDimensions.length > 0 && (
                <div className="space-y-2">
                  {selectedDimensions.map((dimId, index) => (
                    <div key={dimId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="font-medium">{getFieldLabel(dimId)}</span>
                        <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(dimId)}</Badge>
                        {index === 0 && <Badge variant="outline" className="text-xs">Primary</Badge>}
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
              {selectedDimensions.length < 2 && (
                <div>
                  {categoryFields.length > 0 ? (
                    <Select onValueChange={addDimension}>
                      <SelectTrigger className={`border-dashed border-2 ${selectedDimensions.length === 0 ? '' : 'border-muted'}`}>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Plus className="h-4 w-4" />
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
                      <Info className="h-4 w-4" />
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
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <Card className={isConfigComplete() ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {isConfigComplete() ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
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
                    ? selectedDimensions.length > 0
                      ? `Your chart will compare "${getFieldLabel(selectedMetrics[0])}" vs "${getFieldLabel(selectedMetrics[1])}" grouped by "${getFieldLabel(selectedDimensions[0])}".`
                      : `Your chart will compare "${getFieldLabel(selectedMetrics[0])}" vs "${getFieldLabel(selectedMetrics[1])}". Add a group field to see comparisons per category.`
                    : 'Select two fields to compare.'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
