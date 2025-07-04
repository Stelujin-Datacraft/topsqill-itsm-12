
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface HorizontalLineFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const LINE_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

export function HorizontalLineFieldConfig({ config, onUpdate, errors }: HorizontalLineFieldConfigProps) {
  const customConfig = config.customConfig || {};

  const handleConfigUpdate = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="line-color">Line Color</Label>
        <Input
          id="line-color"
          type="color"
          value={customConfig.lineColor || '#e5e7eb'}
          onChange={(e) => handleConfigUpdate('lineColor', e.target.value)}
          className="w-full h-10"
        />
      </div>

      <div>
        <Label htmlFor="line-style">Line Style</Label>
        <Select
          value={customConfig.lineStyle || 'solid'}
          onValueChange={(value) => handleConfigUpdate('lineStyle', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select line style" />
          </SelectTrigger>
          <SelectContent>
            {LINE_STYLES.map((style) => (
              <SelectItem key={style.value} value={style.value}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="thickness">Line Thickness (px)</Label>
        <Input
          id="thickness"
          type="number"
          value={customConfig.thickness || '1'}
          onChange={(e) => handleConfigUpdate('thickness', e.target.value)}
          placeholder="1"
          min="1"
          max="10"
        />
      </div>

      <div>
        <Label htmlFor="margin">Margin (px)</Label>
        <Input
          id="margin"
          value={customConfig.margin || '16px 0'}
          onChange={(e) => handleConfigUpdate('margin', e.target.value)}
          placeholder="16px 0"
        />
        <p className="text-sm text-gray-500 mt-1">
          Use CSS margin format (e.g., "16px 0" for top/bottom margin)
        </p>
      </div>
    </div>
  );
}
