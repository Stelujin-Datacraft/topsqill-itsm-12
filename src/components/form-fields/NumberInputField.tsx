
import React from 'react';
import { FormField } from '@/types/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NumberInputFieldProps {
  field: FormField;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
}

export function NumberInputField({ field, value, onChange, error, disabled = false }: NumberInputFieldProps) {
  const min = field.validation?.min;
  const max = field.validation?.max;
  const step = field.customConfig?.step || 1;
  const unit = field.customConfig?.unit || '';
  const precision = field.customConfig?.precision || 0;
  const readOnly = field.customConfig?.readOnly || false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const maxDigits = field.customConfig?.maxDigits;
    
    // Check max digits restriction
    if (maxDigits && inputValue.length > maxDigits) {
      return; // Prevent input beyond max digits
    }
    
    const newValue = parseFloat(inputValue);
    if (!isNaN(newValue)) {
      const rounded = precision > 0 ? parseFloat(newValue.toFixed(precision)) : newValue;
      onChange(rounded);
    } else if (inputValue === '') {
      onChange(0);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={field.id}
          name={field.id}
          type="number"
          value={value || ''}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          required={field.required}
          disabled={disabled || readOnly}
          placeholder={field.placeholder}
          className={`${unit ? 'pr-12' : ''} ${error ? 'border-red-500' : ''}`}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
            {unit}
          </span>
        )}
      </div>
      {field.tooltip && (
        <p className="text-xs text-gray-500">{field.tooltip}</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
