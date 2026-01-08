import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Search, X } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Button } from '@/components/ui/button';

interface RadioFieldWithSearchProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  fieldState: any;
}

export function RadioFieldWithSearch({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled, 
  required,
  fieldState 
}: RadioFieldWithSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Use fieldState.options if available (from rules), otherwise use field.options
  const options = fieldState?.options || field.options || [];
  const config = field.customConfig || {};
  const orientation = config.orientation || 'vertical';
  const clearable = config.clearable || false;
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasScrollbar = filteredOptions.length > 7;

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Label>
            {fieldState.label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <HelpTooltip content={field.tooltip || fieldState.tooltip} />
        </div>
        {clearable && value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search options..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          disabled={disabled}
        />
      </div>
      
      {/* Radio Options */}
      <div className={hasScrollbar ? 'max-h-64 overflow-y-auto border rounded-lg p-3 bg-background' : ''}>
        <RadioGroup
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          className={orientation === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-3'}
        >
          {filteredOptions.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={option.id} />
              <Label htmlFor={option.id} className="flex items-center gap-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  {option.image && (
                    <img 
                      src={option.image} 
                      alt={option.label || 'Option image'} 
                      className="w-16 h-16 object-cover rounded border border-border flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  {!option.image && option.color && (
                    <div 
                      className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" 
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  {option.label && <span className="text-sm">{option.label}</span>}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      
      {filteredOptions.length === 0 && searchTerm && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No options found for "{searchTerm}"
        </p>
      )}
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}