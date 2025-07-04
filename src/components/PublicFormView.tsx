import React, { useState, useEffect } from 'react';
import { FormFieldsRenderer } from './FormFieldsRenderer';
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

  const currentPageIndex = pages.findIndex(p => p.id === currentPageId);

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
              
              <FormFieldsRenderer
                fields={getCurrentPageFields()}
                formData={formData}
                errors={errors}
                fieldStates={fieldStates}
                columns={(form.layout?.columns as number) || 1}
                onFieldChange={handleFieldChange}
                onSubmit={handleFormSubmit}
                onSave={handleSave}
              />
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
        <FormFieldsRenderer
          fields={Array.isArray(form.fields) ? form.fields : []}
          formData={formData}
          errors={errors}
          fieldStates={fieldStates}
          columns={(form.layout?.columns as number) || 1}
          onFieldChange={handleFieldChange}
          onSubmit={handleFormSubmit}
          onSave={handleSave}
        />
      </CardContent>
    </Card>
  );
}
