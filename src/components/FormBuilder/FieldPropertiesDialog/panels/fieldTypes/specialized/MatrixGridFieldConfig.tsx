import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';
import { FieldConfiguration } from '../../../hooks/useFieldConfiguration';

interface MatrixGridFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

interface MatrixRow {
  id: string;
  label: string;
  required?: boolean;
}

interface MatrixColumn {
  id: string;
  label: string;
  type: 'radio' | 'checkbox' | 'select';
  options?: { value: string; label: string }[];
}

export function MatrixGridFieldConfig({ config, onUpdate, errors }: MatrixGridFieldConfigProps) {
  const updateCustomConfig = (key: string, value: any) => {
    onUpdate({
      customConfig: { ...config.customConfig, [key]: value }
    });
  };

  const rows = config.customConfig?.matrixRows || [];
  const columns = config.customConfig?.matrixColumns || [];
  const matrixType = config.customConfig?.matrixType || 'radio';

  const addRow = () => {
    const newRow: MatrixRow = {
      id: `row-${Date.now()}`,
      label: '',
      required: false
    };
    updateCustomConfig('matrixRows', [...rows, newRow]);
  };

  const updateRow = (index: number, field: keyof MatrixRow, value: any) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    updateCustomConfig('matrixRows', newRows);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_: any, i: number) => i !== index);
    updateCustomConfig('matrixRows', newRows);
  };

  const addColumn = () => {
    const newColumn: MatrixColumn = {
      id: `col-${Date.now()}`,
      label: '',
      type: matrixType as 'radio' | 'checkbox' | 'select',
      options: matrixType === 'select' ? [] : undefined
    };
    updateCustomConfig('matrixColumns', [...columns, newColumn]);
  };

  const updateColumn = (index: number, field: keyof MatrixColumn, value: any) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    updateCustomConfig('matrixColumns', newColumns);
  };

  const removeColumn = (index: number) => {
    const newColumns = columns.filter((_: any, i: number) => i !== index);
    updateCustomConfig('matrixColumns', newColumns);
  };

  const addColumnOption = (columnIndex: number) => {
    const newColumns = [...columns];
    if (!newColumns[columnIndex].options) {
      newColumns[columnIndex].options = [];
    }
    newColumns[columnIndex].options!.push({
      value: '',
      label: ''
    });
      updateCustomConfig('matrixColumns', newColumns);
  };

  const updateColumnOption = (columnIndex: number, optionIndex: number, field: 'value' | 'label', value: string) => {
    const newColumns = [...columns];
    if (newColumns[columnIndex].options) {
      newColumns[columnIndex].options![optionIndex] = {
        ...newColumns[columnIndex].options![optionIndex],
        [field]: value
      };
        updateCustomConfig('matrixColumns', newColumns);
    }
  };

  const removeColumnOption = (columnIndex: number, optionIndex: number) => {
    const newColumns = [...columns];
    if (newColumns[columnIndex].options) {
      newColumns[columnIndex].options = newColumns[columnIndex].options!.filter((_, i) => i !== optionIndex);
      updateCustomConfig('matrixColumns', newColumns);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
        <h3 className="text-lg font-semibold">Matrix Grid Configuration</h3>
      </div>

      {/* Matrix Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matrix Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="matrix-type">Response Type</Label>
              <Select
                value={matrixType}
                onValueChange={(value) => updateCustomConfig('matrixType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select matrix type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radio">Single Choice (Radio)</SelectItem>
                  <SelectItem value="checkbox">Multiple Choice (Checkbox)</SelectItem>
                  <SelectItem value="select">Dropdown Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="require-all-rows"
                checked={config.customConfig?.requireAllRows || false}
                onCheckedChange={(checked) => updateCustomConfig('requireAllRows', checked)}
              />
              <Label htmlFor="require-all-rows">Require response for all rows</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rows Configuration */}
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
            <div key={row.id} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <Input
                  placeholder="Row label"
                  value={row.label}
                  onChange={(e) => updateRow(index, 'label', e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={row.required || false}
                  onCheckedChange={(checked) => updateRow(index, 'required', checked)}
                />
                <Label className="text-sm">Required</Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeRow(index)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No rows configured. Add rows to create your matrix grid.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Columns Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Matrix Columns
            <Button onClick={addColumn} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Column
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {columns.map((column: MatrixColumn, columnIndex: number) => (
            <div key={column.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <Input
                    placeholder="Column label"
                    value={column.label}
                    onChange={(e) => updateColumn(columnIndex, 'label', e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeColumn(columnIndex)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Column Options for Select Type */}
              {matrixType === 'select' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Options</Label>
                    <Button
                      onClick={() => addColumnOption(columnIndex)}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Option
                    </Button>
                  </div>
                  {column.options?.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex gap-2 items-center">
                      <Input
                        placeholder="Option value"
                        value={option.value}
                        onChange={(e) => updateColumnOption(columnIndex, optionIndex, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Option label"
                        value={option.label}
                        onChange={(e) => updateColumnOption(columnIndex, optionIndex, 'label', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumnOption(columnIndex, optionIndex)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {columns.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No columns configured. Add columns to create your matrix grid.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-grid-lines"
              checked={config.customConfig?.showGridLines !== false}
              onCheckedChange={(checked) => updateCustomConfig('showGridLines', checked)}
            />
            <Label htmlFor="show-grid-lines">Show grid lines</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="compact-layout"
              checked={config.customConfig?.compactLayout || false}
              onCheckedChange={(checked) => updateCustomConfig('compactLayout', checked)}
            />
            <Label htmlFor="compact-layout">Compact layout</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}