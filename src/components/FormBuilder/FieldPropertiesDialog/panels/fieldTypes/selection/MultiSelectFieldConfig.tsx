import React, { useState, useEffect } from 'react';
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
  
  // Use local state for maxSelections to ensure input works properly
  const [localMaxSelections, setLocalMaxSelections] = useState<string>(
    config.maxSelections !== undefined ? String(config.maxSelections) : ''
  );

  // Sync local state with config when field changes
  useEffect(() => {
    setLocalMaxSelections(config.maxSelections !== undefined ? String(config.maxSelections) : '');
  }, [config.maxSelections]);

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
    onConfigChange({ options: newOptions });
  };

  const handleMaxSelectionsChange = (value: string) => {
    setLocalMaxSelections(value);
    const newMax = value === '' ? undefined : parseInt(value, 10);
    if (value === '' || (!isNaN(newMax!) && newMax! > 0)) {
      onConfigChange({ maxSelections: newMax });
    }
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
              onCheckedChange={(checked) => onConfigChange({ searchable: checked })}
            />
            <Label htmlFor="searchable">Enable search</Label>
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
            value={localMaxSelections}
            onChange={(e) => handleMaxSelectionsChange(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
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
