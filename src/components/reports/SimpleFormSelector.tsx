
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Form } from '@/types/form';

interface SimpleFormSelectorProps {
  forms: Form[];
  selectedFormId: string;
  onFormSelect: (formId: string) => void;
  disabled?: boolean;
}

export function SimpleFormSelector({ forms, selectedFormId, onFormSelect, disabled }: SimpleFormSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Primary Form *</label>
      <Select
        value={selectedFormId}
        onValueChange={onFormSelect}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a form to build table from" />
        </SelectTrigger>
        <SelectContent>
          {forms.map((form) => (
            <SelectItem key={form.id} value={form.id}>
              <div className="flex items-center justify-between w-full">
                <span>{form.name}</span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {form.fields.length} fields
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
