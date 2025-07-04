
import React from 'react';
import { FormField } from '@/types/form';

interface HorizontalLineFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function HorizontalLineField({ field }: HorizontalLineFieldProps) {
  const config = field.customConfig || {};
  const lineColor = config.lineColor || '#e5e7eb';
  const lineStyle = config.lineStyle || 'solid';
  const thickness = config.thickness || '1';
  const margin = config.margin || '16px 0';

  const style = {
    borderTop: `${thickness}px ${lineStyle} ${lineColor}`,
    margin,
    width: '100%',
  };

  return <hr style={style} />;
}
