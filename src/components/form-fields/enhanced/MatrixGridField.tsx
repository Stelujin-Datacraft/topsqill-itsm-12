import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MatrixGridFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
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

export function MatrixGridField({ field, value = {}, onChange, error, disabled }: MatrixGridFieldProps) {
  const config = field.customConfig || {};
  const rows: MatrixRow[] = (config.matrixRows as unknown as MatrixRow[]) || [];
  const columns: MatrixColumn[] = (config.matrixColumns as unknown as MatrixColumn[]) || [];
  const matrixType = (config as any).matrixType || 'radio';
  const requireAllRows = (config as any).requireAllRows || false;
  const showGridLines = (config as any).showGridLines !== false;
  const compactLayout = (config as any).compactLayout || false;

  const handleValueChange = (rowId: string, columnId: string, newValue: any) => {
    if (disabled) return;

    const currentValue = { ...value };
    
    if (matrixType === 'radio') {
      // For radio, only one selection per row
      currentValue[rowId] = { [columnId]: newValue };
    } else if (matrixType === 'checkbox') {
      // For checkbox, multiple selections per row
      if (!currentValue[rowId]) currentValue[rowId] = {};
      currentValue[rowId][columnId] = newValue;
    } else if (matrixType === 'select') {
      // For select, one value per row
      currentValue[rowId] = { [columnId]: newValue };
    }

    onChange?.(currentValue);
  };

  const getRowValue = (rowId: string, columnId: string) => {
    return value[rowId]?.[columnId] || '';
  };

  const isRowChecked = (rowId: string, columnId: string) => {
    if (matrixType === 'checkbox') {
      return Boolean(value[rowId]?.[columnId]);
    } else if (matrixType === 'radio') {
      return value[rowId]?.[columnId] === true;
    }
    return false;
  };

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="w-full p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center">
        <p className="text-muted-foreground mb-2">Matrix Grid: {field.label}</p>
        <p className="text-sm text-muted-foreground">No rows or columns configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      <div className={`
        overflow-x-auto
        ${showGridLines ? 'border rounded-lg' : ''}
        ${compactLayout ? 'text-sm' : ''}
      `}>
        <table className="w-full">
          <thead>
            <tr className={showGridLines ? 'border-b bg-muted/50' : ''}>
              <th className={`
                text-left p-3 font-medium
                ${showGridLines ? 'border-r' : ''}
              `}>
                {/* Empty header for row labels */}
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={`
                    text-center p-3 font-medium
                    ${showGridLines ? 'border-r last:border-r-0' : ''}
                  `}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={showGridLines ? 'border-b last:border-b-0' : ''}>
                <td className={`
                  p-3 font-medium
                  ${showGridLines ? 'border-r bg-muted/25' : ''}
                `}>
                  {row.label}
                  {(row.required || requireAllRows) && <span className="text-red-500 ml-1">*</span>}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`
                      text-center p-3
                      ${showGridLines ? 'border-r last:border-r-0' : ''}
                    `}
                  >
                    {matrixType === 'radio' && (
                      <RadioGroup
                        value={isRowChecked(row.id, column.id) ? 'selected' : ''}
                        onValueChange={(val) => handleValueChange(row.id, column.id, val === 'selected')}
                        disabled={disabled}
                      >
                        <div className="flex items-center justify-center">
                          <RadioGroupItem value="selected" />
                        </div>
                      </RadioGroup>
                    )}

                    {matrixType === 'checkbox' && (
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={isRowChecked(row.id, column.id)}
                          onCheckedChange={(checked) => handleValueChange(row.id, column.id, checked)}
                          disabled={disabled}
                        />
                      </div>
                    )}

                    {matrixType === 'select' && column.options && (
                      <div className="min-w-[120px]">
                        <Select
                          value={getRowValue(row.id, column.id)}
                          onValueChange={(val) => handleValueChange(row.id, column.id, val)}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {column.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}