import React from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, PieChart, Tag, Calculator, Info } from 'lucide-react';
import { MaxDataPointsControl } from './MaxDataPointsControl';

interface PieDonutDataSectionProps {
  config: ChartConfig;
  formFields: FormField[];
  onConfigChange: (updates: Partial<ChartConfig>) => void;
  chartType: 'pie' | 'donut';
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

export function PieDonutDataSection({ config, formFields, onConfigChange, chartType }: PieDonutDataSectionProps) {
  const numericFields = getNumericFields(formFields);
  const categoryFields = getCategoryFields(formFields);
  
  const selectedMetric = config.metrics?.[0];
  const selectedDimension = config.dimensions?.[0];
  const metricAggregation = config.metricAggregations?.[0]?.aggregation || 'sum';

  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || 'Unknown Field';
  };

  const getFieldTypeLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field ? getFieldType(field) : 'unknown';
  };

  const chartLabel = chartType === 'pie' ? 'Pie' : 'Donut';

  if (formFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
        <PieChart className="h-12 w-12 text-muted-foreground/50 mb-4" />
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
        <PieChart className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>{chartLabel} Chart</strong> shows parts of a whole. Select a <strong>category</strong> to slice by and a <strong>value</strong> to measure each slice's size.
        </AlertDescription>
      </Alert>

      {/* Step 1: Select Category (Slices) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <CardTitle className="text-base">Slice By (Category)</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Each unique value becomes a slice in the {chartLabel.toLowerCase()} chart
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
                <SelectValue placeholder="Select a category field..." />
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
              <AlertDescription>No category fields found in this form.</AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Example: Product Category, Region, Status
          </p>
        </CardContent>
      </Card>

      {/* Step 2: Select Value (Slice Size) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              2
            </div>
            <div>
              <CardTitle className="text-base">Slice Size (Value)</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Choose what determines the size of each slice
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedMetric ? (
            <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="font-medium">{getFieldLabel(selectedMetric)}</span>
                  <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(selectedMetric)}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfigChange({ 
                    metrics: [], 
                    metricAggregations: [],
                    aggregationEnabled: false 
                  })}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-3">
                <Label className="text-sm whitespace-nowrap font-medium">Calculate as:</Label>
                <Select
                  value={metricAggregation}
                  onValueChange={(v) => onConfigChange({ 
                    metricAggregations: [{ field: selectedMetric, aggregation: v as any }],
                    aggregation: v as any
                  })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum (Total)</SelectItem>
                    <SelectItem value="avg">Average (Mean)</SelectItem>
                    <SelectItem value="count">Count (Number of records)</SelectItem>
                    <SelectItem value="min">Minimum</SelectItem>
                    <SelectItem value="max">Maximum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : numericFields.length > 0 ? (
            <Select onValueChange={(value) => onConfigChange({ 
              metrics: [value],
              metricAggregations: [{ field: value, aggregation: 'sum' }],
              aggregationEnabled: true
            })}>
              <SelectTrigger className="border-dashed border-2">
                <SelectValue placeholder="Select a numeric field..." />
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
            <div className="p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                No numeric fields found. The chart will show <strong>count of records</strong> for each category.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onConfigChange({
                  metrics: [],
                  metricAggregations: [],
                  aggregationEnabled: false
                })}
              >
                Use Record Count
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Example: Total Sales, Average Rating, Count of Orders
          </p>
        </CardContent>
      </Card>

      {/* Step 3: Max Data Points */}
      <MaxDataPointsControl 
        config={config} 
        onConfigChange={onConfigChange}
        stepNumber={3}
        label="Max Slices"
        description="Limit the number of slices shown (others grouped as 'Other')"
      />

      {/* Summary */}
      <Card className={selectedDimension ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className={`h-5 w-5 shrink-0 mt-0.5 ${selectedDimension ? 'text-green-600' : 'text-amber-600'}`} />
            <div>
              <p className={`text-sm font-medium ${selectedDimension ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {selectedDimension ? 'Configuration Complete' : 'Select a Category'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedDimension && selectedMetric
                  ? `${chartLabel} chart showing ${metricAggregation} of "${getFieldLabel(selectedMetric)}" for each "${getFieldLabel(selectedDimension)}"`
                  : selectedDimension
                    ? `${chartLabel} chart showing count of records for each "${getFieldLabel(selectedDimension)}"`
                    : `Select a category field to create your ${chartLabel.toLowerCase()} chart`
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
