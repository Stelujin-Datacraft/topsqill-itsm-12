
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

export function HeaderField({ field }: HeaderFieldProps) {
  const config = field.customConfig || {};
  const level = config.level || 'h2';
  const icon = config.icon;
  const alignment = config.alignment || 'left';
  const color = config.color || '#000000';
  const fontSize = config.fontSize;
  const fontWeight = config.fontWeight || 'normal';

  const IconComponent = icon ? ICON_MAP[icon as keyof typeof ICON_MAP] : null;

  const style = {
    textAlign: alignment as any,
    color,
    fontSize,
    fontWeight,
  };

  const HeaderTag = level as keyof JSX.IntrinsicElements;

  return (
    <HeaderTag style={style} className="flex items-center gap-2">
      {IconComponent && <IconComponent className="h-6 w-6" />}
      {field.label}
    </HeaderTag>
  );
}
