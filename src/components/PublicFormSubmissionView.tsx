import React, { useState, useEffect } from 'react';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { Form } from '@/types/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { UserRoleAssignmentService } from '@/services/userRoleAssignmentService';

interface PublicFormSubmissionViewProps {
  form: Form;
  onSubmit: (formData: Record<string, any>) => Promise<void>;
}

export function PublicFormSubmissionView({ form, onSubmit }: PublicFormSubmissionViewProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [fieldStates, setFieldStates] = useState<Record<string, any>>({});

  // Initialize field states
  useEffect(() => {
    const initialStates: Record<string, any> = {};
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

  const handleSave = async (formDataToSave: Record<string, any>) => {
    try {
      // Save form data to local storage for draft saving
      localStorage.setItem(`form-draft-${form.id}`, JSON.stringify(formDataToSave));
      toast.success('Form saved as draft');
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

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
      
      // Process user role assignments from user-picker fields
      await UserRoleAssignmentService.processFormSubmissionRoleAssignments(
        form.id, 
        submissionData, 
        'current-user-id' // This should be the actual user ID
      );
      
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      // Handle submission error
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-600 mb-2">Form Submitted Successfully!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for your submission. We'll get back to you soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{form.name}</CardTitle>
            {form.description && (
              <p className="text-muted-foreground">{form.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <FormFieldsRenderer
              fields={form.fields}
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
