
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, X } from 'lucide-react';
import { Form } from '@/types/form';

interface ColumnField {
  id: string;
  label: string;
  type: string;
}

interface ColumnSelectorProps {
  form: Form | null;
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function ColumnSelector({ form, selectedColumns, onColumnsChange }: ColumnSelectorProps) {
  if (!form) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please select a form first to choose columns</p>
      </div>
    );
  }

  const getAvailableFields = (): ColumnField[] => {
    const metadataFields: ColumnField[] = [
      { id: 'submitted_at', label: 'Submitted At', type: 'metadata' },
      { id: 'submitted_by', label: 'Submitted By', type: 'metadata' },
      { id: 'submission_ref_id', label: 'Reference ID', type: 'metadata' }
    ];
    
    const formFields: ColumnField[] = form.fields.map(field => ({
      id: field.id,
      label: field.label,
      type: field.type
    }));
    
    return [...metadataFields, ...formFields];
  };

  const availableFields = getAvailableFields();

  const handleColumnToggle = (fieldId: string, checked: boolean) => {
    const newColumns = checked
      ? [...selectedColumns, fieldId]
      : selectedColumns.filter(id => id !== fieldId);
    
    onColumnsChange(newColumns);
  };

  const selectAllColumns = () => {
    const allFieldIds = availableFields.map(field => field.id);
    onColumnsChange(allFieldIds);
  };

  const clearAllColumns = () => {
    onColumnsChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Column Selection</h3>
          <p className="text-sm text-muted-foreground">
            Choose which columns to display in your data table
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAllColumns}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={clearAllColumns}>
            Clear All
          </Button>
        </div>
      </div>

      {selectedColumns.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                {selectedColumns.length} columns selected
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedColumns.map((columnId) => {
                const field = availableFields.find(f => f.id === columnId);
                return field ? (
                  <Badge
                    key={columnId}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-red-100"
                    onClick={() => handleColumnToggle(columnId, false)}
                  >
                    {field.label}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {availableFields.map((field) => (
          <Card 
            key={field.id} 
            className={`cursor-pointer transition-colors hover:bg-accent ${
              selectedColumns.includes(field.id) ? 'bg-blue-50 border-blue-200' : ''
            }`}
            onClick={() => handleColumnToggle(field.id, !selectedColumns.includes(field.id))}
          >
            <CardContent className="p-3">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id={field.id}
                  checked={selectedColumns.includes(field.id)}
                  onCheckedChange={(checked) => handleColumnToggle(field.id, !!checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <label htmlFor={field.id} className="cursor-pointer text-sm font-medium">
                    {field.label}
                  </label>
                  <div className="flex items-center justify-between mt-1">
                    <Badge 
                      variant={field.type === 'metadata' ? 'secondary' : 'outline'} 
                      className="text-xs"
                    >
                      {field.type === 'metadata' ? 'Meta' : field.type}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
