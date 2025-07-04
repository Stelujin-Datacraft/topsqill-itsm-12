
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormField } from '@/types/form';
import { categorizeFields, ChartFieldOption } from '@/utils/chartConfig';

interface FormFieldSelectorProps {
  formFields: FormField[];
  selectedFields: string[];
  onFieldsChange: (fields: string[]) => void;
  label: string;
  description?: string;
  filterType?: 'all' | 'metrics' | 'dimensions';
  maxHeight?: string;
}

export function FormFieldSelector({
  formFields,
  selectedFields,
  onFieldsChange,
  label,
  description,
  filterType = 'all',
  maxHeight = '200px'
}: FormFieldSelectorProps) {
  // For 'all' filter type (tables), show all form fields directly without categorization
  const fieldsToShow = filterType === 'all' 
    ? formFields.map(field => ({
        id: field.id,
        label: field.label,
        type: field.type,
        canBeMetric: false,
        canBeDimension: false
      }))
    : (() => {
        const categorizedFields = categorizeFields(formFields);
        return categorizedFields.filter(field => {
          if (filterType === 'metrics') return field.canBeMetric;
          if (filterType === 'dimensions') return field.canBeDimension;
          return true;
        });
      })();

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    if (checked) {
      onFieldsChange([...selectedFields, fieldId]);
    } else {
      onFieldsChange(selectedFields.filter(id => id !== fieldId));
    }
  };

  const getFieldTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'text': 'bg-blue-100 text-blue-800',
      'number': 'bg-green-100 text-green-800',
      'currency': 'bg-emerald-100 text-emerald-800',
      'date': 'bg-purple-100 text-purple-800',
      'datetime': 'bg-purple-100 text-purple-800',
      'select': 'bg-orange-100 text-orange-800',
      'multi-select': 'bg-orange-100 text-orange-800',
      'radio': 'bg-yellow-100 text-yellow-800',
      'checkbox': 'bg-pink-100 text-pink-800',
      'rating': 'bg-indigo-100 text-indigo-800',
      'slider': 'bg-cyan-100 text-cyan-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (fieldsToShow.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <div className="p-4 text-center text-muted-foreground text-sm">
          {filterType === 'all' ? 'No fields found in the selected form' : 'No compatible fields found for this configuration'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <Badge variant="secondary" className="text-xs">
          {selectedFields.length} selected
        </Badge>
      </div>

      <ScrollArea className="border rounded-md" style={{ maxHeight }}>
        <div className="p-3 space-y-2">
          {fieldsToShow.map((field) => (
            <div key={field.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
              <Checkbox
                id={field.id}
                checked={selectedFields.includes(field.id)}
                onCheckedChange={(checked) => handleFieldToggle(field.id, !!checked)}
              />
              <div className="flex-1 min-w-0">
                <Label 
                  htmlFor={field.id} 
                  className="text-sm font-medium cursor-pointer"
                >
                  {field.label}
                </Label>
                {/* Show field description/tooltip if available */}
                {formFields.find(f => f.id === field.id)?.tooltip && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formFields.find(f => f.id === field.id)?.tooltip}
                  </p>
                )}
              </div>
              <Badge 
                variant="outline" 
                className={`text-xs ${getFieldTypeColor(field.type)}`}
              >
                {field.type}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
