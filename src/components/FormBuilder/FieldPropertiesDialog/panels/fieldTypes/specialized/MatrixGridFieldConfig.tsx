import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';
import { FieldConfiguration } from '../../../hooks/useFieldConfiguration';

interface MatrixGridFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

interface MatrixRow {
  label: string;
  type: 'radio' | 'checkbox' | 'dropdown' | 'text';
  options?: string[];
}

export function MatrixGridFieldConfig({ config, onUpdate, errors }: MatrixGridFieldConfigProps) {
  const updateCustomConfig = (key: string, value: any) => {
    onUpdate({
      customConfig: { ...config.customConfig, [key]: value }
    });
  };

  const rows: MatrixRow[] = config.customConfig?.rows || [];

  const addRow = () => {
    const newRow: MatrixRow = {
      label: '',
      type: 'radio',
      options: []
    };
    updateCustomConfig('rows', [...rows, newRow]);
  };

  const updateRow = (index: number, field: keyof MatrixRow, value: any) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    
    // If type changes to text, remove options
    if (field === 'type' && value === 'text') {
      newRows[index].options = undefined;
    }
    // If type changes from text, add empty options array
    else if (field === 'type' && value !== 'text' && !newRows[index].options) {
      newRows[index].options = [];
    }
    
    updateCustomConfig('rows', newRows);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    updateCustomConfig('rows', newRows);
  };

  const addOption = (rowIndex: number) => {
    const newRows = [...rows];
    if (!newRows[rowIndex].options) {
      newRows[rowIndex].options = [];
    }
    newRows[rowIndex].options!.push('');
    updateCustomConfig('rows', newRows);
  };

  const updateOption = (rowIndex: number, optionIndex: number, value: string) => {
    const newRows = [...rows];
    if (newRows[rowIndex].options) {
      newRows[rowIndex].options![optionIndex] = value;
      updateCustomConfig('rows', newRows);
    }
  };

  const removeOption = (rowIndex: number, optionIndex: number) => {
    const newRows = [...rows];
    if (newRows[rowIndex].options) {
      newRows[rowIndex].options = newRows[rowIndex].options!.filter((_, i) => i !== optionIndex);
      updateCustomConfig('rows', newRows);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
        <h3 className="text-lg font-semibold">Matrix Grid Configuration</h3>
      </div>

      {/* Matrix Rows Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Matrix Rows
            <Button onClick={addRow} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row: MatrixRow, index: number) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <Label htmlFor={`row-label-${index}`} className="text-sm font-medium">Row Label</Label>
                  <Input
                    id={`row-label-${index}`}
                    placeholder="Enter row label"
                    value={row.label}
                    onChange={(e) => updateRow(index, 'label', e.target.value)}
                  />
                </div>
                <div className="w-48">
                  <Label htmlFor={`row-type-${index}`} className="text-sm font-medium">Response Type</Label>
                  <Select
                    value={row.type}
                    onValueChange={(value) => updateRow(index, 'type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="radio">Single Select (Radio)</SelectItem>
                      <SelectItem value="checkbox">Multi Select (Checkbox)</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="text">Text Input</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeRow(index)}
                  className="text-red-600 hover:text-red-700 mt-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Options for non-text types */}
              {row.type !== 'text' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Options</Label>
                    <Button
                      onClick={() => addOption(index)}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Option
                    </Button>
                  </div>
                  {row.options?.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex gap-2 items-center">
                      <Input
                        placeholder="Option label"
                        value={option}
                        onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index, optionIndex)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!row.options || row.options.length === 0) && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No options configured. Add options for this row.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No rows configured. Add rows to create your matrix grid.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}