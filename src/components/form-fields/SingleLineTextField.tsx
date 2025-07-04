
import React from 'react';
import { FormField } from '@/types/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SingleLineTextFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function SingleLineTextField({ field, value, onChange, error, disabled = false }: SingleLineTextFieldProps) {
  const minLength = field.validation?.minLength;
  const maxLength = field.validation?.maxLength;
  const pattern = field.validation?.pattern;
  const autoTrim = field.customConfig?.autoTrim || false;
  const readOnly = field.customConfig?.readOnly || false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    if (autoTrim) {
      newValue = newValue.trim();
    }
    
    if (maxLength && newValue.length > maxLength) {
      newValue = newValue.substring(0, maxLength);
    }
    
    onChange(newValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (autoTrim && value !== value.trim()) {
      onChange(value.trim());
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
        {maxLength && (
          <span className="text-xs text-gray-500 ml-2">
            ({value.length}/{maxLength})
          </span>
        )}
      </Label>
      <Input
        id={field.id}
        name={field.id}
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        required={field.required}
        disabled={disabled || readOnly}
        placeholder={field.placeholder}
        className={error ? 'border-red-500' : ''}
      />
      {field.tooltip && (
        <p className="text-xs text-gray-500">{field.tooltip}</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
