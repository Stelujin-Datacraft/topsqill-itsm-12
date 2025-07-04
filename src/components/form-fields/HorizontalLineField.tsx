
import React from 'react';
import { FormField } from '@/types/form';

interface HorizontalLineFieldProps {
  field: FormField;
  isPreview?: boolean;
}

export function HorizontalLineField({ field, isPreview = false }: HorizontalLineFieldProps) {
  const thickness = field.customConfig?.thickness || 1;
  const color = field.customConfig?.color || '#e5e7eb';
  const margin = field.customConfig?.margin || '16px';

  const lineStyle = {
    height: `${thickness}px`,
    backgroundColor: color,
    border: 'none',
    margin: `${margin} 0`,
  };

  if (isPreview) {
    return (
      <div className="w-full relative py-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
        <hr style={lineStyle} />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
      </div>
    );
  }

  return <hr style={lineStyle} />;
}
