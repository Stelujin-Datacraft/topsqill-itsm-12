
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface DateTimeFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const DATETIME_FORMATS = [
  { value: 'MM/dd/yyyy hh:mm a', label: 'MM/dd/yyyy hh:mm AM/PM' },
  { value: 'dd/MM/yyyy HH:mm', label: 'dd/MM/yyyy HH:mm (24h)' },
  { value: 'yyyy-MM-dd HH:mm', label: 'yyyy-MM-dd HH:mm (ISO)' },
  { value: 'MMM dd, yyyy hh:mm a', label: 'MMM dd, yyyy hh:mm AM/PM' },
];

export function DateTimeFieldConfig({ config, onUpdate, errors }: DateTimeFieldConfigProps) {
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
        <Label htmlFor="auto-populate">Auto-fill with current date & time</Label>
      </div>

      <div>
        <Label htmlFor="datetime-format">Date & Time Format</Label>
        <Select
          value={customConfig.format || 'MM/dd/yyyy hh:mm a'}
          onValueChange={(value) => handleConfigUpdate('format', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select date/time format" />
          </SelectTrigger>
          <SelectContent>
            {DATETIME_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
