
import React from 'react';
import { FormField } from '@/types/form';
import { TagsField as BaseTagsField } from '../TagsField';

interface TagsFieldProps {
  field: FormField;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  disabled?: boolean;
}

export function TagsField({ field, value, onChange, error, disabled }: TagsFieldProps) {
  return (
    <BaseTagsField
      field={field}
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
    />
  );
}
