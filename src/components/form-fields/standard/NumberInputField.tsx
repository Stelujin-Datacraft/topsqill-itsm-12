
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/types/form';

interface NumberInputFieldProps {
  field: FormField;
  value?: number | string;
  onChange?: (value: number | string) => void;
  error?: string;
  disabled?: boolean;
}

export function NumberInputField({ 
  field, 
  value = '', 
  onChange, 
  error, 
  disabled = false 
}: NumberInputFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <Input
        id={field.id}
        name={field.id}
        type="number"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled || !field.isEnabled}
        required={field.required}
        className={error ? 'border-red-500' : ''}
        min={field.validation?.min}
        max={field.validation?.max}
        step={field.customConfig?.step || 1}
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
