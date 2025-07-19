
import React from 'react';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { Form } from '@/types/form';
import { toast } from 'sonner';

interface FormViewProps {
  form: Form;
  onSubmit: (formData: Record<string, any>) => void;
}

export function FormView({ form, onSubmit }: FormViewProps) {
  const handleSave = async (formData: Record<string, any>) => {
    try {
      // Save form data to local storage for draft saving
      localStorage.setItem(`form-draft-${form.id}`, JSON.stringify(formData));
      toast.success('Form saved as draft');
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form');
    }
  };

  const handleSubmit = () => {
    onSubmit({});
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{form.name}</h2>
        <p className="text-muted-foreground">{form.description}</p>
      </div>
      
      <FormFieldsRenderer
        fields={form.fields}
        formData={{}}
        errors={{}}
        fieldStates={{}}
        columns={(form.layout?.columns as 1 | 2 | 3) || 1}
        onFieldChange={() => {}}
        onSubmit={handleSubmit}
        formId={form.id}
      />
    </div>
  );
}
