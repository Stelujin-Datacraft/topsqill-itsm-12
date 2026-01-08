import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { EnhancedOptionConfig } from '../EnhancedOptionConfig';
import { Settings2 } from 'lucide-react';

interface RadioFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function RadioFieldConfig({ field, onConfigChange }: RadioFieldConfigProps) {
  const config = (field.customConfig || {}) as Record<string, any>;

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

  const options = ensureOptionsArray(field.options ?? []);

  const handleOptionsChange = (newOptions: any[]) => {
    onConfigChange({ ...config, options: newOptions });
  };

  return (
    <div className="space-y-4">
      {/* Options Configuration */}
      <EnhancedOptionConfig
        options={options}
        onChange={handleOptionsChange}
        fieldType="radio"
      />

      {/* General Options Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">General Options</h4>
        </div>

        <div className="space-y-3 pl-1">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="clearable"
              checked={config.clearable || false}
              onCheckedChange={(checked) => onConfigChange({ ...config, clearable: checked })}
            />
            <Label htmlFor="clearable">Allow clearing selection</Label>
          </div>
        </div>
      </div>

      {/* Orientation Selector */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Orientation</Label>
        <RadioGroup
          value={config.orientation || 'vertical'}
          onValueChange={(value) => onConfigChange({ ...config, orientation: value })}
        >
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="vertical" id={`${field.id}-vertical`} />
              <Label htmlFor={`${field.id}-vertical`}>Vertical</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="horizontal" id={`${field.id}-horizontal`} />
              <Label htmlFor={`${field.id}-horizontal`}>Horizontal</Label>
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
