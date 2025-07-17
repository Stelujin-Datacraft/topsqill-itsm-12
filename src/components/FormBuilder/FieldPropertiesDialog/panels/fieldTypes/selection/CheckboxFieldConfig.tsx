
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { EnhancedOptionConfig } from '../EnhancedOptionConfig';

interface CheckboxFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function CheckboxFieldConfig({ field, onConfigChange }: CheckboxFieldConfigProps) {
  const config = field.customConfig || {};
  
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
  
  const options = ensureOptionsArray(field.options);

  const handleOptionsChange = (newOptions: any[]) => {
    onConfigChange({ options: newOptions });
  };

  return (
    <div className="space-y-4">
      <EnhancedOptionConfig
        options={options}
        onChange={handleOptionsChange}
        fieldType="checkbox"
      />

      <div>
        <Label className="text-sm font-medium mb-2 block">Orientation</Label>
        <RadioGroup
          value={config.orientation || 'vertical'}
          onValueChange={(value) => onConfigChange({ orientation: value })}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="vertical" id="vertical" />
            <Label htmlFor="vertical">Vertical</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="horizontal" id="horizontal" />
            <Label htmlFor="horizontal">Horizontal</Label>
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label htmlFor="maxSelections">Max Selections</Label>
        <Input
          id="maxSelections"
          type="number"
          value={config.maxSelections || ''}
          onChange={(e) => onConfigChange({ maxSelections: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder="No limit"
          min="1"
        />
      </div>
    </div>
  );
}
