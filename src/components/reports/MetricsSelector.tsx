import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, X, TrendingUp } from 'lucide-react';
import { getMetricCompatibleFields, getCompatibleAggregations } from '@/utils/chartConfig';

interface MetricAggregation {
  field: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median' | 'stddev';
}

interface MetricsSelectorProps {
  formFields: FormField[];
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
  aggregationEnabled: boolean;
  onAggregationEnabledChange: (enabled: boolean) => void;
  metricAggregations?: MetricAggregation[];
  onMetricAggregationsChange?: (aggregations: MetricAggregation[]) => void;
  groupByField?: string;
  onGroupByFieldChange?: (fieldId: string | undefined) => void;
  maxMetrics?: number;
  label?: string;
  description?: string;
}

export function MetricsSelector({
  formFields,
  selectedMetrics,
  onMetricsChange,
  aggregationEnabled,
  onAggregationEnabledChange,
  metricAggregations = [],
  onMetricAggregationsChange,
  groupByField,
  onGroupByFieldChange,
  maxMetrics = 5,
  label = "Metrics",
  description = "Select numeric fields to measure and analyze"
}: MetricsSelectorProps) {
  const metricCompatibleFields = getMetricCompatibleFields(formFields);
  const allFields = formFields; // For groupBy, we can use any field
  
  const addMetric = (fieldId: string) => {
    if (selectedMetrics.length < maxMetrics && !selectedMetrics.includes(fieldId)) {
      const newMetrics = [...selectedMetrics, fieldId];
      onMetricsChange(newMetrics);
      
      // Add default aggregation for new metric
      if (aggregationEnabled && onMetricAggregationsChange) {
        const field = metricCompatibleFields.find(f => f.id === fieldId);
        const defaultAggregation = field?.type === 'number' || field?.type === 'currency' ? 'sum' : 'count';
        const newAggregations = [...metricAggregations, { field: fieldId, aggregation: defaultAggregation as any }];
        onMetricAggregationsChange(newAggregations);
      }
    }
  };

  const removeMetric = (fieldId: string) => {
    const newMetrics = selectedMetrics.filter(id => id !== fieldId);
    onMetricsChange(newMetrics);
    
    // Remove aggregation for removed metric
    if (onMetricAggregationsChange) {
      const newAggregations = metricAggregations.filter(agg => agg.field !== fieldId);
      onMetricAggregationsChange(newAggregations);
    }
  };

  const updateAggregation = (fieldId: string, aggregation: string) => {
    if (onMetricAggregationsChange) {
      const newAggregations = metricAggregations.map(agg => 
        agg.field === fieldId ? { ...agg, aggregation: aggregation as any } : agg
      );
      onMetricAggregationsChange(newAggregations);
    }
  };

  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || 'Unknown Field';
  };

  const getFieldType = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.type || 'unknown';
  };

  const availableFields = metricCompatibleFields.filter(field => !selectedMetrics.includes(field.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="aggregation-toggle" className="text-xs">Enable Aggregation</Label>
          <Switch
            id="aggregation-toggle"
            checked={aggregationEnabled}
            onCheckedChange={onAggregationEnabledChange}
          />
        </div>
      </div>

      {/* Selected Metrics */}
      {selectedMetrics.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Selected Metrics</Label>
          <div className="space-y-2">
            {selectedMetrics.map((fieldId) => {
              const field = formFields.find(f => f.id === fieldId);
              const aggregation = metricAggregations.find(agg => agg.field === fieldId);
              
              return (
                <div key={fieldId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{getFieldLabel(fieldId)}</div>
                    <Badge variant="secondary" className="text-xs">
                      {getFieldType(fieldId)}
                    </Badge>
                  </div>
                  
                  {aggregationEnabled && (
                    <Select
                      value={aggregation?.aggregation || 'count'}
                      onValueChange={(value) => updateAggregation(fieldId, value)}
                    >
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getCompatibleAggregations(getFieldType(fieldId)).map((agg) => (
                          <SelectItem key={agg.value} value={agg.value} className="text-xs">
                            {agg.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMetric(fieldId)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Metric */}
      {selectedMetrics.length < maxMetrics && availableFields.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Add Metric</Label>
          <Select onValueChange={addMetric}>
            <SelectTrigger>
              <SelectValue placeholder="Select a metric field..." />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  <div className="flex items-center gap-2">
                    <span>{field.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {field.type}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Group By Field (when aggregation is enabled) */}
      {aggregationEnabled && onGroupByFieldChange && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Group Aggregation By</Label>
          <Select
            value={groupByField || ''}
            onValueChange={(value) => onGroupByFieldChange(value || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select grouping field (optional)..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No grouping</SelectItem>
              {allFields
                .filter(field => ['text', 'select', 'radio', 'date', 'email'].includes(field.type))
                .map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    <div className="flex items-center gap-2">
                      <span>{field.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {field.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedMetrics.length >= maxMetrics && (
        <div className="text-xs text-muted-foreground">
          Maximum of {maxMetrics} metrics reached for this chart type.
        </div>
      )}

      {metricCompatibleFields.length === 0 && (
        <div className="p-3 text-center text-muted-foreground text-sm bg-muted/30 rounded-md">
          No numeric fields available in the selected form. 
          <br />
          You can still use count aggregation with any field.
        </div>
      )}
    </div>
  );
}