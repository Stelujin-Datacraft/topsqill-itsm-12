import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Filter } from 'lucide-react';
import { FormField } from '@/types/form';

interface FilterConfigProps {
  formFields: FormField[];
  filters: Array<{
    field: string;
    operator: string;
    value: string;
    label?: string;
  }>;
  onFiltersChange: (filters: Array<{ field: string; operator: string; value: string; label?: string }>) => void;
}

const FILTER_OPERATORS = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_equal', label: 'Greater or equal' },
    { value: 'less_equal', label: 'Less or equal' },
    { value: 'between', label: 'Between' },
    { value: 'not_equals', label: 'Not equals' }
  ],
  date: [
    { value: 'equals', label: 'On date' },
    { value: 'after', label: 'After' },
    { value: 'before', label: 'Before' },
    { value: 'between', label: 'Between dates' },
    { value: 'last_days', label: 'Last N days' },
    { value: 'next_days', label: 'Next N days' }
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'in', label: 'In list' },
    { value: 'not_in', label: 'Not in list' }
  ],
  boolean: [
    { value: 'equals', label: 'Is' },
    { value: 'not_equals', label: 'Is not' }
  ]
};

export function FilterConfig({ formFields, filters, onFiltersChange }: FilterConfigProps) {
  const addFilter = () => {
    onFiltersChange([
      ...filters,
      { field: '', operator: 'equals', value: '' }
    ]);
  };

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<typeof filters[0]>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onFiltersChange(newFilters);
  };

  const getFieldType = (fieldId: string): keyof typeof FILTER_OPERATORS => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field) return 'text';
    
    // Support both .type and .field_type for compatibility
    const fieldType = (field as any)?.field_type || field?.type || '';
    
    switch (fieldType) {
      case 'number':
      case 'currency':
      case 'rating':
      case 'slider':
        return 'number';
      case 'date':
      case 'datetime':
      case 'time':
        return 'date';
      case 'select':
      case 'radio':
      case 'multi-select':
      case 'dropdown':
      case 'status':
        return 'select';
      case 'checkbox':
      case 'toggle-switch':
      case 'toggle':
      case 'yes-no':
        return 'boolean';
      default:
        return 'text';
    }
  };

  const getOperatorsForField = (fieldId: string) => {
    const fieldType = getFieldType(fieldId);
    return FILTER_OPERATORS[fieldType] || FILTER_OPERATORS.text;
  };

  const renderValueInput = (filter: typeof filters[0], index: number) => {
    const field = formFields.find(f => f.id === filter.field);
    // Support both .type and .field_type
    const rawFieldType = (field as any)?.field_type || field?.type || '';
    const fieldTypeCategory = getFieldType(filter.field);

    if (filter.operator === 'is_empty' || filter.operator === 'is_not_empty') {
      return null;
    }

    // Get field options - support field.options, custom_config.options, and customConfig.options
    const getFieldOptions = () => {
      if (field?.options && Array.isArray(field.options) && field.options.length > 0) {
        return field.options;
      }
      const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
      if (customConfig?.options && Array.isArray(customConfig.options)) {
        return customConfig.options;
      }
      return [];
    };

    const fieldOptions = getFieldOptions();

    // Handle rating field type - show star options
    if (rawFieldType === 'rating' || rawFieldType === 'star-rating') {
      const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
      const maxRating = customConfig?.maxRating || (field as any)?.validation?.max || 5;
      const ratingOptions = Array.from({ length: maxRating }, (_, i) => i + 1);
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select rating" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {ratingOptions.map((rating) => (
                <SelectItem key={rating} value={String(rating)}>
                  {'★'.repeat(rating)} ({rating})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle slider/range field type - show min/max range input
    if (rawFieldType === 'slider' || rawFieldType === 'range') {
      const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
      const min = (field as any)?.validation?.min || customConfig?.min || 0;
      const max = (field as any)?.validation?.max || customConfig?.max || 100;
      const step = (field as any)?.validation?.step || customConfig?.step || 1;
      
      // Generate options based on min/max/step
      const sliderOptions: number[] = [];
      for (let val = min; val <= max; val += step) {
        sliderOptions.push(val);
        if (sliderOptions.length > 50) break; // Limit options
      }
      
      return (
        <div className="space-y-2">
          <Label>Value ({min} - {max})</Label>
          {sliderOptions.length <= 20 ? (
            <Select
              value={filter.value}
              onValueChange={(value) => updateFilter(index, { value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {sliderOptions.map((val) => (
                  <SelectItem key={val} value={String(val)}>
                    {val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="number"
              min={min}
              max={max}
              step={step}
              value={filter.value}
              onChange={(e) => updateFilter(index, { value: e.target.value })}
              placeholder={`${min} - ${max}`}
            />
          )}
        </div>
      );
    }

    // Handle yes-no field type
    if (rawFieldType === 'yes-no') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle toggle/switch field type
    if (rawFieldType === 'toggle' || rawFieldType === 'toggle-switch') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="true">On</SelectItem>
              <SelectItem value="false">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle checkbox field type (standalone, not checkbox group with options)
    if (rawFieldType === 'checkbox' && fieldOptions.length === 0) {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="true">Checked</SelectItem>
              <SelectItem value="false">Unchecked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle time field type
    if (rawFieldType === 'time') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="time"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Select time"
          />
        </div>
      );
    }

    // Handle datetime field type
    if (rawFieldType === 'datetime' || rawFieldType === 'date-time') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="datetime-local"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Select date and time"
          />
        </div>
      );
    }

    // Handle tags field type - text input for tag values
    if (rawFieldType === 'tags') {
      return (
        <div className="space-y-2">
          <Label>Value (tag to filter)</Label>
          <Input
            type="text"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Enter tag value"
          />
        </div>
      );
    }

    // Handle submission-access field type - show configured users/groups
    if (rawFieldType === 'submission-access') {
      const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
      const allowedUsers = customConfig?.allowedUsers || [];
      const allowedGroups = customConfig?.allowedGroups || [];
      
      const accessOptions = [
        ...allowedUsers.map((user: any) => ({
          value: user.id || user.email || user,
          label: user.name || user.email || user.id || user,
          type: 'user'
        })),
        ...allowedGroups.map((group: any) => ({
          value: group.id || group.name || group,
          label: group.name || group.id || group,
          type: 'group'
        }))
      ];

      if (accessOptions.length > 0) {
        return (
          <div className="space-y-2">
            <Label>Value</Label>
            <Select
              value={filter.value}
              onValueChange={(value) => updateFilter(index, { value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user/group" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {accessOptions.map((option, optIndex) => (
                  <SelectItem key={optIndex} value={String(option.value)}>
                    {option.type === 'group' ? '👥 ' : '👤 '}{option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }
      
      // Fallback if no configured users/groups
      return (
        <div className="space-y-2">
          <Label>Value (user/group ID or email)</Label>
          <Input
            type="text"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Enter user/group ID or email"
          />
        </div>
      );
    }

    // Handle multi-select, dropdown, radio, select, checkbox (with options), status fields
    if ((rawFieldType === 'multi-select' || rawFieldType === 'dropdown' || 
         rawFieldType === 'radio' || rawFieldType === 'select' || 
         rawFieldType === 'status' || (rawFieldType === 'checkbox' && fieldOptions.length > 0)) && 
        fieldOptions.length > 0) {
      if (filter.operator === 'in' || filter.operator === 'not_in') {
        return (
          <div className="space-y-2">
            <Label>Values (comma-separated)</Label>
            <Input
              value={filter.value}
              onChange={(e) => updateFilter(index, { value: e.target.value })}
              placeholder="value1, value2, value3"
            />
          </div>
        );
      } else {
        return (
          <div className="space-y-2">
            <Label>Value</Label>
            <Select
              value={filter.value}
              onValueChange={(value) => updateFilter(index, { value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {fieldOptions
                  .filter((option: any) => {
                    const val = option.value || option;
                    return val && String(val).trim() !== '';
                  })
                  .map((option: any, optIndex: number) => {
                    const val = option.value || option;
                    const label = option.label || option.value || option;
                    return (
                      <SelectItem key={option.id || optIndex} value={String(val)}>
                        {label}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>
        );
      }
    }

    // Handle boolean field type (generic fallback)
    if (fieldTypeCategory === 'boolean') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle date field type
    if (rawFieldType === 'date') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="date"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Select date"
          />
        </div>
      );
    }

    // Handle number/currency field types
    if (rawFieldType === 'number' || rawFieldType === 'currency') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="number"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Enter number"
          />
        </div>
      );
    }

    // Default text input
    return (
      <div className="space-y-2">
        <Label>Value</Label>
        <Input
          type="text"
          value={filter.value}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          placeholder="Enter filter value"
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {filters.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No filters configured. Add filters to refine your data.
          </div>
        ) : (
          <div className="space-y-4">
            {filters.map((filter, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Filter {index + 1}</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFilter(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Field</Label>
                      <Select
                        value={filter.field}
                        onValueChange={(value) => updateFilter(index, { 
                          field: value, 
                          operator: 'equals', 
                          value: '' 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {formFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Operator</Label>
                      <Select
                        value={filter.operator}
                        onValueChange={(value) => updateFilter(index, { 
                          operator: value, 
                          value: '' 
                        })}
                        disabled={!filter.field}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorsForField(filter.field).map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      {renderValueInput(filter, index)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Button
          onClick={addFilter}
          variant="outline"
          className="w-full"
          disabled={formFields.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </CardContent>
    </Card>
  );
}