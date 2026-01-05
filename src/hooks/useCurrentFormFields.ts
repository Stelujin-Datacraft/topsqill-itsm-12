import { useMemo, useContext, createContext } from 'react';
import { useFormsData } from '@/hooks/useFormsData';
import { useParams } from 'react-router-dom';
import { Form } from '@/types/form';

// Optional context for passing working form from Form Builder
interface WorkingFormContextType {
  workingForm: Form | null;
}

const WorkingFormContext = createContext<WorkingFormContextType | null>(null);

export const WorkingFormProvider = WorkingFormContext.Provider;

export function useCurrentFormFields() {
  const { forms } = useFormsData();
  const { id: formId } = useParams();
  const workingFormContext = useContext(WorkingFormContext);
  
  // Prefer working form from context (snapshot/draft) over database form
  const currentForm = useMemo(() => {
    // If we have a working form from context (Form Builder snapshot), use it
    if (workingFormContext?.workingForm) {
      return workingFormContext.workingForm;
    }
    // Otherwise fall back to the database form
    return formId ? forms.find(f => f.id === formId) : null;
  }, [workingFormContext?.workingForm, formId, forms]);

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
