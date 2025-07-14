import React from 'react';
import { FormField } from '@/types/form';
import { TextField } from './form-fields/TextField';
import { TextAreaField } from './form-fields/TextAreaField';
import { NumberField } from './form-fields/NumberField';
import { EmailField } from './form-fields/EmailField';
import { PasswordField } from './form-fields/PasswordField';
import { SelectField } from './form-fields/SelectField';
import { MultiSelectField } from './form-fields/MultiSelectField';
import { CheckboxField } from './form-fields/CheckboxField';
import { RadioField } from './form-fields/RadioField';
import { ToggleSwitchField } from './form-fields/ToggleSwitchField';
import { DateField } from './form-fields/DateField';
import { TimeField } from './form-fields/TimeField';
import { DateTimeField } from './form-fields/DateTimeField';
import { FileField } from './form-fields/FileField';
import { ImageField } from './form-fields/ImageField';
import { UrlField } from './form-fields/UrlField';
import { PhoneField } from './form-fields/PhoneField';
import { AddressField } from './form-fields/AddressField';
import { CurrencyField } from './form-fields/CurrencyField';
import { RatingField } from './form-fields/RatingField';
import { SliderField } from './form-fields/SliderField';
import { ColorField } from './form-fields/ColorField';
import { SignatureField } from './form-fields/SignatureField';
import { TagsField } from './form-fields/TagsField';
import { LookupField } from './form-fields/LookupField';
import { CalculatedField } from './form-fields/CalculatedField';
import { HeaderField } from './form-fields/HeaderField';
import { DescriptionField } from './form-fields/DescriptionField';
import { SectionBreakField } from './form-fields/SectionBreakField';
import { HorizontalLineField } from './form-fields/HorizontalLineField';
import { RichTextField } from './form-fields/RichTextField';
import { BarcodeField } from './form-fields/BarcodeField';
import { UserPickerField } from './form-fields/UserPickerField';
import { GeoLocationField } from './form-fields/GeoLocationField';
import { WorkflowTriggerField } from './form-fields/WorkflowTriggerField';
import { MatrixGridField } from './form-fields/MatrixGridField';
import { RecordTableField } from './form-fields/RecordTableField';
import { CrossReferenceField } from './form-fields/CrossReferenceField';
import { DynamicDropdownField } from './form-fields/DynamicDropdownField';
import { ConditionalSectionField } from './form-fields/ConditionalSectionField';
import { IpAddressField } from './form-fields/IpAddressField';
import { FullWidthContainerField } from './form-fields/FullWidthContainerField';
import { CountryField } from './form-fields/CountryField';
import { SubmissionAccessField } from './form-fields/SubmissionAccessField';
import { ApprovalField } from './form-fields/ApprovalField';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

