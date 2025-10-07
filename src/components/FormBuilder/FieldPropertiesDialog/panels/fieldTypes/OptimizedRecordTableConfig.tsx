
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2 } from 'lucide-react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { useFormAccess } from '../../hooks/useFormAccess';
import { supabase } from '@/integrations/supabase/client';

interface OptimizedRecordTableConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
  fieldType: 'record-table' | 'matrix-grid' | 'cross-reference';
}

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

const METADATA_COLUMNS = [
  { id: 'created_at', label: 'Created At', type: 'timestamp' },
  { id: 'updated_at', label: 'Updated At', type: 'timestamp' },
  { id: 'submitted_by', label: 'Submitted By', type: 'text' },
  { id: 'submission_id', label: 'Submission ID', type: 'uuid' },
];

export function OptimizedRecordTableConfig({ config, onUpdate, errors, fieldType }: OptimizedRecordTableConfigProps) {
  const { getFormOptions, loading } = useFormAccess();
  const [selectedFormFields, setSelectedFormFields] = useState<FormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  
  const formOptions = useMemo(() => getFormOptions, [getFormOptions]);

  const updateCustomConfig = useCallback((key: string, value: any) => {
    console.log(`Updating custom config: ${key} =`, value);
    onUpdate({
      customConfig: { ...config.customConfig, [key]: value }
    });
  }, [config.customConfig, onUpdate]);

  // Fetch form fields when target form changes
  const fetchFormFields = useCallback(async (formId: string) => {
    if (!formId) {
      console.log('No form ID provided, clearing fields');
      setSelectedFormFields([]);
      return;
    }

    console.log('Fetching form fields for form:', formId);
    setLoadingFields(true);
    
    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId)
        .order('field_order', { ascending: true });

      if (error) {
        console.error('Error fetching form fields:', error);
        setSelectedFormFields([]);
      } else {
        console.log('Successfully fetched form fields:', fields);
        setSelectedFormFields(fields || []);
      }
    } catch (error) {
      console.error('Exception while fetching form fields:', error);
      setSelectedFormFields([]);
    } finally {
      setLoadingFields(false);
    }
  }, []);

  // Load fields when component mounts with existing target form
  useEffect(() => {
    const targetFormId = config.customConfig?.targetFormId;
    if (targetFormId) {
      console.log('Component mounted with existing target form:', targetFormId);
      fetchFormFields(targetFormId);
    }
  }, [config.customConfig?.targetFormId, fetchFormFields]);

  const handleTargetFormChange = useCallback(async (formValue: string) => {
    console.log('Target form selection changed to:', formValue);
    const selectedForm = formOptions.find(form => form.value === formValue);
    
    // Update form selection immediately
    updateCustomConfig('targetFormId', formValue);
    updateCustomConfig('targetFormName', selectedForm?.label || '');
    
    // Reset dependent fields when form changes
    updateCustomConfig('displayColumns', []);
    
    // Fetch form fields for the new selection
    await fetchFormFields(formValue);
  }, [formOptions, updateCustomConfig, fetchFormFields]);

  const handleColumnToggle = useCallback((columnId: string, checked: boolean) => {
    const currentColumns = config.customConfig?.displayColumns || [];
    let updatedColumns;
    
    if (checked) {
      updatedColumns = [...currentColumns, columnId];
    } else {
      updatedColumns = currentColumns.filter((col: string) => col !== columnId);
    }
    
    console.log('Column selection updated:', updatedColumns);
    updateCustomConfig('displayColumns', updatedColumns);
  }, [config.customConfig?.displayColumns, updateCustomConfig]);

  const handleMetadataColumnToggle = useCallback((columnId: string, checked: boolean) => {
    const currentColumns = config.customConfig?.displayColumns || [];
    const metadataColumnId = `metadata_${columnId}`;
    let updatedColumns;
    
    if (checked) {
      updatedColumns = [...currentColumns, metadataColumnId];
    } else {
      updatedColumns = currentColumns.filter((col: string) => col !== metadataColumnId);
    }
    
    console.log('Metadata column selection updated:', updatedColumns);
    updateCustomConfig('displayColumns', updatedColumns);
  }, [config.customConfig?.displayColumns, updateCustomConfig]);

  const addFilter = useCallback(() => {
    const newFilter = {
      id: `filter-${Date.now()}`,
      field: '',
      operator: '==',
      value: ''
    };
    
    const currentFilters = config.customConfig?.filters || [];
    updateCustomConfig('filters', [...currentFilters, newFilter]);
  }, [config.customConfig?.filters, updateCustomConfig]);

  const removeFilter = useCallback((index: number) => {
    const currentFilters = config.customConfig?.filters || [];
    const newFilters = currentFilters.filter((_, i) => i !== index);
    updateCustomConfig('filters', newFilters);
  }, [config.customConfig?.filters, updateCustomConfig]);

  const updateFilter = useCallback((index: number, field: string, value: any) => {
    const currentFilters = config.customConfig?.filters || [];
    const newFilters = [...currentFilters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    updateCustomConfig('filters', newFilters);
  }, [config.customConfig?.filters, updateCustomConfig]);

  const displayColumns = config.customConfig?.displayColumns || [];
  const includeMetadata = config.customConfig?.includeMetadata || false;

  // Get available fields for filter dropdown (both form fields and metadata if enabled)
  const getAvailableFilterFields = useCallback(() => {
    const fields = [...selectedFormFields];
    if (includeMetadata) {
      const metadataFields = METADATA_COLUMNS.map(col => ({
        id: `metadata_${col.id}`,
        label: `${col.label} (metadata)`,
        field_type: col.type
      }));
      fields.push(...metadataFields);
    }
    return fields;
  }, [selectedFormFields, includeMetadata]);

  const availableFilterFields = getAvailableFilterFields();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
        <h3 className="text-lg font-semibold">
          {fieldType === 'record-table' ? 'Record Table' : 
           fieldType === 'matrix-grid' ? 'Matrix Grid' : 'Cross Reference'} Configuration
        </h3>
      </div>

      {/* Target Form Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="target-form">Select Form *</Label>
            <Select
              value={config.customConfig?.targetFormId || ''}
              onValueChange={handleTargetFormChange}
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

          {config.customConfig?.targetFormId && (
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Connected to:</strong> {config.customConfig.targetFormName || 'Selected form'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Selection - Only show when a form is selected */}
      {config.customConfig?.targetFormId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Display Columns
              {loadingFields && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFields ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2 text-sm text-gray-500">Loading form fields...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Form Fields Section */}
                {selectedFormFields.length > 0 ? (
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Form Fields</Label>
                    <div className="max-h-64 overflow-y-auto space-y-3 border rounded-lg p-4 bg-gray-50">
                      {selectedFormFields.map((field) => (
                        <div key={field.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={`field-${field.id}`}
                            checked={displayColumns.includes(field.id)}
                            onCheckedChange={(checked) => handleColumnToggle(field.id, Boolean(checked))}
                          />
                          <Label htmlFor={`field-${field.id}`} className="text-sm flex-1 cursor-pointer">
                            <span className="font-medium">{field.label}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {field.field_type}
                            </Badge>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                    <p className="font-medium">No fields found</p>
                    <p className="text-sm">The selected form doesn't have any fields yet.</p>
                  </div>
                )}

                {/* Metadata Columns Section */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <Checkbox
                      id="include-metadata"
                      checked={includeMetadata}
                      onCheckedChange={(checked) => updateCustomConfig('includeMetadata', Boolean(checked))}
                    />
                    <Label htmlFor="include-metadata" className="text-sm font-medium cursor-pointer">
                      Include Metadata Columns
                    </Label>
                  </div>
                  
                  {includeMetadata && (
                    <div className="max-h-48 overflow-y-auto space-y-3 border rounded-lg p-4 bg-blue-50">
                      {METADATA_COLUMNS.map((column) => (
                        <div key={column.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={`metadata-${column.id}`}
                            checked={displayColumns.includes(`metadata_${column.id}`)}
                            onCheckedChange={(checked) => handleMetadataColumnToggle(column.id, Boolean(checked))}
                          />
                          <Label htmlFor={`metadata-${column.id}`} className="text-sm flex-1 cursor-pointer">
                            <span className="font-medium">{column.label}</span>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {column.type}
                            </Badge>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Columns Summary */}
                {displayColumns.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Selected Columns ({displayColumns.length})
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {displayColumns.map((columnId) => {
                        const isMetadata = columnId.startsWith('metadata_');
                        const actualId = isMetadata ? columnId.replace('metadata_', '') : columnId;
                        
                        let columnLabel = '';
                        if (isMetadata) {
                          const metadataCol = METADATA_COLUMNS.find(col => col.id === actualId);
                          columnLabel = metadataCol?.label || actualId;
                        } else {
                          const field = selectedFormFields.find(f => f.id === actualId);
                          columnLabel = field?.label || actualId;
                        }

                        return (
                          <Badge key={columnId} variant={isMetadata ? "secondary" : "default"}>
                            {columnLabel}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}


{/* Table Display Field - choose a single field to show */}
{config.customConfig?.targetFormId && selectedFormFields.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="text-base flex items-center gap-2">
        Table Display Field
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      <Label className="text-sm font-medium">
        Select which field from the target form should be displayed in the table view.
      </Label>

      <Select
        value={config.customConfig?.tableDisplayField || "__default__"}
        onValueChange={(value) => {
          updateCustomConfig(
            "tableDisplayField",
            value === "__default__" ? "" : value
          );
        }}
      >
        <SelectTrigger className="border-2">
          <SelectValue placeholder="Select a field to display in table" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">Submission ID only (default)</SelectItem>
          {selectedFormFields.map((field) => (
            <SelectItem key={field.id} value={field.id}>
              {field.label} ({field.field_type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {config.customConfig?.tableDisplayField &&
        config.customConfig?.tableDisplayField !== "__default__" && (
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            ✓ Will display:{" "}
            {
              selectedFormFields.find(
                (f) => f.id === config.customConfig.tableDisplayField
              )?.label
            }
          </p>
        )}
    </CardContent>
  </Card>
)}

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Filters
            <Button type="button" variant="outline" size="sm" onClick={addFilter}>
              <Plus className="h-4 w-4 mr-1" />
              Add Filter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(config.customConfig?.filters || []).map((filter: any, index: number) => (
              <div key={filter.id} className="flex items-center space-x-2 p-3 border rounded-lg bg-gray-50">
                <Select
                  value={filter.field}
                  onValueChange={(value) => updateFilter(index, 'field', value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFilterFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {(!config.customConfig?.filters || config.customConfig.filters.length === 0) && (
              <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                <p>No filters configured. Click "Add Filter" to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="space-y-2">
            <Label htmlFor="page-size">Records per page</Label>
            <Input
              id="page-size"
              type="number"
              value={config.customConfig?.pageSize || 10}
              onChange={(e) => updateCustomConfig('pageSize', parseInt(e.target.value, 10) || 10)}
              min="1"
              max="100"
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
