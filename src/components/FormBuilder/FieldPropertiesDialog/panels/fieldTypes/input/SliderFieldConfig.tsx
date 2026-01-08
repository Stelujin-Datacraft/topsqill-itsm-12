import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Settings2 } from 'lucide-react';

interface SliderFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function SliderFieldConfig({ field, onConfigChange }: SliderFieldConfigProps) {
  const config = (field.customConfig || {}) as Record<string, any>;

  // Use local state for number inputs to ensure they work properly
  const [localMin, setLocalMin] = useState<string>(String(config.min ?? 0));
  const [localMax, setLocalMax] = useState<string>(String(config.max ?? 100));
  const [localStep, setLocalStep] = useState<string>(String(config.step ?? 1));
  const [localDefault, setLocalDefault] = useState<string>(String(config.defaultValue ?? config.min ?? 0));

  // Sync local state with config when field changes
  useEffect(() => {
    setLocalMin(String(config.min ?? 0));
    setLocalMax(String(config.max ?? 100));
    setLocalStep(String(config.step ?? 1));
    setLocalDefault(String(config.defaultValue ?? config.min ?? 0));
  }, [config.min, config.max, config.step, config.defaultValue]);

  const handleMinChange = (value: string) => {
    setLocalMin(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onConfigChange({ min: numValue });
    }
  };

  const handleMaxChange = (value: string) => {
    setLocalMax(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onConfigChange({ max: numValue });
    }
  };

  const handleStepChange = (value: string) => {
    setLocalStep(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      onConfigChange({ step: numValue });
    }
  };

  const handleDefaultChange = (value: string) => {
    setLocalDefault(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onConfigChange({ defaultValue: numValue });
    }
  };

  const minVal = parseInt(localMin, 10) || 0;
  const maxVal = parseInt(localMax, 10) || 100;
  const stepVal = parseInt(localStep, 10) || 1;
  const defaultVal = parseInt(localDefault, 10) || minVal;

  return (
    <div className="space-y-4">
      {/* Range Configuration */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Range Configuration</h4>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minValue">Minimum Value</Label>
            <Input
              id="minValue"
              type="number"
              value={localMin}
              onChange={(e) => handleMinChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxValue">Maximum Value</Label>
            <Input
              id="maxValue"
              type="number"
              value={localMax}
              onChange={(e) => handleMaxChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="step">Step Size</Label>
          <Input
            id="step"
            type="number"
            value={localStep}
            onChange={(e) => handleStepChange(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            min="1"
          />
        </div>
      </div>

      {/* Default Value with Slider Preview */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Default Value</h4>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Slider
              value={[defaultVal]}
              onValueChange={(values) => {
                setLocalDefault(String(values[0]));
                onConfigChange({ defaultValue: values[0] });
              }}
              min={minVal}
              max={maxVal}
              step={stepVal}
              className="flex-1"
            />
            <Input
              id="defaultValue"
              type="number"
              value={localDefault}
              onChange={(e) => handleDefaultChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="w-20"
              min={minVal}
              max={maxVal}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Range: {minVal} to {maxVal} (step: {stepVal})
          </p>
        </div>
      </div>

      {/* Orientation */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Display Options</h4>
        </div>

        <div className="space-y-2">
          <Label htmlFor="orientation">Orientation</Label>
          <Select
            value={config.orientation || 'horizontal'}
            onValueChange={(value) => onConfigChange({ orientation: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="horizontal">Horizontal</SelectItem>
              <SelectItem value="vertical">Vertical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 pt-2">
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
    </div>
  );
}
