
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@/contexts/FormContext';

interface FormSelectorProps {
  value?: string;
  onValueChange: (formId: string, formName: string) => void;
  placeholder?: string;
}

export function FormSelector({ value, onValueChange, placeholder = "Select a form" }: FormSelectorProps) {
  const { forms } = useForm();
  const [selectedForm, setSelectedForm] = useState(value);

  useEffect(() => {
    setSelectedForm(value);
  }, [value]);

  const handleValueChange = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setSelectedForm(formId);
      onValueChange(formId, form.name);
    }
  };

  return (
    <Select value={selectedForm} onValueChange={handleValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {forms.map((form) => (
          <SelectItem key={form.id} value={form.id}>
            {form.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
