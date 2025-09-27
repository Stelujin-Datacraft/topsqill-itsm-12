import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface MatrixGridFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

interface MatrixRow {
  label: string;
  type: 'radio' | 'checkbox' | 'dropdown' | 'text';
  options?: string[];
}

export function MatrixGridField({ field, value = {}, onChange, error, disabled }: MatrixGridFieldProps) {
  const config = field.customConfig || {};
  const rows: MatrixRow[] = (config.rows as unknown as MatrixRow[]) || [];

  const handleValueChange = (rowIndex: number, newValue: any) => {
    if (disabled) return;

    const currentValue = { ...value };
    currentValue[rowIndex] = newValue;
    onChange?.(currentValue);
  };

  const handleCheckboxChange = (rowIndex: number, optionValue: string, checked: boolean) => {
    if (disabled) return;

    const currentValue = { ...value };
    const currentRowValue = currentValue[rowIndex] || [];
    
    if (checked) {
      // Add option if not already present
      if (!currentRowValue.includes(optionValue)) {
        currentValue[rowIndex] = [...currentRowValue, optionValue];
      }
    } else {
      // Remove option
      currentValue[rowIndex] = currentRowValue.filter((v: string) => v !== optionValue);
    }
    
    onChange?.(currentValue);
  };

  if (rows.length === 0) {
    return (
      <div className="w-full p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center">
        <p className="text-muted-foreground mb-2">Matrix Grid: {field.label}</p>
        <p className="text-sm text-muted-foreground">No rows configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* <Label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label> */}

      <div className="space-y-4">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Label className="font-medium">{row.label}</Label>
            </div>

            {/* Render based on row type */}
            {row.type === 'text' && (
              <Input
                value={value[rowIndex] || ''}
                onChange={(e) => handleValueChange(rowIndex, e.target.value)}
                disabled={disabled}
                placeholder="Enter text..."
              />
            )}

            {row.type === 'radio' && row.options && (
              <RadioGroup
                value={value[rowIndex] || ''}
                onValueChange={(val) => handleValueChange(rowIndex, val)}
                disabled={disabled}
              >
                <div className="flex flex-wrap gap-4">
                  {row.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`${rowIndex}-${optionIndex}`} />
                      <Label htmlFor={`${rowIndex}-${optionIndex}`} className="text-sm">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}

            {row.type === 'checkbox' && row.options && (
              <div className="flex flex-wrap gap-4">
                {row.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${rowIndex}-${optionIndex}`}
                      checked={(value[rowIndex] || []).includes(option)}
                      onCheckedChange={(checked) => handleCheckboxChange(rowIndex, option, !!checked)}
                      disabled={disabled}
                    />
                    <Label htmlFor={`${rowIndex}-${optionIndex}`} className="text-sm">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {row.type === 'dropdown' && row.options && (
              <Select
                value={value[rowIndex] || ''}
                onValueChange={(val) => handleValueChange(rowIndex, val)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  {row.options.map((option, optionIndex) => (
                    <SelectItem key={optionIndex} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}