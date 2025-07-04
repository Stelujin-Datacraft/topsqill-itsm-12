
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

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
          <Label htmlFor="min">Minimum Value</Label>
          <Input
            id="min"
            type="number"
            value={config.min || 0}
            onChange={(e) => onConfigChange({ min: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="max">Maximum Value</Label>
          <Input
            id="max"
            type="number"
            value={config.max || 100}
            onChange={(e) => onConfigChange({ max: parseInt(e.target.value) || 100 })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="step">Step</Label>
        <Input
          id="step"
          type="number"
          value={config.step || 1}
          onChange={(e) => onConfigChange({ step: parseInt(e.target.value) || 1 })}
          min="1"
        />
      </div>

      <div>
        <Label htmlFor="unit">Unit</Label>
        <Input
          id="unit"
          value={config.unit || ''}
          onChange={(e) => onConfigChange({ unit: e.target.value })}
          placeholder="e.g., px, %, kg"
        />
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
            id="showRange"
            checked={config.showRange || false}
            onCheckedChange={(checked) => onConfigChange({ showRange: checked })}
          />
          <Label htmlFor="showRange">Show min/max labels</Label>
        </div>
      </div>
    </div>
  );
}
