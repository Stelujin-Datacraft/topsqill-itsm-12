
import React from 'react';
import { FormField } from '@/types/form';

interface HeaderFieldProps {
  field: FormField;
  value?: string;
  onChange?: (value: string) => void;
  isPreview?: boolean;
}

export function HeaderField({ field, value, onChange, isPreview }: HeaderFieldProps) {
  const headerSize = field.customConfig?.headerSize || 'h1';
  const textAlign = field.customConfig?.textAlign || 'left';
  
  if (isPreview) {
    const HeaderTag = headerSize as keyof JSX.IntrinsicElements;
    return (
      <div className="w-full py-4">
        <HeaderTag 
          className={`font-bold ${
            headerSize === 'h1' ? 'text-3xl' : 
            headerSize === 'h2' ? 'text-2xl' : 
            headerSize === 'h3' ? 'text-xl' : 'text-lg'
          } text-${textAlign}`}
        >
          {field.label}
        </HeaderTag>
        {field.customConfig?.description && (
          <p className={`text-muted-foreground mt-2 text-${textAlign}`}>
            {field.customConfig.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full py-4">
      <div className={`font-bold text-2xl text-${textAlign}`}>
        {field.label}
      </div>
      {field.customConfig?.description && (
        <p className={`text-muted-foreground mt-2 text-${textAlign}`}>
          {field.customConfig.description}
        </p>
      )}
    </div>
  );
}
