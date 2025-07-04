
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/types/form';

interface SingleLineTextFieldProps {
  field: FormField;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function SingleLineTextField({ 
  field, 
  value = '', 
  onChange, 
  error, 
  disabled = false 
}: SingleLineTextFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <Input
        id={field.id}
        name={field.id}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled || !field.isEnabled}
        required={field.required}
        className={error ? 'border-red-500' : ''}
        minLength={field.validation?.min}
        maxLength={field.validation?.max}
        pattern={field.validation?.pattern}
      />
      
      {field.tooltip && (
        <p className="text-xs text-muted-foreground">{field.tooltip}</p>
      )}
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
