import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormOption {
  id: string;
  name: string;
  description?: string;
}

interface CopilotFormPickerProps {
  forms: FormOption[];
  onSelect: (formId: string) => void;
  placeholder?: string;
  selectedId?: string;
  className?: string;
}

export function CopilotFormPicker({
  forms,
  onSelect,
  placeholder = 'Search forms…',
  selectedId,
  className,
}: CopilotFormPickerProps) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(
    () => [...forms].sort((a, b) => a.name.localeCompare(b.name)),
    [forms],
  );
  const selectedLabel = selectedId ? forms.find((f) => f.id === selectedId)?.name : undefined;

  if (forms.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn('h-8 justify-between text-xs font-normal max-w-[240px]', className)}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search forms…" />
          <CommandList>
            <CommandEmpty>No form found.</CommandEmpty>
            <CommandGroup>
              {sorted.map((form) => (
                <CommandItem
                  key={form.id}
                  value={form.name}
                  onSelect={() => {
                    onSelect(form.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5', selectedId === form.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{form.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
