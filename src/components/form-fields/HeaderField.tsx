
import React from 'react';
import { FormField } from '@/types/form';

interface HeaderFieldProps {
  field: FormField;
  isPreview?: boolean;
}

export function HeaderField({ field, isPreview = false }: HeaderFieldProps) {
  const level = field.customConfig?.level || 'h1';
  const alignment = field.customConfig?.alignment || 'left';
  const color = field.customConfig?.color || '#000000';
  
  const HeadingTag = level as keyof JSX.IntrinsicElements;
  
  const styles = {
    textAlign: alignment as 'left' | 'center' | 'right',
    color: color,
    margin: 0,
    fontFamily: "'Inter', system-ui, sans-serif",
  };

  const sizeClasses = {
    h1: 'text-3xl font-bold',
    h2: 'text-2xl font-semibold', 
    h3: 'text-xl font-medium',
    h4: 'text-lg font-medium'
  };

  if (isPreview) {
    return (
      <div className="w-full relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
        <div className="py-6">
          <HeadingTag 
            className={`${sizeClasses[level as keyof typeof sizeClasses]} leading-tight`}
            style={styles}
          >
            {field.label}
          </HeadingTag>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
      </div>
    );
  }

  return (
    <HeadingTag 
      className={`${sizeClasses[level as keyof typeof sizeClasses]} leading-tight`}
      style={styles}
    >
      {field.label}
    </HeadingTag>
  );
}
