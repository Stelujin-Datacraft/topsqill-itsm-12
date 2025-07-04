
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/types/form';

interface GenericFieldSelectorProps {
  formFields: FormField[];
  selectedFields: string[];
  onFieldsChange: (fields: string[]) => void;
  label: string;
  description?: string;
  selectionType: 'checkbox' | 'dropdown';
  maxSelections?: number;
  placeholder?: string;
  maxHeight?: string;
}

export function GenericFieldSelector({
  formFields,
  selectedFields,
  onFieldsChange,
  label,
  description,
  selectionType,
  maxSelections,
  placeholder = 'Select field...',
  maxHeight = '300px'
}: GenericFieldSelectorProps) {
  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    if (checked) {
      const newFields = maxSelections === 1 ? [fieldId] : [...selectedFields, fieldId];
      onFieldsChange(newFields);
    } else {
      onFieldsChange(selectedFields.filter(id => id !== fieldId));
    }
  };

  const handleDropdownChange = (fieldId: string) => {
    if (maxSelections === 1) {
      onFieldsChange([fieldId]);
    } else {
      const newFields = selectedFields.includes(fieldId)
        ? selectedFields.filter(id => id !== fieldId)
        : [...selectedFields, fieldId];
      onFieldsChange(newFields);
    }
  };

  const getFieldTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'text': 'bg-blue-100 text-blue-800',
      'textarea': 'bg-blue-100 text-blue-800',
      'number': 'bg-green-100 text-green-800',
      'currency': 'bg-emerald-100 text-emerald-800',
      'date': 'bg-purple-100 text-purple-800',
      'time': 'bg-purple-100 text-purple-800',
      'datetime': 'bg-purple-100 text-purple-800',
      'select': 'bg-orange-100 text-orange-800',
      'multi-select': 'bg-orange-100 text-orange-800',
      'radio': 'bg-yellow-100 text-yellow-800',
      'checkbox': 'bg-pink-100 text-pink-800',
      'toggle-switch': 'bg-pink-100 text-pink-800',
      'rating': 'bg-indigo-100 text-indigo-800',
      'slider': 'bg-cyan-100 text-cyan-800',
      'email': 'bg-blue-100 text-blue-800',
      'phone': 'bg-blue-100 text-blue-800',
      'url': 'bg-blue-100 text-blue-800',
      'file': 'bg-gray-100 text-gray-800',
      'image': 'bg-gray-100 text-gray-800',
      'address': 'bg-teal-100 text-teal-800',
      'color': 'bg-red-100 text-red-800',
      'signature': 'bg-gray-100 text-gray-800',
      'tags': 'bg-violet-100 text-violet-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Show all form fields without any filtering or validation
  const fieldsToShow = formFields.map(field => ({
    id: field.id,
    label: field.label,
    type: field.type,
    tooltip: field.tooltip
  }));

  if (fieldsToShow.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <div className="p-4 text-center text-muted-foreground text-sm">
          No fields found in the selected form
        </div>
      </div>
    );
  }

  if (selectionType === 'dropdown') {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <Select 
          value={selectedFields[0] || ''} 
          onValueChange={handleDropdownChange}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            {fieldsToShow.map(field => (
              <SelectItem key={field.id} value={field.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{field.label}</span>
                  <Badge 
                    variant="outline" 
                    className={`ml-2 text-xs ${getFieldTypeColor(field.type)}`}
                  >
                    {field.type}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Checkbox selection with improved scrolling
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

      <div className="border rounded-md bg-background" style={{ height: maxHeight }}>
        <ScrollArea className="h-full">
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
                  {field.tooltip && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {field.tooltip}
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
    </div>
  );
}
