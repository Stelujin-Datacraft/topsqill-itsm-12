import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { EnhancedOptionConfig } from '../EnhancedOptionConfig';
import { Settings2 } from 'lucide-react';

interface MultiSelectFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function MultiSelectFieldConfig({ field, onConfigChange }: MultiSelectFieldConfigProps) {
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
      {/* Options Configuration - Same as Dropdown */}
      <EnhancedOptionConfig
        options={options}
        onChange={handleOptionsChange}
        fieldType="multi-select"
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
              id="searchable"
              checked={config.searchable !== false}
              onCheckedChange={(checked) => onConfigChange({ ...config, searchable: checked })}
            />
            <Label htmlFor="searchable">Enable search</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="allowOther"
              checked={config.allowOther || false}
              onCheckedChange={(checked) => onConfigChange({ ...config, allowOther: checked })}
            />
            <Label htmlFor="allowOther">Allow "Other" option</Label>
          </div>
        </div>
      </div>

      {/* Validation Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Validation</h4>
        </div>

        <div className="space-y-2 pl-1">
          <Label htmlFor="maxSelections">Maximum Selections</Label>
          <Input
            id="maxSelections"
            type="number"
            value={config.maxSelections ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onConfigChange({ 
                ...config, 
                maxSelections: val === '' ? undefined : parseInt(val, 10)
              });
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="Leave empty for unlimited"
            min="1"
          />
          <p className="text-xs text-muted-foreground">
            Limit how many options users can select
          </p>
        </div>
      </div>
    </div>
  );
}
