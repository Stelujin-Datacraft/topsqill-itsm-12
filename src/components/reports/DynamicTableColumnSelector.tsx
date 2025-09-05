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
  // Filter fields to only show selectable ones (excluding structural and system fields)
  const selectableFields = formFields.filter(field => {
    const excludedFieldTypes = [
      'header', 'description', 'section-break', 'horizontal-line', 
      'full-width-container', 'user-picker', 'approval', 'cross-reference', 
      'query-field', 'geo-location', 'conditional-section', 
      'submission-access', 'signature', 'dynamic-dropdown', 'rich-text',
      'record-table', 'matrix-grid', 'workflow-trigger'
    ];
    
    // Exclude by field type
    if (excludedFieldTypes.includes(field.field_type)) return false;
    
    // Exclude auto-generated cross-reference fields
    if (field.label && field.label.startsWith('Reference from ')) return false;
    
    return true;
  });
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
        {selectableFields && selectableFields.length > 0 ? selectableFields.map((field) => (
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