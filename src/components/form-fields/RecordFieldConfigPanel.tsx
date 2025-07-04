
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus } from 'lucide-react';
import { useForm } from '@/contexts/FormContext';

interface RecordFieldConfigPanelProps {
  field: FormField;
  onConfigChange: (config: any) => void;
}

export function RecordFieldConfigPanel({ field, onConfigChange }: RecordFieldConfigPanelProps) {
  const { forms } = useForm();
  
  // Stable initial state to prevent unnecessary re-renders
  const initialState = useMemo(() => {
    const config = field.customConfig || {};
    return {
      targetFormId: config.targetFormId || '',
      displayColumns: config.displayColumns || [],
      filters: config.filters || [],
      enableSorting: config.enableSorting !== false,
      enableSearch: config.enableSearch !== false,
      pageSize: config.pageSize || 10,
      includeMetadata: config.includeMetadata || false,
      showOnlyUserRecords: config.showOnlyUserRecords !== false
    };
  }, [field.id]); // Only depend on field.id to prevent constant re-initialization

  const [localState, setLocalState] = useState(initialState);

  // Only update when field ID changes (new field selected)
  useEffect(() => {
    const config = field.customConfig || {};
    const newState = {
      targetFormId: config.targetFormId || '',
      displayColumns: config.displayColumns || [],
      filters: config.filters || [],
      enableSorting: config.enableSorting !== false,
      enableSearch: config.enableSearch !== false,
      pageSize: config.pageSize || 10,
      includeMetadata: config.includeMetadata || false,
      showOnlyUserRecords: config.showOnlyUserRecords !== false
    };
    
    setLocalState(newState);
  }, [field.id]); // Only when field ID changes

  // Debounced config change notification
  const debouncedOnConfigChange = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (config: any) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onConfigChange(config);
        }, 300); // 300ms debounce
      };
    })(),
    [onConfigChange]
  );

  // Update local state and notify parent with debouncing
  const updateLocalState = useCallback((key: string, value: any) => {
    setLocalState(prev => {
      const newState = { ...prev, [key]: value };
      debouncedOnConfigChange(newState);
      return newState;
    });
  }, [debouncedOnConfigChange]);

  // Optimized form change handler - single API call
  const handleTargetFormChange = useCallback((formId: string) => {
    const selectedForm = availableForms.find(form => form.id === formId);
    const targetFormName = selectedForm ? selectedForm.name : '';
    
    // Batch multiple updates to prevent multiple re-renders
    setLocalState(prev => {
      const newState = {
        ...prev,
        targetFormId: formId,
        targetFormName: targetFormName,
        displayColumns: [] // Reset columns when form changes
      };
      debouncedOnConfigChange(newState);
      return newState;
    });
  }, [debouncedOnConfigChange]);

  const handleAddFilter = useCallback(() => {
    const newFilter = {
      id: `filter-${Date.now()}`,
      field: '',
      operator: '==',
      value: ''
    };
    updateLocalState('filters', [...localState.filters, newFilter]);
  }, [localState.filters, updateLocalState]);

  const handleRemoveFilter = useCallback((filterId: string) => {
    updateLocalState('filters', localState.filters.filter((f: any) => f.id !== filterId));
  }, [localState.filters, updateLocalState]);

  const handleFilterChange = useCallback((filterId: string, key: string, value: string) => {
    const updatedFilters = localState.filters.map((f: any) => 
      f.id === filterId ? { ...f, [key]: value } : f
    );
    updateLocalState('filters', updatedFilters);
  }, [localState.filters, updateLocalState]);

  const handleColumnToggle = useCallback((columnId: string, checked: boolean) => {
    let updatedColumns;
    if (checked) {
      updatedColumns = [...localState.displayColumns, columnId];
    } else {
      updatedColumns = localState.displayColumns.filter((col: string) => col !== columnId);
    }
    updateLocalState('displayColumns', updatedColumns);
  }, [localState.displayColumns, updateLocalState]);

  // Memoized values to prevent unnecessary re-calculations
  const availableForms = useMemo(() => 
    forms.filter(form => form.status === 'active'), 
    [forms]
  );
  
  const selectedForm = useMemo(() => 
    availableForms.find(form => form.id === localState.targetFormId), 
    [availableForms, localState.targetFormId]
  );
  
  const selectedFormFields = useMemo(() => 
    selectedForm?.fields || [], 
    [selectedForm]
  );

  return (
    <div className="space-y-6">
      {/* Target Form Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Form Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Target Form</Label>
            <Select 
              value={localState.targetFormId || undefined} 
              onValueChange={handleTargetFormChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a form..." />
              </SelectTrigger>
              <SelectContent>
                {availableForms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    <div>
                      <div className="font-medium">{form.name}</div>
                      {form.description && (
                        <div className="text-xs text-gray-500">{form.description}</div>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Display Columns Selection */}
      {selectedForm && selectedFormFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Display Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto space-y-2 border rounded p-3">
              {selectedFormFields.map((field) => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`column-${field.id}`}
                    checked={localState.displayColumns.includes(field.id)}
                    onCheckedChange={(checked) => handleColumnToggle(field.id, Boolean(checked))}
                  />
                  <Label htmlFor={`column-${field.id}`} className="text-sm font-medium">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show message if form is selected but has no fields */}
      {selectedForm && selectedFormFields.length === 0 && (
        <Card>
          <CardContent>
            <div className="text-sm text-muted-foreground p-3 text-center">
              The selected form has no fields to display as columns.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Filters
            <Button onClick={handleAddFilter} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Filter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {localState.filters.length > 0 ? (
            <div className="space-y-3">
              {localState.filters.map((filter: any) => (
                <Card key={filter.id}>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <Input
                        placeholder="Field"
                        value={filter.field}
                        onChange={(e) => handleFilterChange(filter.id, 'field', e.target.value)}
                      />
                      
                      <Select
                        value={filter.operator}
                        onValueChange={(value) => handleFilterChange(filter.id, 'operator', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="==">=</SelectItem>
                          <SelectItem value="!=">≠</SelectItem>
                          <SelectItem value="<">&lt;</SelectItem>
                          <SelectItem value=">">&gt;</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Input
                        placeholder="Value"
                        value={filter.value}
                        onChange={(e) => handleFilterChange(filter.id, 'value', e.target.value)}
                      />
                      
                      <Button
                        onClick={() => handleRemoveFilter(filter.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
              <p>No filters configured. Click "Add Filter" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-sorting"
                  checked={localState.enableSorting}
                  onCheckedChange={(checked) => updateLocalState('enableSorting', Boolean(checked))}
                />
                <Label htmlFor="enable-sorting">Enable sorting</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-search"
                  checked={localState.enableSearch}
                  onCheckedChange={(checked) => updateLocalState('enableSearch', Boolean(checked))}
                />
                <Label htmlFor="enable-search">Enable search</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-metadata"
                  checked={localState.includeMetadata}
                  onCheckedChange={(checked) => updateLocalState('includeMetadata', Boolean(checked))}
                />
                <Label htmlFor="include-metadata">Include metadata columns</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-only-user-records"
                  checked={localState.showOnlyUserRecords}
                  onCheckedChange={(checked) => updateLocalState('showOnlyUserRecords', Boolean(checked))}
                />
                <Label htmlFor="show-only-user-records">Show only user's records</Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="page-size">Page Size</Label>
              <Input
                id="page-size"
                type="number"
                min="1"
                max="100"
                value={localState.pageSize}
                onChange={(e) => updateLocalState('pageSize', parseInt(e.target.value) || 10)}
                className="w-32"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
