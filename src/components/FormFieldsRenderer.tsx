
import React from 'react';
import { FormField } from '@/types/form';
import { ParsedFieldReference } from '@/utils/fieldReferenceParser';
import { RecordTableField } from './form-fields/RecordTableField';
import { CrossReferenceField } from './form-fields/CrossReferenceField';
import { ChildCrossReferenceField } from './form-fields/ChildCrossReferenceField';

import { RatingField } from './form-fields/RatingField';
import { UserPickerField } from './form-fields/UserPickerField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { 
  HeaderField, 
  DescriptionField, 
  SectionBreakField, 
  HorizontalLineField, 
  AddressField,
  RichTextField,
  FullWidthContainerField,
  TagsField,
  PasswordField,
  ColorField,
  FileField,
  MatrixGridField
} from './form-fields/enhanced';
import { QueryField } from './form-fields/QueryField';
import { BarcodeField } from './form-fields/BarcodeField';
import { ApprovalField } from './form-fields/ApprovalField';
import { DynamicDropdownField } from './form-fields/DynamicDropdownField';
import { CalculatedField } from './form-fields/CalculatedField';
import { ConditionalSectionField } from './form-fields/ConditionalSectionField';
import { GeoLocationField } from './form-fields/GeoLocationField';
import { MultiSelectField } from './form-fields/MultiSelectField';
import { SignatureField } from './form-fields/SignatureField';
import { CurrencyField } from './form-fields/CurrencyField';
import { CountryField } from './form-fields/CountryField';
import { PhoneField } from './form-fields/PhoneField';
import { SubmissionAccessField } from './form-fields/SubmissionAccessField';
import { SelectFieldWithSearch } from './form-fields/SelectFieldWithSearch';
import { RadioFieldWithSearch } from './form-fields/RadioFieldWithSearch';

