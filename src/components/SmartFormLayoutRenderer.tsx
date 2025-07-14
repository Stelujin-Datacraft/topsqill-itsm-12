
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { FormField, Form } from '@/types/form';

interface SmartFormLayoutRendererProps {
  form: Form;
  onSubmit: (formData: Record<string, any>) => void;
  isSubmitting?: boolean;
}

export function SmartFormLayoutRenderer({ 
  form, 
  onSubmit,
  isSubmitting = false 
}: SmartFormLayoutRendererProps) {
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

  if (!form) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Form Not Found</h2>
        <p className="text-muted-foreground">The form you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{form.name}</CardTitle>
              {form.description && (
                <p className="text-muted-foreground mt-2">{form.description}</p>
              )}
            </div>
            <Badge variant="outline">{form.status}</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Form Fields - High Priority */}
      <Card>
        <CardHeader>
          <CardTitle>High Priority Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <FormFieldsRenderer
            fields={form.fields.filter(field => field.required)}
            formData={formData}
            errors={errors}
            fieldStates={fieldStates}
            columns={1}
            onFieldChange={handleFieldChange}
            onSubmit={onSubmit}
            showButtons={false}
          />
        </CardContent>
      </Card>

      {/* Form Fields - Standard */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <FormFieldsRenderer
            fields={form.fields.filter(field => !field.required)}
            formData={formData}
            errors={errors}
            fieldStates={fieldStates}
            columns={1}
            onFieldChange={handleFieldChange}
            onSubmit={onSubmit}
            showButtons={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
