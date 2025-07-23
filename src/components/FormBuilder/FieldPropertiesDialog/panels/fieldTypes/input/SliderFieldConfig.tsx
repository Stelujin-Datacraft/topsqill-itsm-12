import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SliderFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function SliderFieldConfig({ field, onConfigChange }: SliderFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="minValue">Minimum Value</Label>
          <Input
            id="minValue"
            type="number"
            value={(config as any).min || 0}
            onChange={(e) => onConfigChange({ min: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="maxValue">Maximum Value</Label>
          <Input
            id="maxValue"
            type="number"
            value={(config as any).max || 100}
            onChange={(e) => onConfigChange({ max: parseInt(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="step">Step Size</Label>
        <Input
          id="step"
          type="number"
          value={(config as any).step || 1}
          onChange={(e) => onConfigChange({ step: parseInt(e.target.value) })}
          min="1"
        />
      </div>

      <div>
        <Label htmlFor="defaultValue">Default Value</Label>
        <Input
          id="defaultValue"
          type="number"
          value={(config as any).defaultValue || (config as any).min || 0}
          onChange={(e) => onConfigChange({ defaultValue: parseInt(e.target.value) })}
        />
      </div>

      <div>
        <Label htmlFor="orientation">Orientation</Label>
        <Select
          value={config.orientation || 'horizontal'}
          onValueChange={(value) => onConfigChange({ orientation: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="horizontal">Horizontal</SelectItem>
            <SelectItem value="vertical">Vertical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showValue"
            checked={config.showValue !== false}
            onCheckedChange={(checked) => onConfigChange({ showValue: checked })}
          />
          <Label htmlFor="showValue">Show current value</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showTicks"
            checked={config.showTicks || false}
            onCheckedChange={(checked) => onConfigChange({ showTicks: checked })}
          />
          <Label htmlFor="showTicks">Show tick marks</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showLabels"
            checked={config.showLabels || false}
            onCheckedChange={(checked) => onConfigChange({ showLabels: checked })}
          />
          <Label htmlFor="showLabels">Show min/max labels</Label>
        </div>
      </div>
    </div>
  );
}