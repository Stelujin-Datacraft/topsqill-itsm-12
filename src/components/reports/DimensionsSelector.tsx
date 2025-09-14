import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Tag } from 'lucide-react';
import { getDimensionCompatibleFields } from '@/utils/chartConfig';

interface DimensionsSelectorProps {
  formFields: FormField[];
  selectedDimensions: string[];
  onDimensionsChange: (dimensions: string[]) => void;
  maxDimensions?: number;
  label?: string;
  description?: string;
}

export function DimensionsSelector({
  formFields,
  selectedDimensions,
  onDimensionsChange,
  maxDimensions = 3,
  label = "Dimensions",
  description = "Select categorical fields to group and categorize data"
}: DimensionsSelectorProps) {
  const dimensionCompatibleFields = getDimensionCompatibleFields(formFields);
  
  const addDimension = (fieldId: string) => {
    if (selectedDimensions.length < maxDimensions && !selectedDimensions.includes(fieldId)) {
      const newDimensions = [...selectedDimensions, fieldId];
      onDimensionsChange(newDimensions);
    }
  };

  const removeDimension = (fieldId: string) => {
    const newDimensions = selectedDimensions.filter(id => id !== fieldId);
    onDimensionsChange(newDimensions);
  };

  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || 'Unknown Field';
  };

  const getFieldType = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.type || 'unknown';
  };

  const availableFields = dimensionCompatibleFields.filter(field => !selectedDimensions.includes(field.id));

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>

      {/* Selected Dimensions */}
      {selectedDimensions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Selected Dimensions</Label>
          <div className="space-y-2">
            {selectedDimensions.map((fieldId, index) => (
              <div key={fieldId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <Tag className="h-4 w-4 text-secondary" />
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {index === 0 && "Primary: "}{index === 1 && "Secondary: "}{index === 2 && "Tertiary: "}
                    {getFieldLabel(fieldId)}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {getFieldType(fieldId)}
                  </Badge>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDimension(fieldId)}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Dimension */}
      {selectedDimensions.length < maxDimensions && availableFields.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Add {selectedDimensions.length === 0 ? "Primary" : selectedDimensions.length === 1 ? "Secondary" : "Tertiary"} Dimension
          </Label>
          <Select onValueChange={addDimension}>
            <SelectTrigger>
              <SelectValue placeholder="Select a dimension field..." />
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

      {selectedDimensions.length >= maxDimensions && (
        <div className="text-xs text-muted-foreground">
          Maximum of {maxDimensions} dimensions reached for this chart type.
        </div>
      )}

      {dimensionCompatibleFields.length === 0 && (
        <div className="p-3 text-center text-muted-foreground text-sm bg-muted/30 rounded-md">
          No categorical fields available in the selected form for grouping data.
        </div>
      )}

      {selectedDimensions.length > 0 && (
        <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Tip:</strong> Primary dimension will be used for main grouping. 
            {selectedDimensions.length > 1 && " Secondary dimension will create sub-groups within each primary group."}
            {selectedDimensions.length > 2 && " Tertiary dimension adds another level of detail."}
          </p>
        </div>
      )}
    </div>
  );
}