interface FormFieldsRendererProps {
  fields: FormField[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  fieldStates: Record<string, {
    isVisible: boolean;
    isEnabled: boolean;
    isRequired?: boolean;
    label: string;
    options?: any[];
    tooltip?: string;
    errorMessage?: string;
  }>;
  columns: number;
  onFieldChange: (fieldId: string, value: any) => void;
  onSubmit: (formData: Record<string, any>) => void;
  onSave?: (formData: Record<string, any>) => void;
  showButtons?: boolean;
  allFormFields?: ParsedFieldReference[];
  highlightedFieldId?: string | null;
  formId?: string;
  currentSubmissionId?: string;
}

export function FormFieldsRenderer({
  fields,
  formData,
  errors,
  fieldStates,
  columns,
  onFieldChange,
  onSubmit,
  onSave,
  showButtons = true,
  allFormFields = [],
  highlightedFieldId,
  formId,
  currentSubmissionId,
}: FormFieldsRendererProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(formData);
    }
  };

  const renderField = (field: FormField) => {
    const fieldState = fieldStates[field.id];
    if (!fieldState?.isVisible) return null;

    // Check if field is required (from field definition or rule)
    const isRequired = field.required || fieldState.isRequired;

    const commonProps = {
      field: {
        ...field,
        label: fieldState.label || field.label,
        options: fieldState.options || field.options,
        tooltip: fieldState.tooltip || field.tooltip,
        errorMessage: fieldState.errorMessage || field.errorMessage,
      },
      value: formData[field.id],
      onChange: (value: any) => onFieldChange(field.id, value),
      error: errors[field.id],
      disabled: !fieldState.isEnabled,
    };

    switch (field.type as any) {
      // Enhanced Layout Fields
      case 'header':
        return <HeaderField {...commonProps} />;
      
      case 'description':
        return <DescriptionField {...commonProps} />;
      
      case 'section-break':
        return <SectionBreakField {...commonProps} />;
      
      case 'horizontal-line':
        return <HorizontalLineField {...commonProps} />;

      case 'rich-text':
        return <RichTextField {...commonProps} />;

      case 'full-width-container':
        return <FullWidthContainerField {...commonProps} />;

      // Enhanced Geographic Fields
      case 'address':
        return <AddressField {...commonProps} />;

      // Enhanced Input Fields
      case 'password':
        return <PasswordField {...commonProps} />;

      case 'tags':
        return <TagsField {...commonProps} />;

      // case 'user-picker':
      //   return (
      //     <UserPickerField
      //       field={field}
      //       value={formData[field.id] || (field.customConfig?.allowMultiple ? [] : '')}
      //       onChange={(value) => onFieldChange(field.id, value)}
      //       error={errors[field.id]}
      //       disabled={!fieldState.isEnabled}
      //     />
      //   );

      // Enhanced Media Fields
      case 'color':
        return <ColorField {...commonProps} />;

      case 'file':
        return <FileField {...commonProps} />;

      // New Field Types
      case 'multi-select':
        return (
          <MultiSelectField
            field={field}
            value={formData[field.id] || []}
            onChange={(value) => onFieldChange(field.id, value)}
            error={errors[field.id]}
            disabled={!fieldState.isEnabled}
          />
        );

      case 'signature':
        return (
          <SignatureField
            field={field}
            value={formData[field.id] || ''}
            onChange={(value) => onFieldChange(field.id, value)}
            error={errors[field.id]}
            disabled={!fieldState.isEnabled}
          />
        );

      case 'currency':
        return (
          <CurrencyField
            field={field}
            value={formData[field.id] || { amount: 0, currency: field.customConfig?.defaultCurrency || 'USD' }}
            onChange={(value) => onFieldChange(field.id, value)}
            error={errors[field.id]}
            disabled={!fieldState.isEnabled}
          />
        );

      case 'country':
        return (
          <CountryField
            field={field}
            value={formData[field.id] || ''}
            onChange={(value) => onFieldChange(field.id, value)}
            error={errors[field.id]}
            disabled={!fieldState.isEnabled}
          />
        );

       case 'phone':
         return (
           <PhoneField
             field={field}
             value={formData[field.id] || ''}
             onChange={(value) => onFieldChange(field.id, value)}
             error={errors[field.id]}
             disabled={!fieldState.isEnabled}
           />
         );

       case 'submission-access':
         return (
           <SubmissionAccessField
             field={field}
             value={formData[field.id] || (field.customConfig?.allowMultiple ? [] : '')}
             onChange={(value) => onFieldChange(field.id, value)}
             error={errors[field.id]}
             disabled={!fieldState.isEnabled}
           />
         );

      // Enhanced Email with validation
      case 'email':
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>
                {fieldState.label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Input
              id={field.id}
              type="email"
              value={formData[field.id] || ''}
              onChange={(e) => {
                onFieldChange(field.id, e.target.value);
                // Real-time validation if enabled
                const config = field.customConfig || {};
                if ((config as any).realTimeValidation !== false && e.target.value) {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(e.target.value)) {
                    // Set error state instead of just logging
                    onFieldChange(field.id + '_error', (config as any).validationMessage || 'Invalid email format');
                  } else {
                    onFieldChange(field.id + '_error', '');
                  }
                }
              }}
              placeholder={field.placeholder}
              disabled={!fieldState.isEnabled}
            />
            {(errors[field.id] || formData[field.id + '_error']) && (
              <p className="text-sm text-red-500">
                {(field.customConfig as any)?.validationMessage || errors[field.id] || formData[field.id + '_error']}
              </p>
            )}
          </div>
        );

      // Enhanced URL with validation
      case 'url':
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>
                {fieldState.label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Input
              id={field.id}
              type="url"
              value={formData[field.id] || ''}
              onChange={(e) => {
                onFieldChange(field.id, e.target.value);
                // Real-time validation if enabled
                const config = field.customConfig || {};
                if ((config as any).realTimeValidation !== false && e.target.value) {
                  try {
                    const url = new URL(e.target.value);
                    const protocol = (config as any).protocolRestriction;
                    if (protocol && protocol !== 'any' && !url.protocol.startsWith(protocol)) {
                      onFieldChange(field.id + '_error', `Invalid protocol, expected ${protocol}`);
                    } else {
                      onFieldChange(field.id + '_error', '');
                    }
                  } catch {
                    onFieldChange(field.id + '_error', (config as any).validationMessage || 'Invalid URL format');
                  }
                }
              }}
              placeholder={field.placeholder || 'https://example.com'}
              disabled={!fieldState.isEnabled}
            />
            {(errors[field.id] || formData[field.id + '_error']) && (
              <p className="text-sm text-red-500">
                {(field.customConfig as any)?.validationMessage || errors[field.id] || formData[field.id + '_error']}
              </p>
            )}
          </div>
        );

      // Enhanced IP Address field
      case 'ip-address':
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>{field.label}</Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Input
              id={field.id}
              type="text"
              value={formData[field.id] || ''}
              onChange={(e) => {
                onFieldChange(field.id, e.target.value);
                // Real-time validation if enabled
                const config = field.customConfig || {};
                if (config.realTimeValidation !== false && e.target.value) {
                  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
                  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                  if (!ipv4Regex.test(e.target.value) && !ipv6Regex.test(e.target.value)) {
                    console.log('Invalid IP address format');
                  }
                }
              }}
              placeholder={field.placeholder || '192.168.0.1'}
              disabled={!fieldState.isEnabled}
            />
            {errors[field.id] && (
              <p className="text-sm text-red-500">
                {field.customConfig?.validationMessage || errors[field.id]}
              </p>
            )}
          </div>
        );

      // Enhanced Date with auto-fill and format display
      case 'date':
        const dateConfig = field.customConfig || {};
        const dateValue = dateConfig.autoPopulate && !formData[field.id] 
          ? new Date().toISOString().split('T')[0] 
          : formData[field.id] || '';
        
        // Format display based on configuration
        const getFormattedDateDisplay = (value: string) => {
          if (!value) return '';
          const date = new Date(value);
          const format = dateConfig.format || 'default';
          
          switch (format) {
            case 'MM/dd/yyyy': return date.toLocaleDateString('en-US');
            case 'dd/MM/yyyy': return date.toLocaleDateString('en-GB');
            case 'yyyy-MM-dd': return date.toISOString().split('T')[0];
            case 'dd MMM yyyy': return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            case 'MMM dd, yyyy': return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            case 'ISO': return date.toISOString().split('T')[0];
            case 'Long Date': return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            default: return date.toLocaleDateString();
          }
        };
        
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>
                {fieldState.label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Input
              id={field.id}
              type="date"
              value={dateValue}
              onChange={(e) => onFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              disabled={!fieldState.isEnabled}
              min={dateConfig.minDate}
              max={dateConfig.maxDate}
            />
            {/* Show formatted preview if different from input format */}
            {dateValue && dateConfig.format && dateConfig.format !== 'YYYY-MM-DD' && (
              <p className="text-xs text-muted-foreground">
                Preview: {getFormattedDateDisplay(dateValue)}
              </p>
            )}
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );

      // Enhanced Time with auto-fill
      case 'time':
        const timeConfig = field.customConfig || {};
        const timeValue = timeConfig.autoPopulate && !formData[field.id] 
          ? new Date().toTimeString().split(' ')[0].slice(0, 5)
          : formData[field.id] || '';
        
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>{field.label}</Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Input
              id={field.id}
              type="time"
              value={timeValue}
              onChange={(e) => onFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              disabled={!fieldState.isEnabled}
            />
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );

      // Enhanced DateTime with auto-fill
      case 'datetime':
        const datetimeConfig = field.customConfig || {};
        const datetimeValue = datetimeConfig.autoPopulate && !formData[field.id] 
          ? new Date().toISOString().slice(0, 16)
          : formData[field.id] || '';
        
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>
                {fieldState.label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Input
              id={field.id}
              type="datetime-local"
              value={datetimeValue}
              onChange={(e) => onFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              disabled={!fieldState.isEnabled}
            />
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );

      // Keep all existing field types
case 'text':
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <Label htmlFor={field.id}>
          {fieldState.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <HelpTooltip content={field.tooltip || fieldState.tooltip} />
      </div>
      <Input
        id={field.id}
        type="text"
        value={formData[field.id] ?? ''}
        placeholder={field.placeholder}
        disabled={!fieldState.isEnabled}
        maxLength={field.validation?.maxLength} // Prevent typing beyond max length
        onChange={(e) => onFieldChange(field.id, e.target.value)}
      />

      {/* Minimum length alert */}
      {field.validation?.minLength !== undefined &&
        (formData[field.id]?.length || 0) < field.validation.minLength && (
          <p className="text-sm text-red-500">
            Minimum length is {field.validation.minLength} characters
          </p>
        )}

      {errors[field.id] && (
        <p className="text-sm text-red-500">{errors[field.id]}</p>
      )}
    </div>
  );


case 'textarea':
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <Label htmlFor={field.id}>
          {fieldState.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <HelpTooltip content={field.tooltip || fieldState.tooltip} />
      </div>
      <Textarea
        id={field.id}
        value={formData[field.id] ?? ''}
        placeholder={field.placeholder}
        disabled={!fieldState.isEnabled}
        maxLength={field.validation?.maxLength} // Prevent typing beyond max length
        onChange={(e) => onFieldChange(field.id, e.target.value)}
      />

      {/* Minimum length alert */}
      {field.validation?.minLength !== undefined &&
        (formData[field.id]?.length || 0) < field.validation.minLength && (
          <p className="text-sm text-red-500">
            Minimum length is {field.validation.minLength} characters
          </p>
        )}

      {errors[field.id] && (
        <p className="text-sm text-red-500">{errors[field.id]}</p>
      )}
    </div>
  );

      case 'number':
        const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const value = e.target.value;
          const maxLength = field.validation?.maxLength;
          
          // Restrict input to maxLength if specified
          if (maxLength && value.length > maxLength) {
            return; // Don't allow typing beyond max length
          }
          
          onFieldChange(field.id, value);
        };
        
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>
                {fieldState.label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Input
              id={field.id}
              type="number"
              value={formData[field.id] || ''}
              onChange={handleNumberChange}
              placeholder={field.placeholder}
              disabled={!fieldState.isEnabled}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.customConfig?.step || 1}
            />
            {/* Max length warning */}
            {field.validation?.maxLength && (formData[field.id]?.toString().length || 0) >= field.validation.maxLength && (
              <p className="text-sm text-red-500">
                Maximum length is {field.validation.maxLength} digits
              </p>
            )}
            {/* Min/Max validation warnings */}
            {field.validation?.min !== undefined && formData[field.id] && Number(formData[field.id]) < field.validation.min && (
              <p className="text-sm text-red-500">
                Minimum value is {field.validation.min}
              </p>
            )}
            {field.validation?.max !== undefined && formData[field.id] && Number(formData[field.id]) > field.validation.max && (
              <p className="text-sm text-red-500">
                Maximum value is {field.validation.max}
              </p>
            )}
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );
        
      case 'select':
        const selectedOption = field.options?.find(opt => opt.value === formData[field.id]);
        const selectConfig = field.customConfig || {};
        const isSearchable = selectConfig.searchable;
        
        if (isSearchable) {
          return (
            <SelectFieldWithSearch
              field={field}
              value={formData[field.id] || ''}
              onChange={(value) => onFieldChange(field.id, value)}
              error={errors[field.id]}
              disabled={!fieldState.isEnabled}
              required={isRequired}
              fieldState={fieldState}
            />
          );
        }
        
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>
                {fieldState.label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Select
              value={formData[field.id] || ''}
              onValueChange={(value) => onFieldChange(field.id, value)}
              disabled={!fieldState.isEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder}>
                  {selectedOption && (
                    <div className="flex items-center gap-2">
                      {selectedOption.color && (
                        <div 
                          className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" 
                          style={{ backgroundColor: selectedOption.color }}
                        />
                      )}
                      <span>{selectedOption.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.id} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.color && (
                        <div 
                          className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" 
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );
      case 'radio':
        const radioConfig = field.customConfig || {};
        const radioOrientation = radioConfig.orientation || 'vertical';
        const isRadioSearchable = radioConfig.searchable;
        
        if (isRadioSearchable) {
          return (
            <RadioFieldWithSearch
              field={field}
              value={formData[field.id] || ''}
              onChange={(value) => onFieldChange(field.id, value)}
              error={errors[field.id]}
              disabled={!fieldState.isEnabled}
              required={isRequired}
              fieldState={fieldState}
            />
          );
        }
        
        const hasScrollbar = field.options && field.options.length > 7;
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label>{field.label}</Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <div className={hasScrollbar ? 'max-h-64 overflow-y-auto border rounded-lg p-3 bg-background' : ''}>
              <RadioGroup
                value={formData[field.id] || ''}
                onValueChange={(value) => onFieldChange(field.id, value)}
                disabled={!fieldState.isEnabled}
                className={radioOrientation === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-3'}
              >
                {field.options?.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.id} />
                    <Label htmlFor={option.id} className="flex items-center gap-2 cursor-pointer">
                      {option.color && (
                        <div 
                          className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" 
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      <span>{option.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );
      case 'checkbox':
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.id}
                checked={formData[field.id] || false}
                onCheckedChange={(checked) => onFieldChange(field.id, checked)}
                disabled={!fieldState.isEnabled}
              />
              <Label htmlFor={field.id}>{field.label}</Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );
      case 'toggle-switch':
        return (
          <div className="space-y-3">
            <div className="flex items-center">
              <Label htmlFor={field.id}>{field.label}</Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Switch
              id={field.id}
              checked={formData[field.id] || false}
              onCheckedChange={(checked) => onFieldChange(field.id, checked)}
              disabled={!fieldState.isEnabled}
            />
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );
      case 'slider':
        return (
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor={field.id}>{field.label}</Label>
              <HelpTooltip content={field.tooltip || fieldState.tooltip} />
            </div>
            <Slider
              value={[formData[field.id] || 0]}
              onValueChange={(value) => onFieldChange(field.id, value[0])}
              max={field.validation?.max || 100}
              min={field.validation?.min || 0}
              step={field.customConfig?.step || 1}
              disabled={!fieldState.isEnabled}
            />
            {errors[field.id] && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        );
      case 'rating':
        return <RatingField {...commonProps} />;
      case 'record-table':
        return <RecordTableField {...commonProps} />;
      case 'matrix-grid':
        return <MatrixGridField {...commonProps} />;
      case 'cross-reference':
        return <CrossReferenceField {...commonProps} />;
      
      // New Field Types
      case 'barcode':
        return <BarcodeField {...commonProps} />;
      case 'approval':
        return (
          <ApprovalField 
            {...commonProps} 
            formData={formData} 
            allFields={fields} 
          />
        );
      case 'dynamic-dropdown':
        return <DynamicDropdownField {...commonProps} formData={formData} />;
      case 'calculated':
        return <CalculatedField {...commonProps} formData={formData} allFormFields={allFormFields} />;
      case 'conditional-section':
        return <ConditionalSectionField {...commonProps} formData={formData} />;
      case 'geo-location':
        return <GeoLocationField {...commonProps} />;
      case 'child-cross-reference':
        return <ChildCrossReferenceField {...commonProps} currentFormId={formId} currentSubmissionId={currentSubmissionId} />;
      
      case 'query-field':
        return (
          <QueryField
            field={field}
            value={formData[field.id]}
            onChange={(value) => onFieldChange(field.id, value)}
            error={errors[field.id]}
            disabled={!fieldState.isEnabled}
            formData={formData}
            onFieldChange={onFieldChange}
          />
        );
      
      default:
        return (
          <div className="p-4 border border-dashed border-gray-300 rounded-lg">
            <p className="text-sm text-gray-500">
              Field type "{field.type}" is not yet implemented
            </p>
          </div>
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={`grid gap-6 ${
        columns === 1 ? 'grid-cols-1' : 
        columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {fields.map((field) => (
          <div 
            key={field.id} 
            id={`field-${field.id}`}
            className={`space-y-2 transition-all duration-300 ${
              highlightedFieldId === field.id 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20 dark:ring-blue-400 rounded-lg p-3 animate-pulse' 
                : ''
            }`}
          >
            {renderField(field)}
          </div>
        ))}
      </div>

      {showButtons && (
        <div className="flex justify-end space-x-3">
          {onSave && (
            <Button type="button" variant="outline" onClick={handleSave}>
              Save Draft
            </Button>
          )}
          <Button type="submit">
            Submit Form
          </Button>
        </div>
      )}
    </form>
  );
}
