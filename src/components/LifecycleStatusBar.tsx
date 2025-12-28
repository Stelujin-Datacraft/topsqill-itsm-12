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

  // Get color based on option label (semantic colors for common statuses)
  const getColorForOption = (optionLabel: string, index: number) => {
    const label = optionLabel.toLowerCase();
    
    // Semantic colors for common status names
    if (label.includes('complete') || label.includes('done') || label.includes('approved') || label.includes('success')) {
      return { bg: 'bg-green-600', hover: 'hover:bg-green-700', border: 'border-green-500' };
    }
    if (label.includes('reject') || label.includes('cancel') || label.includes('fail') || label.includes('error')) {
      return { bg: 'bg-red-600', hover: 'hover:bg-red-700', border: 'border-red-500' };
    }
    if (label.includes('pending') || label.includes('wait') || label.includes('hold')) {
      return { bg: 'bg-amber-600', hover: 'hover:bg-amber-700', border: 'border-amber-500' };
    }
    if (label.includes('progress') || label.includes('review') || label.includes('process')) {
      return { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', border: 'border-blue-500' };
    }
    
    // Default colors for other options
    const colors = [
      { bg: 'bg-slate-600', hover: 'hover:bg-slate-700', border: 'border-slate-500' },
      { bg: 'bg-indigo-600', hover: 'hover:bg-indigo-700', border: 'border-indigo-500' },
      { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', border: 'border-purple-500' },
      { bg: 'bg-teal-600', hover: 'hover:bg-teal-700', border: 'border-teal-500' },
      { bg: 'bg-pink-600', hover: 'hover:bg-pink-700', border: 'border-pink-500' },
    ];
    
    return colors[index % colors.length];
  };

  // Generate colors for options - show dark colors for selected, lighter for unselected
  const getOptionStyle = (optionValue: string, optionLabel: string, index: number) => {
    const isSelected = value === optionValue;
    const color = getColorForOption(optionLabel, index);
    
    if (isSelected) {
      return `${color.bg} ${color.hover} text-white ${color.border} font-semibold`;
    }
    // Non-selected: show muted version but still visible
    return 'bg-muted/50 text-muted-foreground hover:bg-muted';
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
              className={`text-xs px-3 py-1 ${getOptionStyle(optionValue, optionLabel, index)}`}
            >
              {optionLabel}
            </Button>
        );
      })}
    </div>
  );
}
