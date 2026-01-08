
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

  // Initialize field states and default values for boolean fields
  useEffect(() => {
    if (!form) return;

    const states: Record<string, any> = {};
    const initialFormData: Record<string, any> = {};
    
    form.fields.forEach(field => {
      // Check if field is read-only from customConfig
      const isReadOnly = field.customConfig?.readOnly === true;
      
      states[field.id] = {
        isVisible: field.isVisible !== false,
        isEnabled: isReadOnly ? false : (field.isEnabled !== false),
        label: field.label,
        options: field.options,
        tooltip: field.tooltip,
        errorMessage: field.errorMessage,
      };
      
      // Initialize boolean fields (checkbox, toggle, yes-no) with their default value
      const booleanFieldTypes = ['checkbox', 'toggle-switch', 'toggle', 'yes-no', 'boolean'];
      if (booleanFieldTypes.includes(field.type?.toLowerCase() || '')) {
        // For boolean fields, explicitly check for true/false values
        if (field.defaultValue === true || field.defaultValue === 'true') {
          initialFormData[field.id] = true;
        } else {
          initialFormData[field.id] = false;
        }
      } else if (field.type?.toLowerCase() === 'slider') {
        // Slider uses customConfig for min value as default
        const sliderMin = field.customConfig?.min ?? 0;
        initialFormData[field.id] = field.defaultValue !== undefined && field.defaultValue !== '' 
          ? Number(field.defaultValue) 
          : sliderMin;
      } else if (field.defaultValue !== undefined && field.defaultValue !== '') {
        // Apply default value for other field types
        initialFormData[field.id] = field.defaultValue;
      }
    });
    
    setFieldStates(states);
    // Only set initial form data if formData is empty to avoid overwriting user input
    setFormData(prev => {
      const merged = { ...initialFormData };
      // Preserve any existing values
      Object.keys(prev).forEach(key => {
        if (prev[key] !== undefined) {
          merged[key] = prev[key];
        }
      });
      return merged;
    });
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
            formId={form.id}
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
            formId={form.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
