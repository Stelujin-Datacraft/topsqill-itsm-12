import React from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Grid3X3, Info } from 'lucide-react';

interface HeatmapDataSectionProps {
  config: ChartConfig;
  formFields: FormField[];
  onConfigChange: (updates: Partial<ChartConfig>) => void;
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

export function HeatmapDataSection({ config, formFields, onConfigChange }: HeatmapDataSectionProps) {
  const numericFields = getNumericFields(formFields);
  const categoryFields = getCategoryFields(formFields);
  
  const rowField = config.dimensions?.[0];
  const columnField = config.dimensions?.[1];
  const intensityField = config.heatmapIntensityField || config.metrics?.[0];

  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || 'Unknown Field';
  };

  const getFieldTypeLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field ? getFieldType(field) : 'unknown';
  };

  if (formFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
        <Grid3X3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
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
        <Grid3X3 className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Heatmap</strong> displays data in a grid where color intensity represents values. Perfect for showing relationships between two categories.
        </AlertDescription>
      </Alert>

      {/* Step 1: Rows */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <CardTitle className="text-base">Rows</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Category field for row labels (vertical axis)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rowField ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="font-medium">{getFieldLabel(rowField)}</span>
                <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(rowField)}</Badge>
                <Badge variant="outline" className="text-xs">Rows</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onConfigChange({ dimensions: config.dimensions?.slice(1) || [] })}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : categoryFields.length > 0 ? (
            <Select onValueChange={(value) => onConfigChange({ 
              dimensions: [value, ...(config.dimensions?.slice(1) || [])]
            })}>
              <SelectTrigger className="border-dashed border-2">
                <SelectValue placeholder="Select row category..." />
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
              <AlertDescription>No category fields found.</AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Example: Product, Region, Department
          </p>
        </CardContent>
      </Card>

      {/* Step 2: Columns */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              2
            </div>
            <div>
              <CardTitle className="text-base">Columns</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Category field for column labels (horizontal axis)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {columnField ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="font-medium">{getFieldLabel(columnField)}</span>
                <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(columnField)}</Badge>
                <Badge variant="outline" className="text-xs">Columns</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onConfigChange({ dimensions: [config.dimensions?.[0] || ''] })}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Select 
              onValueChange={(value) => onConfigChange({ 
                dimensions: [config.dimensions?.[0] || '', value]
              })}
              disabled={!rowField}
            >
              <SelectTrigger className={`border-dashed border-2 ${!rowField ? 'opacity-50' : ''}`}>
                <SelectValue placeholder={rowField ? "Select column category..." : "Select rows first"} />
              </SelectTrigger>
              <SelectContent>
                {categoryFields.filter(f => f.id !== rowField).map((field) => (
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
          <p className="text-xs text-muted-foreground mt-2">
            Example: Month, Quarter, Status
          </p>
        </CardContent>
      </Card>

      {/* Step 3: Intensity Value */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              3
            </div>
            <div>
              <CardTitle className="text-base">Intensity Value</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Numeric field that determines cell color intensity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {intensityField ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="font-medium">{getFieldLabel(intensityField)}</span>
                <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(intensityField)}</Badge>
                <Badge variant="outline" className="text-xs">Intensity</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onConfigChange({ 
                  heatmapIntensityField: undefined,
                  metrics: []
                })}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : numericFields.length > 0 ? (
            <Select 
              onValueChange={(value) => onConfigChange({ 
                heatmapIntensityField: value,
                metrics: [value],
                aggregationEnabled: true,
                metricAggregations: [{ field: value, aggregation: 'sum' }]
              })}
              disabled={!rowField || !columnField}
            >
              <SelectTrigger className={`border-dashed border-2 ${!rowField || !columnField ? 'opacity-50' : ''}`}>
                <SelectValue placeholder={rowField && columnField ? "Select intensity value..." : "Select rows and columns first"} />
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
            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                No numeric fields found. Heatmap will show <strong>count of records</strong> as intensity.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Higher values = darker/more intense colors
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className={rowField && columnField ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className={`h-5 w-5 shrink-0 mt-0.5 ${rowField && columnField ? 'text-green-600' : 'text-amber-600'}`} />
            <div>
              <p className={`text-sm font-medium ${rowField && columnField ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {rowField && columnField ? 'Configuration Complete' : 'Select Both Dimensions'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {rowField && columnField
                  ? `Heatmap: "${getFieldLabel(rowField)}" (rows) × "${getFieldLabel(columnField)}" (columns)${intensityField ? `, intensity by "${getFieldLabel(intensityField)}"` : ', intensity by count'}`
                  : 'Select row and column categories to create a heatmap'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
