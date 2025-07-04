
import React from 'react';
import { FormField } from '@/types/form';

interface SectionBreakFieldProps {
  field: FormField;
  value?: string;
  onChange?: (value: string) => void;
  isPreview?: boolean;
}

export function SectionBreakField({ field, value, onChange, isPreview }: SectionBreakFieldProps) {
  const backgroundColor = field.customConfig?.backgroundColor || 'bg-muted/30';
  
  return (
    <div className={`w-full py-6 px-4 rounded-lg ${backgroundColor} my-4`}>
      <h3 className="text-lg font-semibold mb-2">{field.label}</h3>
      {field.customConfig?.description && (
        <p className="text-muted-foreground text-sm">
          {field.customConfig.description}
        </p>
      )}
    </div>
  );
}
