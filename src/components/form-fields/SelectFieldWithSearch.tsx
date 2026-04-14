
import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface SelectFieldWithSearchProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  fieldState: any;
}

export function SelectFieldWithSearch({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled, 
  required,
  fieldState 
}: SelectFieldWithSearchProps) {
  const [searchValue, setSearchValue] = useState('');

  const config = field.customConfig || {};
  const clearable = config.clearable !== false;

  // Use fieldState.options if available (from rules), otherwise use field.options
  const options = fieldState?.options || field.options || [];
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
    option.value.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleSelect = (optionValue: string) => {
    onChange(optionValue === value ? '' : optionValue);
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <Label htmlFor={field.id}>
          {fieldState.label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <HelpTooltip content={field.tooltip || fieldState.tooltip} />
      </div>

      {/* Inline search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search options..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-10"
          disabled={disabled}
        />
      </div>

      {/* Clear selection */}
      {clearable && value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Clear selection
        </button>
      )}

      {/* Inline radio-style list */}
      <div className={`space-y-1 border rounded-md p-3 bg-background ${filteredOptions.length > 7 ? 'max-h-64 overflow-y-auto' : ''}`}>
        {filteredOptions.length === 0 && (
          <p className="text-sm text-muted-foreground py-2 text-center">No options found.</p>
        )}
        {filteredOptions.map((option) => (
          <div
            key={option.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors",
              value === option.value && "bg-accent"
            )}
            onClick={() => !disabled && handleSelect(option.value)}
          >
            <div className={cn(
              "h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
              value === option.value ? "border-primary" : "border-muted-foreground/40"
            )}>
              {value === option.value && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-1">
              {option.image && (
                <img 
                  src={option.image} 
                  alt={option.label || 'Option image'} 
                  className="w-10 h-10 object-cover rounded border border-border flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              {!option.image && option.color && (
                <div 
                  className="w-4 h-4 rounded-full border border-border flex-shrink-0" 
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.label && <span className="text-sm">{option.label}</span>}
            </div>
          </div>
        ))}
      </div>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
