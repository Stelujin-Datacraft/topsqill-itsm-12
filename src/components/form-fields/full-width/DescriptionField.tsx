
import React from 'react';
import { FormField } from '@/types/form';

interface DescriptionFieldProps {
  field: FormField;
  value?: string;
  onChange?: (value: string) => void;
  isPreview?: boolean;
}

export function DescriptionField({ field, value, onChange, isPreview }: DescriptionFieldProps) {
  const textAlign = field.customConfig?.textAlign || 'left';
  const content = field.customConfig?.content || field.label;
  
  return (
    <div className="w-full py-2">
      <div className={`text-muted-foreground whitespace-pre-wrap text-${textAlign}`}>
        {content}
      </div>
      {field.customConfig?.description && (
        <div className={`text-sm text-muted-foreground/70 mt-1 text-${textAlign}`}>
          {field.customConfig.description}
        </div>
      )}
    </div>
  );
}
