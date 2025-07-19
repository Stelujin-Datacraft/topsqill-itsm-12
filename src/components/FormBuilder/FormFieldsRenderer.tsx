
import React from 'react';
import { FormField } from '@/types/form';
import { FieldRenderer } from '@/components/form-fields/FieldRenderer';
import { useFormSnapshotContext } from './contexts/FormSnapshotContext';

interface FormFieldsRendererProps {
  fields: FormField[];
  values?: Record<string, any>;
  onChange?: (fieldId: string, value: any) => void;
  isPreview?: boolean;
  currentFormId?: string;
}

export function FormFieldsRenderer({ 
  fields, 
  values = {}, 
  onChange, 
  isPreview = false,
  currentFormId 
}: FormFieldsRendererProps) {
  const { updateFieldInSnapshot, syncCrossReferenceField } = useFormSnapshotContext();

  const handleFieldUpdate = (fieldId: string, updates: Partial<FormField>) => {
    console.log('FormFieldsRenderer: Updating field:', fieldId, updates);
    updateFieldInSnapshot(fieldId, updates);
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    console.log('FormFieldsRenderer: Field value changed:', fieldId, value);
    if (onChange) {
      onChange(fieldId, value);
    }
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <FieldRenderer
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(value) => handleFieldChange(field.id, value)}
          onFieldUpdate={handleFieldUpdate}
          isPreview={isPreview}
          currentFormId={currentFormId}
          onCrossReferenceSync={syncCrossReferenceField}
        />
      ))}
    </div>
  );
}
