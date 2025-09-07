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
    
    switch (field.type) {
      case 'number':
      case 'currency':
        return 'number';
      case 'date':
      case 'datetime':
        return 'date';
      case 'select':
      case 'radio':
      case 'multi-select':
        return 'select';
      case 'checkbox':
      case 'toggle-switch':
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
    const fieldType = getFieldType(filter.field);

    if (filter.operator === 'is_empty' || filter.operator === 'is_not_empty') {
      return null;
    }

    if (fieldType === 'select' && field?.options) {
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
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem key={option.id} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }
    }

    if (fieldType === 'boolean') {
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
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    const inputType = fieldType === 'number' ? 'number' : 
                     fieldType === 'date' ? 'date' : 'text';

    return (
      <div className="space-y-2">
        <Label>Value</Label>
        <Input
          type={inputType}
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