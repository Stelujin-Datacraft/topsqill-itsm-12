import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Users, Eye, Share, Settings, Edit, Save, X, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { FormField, Form } from '@/types/form';

interface FormViewLayoutRendererProps {
  form: Form;
  onSubmit: (formData: Record<string, any>) => void;
  showNavigation?: boolean;
  showPublicHeader?: boolean;
  isSubmitting?: boolean;
}

interface ParsedFieldReference {
  field: FormField;
  referencedField?: FormField;
  sourceType: 'form' | 'submission';
  sourceFormId?: string;
  sourceSubmissionId?: string;
}

export function FormViewLayoutRenderer({ 
  form, 
  onSubmit, 
  showNavigation = false, 
  showPublicHeader = false,
  isSubmitting = false 
}: FormViewLayoutRendererProps) {
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fieldStates, setFieldStates] = useState<Record<string, any>>({});
  
  // Initialize field states
  useEffect(() => {
    if (!form) return;

    const states: Record<string, any> = {};
    form.fields.forEach(field => {
      states[field.id] = {
        isVisible: field.isVisible !== false,
        isEnabled: field.isEnabled !== false,
        isRequired: field.required || false,
        label: field.label,
        options: field.options,
        tooltip: field.tooltip,
        errorMessage: field.errorMessage,
      };
    });
    setFieldStates(states);
  }, [form]);

  const handleFieldChange = (fieldId: string, value: any) => {
    console.log('Field change:', fieldId, value);
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleFormSubmit = async (submissionData: Record<string, any>) => {
    try {
      await onSubmit(submissionData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleSave = async () => {
    console.log('Saving form data:', formData);
  };

  if (!form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Form Not Found</h2>
          <p className="text-muted-foreground">The form you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  // Check if field is full-width based on type or explicit setting
  const isFullWidthField = (field: FormField) => {
    const fullWidthTypes = ['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'record-table', 'cross-reference', 'matrix-grid', 'approval'];
    return fullWidthTypes.includes(field.type) || field.isFullWidth || field.fieldCategory === 'full-width';
  };

  // Render with pages
  if (form.pages && form.pages.length > 1) {
    const sortedPages = [...form.pages].sort((a, b) => a.order - b.order);
    
    return (
      <div className="min-h-screen bg-background">
        {showPublicHeader && (
          <div className="bg-card border-b">
            <div className="container mx-auto px-4 py-6">
              <h1 className="text-3xl font-bold text-foreground">{form.name}</h1>
              {form.description && (
                <p className="text-muted-foreground mt-2">{form.description}</p>
              )}
            </div>
          </div>
        )}
        
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="pt-6">
              <FormFieldsRenderer
                fields={form.fields}
                formData={formData}
                errors={errors}
                fieldStates={fieldStates}
                columns={1}
                onFieldChange={handleFieldChange}
                onSubmit={handleFormSubmit}
                showButtons={false}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render without pages (single page)
  return (
    <div className="min-h-screen bg-background">
      {showPublicHeader && (
        <div className="bg-card border-b">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-foreground">{form.name}</h1>
            {form.description && (
              <p className="text-muted-foreground mt-2">{form.description}</p>
            )}
          </div>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <FormFieldsRenderer
              fields={form.fields}
              formData={formData}
              errors={errors}
              fieldStates={fieldStates}
              columns={1}
              onFieldChange={handleFieldChange}
              onSubmit={handleFormSubmit}
              showButtons={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
