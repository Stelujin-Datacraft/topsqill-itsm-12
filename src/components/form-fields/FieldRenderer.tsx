
import React from 'react';
import { FormField } from '@/types/form';
import { TextField } from './TextField';
import { TextareaField } from './TextareaField';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';
import { MultiSelectField } from './MultiSelectField';
import { CheckboxField } from './CheckboxField';
import { RadioField } from './RadioField';
import { DateField } from './DateField';
import { TimeField } from './TimeField';
import { DateTimeField } from './DateTimeField';
import { FileField } from './FileField';
import { ImageField } from './ImageField';
import { EmailField } from './EmailField';
import { PasswordField } from './PasswordField';
import { UrlField } from './UrlField';
import { PhoneField } from './PhoneField';
import { ToggleSwitchField } from './ToggleSwitchField';
import { SliderField } from './SliderField';
import { RatingField } from './RatingField';
import { ColorField } from './ColorField';
import { AddressField } from './AddressField';
import { CurrencyField } from './CurrencyField';
import { SignatureField } from './SignatureField';
import { TagsField } from './TagsField';
import { LookupField } from './LookupField';
import { CalculatedField } from './CalculatedField';
import { HeaderField } from './HeaderField';
import { DescriptionField } from './DescriptionField';
import { SectionBreakField } from './SectionBreakField';
import { HorizontalLineField } from './HorizontalLineField';
import { RichTextField } from './RichTextField';
import { BarcodeField } from './BarcodeField';
import { UserPickerField } from './UserPickerField';
import { GeoLocationField } from './GeoLocationField';
import { WorkflowTriggerField } from './WorkflowTriggerField';
import { MatrixGridField } from './MatrixGridField';
import { RecordTableField } from './RecordTableField';
import { CrossReferenceField } from './CrossReferenceField';
import { ChildCrossReferenceField } from './ChildCrossReferenceField';
import { DynamicDropdownField } from './DynamicDropdownField';
import { ConditionalSectionField } from './ConditionalSectionField';
import { IpAddressField } from './IpAddressField';
import { FullWidthContainerField } from './FullWidthContainerField';
import { CountryField } from './CountryField';
import { SubmissionAccessField } from './SubmissionAccessField';
import { ApprovalField } from './ApprovalField';

interface FieldRendererProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  onFieldUpdate?: (fieldId: string, updates: Partial<FormField>) => void;
  isPreview?: boolean;
  error?: string;
  disabled?: boolean;
  currentFormId?: string;
  onCrossReferenceSync?: (options: any) => Promise<void>;
}

export function FieldRenderer({
  field,
  value,
  onChange,
  onFieldUpdate,
  isPreview = false,
  error,
  disabled = false,
  currentFormId,
  onCrossReferenceSync
}: FieldRendererProps) {
  const commonProps = {
    field,
    value,
    onChange,
    onFieldUpdate,
    isPreview,
    error,
    disabled,
    currentFormId
  };

  switch (field.type) {
    case 'text':
      return <TextField {...commonProps} />;
    case 'textarea':
      return <TextareaField {...commonProps} />;
    case 'number':
      return <NumberField {...commonProps} />;
    case 'email':
      return <EmailField {...commonProps} />;
    case 'password':
      return <PasswordField {...commonProps} />;
    case 'url':
      return <UrlField {...commonProps} />;
    case 'phone':
      return <PhoneField {...commonProps} />;
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
    case 'slider':
      return <SliderField {...commonProps} />;
    case 'rating':
      return <RatingField {...commonProps} />;
    case 'file':
      return <FileField {...commonProps} />;
    case 'image':
      return <ImageField {...commonProps} />;
    case 'color':
      return <ColorField {...commonProps} />;
    case 'address':
      return <AddressField {...commonProps} />;
    case 'currency':
      return <CurrencyField {...commonProps} />;
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
      return <CrossReferenceField {...commonProps} onCrossReferenceSync={onCrossReferenceSync} />;
    case 'child-cross-reference':
      return <ChildCrossReferenceField {...commonProps} />;
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
      return <ApprovalField {...commonProps} />;
    default:
      return (
        <div className="p-4 border border-red-200 rounded bg-red-50">
          <p className="text-red-600">Unknown field type: {field.type}</p>
        </div>
      );
  }
}
