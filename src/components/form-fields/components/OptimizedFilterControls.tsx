
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, Plus, X } from 'lucide-react';

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: string;
}

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

interface OptimizedFilterControlsProps {
  activeFilters: FilterCondition[];
  setActiveFilters: (filters: FilterCondition[]) => void;
  formFields: FormField[];
  displayColumns: string[];
}

export function OptimizedFilterControls({
  activeFilters,
  setActiveFilters,
  formFields,
  displayColumns
}: OptimizedFilterControlsProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  // Get available fields for filtering (only display columns)
  const availableFields = formFields.filter(field => displayColumns.includes(field.id));

  const addFilter = () => {
    const newFilter: FilterCondition = {
      id: Date.now().toString(),
      field: '',
      operator: '==',
      value: '',
      logic: 'AND'
    };
    setActiveFilters([...activeFilters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setActiveFilters(activeFilters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    setActiveFilters(activeFilters.filter(f => f.id !== id));
  };

  const getOperators = (fieldType: string) => {
    const baseOperators = [
      { value: '==', label: 'Equals' },
      { value: '!=', label: 'Not Equal' }
    ];

    if (fieldType === 'text' || fieldType === 'textarea') {
      return [
        ...baseOperators,
        { value: 'contains', label: 'Contains' },
        { value: 'startsWith', label: 'Starts With' },
        { value: 'endsWith', label: 'Ends With' }
      ];
    }

    if (fieldType === 'number') {
      return [
        ...baseOperators,
        { value: '>', label: 'Greater Than' },
        { value: '<', label: 'Less Than' }
      ];
    }

    return baseOperators;
  };

  return (
    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            <Button size="sm" onClick={addFilter}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          
          {activeFilters.length === 0 ? (
            <p className="text-sm text-gray-500">No filters applied</p>
          ) : (
            <div className="space-y-3">
              {activeFilters.map((filter, index) => {
                const field = availableFields.find(f => f.id === filter.field);
                return (
                  <div key={filter.id} className="space-y-2">
                    {index > 0 && (
                      <div className="flex justify-center">
                        <Select
                          value={filter.logic}
                          onValueChange={(value) => updateFilter(filter.id, { logic: value })}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Select
                        value={filter.field}
                        onValueChange={(value) => updateFilter(filter.id, { field: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filter.operator}
                        onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperators(field?.field_type || 'text').map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Value"
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        className="flex-1"
                      />

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFilter(filter.id)}
                        className="h-10 w-10 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
