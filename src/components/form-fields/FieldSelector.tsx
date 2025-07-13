import React, { useState, useMemo } from 'react';
import { FormField } from '@/types/form';
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty, CommandGroup } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParsedFieldReference, parseFormFields } from '@/utils/fieldReferenceParser';

interface FieldSelectorProps {
  fields: FormField[];
  formRefId: string;
  selectedFieldId?: string;
  onSelectField: (fieldId: string, fieldReference: ParsedFieldReference) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FieldSelector({
  fields,
  formRefId,
  selectedFieldId,
  onSelectField,
  placeholder = "Select a field...",
  disabled = false,
  className
}: FieldSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const parsedFields = useMemo(() => {
    return parseFormFields(fields, formRefId);
  }, [fields, formRefId]);

  const filteredFields = useMemo(() => {
    if (!searchValue) return parsedFields;
    
    const search = searchValue.toLowerCase();
    return parsedFields.filter(field => 
      field.displayText.toLowerCase().includes(search) ||
      field.originalField.label.toLowerCase().includes(search) ||
      field.originalField.type.toLowerCase().includes(search)
    );
  }, [parsedFields, searchValue]);

  const selectedField = parsedFields.find(field => field.fieldId === selectedFieldId);

  const handleSelect = (fieldReference: ParsedFieldReference) => {
    onSelectField(fieldReference.fieldId, fieldReference);
    setOpen(false);
    setSearchValue('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">
            {selectedField ? (
              <span className="font-mono text-sm">
                {selectedField.displayText}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search fields..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No fields found.</CommandEmpty>
            <CommandGroup>
              {filteredFields.map((field) => (
                <CommandItem
                  key={field.fieldId}
                  value={field.displayText}
                  onSelect={() => handleSelect(field)}
                  className="flex items-center justify-between p-3 cursor-pointer"
                >
                  <div className="flex flex-col space-y-1 min-w-0 flex-1">
                    <div className="font-mono text-sm text-primary">
                      {field.displayText}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {field.originalField.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Type: {field.originalField.type}
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4 shrink-0",
                      selectedFieldId === field.fieldId ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}