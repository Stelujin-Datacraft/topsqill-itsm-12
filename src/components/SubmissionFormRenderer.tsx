import React from 'react';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { Form, FormField } from '@/types/form';

interface SubmissionFormRendererProps {
  form: Form;
  formData: Record<string, any>;
  fieldStates: Record<string, any>;
  currentPageId: string;
  onFieldChange: (fieldId: string, value: any) => void;
  onSubmit: (formData: Record<string, any>) => void;
  formId?: string;
  currentSubmissionId?: string;
}

export function SubmissionFormRenderer({
  form,
  formData,
  fieldStates,
  currentPageId,
  onFieldChange,
  onSubmit,
  formId,
  currentSubmissionId
}: SubmissionFormRendererProps) {
  // Get fields for current page
  const pages = form.pages && form.pages.length > 0 
    ? form.pages 
    : [{ id: 'default', name: 'Form', order: 0, fields: form.fields.map(f => f.id) }];
  
  const currentPage = pages.find(p => p.id === currentPageId);
  const pageFields = currentPage 
    ? form.fields.filter(f => currentPage.fields.includes(f.id))
    : form.fields;

  // Separate full-width fields from regular fields
  const fullWidthTypes = ['header', 'description', 'section-break', 'horizontal-line', 'full-width-container'];
  const regularFields = pageFields.filter(field => !fullWidthTypes.includes(field.type));
  const fullWidthFields = pageFields.filter(field => fullWidthTypes.includes(field.type));

  // Create a mixed array maintaining original order
  const mixedFields: Array<{ type: 'regular' | 'fullwidth', fields: FormField[] }> = [];
  let regularIndex = 0;
  let fullWidthIndex = 0;

  // Process fields in original order
  pageFields.forEach(field => {
    if (fullWidthTypes.includes(field.type)) {
      // Add any pending regular fields first
      if (regularIndex < regularFields.length) {
        const pendingRegularFields = [];
        while (regularIndex < regularFields.length && regularFields[regularIndex] !== field) {
          if (regularFields[regularIndex]) {
            pendingRegularFields.push(regularFields[regularIndex]);
          }
          regularIndex++;
        }
        if (pendingRegularFields.length > 0) {
          mixedFields.push({ type: 'regular', fields: pendingRegularFields });
        }
      }
      
      // Add the full-width field
      mixedFields.push({ type: 'fullwidth', fields: [field] });
      fullWidthIndex++;
    }
  });

  // Add any remaining regular fields
  const remainingRegularFields = regularFields.slice(regularIndex);
  if (remainingRegularFields.length > 0) {
    mixedFields.push({ type: 'regular', fields: remainingRegularFields });
  }

  return (
    <div className="space-y-6">
      {mixedFields.map((section, index) => (
        <div key={index}>
          {section.type === 'regular' ? (
            // Regular fields in grid layout
            <div className={`grid gap-6 ${
              (form.layout?.columns as number) === 1 ? 'grid-cols-1' : 
              (form.layout?.columns as number) === 2 ? 'grid-cols-1 md:grid-cols-2' : 
              'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {section.fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <FormFieldsRenderer
                    fields={[field]}
                    formData={formData}
                    errors={{}}
                    fieldStates={fieldStates}
                    columns={1}
                    onFieldChange={onFieldChange}
                    onSubmit={onSubmit}
                    showButtons={false}
                    formId={formId}
                    currentSubmissionId={currentSubmissionId}
                  />
                </div>
              ))}
            </div>
          ) : (
            // Full-width fields
            <div className="w-full">
              <FormFieldsRenderer
                fields={section.fields}
                formData={formData}
                errors={{}}
                fieldStates={fieldStates}
                columns={1}
                onFieldChange={onFieldChange}
                onSubmit={onSubmit}
                showButtons={false}
                formId={formId}
                currentSubmissionId={currentSubmissionId}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}