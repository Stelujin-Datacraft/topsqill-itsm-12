
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface ToggleSwitchFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function ToggleSwitchFieldConfig({ field, onConfigChange }: ToggleSwitchFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="onLabel">On Label</Label>
        <Input
          id="onLabel"
          value={config.onLabel || ''}
          onChange={(e) => onConfigChange({ onLabel: e.target.value })}
          placeholder="On"
        />
      </div>

      <div>
        <Label htmlFor="offLabel">Off Label</Label>
        <Input
          id="offLabel"
          value={config.offLabel || ''}
          onChange={(e) => onConfigChange({ offLabel: e.target.value })}
          placeholder="Off"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="showLabels"
          checked={config.showLabels !== false}
          onCheckedChange={(checked) => onConfigChange({ showLabels: checked })}
        />
        <Label htmlFor="showLabels">Show labels</Label>
      </div>

      <div>
        <Label htmlFor="size">Size</Label>
        <select
          id="size"
          value={config.size || 'default'}
          onChange={(e) => onConfigChange({ size: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="sm">Small</option>
          <option value="default">Default</option>
          <option value="lg">Large</option>
        </select>
      </div>
    </div>
  );
}
