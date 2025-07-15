import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FormField {
  id: string;
  label: string;
  field_type?: string;
  type?: string;
}

interface FormWithFields {
  id: string;
  name: string;
  fields: FormField[];
}

interface ColumnSelectorProps {
  form: FormWithFields | null;
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function ColumnSelector({ form, selectedColumns, onColumnsChange }: ColumnSelectorProps) {
  if (!form) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Please select a form first to configure columns.</p>
        </CardContent>
      </Card>
    );
  }

  const handleColumnToggle = (fieldId: string, checked: boolean) => {
    if (checked) {
      onColumnsChange([...selectedColumns, fieldId]);
    } else {
      onColumnsChange(selectedColumns.filter(id => id !== fieldId));
    }
  };

  const handleSelectAll = () => {
    if (selectedColumns.length === form.fields.length) {
      onColumnsChange([]);
    } else {
      onColumnsChange(form.fields.map(field => field.id));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Select Columns</span>
          <button
            onClick={handleSelectAll}
            className="text-sm text-primary hover:underline"
          >
            {selectedColumns.length === form.fields.length ? 'Deselect All' : 'Select All'}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {form.fields.map((field) => (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={selectedColumns.includes(field.id)}
              onCheckedChange={(checked) => handleColumnToggle(field.id, !!checked)}
            />
            <label
              htmlFor={field.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1"
            >
              <div>
                <span>{field.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({field.field_type || field.type})
                </span>
              </div>
            </label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}