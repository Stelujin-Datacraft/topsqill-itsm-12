import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/types/form';
import { FieldOperator } from '@/types/rules';

interface RuleDynamicValueInputProps {
  field: FormField | null;
  value: any;
  onChange: (value: any) => void;
  operator?: FieldOperator;
  disabled?: boolean;
  placeholder?: string;
}

export function RuleDynamicValueInput({ 
  field, 
  value, 
  onChange, 
  operator, 
  disabled = false,
  placeholder = "Enter value" 
}: RuleDynamicValueInputProps) {
  
  // Don't show value input for operators that don't need a value
  if (['isEmpty', 'isNotEmpty'].includes(operator || '')) {
    return (
      <div className="flex items-center justify-center h-10 bg-muted rounded text-sm text-muted-foreground">
        No value required
      </div>
    );
  }

  if (!field) {
    return (
      <Input
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  const renderInput = () => {
    switch (field.type) {
      case 'select':
      case 'radio':
      case 'country':
        // For 'in' operator, allow multiple selections
        if (operator === 'in') {
          const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
          return (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Select multiple options:</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {field.options && field.options.length > 0 ? field.options.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedValues.includes(option.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onChange([...selectedValues, option.value]);
                        } else {
                          onChange(selectedValues.filter(v => v !== option.value));
                        }
                      }}
                      disabled={disabled}
                    />
                    <Label className="text-sm">{option.label || option.value}</Label>
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground">No options available</div>
                )}
              </div>
              {selectedValues.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((val, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {field.options?.find(opt => opt.value === val)?.label || val}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        }
        // Single selection dropdown
        return (
          <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {field.options && field.options.length > 0 ? field.options.filter((option) => option.value && option.value.trim() !== '').map((option) => (
                <SelectItem key={option.id} value={option.value}>
                  {option.label || option.value}
                </SelectItem>
              )) : (
                <SelectItem value="__no_options__" disabled>No options available</SelectItem>
              )}
            </SelectContent>
          </Select>
        );

      case 'multi-select':
      case 'checkbox':
        const multiValues = Array.isArray(value) ? value : (value ? [value] : []);
        return (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Select options:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {field.options && field.options.length > 0 ? field.options.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    checked={multiValues.includes(option.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onChange([...multiValues, option.value]);
                      } else {
                        onChange(multiValues.filter(v => v !== option.value));
                      }
                    }}
                    disabled={disabled}
                  />
                  <Label className="text-sm">{option.label || option.value}</Label>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground">No options available</div>
              )}
            </div>
          </div>
        );

      case 'toggle-switch':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value === true || value === 'true' || value === '1'}
              onCheckedChange={(checked) => onChange(checked)}
              disabled={disabled}
            />
            <Label className="text-sm">
              {value === true || value === 'true' || value === '1' ? 'On' : 'Off'}
            </Label>
          </div>
        );

      case 'number':
      case 'currency':
      case 'rating':
      case 'slider':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter number"
            disabled={disabled}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.customConfig?.step || (field.type === 'currency' ? '0.01' : '1')}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            min={field.customConfig?.minDate}
            max={field.customConfig?.maxDate}
          />
        );

      case 'time':
        return (
          <Input
            type="time"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter email address"
            disabled={disabled}
          />
        );

      case 'phone':
        return (
          <Input
            type="tel"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter phone number"
            disabled={disabled}
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter URL"
            disabled={disabled}
          />
        );

      case 'password':
        return (
          <Input
            type="password"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter password"
            disabled={disabled}
          />
        );

      case 'color':
        return (
          <div className="flex items-center space-x-2">
            <Input
              type="color"
              value={value || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="w-12 h-10 p-1 rounded"
            />
            <Input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              disabled={disabled}
              className="flex-1"
            />
          </div>
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter text"
            disabled={disabled}
            className="w-full p-2 border rounded min-h-[60px] text-sm"
            maxLength={field.validation?.maxLength}
          />
        );

      case 'text':
      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={field.validation?.maxLength}
            minLength={field.validation?.minLength}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {field.label} ({field.type})
      </div>
      {renderInput()}
    </div>
  );
}