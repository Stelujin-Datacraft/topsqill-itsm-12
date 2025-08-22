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
  // Get fields for current page, maintaining their original order
  const pages = form.pages && form.pages.length > 0 
    ? form.pages 
    : [{ id: 'default', name: 'Form', order: 0, fields: form.fields.map(f => f.id) }];
  
  const currentPage = pages.find(p => p.id === currentPageId);
  const pageFields = currentPage 
    ? form.fields
        .filter(f => currentPage.fields.includes(f.id))
        .sort((a, b) => {
          const aIndex = currentPage.fields.indexOf(a.id);
          const bIndex = currentPage.fields.indexOf(b.id);
          return aIndex - bIndex;
        })
    : form.fields;

  // Define full-width field types
  const fullWidthTypes = ['header', 'description', 'section-break', 'horizontal-line', 'full-width-container'];
  
  // Smart field rendering that preserves order and handles layouts correctly
  const renderFieldsWithSmartLayout = () => {
    const renderedElements: JSX.Element[] = [];
    let standardFieldsBuffer: FormField[] = [];
    
    const flushStandardFields = () => {
      if (standardFieldsBuffer.length > 0) {
        const columns = (form.layout?.columns as 1 | 2 | 3) || 1;
        renderedElements.push(
          <div key={`grid-${renderedElements.length}`} className={`grid gap-6 ${
            columns === 1 ? 'grid-cols-1' : 
            columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {standardFieldsBuffer.map((field) => (
              <div key={field.id} id={`field-${field.id}`} data-field-id={field.id} className="space-y-2">
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
        );
        standardFieldsBuffer = [];
      }
    };

    // Process fields in their original order
    pageFields.forEach((field) => {
      if (fullWidthTypes.includes(field.type)) {
        // Flush any accumulated standard fields first
        flushStandardFields();
        
        // Render full-width field immediately
        renderedElements.push(
          <div key={field.id} id={`field-${field.id}`} data-field-id={field.id} className="w-full">
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
        );
      } else {
        // Accumulate standard fields for grid rendering
        standardFieldsBuffer.push(field);
      }
    });

    // Flush any remaining standard fields
    flushStandardFields();

    return renderedElements;
  };

  return (
    <div className="space-y-8">
      {renderFieldsWithSmartLayout()}
    </div>
  );
}