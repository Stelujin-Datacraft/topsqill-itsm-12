import React from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, ScatterChart, Info, ArrowRight } from 'lucide-react';

interface ScatterDataSectionProps {
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
      'status', 'dropdown', 'country', 'tags'
    ].includes(type);
  });
};

export function ScatterDataSection({ config, formFields, onConfigChange }: ScatterDataSectionProps) {
  const numericFields = getNumericFields(formFields);
  const categoryFields = getCategoryFields(formFields);
  
  const xAxisField = config.metrics?.[0];
  const yAxisField = config.metrics?.[1];
  const colorByField = config.dimensions?.[0];

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
        <ScatterChart className="h-12 w-12 text-muted-foreground/50 mb-4" />
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
        <ScatterChart className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Scatter Plot</strong> shows the relationship between two numeric values. Each point represents a data record.
        </AlertDescription>
      </Alert>

      {/* Step 1: X-Axis Value */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <CardTitle className="text-base">X-Axis Value</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Select a numeric field for the horizontal position
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {xAxisField ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="font-medium">{getFieldLabel(xAxisField)}</span>
                <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(xAxisField)}</Badge>
                <Badge variant="outline" className="text-xs">X-Axis</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onConfigChange({ metrics: config.metrics?.slice(1) || [] })}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : numericFields.length > 0 ? (
            <Select onValueChange={(value) => onConfigChange({ 
              metrics: [value, ...(config.metrics?.slice(1) || [])],
              compareMode: true,
              aggregationEnabled: false
            })}>
              <SelectTrigger className="border-dashed border-2">
                <SelectValue placeholder="Select X-axis numeric field..." />
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
              <AlertDescription>No numeric fields found. Scatter plots require numeric data.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Arrow indicator */}
      {xAxisField && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            <span className="font-medium">X</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium">Y</span>
          </div>
        </div>
      )}

      {/* Step 2: Y-Axis Value */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              2
            </div>
            <div>
              <CardTitle className="text-base">Y-Axis Value</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Select a numeric field for the vertical position
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {yAxisField ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="font-medium">{getFieldLabel(yAxisField)}</span>
                <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(yAxisField)}</Badge>
                <Badge variant="outline" className="text-xs">Y-Axis</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onConfigChange({ metrics: [config.metrics?.[0] || ''] })}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Select 
              onValueChange={(value) => onConfigChange({ 
                metrics: [config.metrics?.[0] || '', value]
              })}
              disabled={!xAxisField}
            >
              <SelectTrigger className={`border-dashed border-2 ${!xAxisField ? 'opacity-50' : ''}`}>
                <SelectValue placeholder={xAxisField ? "Select Y-axis numeric field..." : "Select X-axis first"} />
              </SelectTrigger>
              <SelectContent>
                {numericFields.filter(f => f.id !== xAxisField).map((field) => (
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
        </CardContent>
      </Card>

      {/* Step 3: Color By (Optional) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground text-sm font-bold shrink-0">
              3
            </div>
            <div>
              <CardTitle className="text-base">Color By (Optional)</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Color points by a category to see patterns
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {colorByField ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="font-medium">{getFieldLabel(colorByField)}</span>
                <Badge variant="secondary" className="text-xs">{getFieldTypeLabel(colorByField)}</Badge>
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
              <SelectTrigger className="border-dashed border-2 border-muted">
                <SelectValue placeholder="Optional: Color points by category..." />
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
            <p className="text-sm text-muted-foreground">No category fields available for coloring.</p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className={xAxisField && yAxisField ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className={`h-5 w-5 shrink-0 mt-0.5 ${xAxisField && yAxisField ? 'text-green-600' : 'text-amber-600'}`} />
            <div>
              <p className={`text-sm font-medium ${xAxisField && yAxisField ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {xAxisField && yAxisField ? 'Configuration Complete' : 'Select Both Axes'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {xAxisField && yAxisField
                  ? `Scatter plot: "${getFieldLabel(xAxisField)}" vs "${getFieldLabel(yAxisField)}"${colorByField ? `, colored by "${getFieldLabel(colorByField)}"` : ''}`
                  : 'Select both X and Y axis fields to create a scatter plot'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
