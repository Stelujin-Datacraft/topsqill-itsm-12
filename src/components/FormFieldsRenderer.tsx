
import React from 'react';
import { FormField } from '@/types/form';
import { ApprovalField } from './form-fields/ApprovalField';
import { CrossReferenceField } from './form-fields/CrossReferenceField';
import { SubmissionAccessField } from './form-fields/SubmissionAccessField';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

interface FormFieldsRendererProps {
  fields: FormField[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  fieldStates: Record<string, any>;
  columns: 1 | 2 | 3;
  onFieldChange: (fieldId: string, value: any) => void;
  onSubmit: (formData: Record<string, any>) => void;
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
      case 'cross-reference':
        return <CrossReferenceField {...commonProps} />;
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
    ['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'record-table', 'matrix-grid', 'cross-reference', 'full-width-container', 'approval'].includes(field.type)
  );

  const regularFields = fields.filter(field => 
    !field.isFullWidth && 
    !['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'record-table', 'matrix-grid', 'cross-reference', 'full-width-container', 'approval'].includes(field.type)
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
            onClick={() => onSubmit(formData)} 
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
