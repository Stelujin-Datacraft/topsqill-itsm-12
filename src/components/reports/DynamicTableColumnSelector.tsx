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
      <DropdownMenuContent className="w-64 max-h-96 overflow-y-auto" align="end">
        <DropdownMenuLabel>Select Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formFields && formFields.length > 0 ? formFields.map((field) => (
          <DropdownMenuCheckboxItem
            key={field.id}
            checked={selectedColumns.includes(field.id)}
            onCheckedChange={(checked) => {
              // Prevent the dropdown from closing
              if (checked !== undefined) {
                onColumnToggle(field.id);
              }
            }}
            onSelect={(e) => {
              // Prevent the dropdown from closing when clicking on the item
              e.preventDefault();
            }}
          >
            <div className="flex flex-col">
              <span className="font-medium">{field.label || 'Unnamed Field'}</span>
              <span className="text-xs text-muted-foreground">{field.field_type || field.type || 'Unknown Type'}</span>
            </div>
          </DropdownMenuCheckboxItem>
        )) : (
          <div className="px-2 py-1 text-sm text-muted-foreground">
            No columns available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}