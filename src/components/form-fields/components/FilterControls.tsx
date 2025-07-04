
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, Plus, X } from 'lucide-react';
import { TableFilter } from '../types/tableTypes';

interface FilterControlsProps {
  activeFilters: TableFilter[];
  setActiveFilters: React.Dispatch<React.SetStateAction<TableFilter[]>>;
  filterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  targetFormFields: Array<{
    id: string;
    label: string;
    type: string;
  }>;
}

export function FilterControls({
  activeFilters,
  setActiveFilters,
  filterOpen,
  setFilterOpen,
  targetFormFields
}: FilterControlsProps) {
  const addFilter = () => {
    const newFilter: TableFilter = {
      id: Date.now().toString(),
      field: '',
      operator: '==',
      value: '',
      logic: 'AND'
    };
    setActiveFilters(prev => [...prev, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<TableFilter>) => {
    setActiveFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== id));
  };

  // Helper function to get field label by ID
  const getFieldLabel = (fieldId: string) => {
    const field = targetFormFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

  // Helper function to get field type for better operator suggestions
  const getFieldType = (fieldId: string) => {
    const field = targetFormFields.find(f => f.id === fieldId);
    return field?.type || 'text';
  };

  // Get appropriate operators based on field type
  const getOperatorsForField = (fieldId: string) => {
    const fieldType = getFieldType(fieldId);
    const allOperators = [
      { value: '==', label: 'Equals' },
      { value: '!=', label: 'Not Equal' },
      { value: 'contains', label: 'Contains' },
      { value: 'startsWith', label: 'Starts With' },
      { value: 'endsWith', label: 'Ends With' },
      { value: '>', label: 'Greater Than' },
      { value: '<', label: 'Less Than' }
    ];

    // For number fields, prioritize numeric operators
    if (fieldType === 'number') {
      return [
        { value: '==', label: 'Equals' },
        { value: '!=', label: 'Not Equal' },
        { value: '>', label: 'Greater Than' },
        { value: '<', label: 'Less Than' },
        { value: 'contains', label: 'Contains' }
      ];
    }

    // For date fields, prioritize comparison operators
    if (fieldType === 'date' || fieldType === 'datetime') {
      return [
        { value: '==', label: 'Equals' },
        { value: '!=', label: 'Not Equal' },
        { value: '>', label: 'After' },
        { value: '<', label: 'Before' }
      ];
    }

    // For text fields, prioritize text operators
    return [
      { value: '==', label: 'Equals' },
      { value: '!=', label: 'Not Equal' },
      { value: 'contains', label: 'Contains' },
      { value: 'startsWith', label: 'Starts With' },
      { value: 'endsWith', label: 'Ends With' }
    ];
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
            <h4 className="font-medium">Advanced Filters</h4>
            <Button size="sm" onClick={addFilter}>
              <Plus className="h-4 w-4 mr-1" />
              Add Filter
            </Button>
          </div>
          
          {activeFilters.length === 0 ? (
            <p className="text-sm text-gray-500">No filters applied</p>
          ) : (
            <div className="space-y-3">
              {activeFilters.map((filter, index) => (
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
                        <SelectValue placeholder="Select Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetFormFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            <div className="flex flex-col">
                              <span>{field.label}</span>
                              <span className="text-xs text-gray-500">{field.type}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperatorsForField(filter.field).map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder={`Enter ${filter.field ? getFieldLabel(filter.field) : 'value'}...`}
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
                  
                  {filter.field && (
                    <div className="text-xs text-gray-500 pl-2">
                      Filtering: {getFieldLabel(filter.field)} ({getFieldType(filter.field)})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
