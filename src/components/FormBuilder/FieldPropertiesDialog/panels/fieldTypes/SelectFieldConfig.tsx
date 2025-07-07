
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';

interface SelectFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
  fieldType: 'select' | 'multi-select' | 'radio' | 'checkbox';
}

export function SelectFieldConfig({ config, onUpdate, errors, fieldType }: SelectFieldConfigProps) {
  // Ensure options is always an array
  const ensureOptionsArray = (opts: any): any[] => {
    if (Array.isArray(opts)) return opts;
    if (typeof opts === 'string') {
      try {
        const parsed = JSON.parse(opts);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const options = ensureOptionsArray(config.options);

  const handleOptionChange = (optionIndex: number, field: 'value' | 'label', value: string) => {
    const newOptions = [...options];
    if (newOptions[optionIndex]) {
      newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value };
      onUpdate({ options: newOptions });
    }
  };

  const addOption = () => {
    const newOptions = [...options];
    newOptions.push({
      id: `option-${Date.now()}`,
      value: '',
      label: ''
    });
    onUpdate({ options: newOptions });
  };

  const removeOption = (optionIndex: number) => {
    const newOptions = [...options];
    newOptions.splice(optionIndex, 1);
    onUpdate({ options: newOptions });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">
        {fieldType === 'select' ? 'Select' : 
         fieldType === 'multi-select' ? 'Multi-Select' : 
         fieldType === 'radio' ? 'Radio' : 'Checkbox'} Options
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Options</Label>
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus className="h-4 w-4 mr-1" />
            Add Option
          </Button>
        </div>

        <div className="space-y-3">
          {options.map((option: any, optionIndex: number) => (
            <Card key={option.id || optionIndex}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Value</Label>
                      <Input
                        placeholder="Option value"
                        value={option.value || ''}
                        onChange={(e) => handleOptionChange(optionIndex, 'value', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Display Label</Label>
                      <Input
                        placeholder="Display label"
                        value={option.label || ''}
                        onChange={(e) => handleOptionChange(optionIndex, 'label', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(optionIndex)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {options.length === 0 && (
          <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
            <p>No options added yet. Click "Add Option" to get started.</p>
          </div>
        )}

        {errors.options && (
          <p className="text-sm text-red-500">{errors.options}</p>
        )}
      </div>
    </div>
  );
}
