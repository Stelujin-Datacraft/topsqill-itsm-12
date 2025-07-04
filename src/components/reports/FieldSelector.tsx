
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartFieldOption, AggregationOption, getCompatibleAggregations } from '@/utils/chartConfig';
import { Plus, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldConfig {
  fieldId: string;
  aggregation: string;
}

interface FieldSelectorProps {
  label: string;
  description?: string;
  fields: ChartFieldOption[];
  selectedFields: FieldConfig[];
  onFieldsChange: (fields: FieldConfig[]) => void;
  maxFields?: number;
  fieldFilter: (field: ChartFieldOption) => boolean;
  showAggregation?: boolean;
  className?: string;
}

export function FieldSelector({
  label,
  description,
  fields,
  selectedFields,
  onFieldsChange,
  maxFields,
  fieldFilter,
  showAggregation = false,
  className
}: FieldSelectorProps) {
  const availableFields = fields.filter(fieldFilter);
  const canAddMore = !maxFields || selectedFields.length < maxFields;

  const addField = () => {
    if (canAddMore) {
      onFieldsChange([...selectedFields, { fieldId: '', aggregation: 'count' }]);
    }
  };

  const removeField = (index: number) => {
    onFieldsChange(selectedFields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FieldConfig>) => {
    const newFields = [...selectedFields];
    newFields[index] = { ...newFields[index], ...updates };
    onFieldsChange(newFields);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Badge variant="secondary" className="text-xs">
          {selectedFields.length}{maxFields ? `/${maxFields}` : ''}
        </Badge>
      </div>

      <div className="space-y-2">
        {selectedFields.map((fieldConfig, index) => {
          const selectedField = fields.find(f => f.id === fieldConfig.fieldId);
          const aggregations = selectedField ? getCompatibleAggregations(selectedField.type) : [];

          return (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <Select
                  value={fieldConfig.fieldId}
                  onValueChange={(value) => updateField(index, { fieldId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((field) => (
                      <SelectItem 
                        key={field.id} 
                        value={field.id}
                        disabled={selectedFields.some(f => f.fieldId === field.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{field.label}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {field.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showAggregation && fieldConfig.fieldId && (
                <div className="w-32">
                  <Select
                    value={fieldConfig.aggregation}
                    onValueChange={(value) => updateField(index, { aggregation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aggregations.map((agg) => (
                        <SelectItem key={agg.value} value={agg.value}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{agg.label}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm">{agg.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeField(index)}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {canAddMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={addField}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {label.slice(0, -1)}
          </Button>
        )}
      </div>
    </div>
  );
}
