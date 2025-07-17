
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { EnhancedOptionConfig } from '../EnhancedOptionConfig';

interface SelectFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function SelectFieldConfig({ field, onConfigChange }: SelectFieldConfigProps) {
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
        fieldType="select"
      />

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="searchable"
            checked={config.searchable || false}
            onCheckedChange={(checked) => onConfigChange({ searchable: checked })}
          />
          <Label htmlFor="searchable">Enable search</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="clearable"
            checked={config.clearable !== false}
            onCheckedChange={(checked) => onConfigChange({ clearable: checked })}
          />
          <Label htmlFor="clearable">Allow clearing selection</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowOther"
            checked={config.allowOther || false}
            onCheckedChange={(checked) => onConfigChange({ allowOther: checked })}
          />
          <Label htmlFor="allowOther">Allow "Other" option</Label>
        </div>
      </div>
    </div>
  );
}
