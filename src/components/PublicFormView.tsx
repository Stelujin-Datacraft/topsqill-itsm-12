
import React from 'react';
import { Form } from '@/types/form';
import { FormViewLayoutRenderer } from './FormViewLayoutRenderer';

interface PublicFormViewProps {
  form: Form;
  onSubmit: (formData: Record<string, any>) => void;
  showNavigation?: boolean;
}

export function PublicFormView({ form, onSubmit, showNavigation = true }: PublicFormViewProps) {
  return (
    <FormViewLayoutRenderer
      form={form}
      onSubmit={onSubmit}
      showNavigation={showNavigation}
      showPublicHeader={false}
    />
  );
}
