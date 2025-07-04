
import React from 'react';
import { EnhancedFormAccessManager } from './EnhancedFormAccessManager';

interface FormAccessManagerProps {
  formId: string;
  formName: string;
}

export function FormAccessManager({ formId, formName }: FormAccessManagerProps) {
  return <EnhancedFormAccessManager formId={formId} formName={formName} />;
}
