import React, { useState, useEffect } from 'react';
import { SmartFormLayoutRenderer } from './SmartFormLayoutRenderer';
import { Form, FormField } from '@/types/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Save } from 'lucide-react';
import { FormNavigationPanel } from './FormNavigationPanel';
import { FormPagination } from './FormPagination';
import { toast } from 'sonner';

interface PublicFormViewProps {
  form: Form;
  onSubmit: (formData: Record<string, any>) => void;
  showNavigation?: boolean;
}

export function PublicFormView({ form, onSubmit, showNavigation = true }: PublicFormViewProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [fieldStates, setFieldStates] = useState<Record<string, any>>({});
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const [navigationVisible, setNavigationVisible] = useState(showNavigation);

  // Initialize pages with proper type checking
  const pages = Array.isArray(form.pages) && form.pages.length > 0 
    ? form.pages 
    : [{ id: 'default', name: 'Page 1', order: 0, fields: form.fields?.map(f => f.id) || [] }];

  useEffect(() => {
    if (pages.length > 0 && !currentPageId) {
      setCurrentPageId(pages[0].id);
    }
    
    console.log("---------------------------------------------------------------------------------------------------------------")
    console.log(form)
        console.log("---------------------------------------------------------------------------------------------------------------")
  }, [pages, currentPageId]);

  // Initialize field states
  useEffect(() => {
    const initialStates: Record<string, any> = {};
    if (Array.isArray(form.fields)) {
      form.fields.forEach(field => {
        initialStates[field.id] = {
          isVisible: field.isVisible ?? true,
          isEnabled: field.isEnabled ?? true,
          label: field.label,
          options: field.options,
          tooltip: field.tooltip,
          errorMessage: field.errorMessage,
        };
      });
    }
    setFieldStates(initialStates);
  }, [form.fields]);


  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));

    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (Array.isArray(form.fields)) {
      form.fields.forEach(field => {
      const value = formData[field.id];
      const fieldState = fieldStates[field.id];

      // Skip validation if field is not visible or not enabled
      if (!fieldState?.isVisible || !fieldState?.isEnabled) {
        return;
      }

      // Required field validation
      if (field.required && (!value || value === '')) {
        newErrors[field.id] = `${field.label} is required`;
      }

      // Email validation
      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.id] = 'Please enter a valid email address';
        }
      }

      // Number validation
      if (field.type === 'number' && value !== undefined && value !== '') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          newErrors[field.id] = 'Please enter a valid number';
        } else if (field.validation) {
          if (field.validation.min !== undefined && numValue < field.validation.min) {
            newErrors[field.id] = `Value must be at least ${field.validation.min}`;
          }
          if (field.validation.max !== undefined && numValue > field.validation.max) {
            newErrors[field.id] = `Value must be at most ${field.validation.max}`;
          }
        }
      }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = async (submissionData: Record<string, any>) => {
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(submissionData);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      // Handle submission error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldHighlight = (fieldId: string) => {
    setHighlightedFieldId(fieldId);
    
    // Auto-clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedFieldId(null);
    }, 3000);
  };

  const getCurrentPageFields = () => {
    if (!currentPageId || pages.length === 0) return Array.isArray(form.fields) ? form.fields : [];
    
    const currentPage = pages.find(p => p.id === currentPageId);
    if (!currentPage) return Array.isArray(form.fields) ? form.fields : [];
    
    return Array.isArray(form.fields) ? form.fields.filter(field => currentPage.fields.includes(field.id)) : [];
  };

  const handlePageChange = (pageId: string) => {
    setCurrentPageId(pageId);
  };

  const currentPageIndex = Array.isArray(pages) ? pages.findIndex(p => p.id === currentPageId) : -1;

  const handlePrevious = () => {
    if (currentPageIndex > 0) {
      setCurrentPageId(pages[currentPageIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageId(pages[currentPageIndex + 1].id);
    }
  };

  const handleSave = async (formDataToSave: Record<string, any>) => {
    try {
      // Save form data to local storage or send to server for draft saving
      localStorage.setItem(`form-draft-${form.id}`, JSON.stringify(formDataToSave));
      toast.success('Form saved as draft');
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form');
    }
  };

  // Enhanced field rendering logic for proper layout handling (from FormPreview.tsx)
  const renderFieldsWithSmartLayout = () => {
    const currentFields = getCurrentPageFields();
    const columns = (form.layout?.columns as 1 | 2 | 3) || 1;
    const renderedElements: React.ReactNode[] = [];
    let standardFieldsBuffer: FormField[] = [];
    let elementIndex = 0;

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
                <SmartFormLayoutRenderer
                  fields={[field]}
                  formData={formData}
                  errors={errors}
                  fieldStates={fieldStates}
                  columns={1}
                  onFieldChange={handleFieldChange}
                  onSubmit={handleFormSubmit}
                  onSave={handleSave}
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
    currentFields.forEach((field) => {
      const fieldState = fieldStates[field.id];
      const isVisible = fieldState?.isVisible ?? field.isVisible ?? true;

      if (!isVisible) return;

      if (isFullWidthField(field)) {
        // Flush any buffered standard fields first
        flushStandardFields();
        
        // Render full-width field in its own container
        renderedElements.push(
          <div key={`fullwidth-${field.id}`} className="w-full">
            <SmartFormLayoutRenderer
              fields={[field]}
              formData={formData}
              errors={errors}
              fieldStates={fieldStates}
              columns={1}
              onFieldChange={handleFieldChange}
              onSubmit={handleFormSubmit}
              onSave={handleSave}
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

  if (isSubmitted) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-600 mb-2">Form Submitted Successfully!</h2>
          <p className="text-muted-foreground mb-6">
            Thank you for your submission. We'll get back to you soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (showNavigation) {
    return (
      <div className={`grid gap-6 ${
        navigationVisible 
          ? 'grid-cols-1 lg:grid-cols-4' 
          : 'grid-cols-1'
      }`}>
        {/* Navigation Panel */}
        <div className={navigationVisible ? "lg:col-span-1" : ""}>
          <FormNavigationPanel
            pages={pages}
            fields={Array.isArray(form.fields) ? form.fields : []}
            currentPageId={currentPageId}
            selectedField={selectedField}
            onPageChange={handlePageChange}
            onFieldSelect={setSelectedField}
            onFieldHighlight={handleFieldHighlight}
            onToggleNavigation={() => setNavigationVisible(!navigationVisible)}
            isCollapsed={!navigationVisible}
          />
        </div>
        
        {/* Form Content */}
        <div className={navigationVisible ? "lg:col-span-3" : "lg:col-span-4"}>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{form.name}</CardTitle>
              {form.description && (
                <p className="text-muted-foreground">{form.description}</p>
              )}
            </CardHeader>
            <CardContent>
              {pages.length > 1 && (
                <div className="mb-6">
                  <FormPagination
                    pages={pages}
                    currentPageId={currentPageId}
                    currentPageIndex={currentPageIndex}
                    onPageChange={handlePageChange}
                    onPrevious={handlePrevious}
                    onNext={handleNext}
                  />
                </div>
              )}
              
              <div className="space-y-8">
                {renderFieldsWithSmartLayout()}
                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6">
                  <button
                    type="button"
                    onClick={() => handleSave(formData)}
                    className="px-6 py-2 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors duration-200"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormSubmit(formData)}
                    className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors duration-200"
                  >
                    Submit Form
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{form.name}</CardTitle>
        {form.description && (
          <p className="text-muted-foreground">{form.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {renderFieldsWithSmartLayout()}
          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6">
            <button
              type="button"
              onClick={() => handleSave(formData)}
              className="px-6 py-2 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors duration-200"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleFormSubmit(formData)}
              className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors duration-200"
            >
              Submit Form
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
