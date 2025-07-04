
import React from 'react';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { Form } from '@/types/form';

interface FormSubmissionViewProps {
  form: Form;
  onSubmit: (formData: Record<string, any>) => Promise<void>;
}

export function FormSubmissionView({ form, onSubmit }: FormSubmissionViewProps) {
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [fieldStates, setFieldStates] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    // Initialize field states
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
  }, [form.fields]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (submissionData: Record<string, any>) => {
    await onSubmit(submissionData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{form.name}</h2>
        <p className="text-muted-foreground">{form.description}</p>
      </div>
      
      <FormFieldsRenderer
        fields={form.fields}
        formData={formData}
        errors={{}}
        fieldStates={fieldStates}
        columns={form.layout?.columns as number || 1}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
