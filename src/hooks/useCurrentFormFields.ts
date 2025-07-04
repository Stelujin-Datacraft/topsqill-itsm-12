import { useMemo } from 'react';
import { useFormsData } from '@/hooks/useFormsData';
import { useParams } from 'react-router-dom';

export function useCurrentFormFields() {
  const { forms } = useFormsData();
  const { id: formId } = useParams();
  
  const currentForm = formId ? forms.find(f => f.id === formId) : null;

  const formFieldOptions = useMemo(() => {
    if (!currentForm?.fields) return [];
    
    return currentForm.fields.map((field) => ({
      value: field.id,
      label: `${field.label} (${field.id})`,
      type: field.type
    }));
  }, [currentForm?.fields]);

  return { formFieldOptions, currentForm };
}