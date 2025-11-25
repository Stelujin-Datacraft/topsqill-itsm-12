import React, { createContext, useContext, ReactNode } from 'react';
import { Form, FormField, FormPage } from '@/types/form';
import { useFormSnapshot, FormSnapshot } from '../hooks/useFormSnapshot';

interface FormSnapshotContextType {
  snapshot: FormSnapshot;
  initializeSnapshot: (form: Form | null) => void;
  updateFormDetails: (updates: Partial<Form>) => void;
  addFieldToSnapshot: (field: Omit<FormField, 'id'>, pageId: string) => FormField;
  updateFieldInSnapshot: (fieldId: string, updates: Partial<FormField>) => void;
  deleteFieldFromSnapshot: (fieldId: string) => void;
  reorderFieldsInSnapshot: (pageId: string, sourceIndex: number, destinationIndex: number) => void;
  addPageToSnapshot: (page: FormPage) => void;
  updatePageInSnapshot: (pageId: string, updates: Partial<FormPage>) => void;
  deletePageFromSnapshot: (pageId: string) => void;
  markAsSaved: () => void;
  resetSnapshot: () => void;
  clearLocalStorage: (formId: string) => void;
}

const FormSnapshotContext = createContext<FormSnapshotContextType | null>(null);

interface FormSnapshotProviderProps {
  children: ReactNode;
  initialForm: Form | null;
}

export function FormSnapshotProvider({ children, initialForm }: FormSnapshotProviderProps) {
  const snapshotHook = useFormSnapshot(initialForm);

  return (
    <FormSnapshotContext.Provider value={snapshotHook}>
      {children}
    </FormSnapshotContext.Provider>
  );
}

export function useFormSnapshotContext() {
  const context = useContext(FormSnapshotContext);
  if (!context) {
    throw new Error('useFormSnapshotContext must be used within a FormSnapshotProvider');
  }
  return context;
}