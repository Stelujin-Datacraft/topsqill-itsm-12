
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { EnhancedOptionConfig } from './EnhancedOptionConfig';
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

  const handleOptionsChange = (newOptions: any[]) => {
    console.log('SelectFieldConfig: Options changed:', newOptions);
    onUpdate({ options: newOptions });
  };

  return (
    <div className="space-y-4">
      <EnhancedOptionConfig
        options={options}
        onChange={handleOptionsChange}
        fieldType={fieldType}
      />

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="searchable"
            checked={config.customConfig?.searchable || false}
            onCheckedChange={(checked) => onUpdate({ customConfig: { ...config.customConfig, searchable: checked } })}
          />
          <Label htmlFor="searchable">Enable search</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="clearable"
            checked={config.customConfig?.clearable !== false}
            onCheckedChange={(checked) => onUpdate({ customConfig: { ...config.customConfig, clearable: checked } })}
          />
          <Label htmlFor="clearable">Allow clearing selection</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowOther"
            checked={config.customConfig?.allowOther || false}
            onCheckedChange={(checked) => onUpdate({ customConfig: { ...config.customConfig, allowOther: checked } })}
          />
          <Label htmlFor="allowOther">Allow "Other" option</Label>
        </div>
      </div>
    </div>
  );
}
