import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Columns3 } from 'lucide-react';

interface FormField {
  id: string;
  label: string;
  field_type?: string;
  type?: string;
}

interface ColumnSelectorProps {
  formFields: FormField[];
  selectedColumns: string[];
  onColumnToggle: (fieldId: string) => void;
}

export function DynamicTableColumnSelector({ formFields, selectedColumns, onColumnToggle }: ColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-4 w-4 mr-2" />
          Columns ({selectedColumns.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel>Select Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formFields.map((field) => (
          <DropdownMenuCheckboxItem
            key={field.id}
            checked={selectedColumns.includes(field.id)}
            onCheckedChange={() => onColumnToggle(field.id)}
          >
            <div className="flex flex-col">
              <span className="font-medium">{field.label}</span>
              <span className="text-xs text-muted-foreground">{field.field_type || field.type}</span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}