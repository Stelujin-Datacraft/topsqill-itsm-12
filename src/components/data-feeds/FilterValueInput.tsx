import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFieldCategory, FieldCategory } from '@/types/dataFeed';
import { useState, useEffect } from 'react';

interface FieldOption {
  id: string;
  label: string;
  field_type: string;
  options?: { label: string; value: string }[];
  custom_config?: any;
}

interface FilterValueInputProps {
  fieldType: string;
  value: string;
  onChange: (value: string) => void;
  field?: FieldOption;
  operator?: string;
  className?: string;
}

export function FilterValueInput({ 
  fieldType, 
  value, 
  onChange, 
  field,
  operator,
  className = "flex-1"
}: FilterValueInputProps) {
  const category = getFieldCategory(fieldType);
  
  // Get options from field configuration
  const getFieldOptions = (): { label: string; value: string }[] => {
    if (!field) return [];
    
    // Options might be stored in different places depending on field type
    if (field.options && Array.isArray(field.options)) {
      return field.options;
    }
    
    if (field.custom_config?.options && Array.isArray(field.custom_config.options)) {
      return field.custom_config.options;
    }
    
    // For lifecycle fields, stages are the options
    if (field.custom_config?.stages && Array.isArray(field.custom_config.stages)) {
      return field.custom_config.stages.map((stage: any) => ({
        label: stage.label || stage.name || stage,
        value: stage.value || stage.id || stage.label || stage.name || stage
      }));
    }
    
    return [];
  };

  const options = getFieldOptions();
  
  // For multi-select "in" or "not_in" operators
  const isMultiSelectOperator = operator === 'in' || operator === 'not_in';
  const selectedValues = isMultiSelectOperator && value ? value.split(',').filter(Boolean) : [];

  const handleMultiSelectChange = (optionValue: string, checked: boolean) => {
    let newValues: string[];
    if (checked) {
      newValues = [...selectedValues, optionValue];
    } else {
      newValues = selectedValues.filter(v => v !== optionValue);
    }
    onChange(newValues.join(','));
  };

  // Render based on field category
  switch (category) {
    case 'boolean':
      // Boolean fields don't need a value input for is_true/is_false operators
      return null;

    case 'number':
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter number"
          className={className}
        />
      );

    case 'date':
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );

    case 'time':
      return (
        <Input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );

    case 'selection':
      if (isMultiSelectOperator && options.length > 0) {
        return (
          <div className={`${className} flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[38px]`}>
            {options.map((option) => (
              <label 
                key={option.value} 
                className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-muted px-2 py-1 rounded"
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => handleMultiSelectChange(option.value, checked === true)}
                />
                <span>{option.label}</span>
              </label>
            ))}
            {options.length === 0 && (
              <span className="text-muted-foreground text-sm">No options available</span>
            )}
          </div>
        );
      }
      
      // Single selection for equals/not_equals
      if (options.length > 0) {
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={className}>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      
      // Fallback to text input if no options
      return (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter value"
          className={className}
        />
      );

    case 'text':
    default:
      return (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter value"
          className={className}
        />
      );
  }
}
