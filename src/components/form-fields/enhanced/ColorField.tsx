
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ColorFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function ColorField({ field, value, onChange, error, disabled }: ColorFieldProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="flex items-center gap-2">
        <input
          type="color"
          id={field.id}
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-12 h-10 border border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed"
        />
        
        {config.showInput !== false && (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || '#000000'}
            disabled={disabled}
            className={`flex-1 ${error ? 'border-red-500' : ''}`}
          />
        )}
        
        {config.showPreview !== false && (
          <div
            className="w-10 h-10 border border-gray-300 rounded"
            style={{ backgroundColor: value || '#000000' }}
          />
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
