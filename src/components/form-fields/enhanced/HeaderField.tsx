
import React from 'react';
import { FormField } from '@/types/form';
import { Star, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface HeaderFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

const ICON_MAP = {
  star: Star,
  alert: AlertTriangle,
  info: Info,
  check: CheckCircle,
};

const LEVEL_STYLES = {
  h1: { fontSize: '2.25rem', fontWeight: '700' }, // text-4xl font-bold
  h2: { fontSize: '1.875rem', fontWeight: '600' }, // text-3xl font-semibold
  h3: { fontSize: '1.5rem', fontWeight: '600' }, // text-2xl font-semibold
  h4: { fontSize: '1.25rem', fontWeight: '500' }, // text-xl font-medium
  h5: { fontSize: '1.125rem', fontWeight: '500' }, // text-lg font-medium
  h6: { fontSize: '1rem', fontWeight: '500' }, // text-base font-medium
};

export function HeaderField({ field }: HeaderFieldProps) {
  const config = field.customConfig || {};
  const level = config.level || config.headerSize || 'h2';
  const icon = config.icon;
  const alignment = config.alignment || 'left';
  const color = config.color || '#000000';

  const IconComponent = icon ? ICON_MAP[icon as keyof typeof ICON_MAP] : null;
  const levelStyle = LEVEL_STYLES[level as keyof typeof LEVEL_STYLES] || LEVEL_STYLES.h2;

  const style = {
    textAlign: alignment as any,
    color,
    fontSize: levelStyle.fontSize,
    fontWeight: levelStyle.fontWeight,
  };

  const HeaderTag = level as keyof JSX.IntrinsicElements;

  return (
    <HeaderTag style={style} className="flex items-center gap-2">
      {IconComponent && <IconComponent className="h-6 w-6" />}
      {field.label}
    </HeaderTag>
  );
}
