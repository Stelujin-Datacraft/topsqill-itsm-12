
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { useFormAccess } from '../../hooks/useFormAccess';

interface RecordTableConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
  fieldType: 'record-table' | 'matrix-grid' | 'cross-reference';
}

export function RecordTableConfig({ config, onUpdate, errors, fieldType }: RecordTableConfigProps) {
  const { getFormOptions, loading } = useFormAccess();
  const formOptions = getFormOptions;

  const updateCustomConfig = (key: string, value: any) => {
    onUpdate({
      customConfig: { ...config.customConfig, [key]: value }
    });
  };

  const addFilter = () => {
    const newFilter = {
      id: `filter-${Date.now()}`,
      field: '',
      operator: '==',
      value: ''
    };
    
    const currentFilters = config.customConfig?.filters || [];
    updateCustomConfig('filters', [...currentFilters, newFilter]);
  };

  const removeFilter = (index: number) => {
    const currentFilters = config.customConfig?.filters || [];
    const newFilters = currentFilters.filter((_, i) => i !== index);
    updateCustomConfig('filters', newFilters);
  };

  const updateFilter = (index: number, field: string, value: any) => {
    const currentFilters = config.customConfig?.filters || [];
    const newFilters = [...currentFilters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    updateCustomConfig('filters', newFilters);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">
        {fieldType === 'record-table' ? 'Record Table' : 
         fieldType === 'matrix-grid' ? 'Matrix Grid' : 'Cross Reference'} Configuration
      </h3>

      {/* Target Form Selection */}
      <div>
        <Label htmlFor="target-form">Target Form *</Label>
        <Select
          value={config.customConfig?.targetFormId || ''}
          onValueChange={(value) => {
            const selectedForm = formOptions.find(form => form.value === value);
            updateCustomConfig('targetFormId', value);
            updateCustomConfig('targetFormName', selectedForm?.label || '');
          }}
        >
          <SelectTrigger className={errors.targetForm ? 'border-red-500' : ''}>
            <SelectValue placeholder={loading ? "Loading forms..." : "Select a form"} />
          </SelectTrigger>
          <SelectContent>
            {formOptions.map((form) => (
              <SelectItem key={form.value} value={form.value}>
                <div>
                  <div className="font-medium">{form.label}</div>
                  {form.description && (
                    <div className="text-sm text-gray-500">{form.description}</div>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.targetForm && <p className="text-sm text-red-500 mt-1">{errors.targetForm}</p>}
      </div>

      {/* Display Columns */}
      <div>
        <Label htmlFor="display-columns">Display Columns</Label>
        <Input
          id="display-columns"
          placeholder="Enter column names separated by commas"
          value={config.customConfig?.displayColumns?.join(', ') || ''}
          onChange={(e) => {
            const columns = e.target.value.split(',').map(col => col.trim()).filter(Boolean);
            updateCustomConfig('displayColumns', columns);
          }}
        />
        <p className="text-sm text-gray-500 mt-1">
          Specify which columns to display from the target form
        </p>
      </div>

      {/* Filters */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Filters</Label>
          <Button type="button" variant="outline" size="sm" onClick={addFilter}>
            <Plus className="h-4 w-4 mr-1" />
            Add Filter
          </Button>
        </div>
        
        <div className="space-y-2">
          {(config.customConfig?.filters || []).map((filter: any, index: number) => (
            <div key={filter.id} className="flex items-center space-x-2 p-2 border rounded">
              <Input
                placeholder="Field name"
                value={filter.field}
                onChange={(e) => updateFilter(index, 'field', e.target.value)}
                className="flex-1"
              />
              <Select
                value={filter.operator}
                onValueChange={(value) => updateFilter(index, 'operator', value)}
              >
                <SelectTrigger className="w-32">
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
                onChange={(e) => updateFilter(index, 'value', e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFilter(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Options */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="enable-sorting"
            checked={config.customConfig?.enableSorting !== false}
            onCheckedChange={(checked) => updateCustomConfig('enableSorting', Boolean(checked))}
          />
          <Label htmlFor="enable-sorting">Enable sorting</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="enable-search"
            checked={config.customConfig?.enableSearch !== false}
            onCheckedChange={(checked) => updateCustomConfig('enableSearch', Boolean(checked))}
          />
          <Label htmlFor="enable-search">Enable search</Label>
        </div>

        {fieldType === 'record-table' && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-user-records"
              checked={config.customConfig?.showOnlyUserRecords || false}
              onCheckedChange={(checked) => updateCustomConfig('showOnlyUserRecords', Boolean(checked))}
            />
            <Label htmlFor="show-user-records">Show only user's records</Label>
          </div>
        )}
      </div>

      {/* Page Size */}
      <div>
        <Label htmlFor="page-size">Records per page</Label>
        <Input
          id="page-size"
          type="number"
          value={config.customConfig?.pageSize || 10}
          onChange={(e) => updateCustomConfig('pageSize', parseInt(e.target.value, 10) || 10)}
          min="1"
          max="100"
        />
      </div>

      {config.customConfig?.targetFormId && (
        <div className="p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Connected to:</strong> {config.customConfig.targetFormName || 'Selected form'}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            This field will display records from the selected form with the configured filters and display options.
          </p>
        </div>
      )}
    </div>
  );
}
