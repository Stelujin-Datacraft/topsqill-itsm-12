import React from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/types/form';

interface LifecycleStatusBarProps {
  field: FormField;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  isEditing?: boolean;
}

export function LifecycleStatusBar({ 
  field, 
  value, 
  onChange, 
  disabled = false,
  isEditing = false
}: LifecycleStatusBarProps) {
  // Parse options from the field
  const options = Array.isArray(field.options) 
    ? field.options 
    : typeof field.options === 'string' 
      ? (() => { try { return JSON.parse(field.options); } catch { return []; } })()
      : [];

  const handleOptionClick = (optionValue: string) => {
    if (!disabled && isEditing && onChange) {
      onChange(optionValue);
    }
  };

  // Generate colors for options based on their index
  const getOptionStyle = (optionValue: string, index: number) => {
    const isSelected = value === optionValue;
    
    // Define a set of colors for lifecycle stages
    const colors = [
      { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', border: 'border-amber-400' },
      { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', border: 'border-blue-400' },
      { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', border: 'border-purple-400' },
      { bg: 'bg-green-500', hover: 'hover:bg-green-600', border: 'border-green-400' },
      { bg: 'bg-red-500', hover: 'hover:bg-red-600', border: 'border-red-400' },
      { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600', border: 'border-indigo-400' },
      { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', border: 'border-pink-400' },
      { bg: 'bg-teal-500', hover: 'hover:bg-teal-600', border: 'border-teal-400' },
    ];
    
    const colorIndex = index % colors.length;
    const color = colors[colorIndex];
    
    if (isSelected) {
      return `${color.bg} ${color.hover} text-white ${color.border}`;
    }
    return 'text-muted-foreground hover:text-foreground';
  };

  const getOptionLabel = (option: any): string => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') {
      return option.label || option.value || String(option);
    }
    return String(option);
  };

  const getOptionValue = (option: any): string => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') {
      return option.value || option.label || String(option);
    }
    return String(option);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
      <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
        {options.map((option: any, index: number) => {
          const optionValue = getOptionValue(option);
          const optionLabel = getOptionLabel(option);
          const isSelected = value === optionValue;
          
          return (
            <Button
              key={optionValue}
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              onClick={() => handleOptionClick(optionValue)}
              disabled={disabled || !isEditing}
              className={`text-xs px-3 py-1 ${getOptionStyle(optionValue, index)}`}
            >
              {optionLabel}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
