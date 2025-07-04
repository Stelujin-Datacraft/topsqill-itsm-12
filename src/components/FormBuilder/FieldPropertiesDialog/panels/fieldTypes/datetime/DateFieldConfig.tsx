
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface DateFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const DATE_FORMATS = [
  { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy (US)' },
  { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy (EU)' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd (ISO)' },
  { value: 'MMM dd, yyyy', label: 'MMM dd, yyyy (Long)' },
];

export function DateFieldConfig({ config, onUpdate, errors }: DateFieldConfigProps) {
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
        <Label htmlFor="auto-populate">Auto-fill with current date</Label>
      </div>

      <div>
        <Label htmlFor="date-format">Date Format</Label>
        <Select
          value={customConfig.format || 'MM/dd/yyyy'}
          onValueChange={(value) => handleConfigUpdate('format', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select date format" />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="min-date">Minimum Date</Label>
        <Input
          id="min-date"
          type="date"
          value={customConfig.minDate || ''}
          onChange={(e) => handleConfigUpdate('minDate', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="max-date">Maximum Date</Label>
        <Input
          id="max-date"
          type="date"
          value={customConfig.maxDate || ''}
          onChange={(e) => handleConfigUpdate('maxDate', e.target.value)}
        />
      </div>
    </div>
  );
}
