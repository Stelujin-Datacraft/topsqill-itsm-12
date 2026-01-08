import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2, Trash2 } from 'lucide-react';
import { FormField } from '@/types/form';
import { RecordFieldConfigPanel } from '../form-fields/RecordFieldConfigPanel';
import { useFormAccess } from './FieldPropertiesDialog/hooks/useFormAccess';
import { useFieldData } from './FieldPropertiesDialog/hooks/useFieldData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
// Import field-specific configuration panels
import { HeaderFieldConfig, DescriptionFieldConfig, SectionBreakFieldConfig, HorizontalLineFieldConfig, RichTextFieldConfig, FullWidthContainerFieldConfig, DateFieldConfig, TimeFieldConfig, DateTimeFieldConfig, AddressFieldConfig, EmailFieldConfig, UrlFieldConfig, IpAddressFieldConfig, UserPickerFieldConfig, BarcodeFieldConfig, ApprovalFieldConfig, DynamicDropdownFieldConfig, CalculatedFieldConfig, ConditionalSectionFieldConfig, GeoLocationFieldConfig, MatrixGridFieldConfig, PhoneFieldConfig, ColorFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes';
import { TextFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/TextFieldConfig';
import { NumberFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/NumberFieldConfig';
import { SelectFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/SelectFieldConfig';
import { OptimizedRecordTableConfig } from './FieldPropertiesDialog/panels/fieldTypes/OptimizedRecordTableConfig';
import { FieldConfiguration, useFieldConfiguration } from './FieldPropertiesDialog/hooks/useFieldConfiguration';

// Import new field configurations
import { MultiSelectFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/selection/MultiSelectFieldConfig';
import { SignatureFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/media/SignatureFieldConfig';
import { FileFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/media/FileFieldConfig';
import { CurrencyFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/international/CurrencyFieldConfig';
import { CountryFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/international/CountryFieldConfig';
import { SliderFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/input/SliderFieldConfig';
import { SubmissionAccessFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/access/SubmissionAccessFieldConfig';
import { ChildCrossReferenceFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/ChildCrossReferenceFieldConfig';
import { QueryFieldConfig } from './FieldPropertiesDialog/panels/fieldTypes/QueryFieldConfig';
interface FieldPropertiesDialogProps {
  selectedField: FormField | null;
  open: boolean;
  onClose: () => void;
  onSave: (fieldId: string, updates: Partial<FormField>) => Promise<void>;
  onDelete?: (fieldId: string) => void;
}
interface FormFieldOption {
  id: string;
  label: string;
  field_type: string;
}
const METADATA_COLUMNS = [{
  id: 'created_at',
  label: 'Created At',
  type: 'timestamp'
}, {
  id: 'updated_at',
  label: 'Updated At',
  type: 'timestamp'
}, {
  id: 'submitted_by',
  label: 'Submitted By',
  type: 'text'
}, {
  id: 'submission_id',
  label: 'Submission ID',
  type: 'uuid'
}];
export function FieldPropertiesDialog({
  selectedField,
  open,
  onClose,
  onSave,
  onDelete
}: FieldPropertiesDialogProps) {
  const [fieldForConfig, setFieldForConfig] = React.useState<FormField | null>(null);
  const [localConfig, setLocalConfig] = React.useState<Partial<FormField>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedFormFields, setSelectedFormFields] = React.useState<FormFieldOption[]>([]);
  const [loadingFields, setLoadingFields] = React.useState(false);

  const {
    getFormOptions,
    loading
  } = useFormAccess();
  const {
    fetchFieldData,
    transformToFormField,
    loading: loadingFieldData,
    error: fieldDataError
  } = useFieldData();

  // Utility function to ensure options is always an array
  const ensureOptionsArray = (opts: any): any[] => {
    if (Array.isArray(opts)) return opts;
    if (typeof opts === 'string') {
      try {
        const parsed = JSON.parse(opts);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Enhanced field data fetching
  React.useEffect(() => {
    const loadFieldConfiguration = async () => {
      if (!selectedField?.id || !open) {
        setFieldForConfig(null);
        setLocalConfig({});
        return;
      }
      try {
        // Fetch complete field data from database
        const dbFieldData = await fetchFieldData(selectedField.id);
        if (!dbFieldData) {
          setFieldForConfig(selectedField);
          initializeLocalConfig(selectedField);
          return;
        }

        // Transform database data to FormField format
        const transformedField = transformToFormField(dbFieldData, selectedField.pageId);
        setFieldForConfig(transformedField);
        initializeLocalConfig(transformedField);

        // Auto-load form fields if target form is already selected
        if (transformedField.customConfig?.targetFormId) {
          await fetchFormFields(transformedField.customConfig.targetFormId);
        }
      } catch (error) {
        toast({
          title: "Error loading field data",
          description: "Failed to load complete field configuration. Using cached data.",
          variant: "destructive"
        });
        // Fallback to selectedField if database fetch fails
        setFieldForConfig(selectedField);
        initializeLocalConfig(selectedField);
      }
    };
    loadFieldConfiguration();
  }, [selectedField?.id, open, fetchFieldData, transformToFormField]);


const { localConfig: fieldConfig, updateConfig } = useFieldConfiguration(selectedField);

  // Initialize local config from field data
  const initializeLocalConfig = (field: FormField) => {
    // Ensure options are properly parsed from JSON string if needed
    const parsedOptions = ensureOptionsArray(field.options);
    
    // Ensure validation object exists with unique property preserved
    const validationConfig = field.validation || {};
    
    const newLocalConfig = {
      label: field.label,
      placeholder: field.placeholder || '',
      required: field.required || false,
      tooltip: field.tooltip || '',
      defaultValue: field.defaultValue || '',
      customConfig: field.customConfig || {},
      options: parsedOptions,
      validation: validationConfig
    };
    setLocalConfig(newLocalConfig);
  };

  // Fetch form fields when target form changes
  const fetchFormFields = React.useCallback(async (formId: string) => {
    if (!formId) {
      setSelectedFormFields([]);
      return;
    }
    setLoadingFields(true);
    try {
      const {
        data: fields,
        error
      } = await supabase.from('form_fields').select('id, label, field_type').eq('form_id', formId).order('field_order', {
        ascending: true
      });
      if (error) {
        setSelectedFormFields([]);
      } else {
        setSelectedFormFields(fields || []);
      }
    } catch (error) {
      setSelectedFormFields([]);
    } finally {
      setLoadingFields(false);
    }
  }, []);
  if (!selectedField) return null;
  const updateField = (key: string, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };
  const updateCustomConfig = (key: string, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      customConfig: {
        ...prev.customConfig,
        [key]: value
      }
    }));
  };
  const updateValidation = (key: string, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      validation: {
        ...prev.validation,
        [key]: value
      }
    }));
  };
  const handleSave = async () => {
    if (!selectedField || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(selectedField.id, localConfig);
      toast({
        title: "Configuration saved",
        description: "Field configuration has been saved successfully."
      });

      // Clear field config to force refresh on next open
      setFieldForConfig(null);
      onClose();
    } catch (error) {
      toast({
        title: "Error saving configuration",
        description: "Failed to save field configuration. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  const handleClose = () => {
    setFieldForConfig(null);
    setLocalConfig({});
    onClose();
  };
  const handleTargetFormChange = async (formValue: string) => {
    const selectedForm = getFormOptions.find(form => form.value === formValue);

    // Update form selection immediately
    updateCustomConfig('targetFormId', formValue);
    updateCustomConfig('targetFormName', selectedForm?.label || '');

    // Reset dependent fields when form changes
    updateCustomConfig('displayColumns', []);

    // Fetch form fields for the new selection
    await fetchFormFields(formValue);
  };
  const handleColumnToggle = (columnId: string, checked: boolean) => {
    const currentColumns = localConfig.customConfig?.displayColumns || [];
    let updatedColumns;
    if (checked) {
      updatedColumns = [...currentColumns, columnId];
    } else {
      updatedColumns = currentColumns.filter((col: string) => col !== columnId);
    }
    updateCustomConfig('displayColumns', updatedColumns);
  };
  const handleMetadataColumnToggle = (columnId: string, checked: boolean) => {
    const currentColumns = localConfig.customConfig?.displayColumns || [];
    const metadataColumnId = `metadata_${columnId}`;
    let updatedColumns;
    if (checked) {
      updatedColumns = [...currentColumns, metadataColumnId];
    } else {
      updatedColumns = currentColumns.filter((col: string) => col !== metadataColumnId);
    }
    updateCustomConfig('displayColumns', updatedColumns);
  };
  const addFilter = () => {
    const newFilter = {
      id: `filter-${Date.now()}`,
      field: '',
      operator: '==',
      value: ''
    };
    const currentFilters = localConfig.customConfig?.filters || [];
    updateCustomConfig('filters', [...currentFilters, newFilter]);
  };
  const removeFilter = (index: number) => {
    const currentFilters = localConfig.customConfig?.filters || [];
    const newFilters = currentFilters.filter((_, i) => i !== index);
    updateCustomConfig('filters', newFilters);
  };
  const updateFilter = (index: number, field: string, value: any) => {
    const currentFilters = localConfig.customConfig?.filters || [];
    const newFilters = [...currentFilters];
    newFilters[index] = {
      ...newFilters[index],
      [field]: value
    };
    updateCustomConfig('filters', newFilters);
  };
  const handleOptionChange = (index: number, field: 'value' | 'label', value: string) => {
    const options = ensureOptionsArray(localConfig.options);
    if (options[index]) {
      options[index] = {
        ...options[index],
        [field]: value
      };
    }
    updateField('options', options);
  };
  const addOption = () => {
    const options = ensureOptionsArray(localConfig.options);
    options.push({
      id: `option-${Date.now()}`,
      value: '',
      label: ''
    });
    updateField('options', options);
  };
  const removeOption = (index: number) => {
    const options = ensureOptionsArray(localConfig.options);
    options.splice(index, 1);
    updateField('options', options);
  };

  // Convert Partial<FormField> to FieldConfiguration for field-specific components
  const getFieldConfiguration = (): FieldConfiguration => {
    return {
      label: localConfig.label || '',
      placeholder: localConfig.placeholder || '',
      required: localConfig.required || false,
      tooltip: localConfig.tooltip || '',
      defaultValue: localConfig.defaultValue || '',
      customConfig: localConfig.customConfig || {},
      options: ensureOptionsArray(localConfig.options),
      validation: localConfig.validation || {}
    };
  };

  // Render field-specific configuration panels
  const renderFieldSpecificConfig = () => {
    if (!fieldForConfig || !localConfig) return null;
    const fieldConfig = getFieldConfiguration();
    const props = {
      config: fieldConfig,
      onUpdate: (updates: any) => {
        Object.keys(updates).forEach(key => {
          if (key === 'customConfig') {
            Object.keys(updates.customConfig).forEach(configKey => {
              updateCustomConfig(configKey, updates.customConfig[configKey]);
            });
          } else {
            updateField(key, updates[key]);
          }
        });
      },
      errors: {}
    };
    switch (fieldForConfig.type as any) {
      // Static/Layout Fields
      case 'header':
        return <HeaderFieldConfig {...props} />;
      case 'description':
        return <DescriptionFieldConfig {...props} />;
      case 'section-break':
        return <SectionBreakFieldConfig {...props} />;
      case 'horizontal-line':
        return <HorizontalLineFieldConfig {...props} />;
      case 'rich-text':
        return <RichTextFieldConfig {...props} />;
      case 'full-width-container':
        return <FullWidthContainerFieldConfig {...props} />;

      // Date/Time Fields
      case 'date':
        return <DateFieldConfig {...props} />;
      case 'time':
        return <TimeFieldConfig {...props} />;
      case 'datetime':
        return <DateTimeFieldConfig {...props} />;

      // Geographic Fields
      case 'address':
        return <AddressFieldConfig {...props} />;

      // Validation Fields
      case 'email':
        return <EmailFieldConfig {...props} />;
      case 'url':
        return <UrlFieldConfig {...props} />;
      case 'ip-address':
        return <IpAddressFieldConfig {...props} />;

      // User/Organization Fields
      case 'user-picker':
        return <UserPickerFieldConfig {...props} />;

      // New Field Types
      case 'barcode':
        return <BarcodeFieldConfig {...props} />;
      case 'approval':
        return <ApprovalFieldConfig {...props} />;
      case 'dynamic-dropdown':
        return <DynamicDropdownFieldConfig {...props} />;
      case 'calculated':
        return <CalculatedFieldConfig {...props} />;
      case 'conditional-section':
        return <ConditionalSectionFieldConfig {...props} />;
      case 'geo-location':
        return <GeoLocationFieldConfig {...props} />;
      case 'child-cross-reference':
        return <ChildCrossReferenceFieldConfig {...props} />;

      // Selection Fields
      case 'select':
      case 'radio':
      case 'checkbox':
        return <SelectFieldConfig {...props} fieldType={fieldForConfig.type as any} />;
      case 'multi-select':
        return <MultiSelectFieldConfig {...props} />;

      // Media Fields
      case 'signature':
        return <SignatureFieldConfig {...props} />;

      // International Fields
      case 'currency':
        return <CurrencyFieldConfig {...props} />;
      case 'country':
        return <CountryFieldConfig {...props} />;
      case 'phone':
        return <PhoneFieldConfig field={fieldForConfig} onConfigChange={config => updateCustomConfig(Object.keys(config)[0], Object.values(config)[0])} />;

      // Media Fields
      case 'color':
        return <ColorFieldConfig field={fieldForConfig} onConfigChange={config => updateCustomConfig(Object.keys(config)[0], Object.values(config)[0])} />;
      case 'file':
        return <FileFieldConfig field={fieldForConfig} onConfigChange={config => updateCustomConfig(Object.keys(config)[0], Object.values(config)[0])} />;

      // Input Fields
      case 'slider':
        return <SliderFieldConfig field={fieldForConfig} onConfigChange={config => updateCustomConfig(Object.keys(config)[0], Object.values(config)[0])} />;

      // Access Control Fields
      case 'submission-access':
        return <SubmissionAccessFieldConfig {...props} />;

      // Query Field
      case 'query-field':
        return <QueryFieldConfig {...props} />;

      // Text Fields
      case 'text':
      case 'textarea':
      case 'password':
        return <TextFieldConfig {...props} />;

      case 'number':
        return <NumberFieldConfig {...props}/>;

      // Record Fields
      case 'record-table':
      case 'cross-reference':
        return <OptimizedRecordTableConfig {...props} fieldType={fieldForConfig.type as any} />;
      case 'matrix-grid':
        return <MatrixGridFieldConfig {...props} />;
      default:
        return null;
    }
  };
  const fieldType = selectedField.type;
  const displayColumns = localConfig.customConfig?.displayColumns || [];
  const includeMetadata = localConfig.customConfig?.includeMetadata || false;
  const formOptions = getFormOptions;

  // Get available fields for filter dropdown (both form fields and metadata if enabled)
  const getAvailableFilterFields = () => {
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
  };
  const availableFilterFields = getAvailableFilterFields();


  // Check if field has advanced configuration
  const hasAdvancedConfig = [
  // Static/Layout
  'header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'full-width-container',
  // Text
  'text', 'textarea', 'email', 'password', 'url', 'ip-address',
  // Select
  'select', 'multi-select', 'radio',
  // User/Organization Fields
  'user-picker',
  // Date/Time
  'date', 'time', 'datetime',
  // Geographic
  'address', 'geo-location',
  // Record
  'record-table', 'matrix-grid', 'cross-reference',
  // New Field Types
  'barcode', 'approval', 'dynamic-dropdown', 'calculated', 'conditional-section', 'submission-access',
  // Media Fields
  'signature', 'color', 'file',
  // International Fields
  'country', 'phone', 'currency',
  // Query Fields
  'query-field',
  // Other
  'number', 'currency', 'file', 'image', 'rating', 'slider',
  // Cross-reference fields
  'child-cross-reference'].includes(fieldType);
  return <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold flex items-center justify-between mx-0 my-[15px]">
            <span>Configure Field: {fieldForConfig?.label || selectedField.label}</span>
            <div className="flex items-center space-x-2">
              {loadingFieldData && <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Loading field data...
                </span>}
              {fieldDataError && !selectedField.id && (
                <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                  {fieldDataError}
                </span>
              )}
              <Button onClick={handleSave} disabled={isSaving || loadingFieldData} className="ml-4">
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loadingFieldData ? <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading field configuration...</span>
          </div> : <div className="space-y-6 py-4">
            {/* Basic Properties Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Basic Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="field-label">Field Label *</Label>
                    <Input id="field-label" value={localConfig.label || ''} onChange={e => updateField('label', e.target.value)} placeholder="Enter field label" />
                  </div>

                  {/* Placeholder only shown for text-input and select fields */}
                  {!['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'checkbox', 'radio', 'date', 'time', 'datetime', 'file', 'signature', 'rating', 'slider', 'toggle', 'color', 'record-table', 'matrix-grid', 'cross-reference', 'full-width-container'].includes(fieldForConfig?.type || '') ? (
                    <div className="space-y-2">
                      <Label htmlFor="field-placeholder">Placeholder Text</Label>
                      <Input id="field-placeholder" value={localConfig.placeholder || ''} onChange={e => updateField('placeholder', e.target.value)} placeholder="Enter placeholder text" />
                    </div>
                  ) : (
                    /* Show Help Text in the second column for non-placeholder fields */
                    <div className="space-y-2">
                      <Label htmlFor="field-tooltip">Help Text / Tooltip</Label>
                      <Input id="field-tooltip" value={localConfig.tooltip || ''} onChange={e => updateField('tooltip', e.target.value)} placeholder="Enter help text or tooltip" />
                    </div>
                  )}
                </div>

                {/* Help Text shown below grid only for fields that have placeholder */}
                {!['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'checkbox', 'radio', 'date', 'time', 'datetime', 'file', 'signature', 'rating', 'slider', 'toggle', 'color', 'record-table', 'matrix-grid', 'cross-reference', 'full-width-container'].includes(fieldForConfig?.type || '') && (
                  <div className="space-y-2">
                    <Label htmlFor="field-tooltip-below">Help Text / Tooltip</Label>
                    <Textarea id="field-tooltip-below" value={localConfig.tooltip || ''} onChange={e => updateField('tooltip', e.target.value)} rows={2} placeholder="Enter help text or tooltip" />
                  </div>
                )}

                {/* Field Options Row - Required, Unique, Weightage side by side */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Required Field */}
                  <div className="flex items-center space-x-2 p-3 border rounded-md bg-blue-50 dark:bg-blue-950/20">
                    <Checkbox id="field-required" checked={localConfig.required || false} onCheckedChange={checked => updateField('required', Boolean(checked))} />
                    <Label htmlFor="field-required" className="text-sm font-medium cursor-pointer">
                      Make Field Required
                    </Label>
                  </div>

                  {/* Unique Field */}
                  {!['header', 'description', 'section-break', 'horizontal-line', 'rich-text'].includes(fieldForConfig?.type || '') ? (
                    <div className="flex items-center space-x-2 p-3 border rounded-md bg-blue-50 dark:bg-blue-950/20">
                      <Checkbox
                        id="field-unique"
                        checked={localConfig.validation?.unique || false}
                        onCheckedChange={(checked) => {
                          console.log('Unique checkbox changed:', checked);
                          updateValidation('unique', Boolean(checked));
                        }}
                      />
                      <Label htmlFor="field-unique" className="text-sm font-medium cursor-pointer">
                        Make Field Unique
                      </Label>
                    </div>
                  ) : <div />}

                  {/* Field Weightage */}
                  {!['header', 'description', 'section-break', 'horizontal-line', 'rich-text'].includes(fieldForConfig?.type || '') ? (
                    <div className="flex items-center space-x-2 p-3 border rounded-md bg-blue-50 dark:bg-blue-950/20">
                      <Label htmlFor="field-weightage" className="text-sm font-medium whitespace-nowrap">
                        Field Weightage
                      </Label>
                      <Input 
                        id="field-weightage" 
                        type="number"
                        min="1"
                        max="100"
                        className="h-8 w-20"
                        value={localConfig.customConfig?.weightage || 1} 
                        onChange={e => {
                          const inputValue = e.target.value;
                          if (inputValue === '') {
                            updateCustomConfig('weightage', '');
                          } else {
                            const numValue = parseInt(inputValue);
                            if (!isNaN(numValue)) {
                              const value = Math.min(100, Math.max(1, numValue));
                              updateCustomConfig('weightage', value);
                            }
                          }
                        }}
                        onBlur={e => {
                          const inputValue = e.target.value;
                          if (inputValue === '' || isNaN(parseInt(inputValue))) {
                            updateCustomConfig('weightage', 1);
                          }
                        }}
                      />
                    </div>
                  ) : <div />}
                </div>
              </CardContent>
            </Card>

            {/* Field-Specific Advanced Configuration */}
            {hasAdvancedConfig && <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Advanced Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderFieldSpecificConfig()}
                </CardContent>
              </Card>}

            {/* Field-Specific Configuration */}
            {/* {['select', 'multi-select', 'radio', 'checkbox'].includes(fieldType) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Options Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ensureOptionsArray(localConfig.options).map((option: any, index: number) => (
                    <div key={option.id || index} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <Input
                          placeholder="Option Value"
                          value={option.value || ''}
                          onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                        />
                        <Input
                          placeholder="Display Label"
                          value={option.label || ''}
                          onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeOption(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    variant="outline"
                    onClick={addOption}
                    className="w-full"
                  >
                    Add Option
                  </Button>
                </CardContent>
              </Card>
             )} */}


            {/* General Options - hidden for layout/display-only fields */}
            {!['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'file', 'signature', 'record-table', 'matrix-grid', 'cross-reference', 'full-width-container'].includes(fieldForConfig?.type || '') && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    General Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="field-default">Default Value</Label>
                    {/* Render appropriate input based on field type */}
                    {(() => {
                      const fieldType = fieldForConfig?.type || '';
                      const options = fieldForConfig?.options || [];
                      
                      // Number field
                      if (fieldType === 'number' || fieldType === 'currency') {
                        return (
                          <Input 
                            id="field-default" 
                            type="number"
                            value={String(localConfig.defaultValue ?? '')} 
                            onChange={e => updateField('defaultValue', e.target.value ? Number(e.target.value) : '')} 
                            placeholder="Enter default number" 
                          />
                        );
                      }
                      
                      // Date field
                      if (fieldType === 'date') {
                        return (
                          <Input 
                            id="field-default" 
                            type="date"
                            value={String(localConfig.defaultValue || '')} 
                            onChange={e => updateField('defaultValue', e.target.value)} 
                          />
                        );
                      }
                      
                      // Time field
                      if (fieldType === 'time') {
                        return (
                          <Input 
                            id="field-default" 
                            type="time"
                            value={String(localConfig.defaultValue || '')} 
                            onChange={e => updateField('defaultValue', e.target.value)} 
                          />
                        );
                      }
                      
                      // DateTime field
                      if (fieldType === 'datetime') {
                        return (
                          <Input 
                            id="field-default" 
                            type="datetime-local"
                            value={String(localConfig.defaultValue || '')} 
                            onChange={e => updateField('defaultValue', e.target.value)} 
                          />
                        );
                      }
                      
                      // Select/Dropdown field
                      if (fieldType === 'select' || fieldType === 'radio') {
                        const optionsArray = Array.isArray(options) ? options : [];
                        const currentValue = String(localConfig.defaultValue || '__none__');
                        return (
                          <Select 
                            value={currentValue} 
                            onValueChange={value => updateField('defaultValue', value === '__none__' ? '' : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select default value" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              <SelectItem value="__none__">No default</SelectItem>
                              {optionsArray.map((opt: any, idx: number) => {
                                const optValue = typeof opt === 'string' ? opt : (opt.value || opt.label || '');
                                // Skip options with empty values
                                if (!optValue) return null;
                                return (
                                  <SelectItem key={idx} value={optValue}>
                                    {typeof opt === 'string' ? opt : opt.label || opt.value}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        );
                      }
                      
                      // Toggle field
                      if (fieldType === 'toggle-switch') {
                        return (
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="field-default-toggle"
                              checked={localConfig.defaultValue === true || localConfig.defaultValue === 'true'} 
                              onCheckedChange={checked => updateField('defaultValue', Boolean(checked))} 
                            />
                            <Label htmlFor="field-default-toggle" className="text-sm">Default to ON</Label>
                          </div>
                        );
                      }
                      
                      // Rating/Slider field
                      if (fieldType === 'rating' || fieldType === 'slider') {
                        return (
                          <Input 
                            id="field-default" 
                            type="number"
                            min={fieldType === 'rating' ? 1 : (localConfig.customConfig?.min || 0)}
                            max={fieldType === 'rating' ? 5 : (localConfig.customConfig?.max || 100)}
                            value={String(localConfig.defaultValue ?? '')} 
                            onChange={e => updateField('defaultValue', e.target.value ? Number(e.target.value) : '')} 
                            placeholder={fieldType === 'rating' ? 'Enter default rating (1-5)' : 'Enter default value'} 
                          />
                        );
                      }
                      
                      // Color field
                      if (fieldType === 'color') {
                        return (
                          <Input 
                            id="field-default" 
                            type="color"
                            value={String(localConfig.defaultValue || '#000000')} 
                            onChange={e => updateField('defaultValue', e.target.value)} 
                          />
                        );
                      }
                      
                      // Textarea field
                      if (fieldType === 'textarea') {
                        return (
                          <Textarea 
                            id="field-default" 
                            value={String(localConfig.defaultValue || '')} 
                            onChange={e => updateField('defaultValue', e.target.value)} 
                            placeholder="Enter default text"
                            rows={3}
                          />
                        );
                      }
                      
                      // Default: text input for text, email, url, phone, etc.
                      return (
                        <Input 
                          id="field-default" 
                          value={String(localConfig.defaultValue || '')} 
                          onChange={e => updateField('defaultValue', e.target.value)} 
                          placeholder="Enter default value" 
                        />
                      );
                    })()}
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox id="field-read-only" checked={localConfig.customConfig?.readOnly || false} onCheckedChange={checked => updateCustomConfig('readOnly', Boolean(checked))} />
                    <Label htmlFor="field-read-only" className="text-sm font-medium">
                      Read-only field
                    </Label>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>}

        <div className="flex justify-between pt-4 border-t">
          <div>
            {onDelete && selectedField?.id && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  onDelete(selectedField.id);
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Field
              </Button>
            )}
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || loadingFieldData}>
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
}