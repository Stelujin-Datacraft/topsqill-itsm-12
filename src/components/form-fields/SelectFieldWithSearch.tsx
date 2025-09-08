import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, Search } from 'lucide-react';
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

  const options = field.options || [];
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
              <div className="flex items-center gap-2">
                {selectedOption.color && (
                  <div 
                    className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" 
                    style={{ backgroundColor: selectedOption.color }}
                  />
                )}
                <span>{selectedOption.label}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">{field.placeholder || "Select an option..."}</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2">
                      {option.color && (
                        <div 
                          className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" 
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      <span>{option.label}</span>
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