
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface TimeFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const TIME_FORMATS = [
  { value: '12', label: '12-hour (AM/PM)' },
  { value: '24', label: '24-hour' },
];

export function TimeFieldConfig({ config, onUpdate, errors }: TimeFieldConfigProps) {
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
      <div className="flex items-center space-x-2">
        <Switch
          id="auto-populate"
          checked={customConfig.autoPopulate || false}
          onCheckedChange={(checked) => handleConfigUpdate('autoPopulate', checked)}
        />
        <Label htmlFor="auto-populate">Auto-fill with current time</Label>
      </div>

      <div>
        <Label htmlFor="time-format">Time Format</Label>
        <Select
          value={customConfig.format || '12'}
          onValueChange={(value) => handleConfigUpdate('format', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select time format" />
          </SelectTrigger>
          <SelectContent>
            {TIME_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="default-time">Default Time</Label>
        <Input
          id="default-time"
          type="time"
          value={customConfig.defaultTime || ''}
          onChange={(e) => handleConfigUpdate('defaultTime', e.target.value)}
        />
      </div>
    </div>
  );
}
