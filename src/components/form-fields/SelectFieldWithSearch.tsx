import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelpTooltip } from '@/components/ui/help-tooltip';

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
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const config = field.customConfig || {};
  const clearable = config.clearable !== false;

  // Use fieldState.options if available (from rules), otherwise use field.options
  const options = fieldState?.options || field.options || [];
  const selectedOption = options.find(opt => opt.value === value);
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
    option.value.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleSelect = (optionValue: string) => {
    onChange(optionValue === value ? '' : optionValue);
    setOpen(false);
    setSearchValue('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setOpen(false);
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
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedOption ? (
              <div className="flex items-center gap-2 flex-1">
                {selectedOption.image && (
                  <img 
                    src={selectedOption.image} 
                    alt={selectedOption.label || 'Selected option'} 
                    className="w-10 h-10 object-cover rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {!selectedOption.image && selectedOption.color && (
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" 
                    style={{ backgroundColor: selectedOption.color }}
                  />
                )}
                {selectedOption.label && <span className="text-sm">{selectedOption.label}</span>}
              </div>
            ) : (
              <span className="text-muted-foreground">{field.placeholder || "Select an option..."}</span>
            )}
            <div className="flex items-center gap-1">
              {clearable && value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  className="h-4 w-4 flex items-center justify-center opacity-50 hover:opacity-100 cursor-pointer"
                  onClick={handleClear}
                  onMouseDown={(e) => e.preventDefault()}
                  onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
                >
                  <X className="h-4 w-4" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search options..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.value || `option-${option.id}`}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-3">
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
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}