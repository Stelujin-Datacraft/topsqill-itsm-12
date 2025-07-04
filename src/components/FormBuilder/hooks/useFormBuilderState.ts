
import { useState, useEffect } from 'react';
import { Form } from '@/types/form';

export function useFormBuilderState(currentForm: Form | null, formId?: string) {
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<Form['status']>('draft');
  const [selectedField, setSelectedField] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(!formId);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [columnLayout, setColumnLayout] = useState<1 | 2 | 3>(1);
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const [showNavigation, setShowNavigation] = useState(true);
  const [showFieldProperties, setShowFieldProperties] = useState(false);
  const [fieldTypeSearch, setFieldTypeSearch] = useState('');
  const [savingFieldConfig, setSavingFieldConfig] = useState<string | null>(null);

  useEffect(() => {
    if (currentForm) {
      console.log('Loading existing form:', currentForm);
      setFormName(currentForm.name);
      setFormDescription(currentForm.description);
      setFormStatus(currentForm.status);
      setColumnLayout((currentForm.layout?.columns as 1 | 2 | 3) || 1);
      setIsCreating(false);
    } else if (!formId) {
      setFormName('');
      setFormDescription('');
      setFormStatus('draft');
      setColumnLayout(1);
      setIsCreating(true);
    }
  }, [currentForm, formId]);

  return {
    formName,
    setFormName,
    formDescription,
    setFormDescription,
    formStatus,
    setFormStatus,
    selectedField,
    setSelectedField,
    isCreating,
    setIsCreating,
    isSaving,
    setIsSaving,
    isPublishing,
    setIsPublishing,
    currentPageId,
    setCurrentPageId,
    columnLayout,
    setColumnLayout,
    highlightedFieldId,
    setHighlightedFieldId,
    showNavigation,
    setShowNavigation,
    showFieldProperties,
    setShowFieldProperties,
    fieldTypeSearch,
    setFieldTypeSearch,
    savingFieldConfig,
    setSavingFieldConfig,
  };
}
