import React from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, TrendingUp, Tag, Calculator, Info, Plus } from 'lucide-react';
import { MaxDataPointsControl } from './MaxDataPointsControl';

interface LineAreaDataSectionProps {
  config: ChartConfig;
  formFields: FormField[];
  onConfigChange: (updates: Partial<ChartConfig>) => void;
  chartType: 'line' | 'area';
}

const getFieldType = (field: FormField): string => {
  return (field as any)?.field_type || field?.type || 'unknown';
};

const getNumericFields = (fields: FormField[]) => {
  return fields.filter(f => {
    const type = getFieldType(f);
    return ['number', 'currency', 'slider', 'rating', 'calculated'].includes(type);
  });
};

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

export function LineAreaDataSection({ config, formFields, onConfigChange, chartType }: LineAreaDataSectionProps) {
  const numericFields = getNumericFields(formFields);
  const categoryFields = getCategoryFields(formFields);
  
  const selectedMetrics = config.metrics || [];
  const selectedDimension = config.dimensions?.[0];
  const metricAggregations = config.metricAggregations || [];

  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || 'Unknown Field';
  };

  const getFieldTypeLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field ? getFieldType(field) : 'unknown';
  };

  const chartLabel = chartType === 'line' ? 'Line' : 'Area';
  const chartIcon = TrendingUp;

  const addMetric = (fieldId: string) => {
    if (selectedMetrics.includes(fieldId)) return;
    if (selectedMetrics.length >= 5) return;
    
    const newMetrics = [...selectedMetrics, fieldId];
    onConfigChange({
      metrics: newMetrics,
      metricAggregations: [...metricAggregations, { field: fieldId, aggregation: 'sum' }],
      aggregationEnabled: true
    });
  };

  const removeMetric = (fieldId: string) => {
    onConfigChange({
      metrics: selectedMetrics.filter(id => id !== fieldId),
      metricAggregations: metricAggregations.filter(a => a.field !== fieldId)
    });
  };

  const updateAggregation = (fieldId: string, aggregation: string) => {
    const newAggregations = metricAggregations.map(a =>
      a.field === fieldId ? { ...a, aggregation: aggregation as any } : a
    );
    if (!newAggregations.find(a => a.field === fieldId)) {
      newAggregations.push({ field: fieldId, aggregation: aggregation as any });
    }
    onConfigChange({ 
      metricAggregations: newAggregations,
      aggregation: aggregation as any
    });
  };

  if (formFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
        <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Data Source Selected</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Please go to the <strong>Basic</strong> tab and select a form as your data source.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-primary/5 border-primary/20">
        <TrendingUp className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>{chartLabel} Chart</strong> shows trends over a continuous axis. Select an <strong>X-axis</strong> (usually time or category) and one or more <strong>values</strong> to plot.
        </AlertDescription>
      </Alert>

      {/* Step 1: Select X-Axis */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <CardTitle className="text-base">X-Axis (Horizontal)</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Choose the field for the horizontal axis (often a date or category)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedDimension ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <span className="font-medium">{getFieldLabel(selectedDimension)}</span>
                <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(selectedDimension)}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onConfigChange({ dimensions: [] })}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : categoryFields.length > 0 ? (
            <Select onValueChange={(value) => onConfigChange({ dimensions: [value] })}>
              <SelectTrigger className="border-dashed border-2">
                <SelectValue placeholder="Select X-axis field..." />
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
              <AlertDescription>No suitable fields found for X-axis.</AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Best for: Date, Month, Quarter, Category
          </p>
        </CardContent>
      </Card>

      {/* Step 2: Select Y-Axis Values (Multiple allowed) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              2
            </div>
            <div>
              <CardTitle className="text-base">Y-Axis Values (Lines)</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Select one or more numeric fields to plot as lines (max 5)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Selected metrics */}
          {selectedMetrics.map((metricId) => (
            <div key={metricId} className="p-3 bg-muted/50 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="font-medium">{getFieldLabel(metricId)}</span>
                  <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(metricId)}</Badge>
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
              
              <div className="flex items-center gap-3">
                <Label className="text-xs whitespace-nowrap">Aggregation:</Label>
                <Select
                  value={metricAggregations.find(a => a.field === metricId)?.aggregation || 'sum'}
                  onValueChange={(v) => updateAggregation(metricId, v)}
                >
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="min">Min</SelectItem>
                    <SelectItem value="max">Max</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          {/* Add more metrics */}
          {selectedMetrics.length < 5 && numericFields.length > 0 && (
            <Select onValueChange={addMetric}>
              <SelectTrigger className="border-dashed border-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Plus className="h-4 w-4" />
                  <span>{selectedMetrics.length === 0 ? 'Select a value field...' : 'Add another line...'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {numericFields.filter(f => !selectedMetrics.includes(f.id)).map((field) => (
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

          {numericFields.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>No numeric fields found. Add number, currency, or rating fields to your form.</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            Each field creates a separate line on the chart
          </p>
        </CardContent>
      </Card>

      {/* Step 3: Max Data Points */}
      <MaxDataPointsControl 
        config={config} 
        onConfigChange={onConfigChange}
        stepNumber={3}
        label="Max Data Points"
        description="Limit the number of data points shown on the chart"
      />

      {/* Summary */}
      <Card className={selectedDimension && selectedMetrics.length > 0 ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className={`h-5 w-5 shrink-0 mt-0.5 ${selectedDimension && selectedMetrics.length > 0 ? 'text-green-600' : 'text-amber-600'}`} />
            <div>
              <p className={`text-sm font-medium ${selectedDimension && selectedMetrics.length > 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {selectedDimension && selectedMetrics.length > 0 ? 'Configuration Complete' : 'Complete the Setup'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedDimension && selectedMetrics.length > 0
                  ? `${chartLabel} chart with ${selectedMetrics.length} line(s) over "${getFieldLabel(selectedDimension)}"`
                  : !selectedDimension
                    ? 'Select an X-axis field'
                    : 'Select at least one value field for Y-axis'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
