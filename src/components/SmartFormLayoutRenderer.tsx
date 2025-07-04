import React from 'react';
import { FormField } from '@/types/form';
import { FormFieldsRenderer } from './FormFieldsRenderer';

interface SmartFormLayoutRendererProps {
  fields: FormField[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  fieldStates: Record<string, {
    isVisible: boolean;
    isEnabled: boolean;
    label: string;
    options?: any[];
    tooltip?: string;
    errorMessage?: string;
  }>;
  columns: 1 | 2 | 3;
  onFieldChange: (fieldId: string, value: any) => void;
  onSubmit: (formData: Record<string, any>) => void;
  onSave?: (formData: Record<string, any>) => void;
  showButtons?: boolean;
}

export function SmartFormLayoutRenderer({
  fields,
  formData,
  errors,
  fieldStates,
  columns,
  onFieldChange,
  onSubmit,
  onSave,
  showButtons = true,
}: SmartFormLayoutRendererProps) {
  // Check if field is full-width based on type or explicit setting
  const isFullWidthField = (field: FormField) => {
    const fullWidthTypes = [
      'header', 
      'description', 
      'section-break', 
      'horizontal-line', 
      'rich-text', 
      'record-table', 
      'matrix-grid',
      'full-width-container'
    ];
    return fullWidthTypes.includes(field.type) || field.isFullWidth || field.fieldCategory === 'full-width';
  };

  // Enhanced field rendering logic for proper layout handling
  const renderFieldsWithSmartLayout = () => {
    const renderedElements: React.ReactNode[] = [];
    let standardFieldsBuffer: FormField[] = [];
    let elementIndex = 0;

    // Flush standard fields into a proper grid
    const flushStandardFields = () => {
      if (standardFieldsBuffer.length > 0) {
        const gridCols = columns === 1 ? 'grid-cols-1' : 
                        columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
        
        
        
        renderedElements.push(
          <div key={`standard-grid-${elementIndex++}`} className={`grid ${gridCols} gap-6`}>
            {standardFieldsBuffer.map(field => (
              <div key={field.id} className="space-y-2">
                <FormFieldsRenderer
                  fields={[field]}
                  formData={formData}
                  errors={errors}
                  fieldStates={fieldStates}
                  columns={1}
                  onFieldChange={onFieldChange}
                  onSubmit={onSubmit}
                  onSave={onSave}
                  showButtons={false}
                />
              </div>
            ))}
          </div>
        );
        standardFieldsBuffer = [];
      }
    };

    // Process each field with smart layout logic
    fields.forEach((field) => {
      const fieldState = fieldStates[field.id];
      const isVisible = fieldState?.isVisible ?? field.isVisible ?? true;

      if (!isVisible) return;

      if (isFullWidthField(field)) {
        // Flush any buffered standard fields first
        flushStandardFields();
        
        // Render full-width field in its own container
        renderedElements.push(
          <div key={`fullwidth-${field.id}`} className="w-full">
            <FormFieldsRenderer
              fields={[field]}
              formData={formData}
              errors={errors}
              fieldStates={fieldStates}
              columns={1}
              onFieldChange={onFieldChange}
              onSubmit={onSubmit}
              onSave={onSave}
              showButtons={false}
            />
          </div>
        );
      } else {
        // Buffer standard field for grid layout
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
      {showButtons && (
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6">
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(formData)}
              className="px-6 py-2 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors duration-200"
            >
              Save Draft
            </button>
          )}
          <button
            type="button"
            onClick={() => onSubmit(formData)}
            className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors duration-200"
          >
            Submit Form
          </button>
        </div>
      )}
    </div>
  );
}