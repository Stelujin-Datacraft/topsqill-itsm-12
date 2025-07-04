
import React from 'react';
import { FormField } from '@/types/form';

interface SectionBreakFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function SectionBreakField({ field }: SectionBreakFieldProps) {
  const config = field.customConfig || {};
  const title = config.title;
  const width = config.width || 'full';
  const breakType = config.breakType || 'empty';
  const backgroundColor = config.backgroundColor || '#f3f4f6';
  const borderStyle = config.borderStyle || 'solid';
  const spacing = config.spacing || '20';

  const containerStyle = {
    width: width === 'full' ? '100%' : width === 'half' ? '50%' : '25%',
    margin: `${spacing}px 0`,
  };

  const contentStyle = {
    backgroundColor: breakType === 'colored' ? backgroundColor : 'transparent',
    border: breakType === 'bordered' ? `1px ${borderStyle} ${backgroundColor}` : 'none',
    padding: breakType !== 'empty' ? '12px' : '0',
    borderRadius: '4px',
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        {title && (
          <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
        )}
        {breakType === 'empty' && <div style={{ height: `${spacing}px` }} />}
      </div>
    </div>
  );
}