interface FormFieldsRendererProps {
  fields: FormField[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  fieldStates: Record<string, any>;
  columns: 1 | 2 | 3;
  onFieldChange: (fieldId: string, value: any) => void;
  onSubmit: () => void;
  showButtons?: boolean;
  isSubmitting?: boolean;
  onFieldUpdate?: (fieldId: string, updates: Partial<FormField>) => void;
  isPreview?: boolean;
  currentFormId?: string;
}

export function FormFieldsRenderer({
  fields,
  formData,
  errors,
  fieldStates,
  columns,
  onFieldChange,
  onSubmit,
  showButtons = true,
  isSubmitting = false,
  onFieldUpdate,
  isPreview = false,
  currentFormId
}: FormFieldsRendererProps) {
  const renderField = (field: FormField) => {
    const fieldState = fieldStates[field.id] || {};
    const isVisible = fieldState.isVisible !== false;
    const isEnabled = fieldState.isEnabled !== false;

    if (!isVisible) return null;

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
      disabled: !isEnabled,
      onFieldUpdate,
      isPreview,
      currentFormId
    };

    // Add additional props for ApprovalField
    const approvalProps = field.type === 'approval' ? {
      formData,
      allFields: fields
    } : {};

    switch (field.type) {
      case 'text':
        return <TextField {...commonProps} />;
      case 'textarea':
        return <TextAreaField {...commonProps} />;
      case 'number':
        return <NumberField {...commonProps} />;
      case 'email':
        return <EmailField {...commonProps} />;
      case 'password':
        return <PasswordField {...commonProps} />;
      case 'select':
        return <SelectField {...commonProps} />;
      case 'multi-select':
        return <MultiSelectField {...commonProps} />;
      case 'checkbox':
        return <CheckboxField {...commonProps} />;
      case 'radio':
        return <RadioField {...commonProps} />;
      case 'toggle-switch':
        return <ToggleSwitchField {...commonProps} />;
      case 'date':
        return <DateField {...commonProps} />;
      case 'time':
        return <TimeField {...commonProps} />;
      case 'datetime':
        return <DateTimeField {...commonProps} />;
      case 'file':
        return <FileField {...commonProps} />;
      case 'image':
        return <ImageField {...commonProps} />;
      case 'url':
        return <UrlField {...commonProps} />;
      case 'phone':
        return <PhoneField {...commonProps} />;
      case 'address':
        return <AddressField {...commonProps} />;
      case 'currency':
        return <CurrencyField {...commonProps} />;
      case 'rating':
        return <RatingField {...commonProps} />;
      case 'slider':
        return <SliderField {...commonProps} />;
      case 'color':
        return <ColorField {...commonProps} />;
      case 'signature':
        return <SignatureField {...commonProps} />;
      case 'tags':
        return <TagsField {...commonProps} />;
      case 'lookup':
        return <LookupField {...commonProps} />;
      case 'calculated':
        return <CalculatedField {...commonProps} />;
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
      case 'barcode':
        return <BarcodeField {...commonProps} />;
      case 'user-picker':
        return <UserPickerField {...commonProps} />;
      case 'geo-location':
        return <GeoLocationField {...commonProps} />;
      case 'workflow-trigger':
        return <WorkflowTriggerField {...commonProps} />;
      case 'matrix-grid':
        return <MatrixGridField {...commonProps} />;
      case 'record-table':
        return <RecordTableField {...commonProps} />;
      case 'cross-reference':
        return <CrossReferenceField {...commonProps} />;
      case 'dynamic-dropdown':
        return <DynamicDropdownField {...commonProps} />;
      case 'conditional-section':
        return <ConditionalSectionField {...commonProps} />;
      case 'ip-address':
        return <IpAddressField {...commonProps} />;
      case 'full-width-container':
        return <FullWidthContainerField {...commonProps} />;
      case 'country':
        return <CountryField {...commonProps} />;
      case 'submission-access':
        return <SubmissionAccessField {...commonProps} />;
      case 'approval':
        return <ApprovalField {...commonProps} {...approvalProps} />;
      default:
        return (
          <div className="p-4 border border-dashed border-gray-300 rounded-lg">
            <p className="text-sm text-gray-500">
              Unsupported field type: {field.type}
            </p>
          </div>
        );
    }
  };

  const getColumnClass = () => {
    switch (columns) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-1 md:grid-cols-2';
      case 3:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      default:
        return 'grid-cols-1';
    }
  };

  const fullWidthFields = fields.filter(field => 
    field.isFullWidth || 
    ['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'record-table', 'matrix-grid', 'cross-reference', 'full-width-container'].includes(field.type)
  );

  const regularFields = fields.filter(field => 
    !field.isFullWidth && 
    !['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'record-table', 'matrix-grid', 'cross-reference', 'full-width-container'].includes(field.type)
  );

  return (
    <div className="space-y-6">
      {/* Full-width fields */}
      {fullWidthFields.map((field) => (
        <div key={field.id} className="w-full">
          {renderField(field)}
        </div>
      ))}

      {/* Regular fields in grid */}
      {regularFields.length > 0 && (
        <div className={`grid gap-6 ${getColumnClass()}`}>
          {regularFields.map((field) => (
            <div key={field.id}>
              {renderField(field)}
            </div>
          ))}
        </div>
      )}

      {/* Submit button */}
      {showButtons && (
        <div className="flex justify-end pt-6">
          <Button 
            onClick={onSubmit} 
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
