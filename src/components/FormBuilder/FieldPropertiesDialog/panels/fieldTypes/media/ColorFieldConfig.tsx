
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface ColorFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function ColorFieldConfig({ field, onConfigChange }: ColorFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="format">Color Format</Label>
        <select
          id="format"
          value={config.format || 'hex'}
          onChange={(e) => onConfigChange({ format: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="hex">Hex (#FFFFFF)</option>
          <option value="rgb">RGB (255, 255, 255)</option>
          <option value="hsl">HSL (360, 100%, 100%)</option>
        </select>
      </div>

      <div>
        <Label htmlFor="pickerType">Picker Type</Label>
        <select
          id="pickerType"
          value={config.pickerType || 'full'}
          onChange={(e) => onConfigChange({ pickerType: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="full">Full Color Picker</option>
          <option value="swatches">Color Swatches</option>
          <option value="wheel">Color Wheel</option>
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowTransparency"
            checked={config.allowTransparency || false}
            onCheckedChange={(checked) => onConfigChange({ allowTransparency: checked })}
          />
          <Label htmlFor="allowTransparency">Allow transparency/alpha</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showPreview"
            checked={config.showPreview !== false}
            onCheckedChange={(checked) => onConfigChange({ showPreview: checked })}
          />
          <Label htmlFor="showPreview">Show color preview</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showInput"
            checked={config.showInput !== false}
            onCheckedChange={(checked) => onConfigChange({ showInput: checked })}
          />
          <Label htmlFor="showInput">Show text input</Label>
        </div>
      </div>
    </div>
  );
}
