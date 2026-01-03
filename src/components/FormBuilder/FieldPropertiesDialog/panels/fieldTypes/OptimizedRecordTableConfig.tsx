
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2, Link2, Filter, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { useFormAccess } from '../../hooks/useFormAccess';
import { supabase } from '@/integrations/supabase/client';
import { EmbeddedChartConfigPanel } from './EmbeddedChartConfig';
import { EmbeddedChartConfig } from '@/types/reports';
import { useCurrentFormFields } from '@/hooks/useCurrentFormFields';
import { ExpressionEvaluator } from '@/utils/expressionEvaluator';
import { cn } from '@/lib/utils';

interface DynamicFieldMapping {
  id: string;
  parentFieldId: string;
  parentFieldLabel?: string;
  childFieldId: string;
  childFieldLabel?: string;
  operator: string;
}

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

// Helper component for Dynamic Mapping Logical Expression
function DynamicMappingLogicalExpression({
  value,
  onChange,
  conditionCount,
  mappings
}: {
  value: string;
  onChange: (expr: string) => void;
  conditionCount: number;
  mappings: DynamicFieldMapping[];
}) {
  const [localValue, setLocalValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value || '');
    }
  }, [value, isFocused]);

  const validation = useMemo(() => {
    if (!localValue.trim()) {
      return { valid: true, error: '' }; // Empty is valid (defaults to AND)
    }
    
    const result = ExpressionEvaluator.validate(localValue);
    
    if (result.valid) {
      const referencedIds = ExpressionEvaluator.extractConditionIds(localValue);
      const invalidIds = referencedIds.filter(id => {
        const num = parseInt(id, 10);
        return isNaN(num) || num < 1 || num > conditionCount;
      });
      
      if (invalidIds.length > 0) {
        return { 
          valid: false, 
          error: `Invalid condition(s): ${invalidIds.join(', ')}. Valid: 1-${conditionCount}` 
        };
      }
    }
    
    return result;
  }, [localValue, conditionCount]);

  const suggestion = useMemo(() => {
    if (conditionCount === 0) return '';
    if (conditionCount === 1) return '1';
    if (conditionCount === 2) return '1 AND 2';
    if (conditionCount === 3) return '(1 AND 2) OR 3';
    return Array.from({ length: conditionCount }, (_, i) => i + 1).join(' AND ');
  }, [conditionCount]);

  const handleBlur = () => {
    setIsFocused(false);
    if (validation.valid) {
      onChange(localValue.toUpperCase().trim());
    }
  };

  return (
    <div className="space-y-2 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-purple-700 dark:text-purple-400">Logical Expression</Label>
        <div className="flex items-center gap-1">
          {validation.valid ? (
            <CheckCircle className="h-3 w-3 text-green-600" />
          ) : (
            <AlertCircle className="h-3 w-3 text-destructive" />
          )}
          <span className={cn("text-xs", validation.valid ? "text-green-600" : "text-destructive")}>
            {validation.valid ? 'Valid' : 'Invalid'}
          </span>
        </div>
      </div>

      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={() => setIsFocused(true)}
        placeholder={suggestion || "e.g., (1 AND 2) OR 3"}
        className={cn(
          "font-mono text-sm bg-white dark:bg-gray-900",
          !validation.valid && localValue && "border-destructive"
        )}
      />

      {!validation.valid && localValue && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {validation.error}
        </p>
      )}

      <div className="bg-white dark:bg-gray-900 p-2 rounded border space-y-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>Click to insert:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {mappings.map((mapping, i) => (
            <Badge 
              key={mapping.id} 
              variant="secondary" 
              className="text-xs font-mono cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800"
              onClick={() => setLocalValue(prev => prev + (prev ? ' ' : '') + (i + 1))}
            >
              {i + 1}: {mapping.parentFieldLabel || 'Parent'} {mapping.operator} {mapping.childFieldLabel || 'Child'}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-muted-foreground pt-1 border-t">
          <p><strong>Operators:</strong> AND, OR, NOT &nbsp;|&nbsp; <strong>Precedence:</strong> NOT &gt; AND &gt; OR</p>
          {suggestion && !localValue && (
            <p className="mt-1">
              <strong>Default:</strong> <span className="font-mono text-purple-600">{suggestion}</span> (all conditions with AND)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for Filter Logical Expression
function FilterLogicalExpression({
  value,
  onChange,
  conditionCount,
  filters,
  formFields
}: {
  value: string;
  onChange: (expr: string) => void;
  conditionCount: number;
  filters: any[];
  formFields: { id: string; label: string; field_type: string }[];
}) {
  const [localValue, setLocalValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value || '');
    }
  }, [value, isFocused]);

  const validation = useMemo(() => {
    if (!localValue.trim()) {
      return { valid: true, error: '' }; // Empty is valid (defaults to AND)
    }
    
    const result = ExpressionEvaluator.validate(localValue);
    
    if (result.valid) {
      const referencedIds = ExpressionEvaluator.extractConditionIds(localValue);
      const invalidIds = referencedIds.filter(id => {
        const num = parseInt(id, 10);
        return isNaN(num) || num < 1 || num > conditionCount;
      });
      
      if (invalidIds.length > 0) {
        return { 
          valid: false, 
          error: `Invalid condition(s): ${invalidIds.join(', ')}. Valid: 1-${conditionCount}` 
        };
      }
    }
    
    return result;
  }, [localValue, conditionCount]);

  const suggestion = useMemo(() => {
    if (conditionCount === 0) return '';
    if (conditionCount === 1) return '1';
    if (conditionCount === 2) return '1 AND 2';
    if (conditionCount === 3) return '(1 AND 2) OR 3';
    return Array.from({ length: conditionCount }, (_, i) => i + 1).join(' AND ');
  }, [conditionCount]);

  const handleBlur = () => {
    setIsFocused(false);
    if (validation.valid) {
      onChange(localValue.toUpperCase().trim());
    }
  };

  const getFieldLabel = (fieldId: string) => {
    return formFields.find(f => f.id === fieldId)?.label || fieldId;
  };

  return (
    <div className="space-y-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-blue-700 dark:text-blue-400">Logical Expression</Label>
        <div className="flex items-center gap-1">
          {validation.valid ? (
            <CheckCircle className="h-3 w-3 text-green-600" />
          ) : (
            <AlertCircle className="h-3 w-3 text-destructive" />
          )}
          <span className={cn("text-xs", validation.valid ? "text-green-600" : "text-destructive")}>
            {validation.valid ? 'Valid' : 'Invalid'}
          </span>
        </div>
      </div>

      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={() => setIsFocused(true)}
        placeholder={suggestion || "e.g., (1 AND 2) OR 3"}
        className={cn(
          "font-mono text-sm bg-white dark:bg-gray-900",
          !validation.valid && localValue && "border-destructive"
        )}
      />

      {!validation.valid && localValue && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {validation.error}
        </p>
      )}

      <div className="bg-white dark:bg-gray-900 p-2 rounded border space-y-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>Click to insert:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map((filter, i) => (
            <Badge 
              key={filter.id || i} 
              variant="secondary" 
              className="text-xs font-mono cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800"
              onClick={() => setLocalValue(prev => prev + (prev ? ' ' : '') + (i + 1))}
            >
              {i + 1}: {getFieldLabel(filter.field)} {filter.operator} {filter.value || '(any)'}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-muted-foreground pt-1 border-t">
          <p><strong>Operators:</strong> AND, OR, NOT &nbsp;|&nbsp; <strong>Precedence:</strong> NOT &gt; AND &gt; OR</p>
          {suggestion && !localValue && (
            <p className="mt-1">
              <strong>Default:</strong> <span className="font-mono text-blue-600">{suggestion}</span> (all conditions with AND)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function OptimizedRecordTableConfig({ config, onUpdate, errors, fieldType }: OptimizedRecordTableConfigProps) {
  const { getFormOptions, loading } = useFormAccess();
  const { currentForm } = useCurrentFormFields();
  const [selectedFormFields, setSelectedFormFields] = useState<FormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Get parent form fields (fields from the form containing this cross-reference field)
  const parentFormFields = useMemo(() => {
    if (!currentForm?.fields) return [];
    // Exclude layout and cross-reference fields
    const excludedTypes = ['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'cross-reference', 'child-cross-reference'];
    return currentForm.fields
      .filter(field => !excludedTypes.includes(field.type))
      .map(field => ({
        id: field.id,
        label: field.label,
        field_type: field.type
      }));
  }, [currentForm?.fields]);
  
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

  // Dynamic Field Mapping functions (Parent Field == Child Field auto-filter)
  const addDynamicMapping = useCallback(() => {
    const newMapping: DynamicFieldMapping = {
      id: `mapping-${Date.now()}`,
      parentFieldId: '',
      parentFieldLabel: '',
      childFieldId: '',
      childFieldLabel: '',
      operator: '=='
    };
    
    const currentMappings = config.customConfig?.dynamicFieldMappings || [];
    updateCustomConfig('dynamicFieldMappings', [...currentMappings, newMapping]);
  }, [config.customConfig?.dynamicFieldMappings, updateCustomConfig]);

  const removeDynamicMapping = useCallback((index: number) => {
    const currentMappings = config.customConfig?.dynamicFieldMappings || [];
    const newMappings = currentMappings.filter((_: any, i: number) => i !== index);
    updateCustomConfig('dynamicFieldMappings', newMappings);
  }, [config.customConfig?.dynamicFieldMappings, updateCustomConfig]);

  const updateDynamicMapping = useCallback((index: number, updates: Partial<DynamicFieldMapping>) => {
    const currentMappings = config.customConfig?.dynamicFieldMappings || [];
    const newMappings = [...currentMappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    
    // Auto-populate labels
    if (updates.parentFieldId) {
      const parentField = parentFormFields.find(f => f.id === updates.parentFieldId);
      newMappings[index].parentFieldLabel = parentField?.label || '';
    }
    if (updates.childFieldId) {
      const childField = selectedFormFields.find(f => f.id === updates.childFieldId);
      newMappings[index].childFieldLabel = childField?.label || '';
    }
    
    updateCustomConfig('dynamicFieldMappings', newMappings);
  }, [config.customConfig?.dynamicFieldMappings, updateCustomConfig, parentFormFields, selectedFormFields]);

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


{/* Table Display Fields - choose multiple fields to show */}
{config.customConfig?.targetFormId && selectedFormFields.length > 0 && (
  <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
    <CardHeader>
      <CardTitle className="text-base flex items-center gap-2">
        📊 Table Display Fields (Multiple Selection)
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="p-2 bg-white dark:bg-gray-900 rounded border">
        <Label className="text-sm font-medium">
          ✨ Select fields from the target form to display in the table view (alongside submission ID)
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Check multiple fields to show their values in cross-reference cells
        </p>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto p-2">
        {selectedFormFields.map((field) => (
          <div key={field.id} className="flex items-center space-x-2 p-2 hover:bg-white dark:hover:bg-gray-900 rounded">
            <Checkbox
              id={`display-field-${field.id}`}
              checked={
                Array.isArray(config.customConfig?.tableDisplayFields)
                  ? config.customConfig.tableDisplayFields.includes(field.id)
                  : false
              }
              onCheckedChange={(checked) => {
                const currentFields = Array.isArray(config.customConfig?.tableDisplayFields)
                  ? config.customConfig.tableDisplayFields
                  : [];
                
                const newFields = checked
                  ? [...currentFields, field.id]
                  : currentFields.filter((id) => id !== field.id);
                
                console.log('Table display fields updated:', newFields);
                updateCustomConfig("tableDisplayFields", newFields);
              }}
            />
            <Label htmlFor={`display-field-${field.id}`} className="text-sm cursor-pointer font-medium">
              {field.label} <span className="text-xs text-muted-foreground">({field.field_type})</span>
            </Label>
          </div>
        ))}
      </div>

      {Array.isArray(config.customConfig?.tableDisplayFields) &&
        config.customConfig.tableDisplayFields.length > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1 font-medium">
              ✓ Selected {config.customConfig.tableDisplayFields.length} field(s):
            </p>
            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
              {config.customConfig.tableDisplayFields
                .map((id) => selectedFormFields.find((f) => f.id === id)?.label)
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        )}
    </CardContent>
  </Card>
)}

{!config.customConfig?.targetFormId && (
  <Card className="border-2 border-yellow-200 dark:border-yellow-800">
    <CardContent className="py-4">
      <p className="text-sm text-yellow-700 dark:text-yellow-400">
        ⚠️ Please select a <strong>Target Form</strong> first to configure table display fields
      </p>
    </CardContent>
  </Card>
)}

{config.customConfig?.targetFormId && selectedFormFields.length === 0 && (
  <Card className="border-2 border-yellow-200 dark:border-yellow-800">
    <CardContent className="py-4">
      <p className="text-sm text-yellow-700 dark:text-yellow-400">
        ⚠️ Target form has no fields available for display
      </p>
    </CardContent>
  </Card>
)}

      {/* Dynamic Field Mapping Section - Parent Field == Child Field auto-filter */}
      {config.customConfig?.targetFormId && selectedFormFields.length > 0 && parentFormFields.length > 0 && (
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-purple-600" />
                Dynamic Field Mapping
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addDynamicMapping}>
                <Plus className="h-4 w-4 mr-1" />
                Add Mapping
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-2 bg-white dark:bg-gray-900 rounded border">
              <p className="text-xs text-muted-foreground">
                <strong>Auto-filter records</strong> when a field value in the current form (parent) matches a field value in the target form (child).
                Use the logical expression below to combine conditions with AND, OR, NOT operators.
              </p>
            </div>
            
            <div className="space-y-3">
              {(config.customConfig?.dynamicFieldMappings || []).map((mapping: DynamicFieldMapping, index: number) => (
                <div key={mapping.id} className="relative flex items-center space-x-2 p-3 border rounded-lg bg-white dark:bg-gray-900">
                  {/* Condition Number Badge */}
                  <div className="absolute -left-3 -top-2">
                    <Badge className="bg-purple-600 text-white font-mono text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">
                      {index + 1}
                    </Badge>
                  </div>
                  
                  {/* Parent Form Field */}
                  <div className="flex-1 ml-2">
                    <Label className="text-xs text-purple-600 mb-1 block">Current Form Field</Label>
                    <Select
                      value={mapping.parentFieldId || ''}
                      onValueChange={(value) => updateDynamicMapping(index, { parentFieldId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent field" />
                      </SelectTrigger>
                      <SelectContent>
                        {parentFormFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Operator */}
                  <div className="w-28">
                    <Label className="text-xs text-muted-foreground mb-1 block">Operator</Label>
                    <Select
                      value={mapping.operator || '=='}
                      onValueChange={(value) => updateDynamicMapping(index, { operator: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="==">=</SelectItem>
                        <SelectItem value="!=">≠</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="starts_with">Starts With</SelectItem>
                        <SelectItem value="ends_with">Ends With</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Child Form Field (Target Form) */}
                  <div className="flex-1">
                    <Label className="text-xs text-purple-600 mb-1 block">Target Form Field</Label>
                    <Select
                      value={mapping.childFieldId || ''}
                      onValueChange={(value) => updateDynamicMapping(index, { childFieldId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select target field" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedFormFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remove button */}
                  <div className="pt-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDynamicMapping(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {(!config.customConfig?.dynamicFieldMappings || config.customConfig.dynamicFieldMappings.length === 0) && (
                <div className="text-center py-6 text-gray-500 bg-white dark:bg-gray-900 rounded-lg border-2 border-dashed">
                  <Link2 className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                  <p className="font-medium">No dynamic mappings configured</p>
                  <p className="text-sm">Click "Add Mapping" to auto-filter records where parent and child field values match.</p>
                </div>
              )}
            </div>

            {/* Logical Expression Input for Dynamic Mappings */}
            {config.customConfig?.dynamicFieldMappings && config.customConfig.dynamicFieldMappings.length > 1 && (
              <DynamicMappingLogicalExpression
                value={config.customConfig?.dynamicMappingLogic || ''}
                onChange={(expr) => updateCustomConfig('dynamicMappingLogic', expr)}
                conditionCount={config.customConfig.dynamicFieldMappings.length}
                mappings={config.customConfig.dynamicFieldMappings}
              />
            )}

            {/* Summary of configured mappings */}
            {config.customConfig?.dynamicFieldMappings && config.customConfig.dynamicFieldMappings.length > 0 && (
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-800">
                <p className="text-xs text-purple-700 dark:text-purple-400 font-medium mb-2">
                  Active Mappings:
                </p>
                <div className="flex flex-wrap gap-2">
                  {config.customConfig.dynamicFieldMappings.map((mapping: DynamicFieldMapping, index: number) => (
                    <Badge key={mapping.id || index} variant="secondary" className="text-xs">
                      <span className="font-mono mr-1 text-purple-600">[{index + 1}]</span>
                      {mapping.parentFieldLabel || 'Parent Field'} {mapping.operator || '=='} {mapping.childFieldLabel || 'Target Field'}
                    </Badge>
                  ))}
                </div>
                {config.customConfig?.dynamicMappingLogic && (
                  <p className="mt-2 text-xs text-purple-600 font-mono">
                    Logic: {config.customConfig.dynamicMappingLogic}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters Section */}
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-600" />
              Filters
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addFilter}>
              <Plus className="h-4 w-4 mr-1" />
              Add Filter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-2 bg-white dark:bg-gray-900 rounded border">
            <p className="text-xs text-muted-foreground">
              <strong>Static filters</strong> to narrow down which records are shown in this cross-reference.
              Use the logical expression below to combine conditions with AND, OR, NOT operators.
            </p>
          </div>
          
          <div className="space-y-3">
            {(config.customConfig?.filters || []).map((filter: any, index: number) => (
              <div key={filter.id} className="relative flex items-center space-x-2 p-3 border rounded-lg bg-white dark:bg-gray-900">
                {/* Condition Number Badge */}
                <div className="absolute -left-3 -top-2">
                  <Badge className="bg-blue-600 text-white font-mono text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">
                    {index + 1}
                  </Badge>
                </div>
                
                <Select
                  value={filter.field}
                  onValueChange={(value) => updateFilter(index, 'field', value)}
                >
                  <SelectTrigger className="flex-1 ml-2">
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
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="==">=</SelectItem>
                    <SelectItem value="!=">≠</SelectItem>
                    <SelectItem value="<">&lt;</SelectItem>
                    <SelectItem value=">">&gt;</SelectItem>
                    <SelectItem value="<=">&le;</SelectItem>
                    <SelectItem value=">=">&ge;</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="not_contains">Not Contains</SelectItem>
                    <SelectItem value="starts_with">Starts With</SelectItem>
                    <SelectItem value="ends_with">Ends With</SelectItem>
                    <SelectItem value="exists">Exists</SelectItem>
                    <SelectItem value="not_exists">Not Exists</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Value"
                  value={filter.value}
                  onChange={(e) => updateFilter(index, 'value', e.target.value)}
                  className="flex-1"
                  disabled={filter.operator === 'exists' || filter.operator === 'not_exists'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {(!config.customConfig?.filters || config.customConfig.filters.length === 0) && (
              <div className="text-center py-6 text-gray-500 bg-white dark:bg-gray-900 rounded-lg border-2 border-dashed">
                <Filter className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                <p className="font-medium">No filters configured</p>
                <p className="text-sm">Click "Add Filter" to narrow down which records are displayed.</p>
              </div>
            )}
          </div>

          {/* Logical Expression Input for Filters */}
          {config.customConfig?.filters && config.customConfig.filters.length > 1 && (
            <FilterLogicalExpression
              value={config.customConfig?.filterLogic || ''}
              onChange={(expr) => updateCustomConfig('filterLogic', expr)}
              conditionCount={config.customConfig.filters.length}
              filters={config.customConfig.filters}
              formFields={availableFilterFields}
            />
          )}

          {/* Summary of configured filters */}
          {config.customConfig?.filters && config.customConfig.filters.length > 0 && (
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-2">
                Active Filters:
              </p>
              <div className="flex flex-wrap gap-2">
                {config.customConfig.filters.map((filter: any, index: number) => {
                  const fieldLabel = availableFilterFields.find(f => f.id === filter.field)?.label || filter.field;
                  return (
                    <Badge key={filter.id || index} variant="secondary" className="text-xs">
                      <span className="font-mono mr-1 text-blue-600">[{index + 1}]</span>
                      {fieldLabel} {filter.operator} {filter.value || '(any)'}
                    </Badge>
                  );
                })}
              </div>
              {config.customConfig?.filterLogic && (
                <p className="mt-2 text-xs text-blue-600 font-mono">
                  Logic: {config.customConfig.filterLogic}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Embedded Chart Configuration - Only for cross-reference */}
      {fieldType === 'cross-reference' && config.customConfig?.targetFormId && selectedFormFields.length > 0 && (
        <EmbeddedChartConfigPanel
          config={config.customConfig?.embeddedChart as EmbeddedChartConfig | undefined}
          onUpdate={(chartConfig) => updateCustomConfig('embeddedChart', chartConfig)}
          targetFormFields={selectedFormFields}
        />
      )}

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
