
import React from 'react';
import { FormField } from '@/types/form';

interface HorizontalLineFieldProps {
  field: FormField;
  value?: string;
  onChange?: (value: string) => void;
  isPreview?: boolean;
}

export function HorizontalLineField({ field, value, onChange, isPreview }: HorizontalLineFieldProps) {
  const lineStyle = field.customConfig?.lineStyle || 'solid';
  const lineColor = field.customConfig?.lineColor || 'border-border';
  
  return (
    <div className="w-full py-4">
      <hr className={`w-full ${lineColor} ${
        lineStyle === 'dashed' ? 'border-dashed' : 
        lineStyle === 'dotted' ? 'border-dotted' : 'border-solid'
      }`} />
      {field.label && field.label.trim() && (
        <div className="text-center text-sm text-muted-foreground mt-2">
          {field.label}
        </div>
      )}
    </div>
  );
}
