import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GeoLocationFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function GeoLocationFieldConfig({ config, onUpdate, errors }: GeoLocationFieldConfigProps) {
  const customConfig = config.customConfig || {};

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inputMethod">Location Input Method</Label>
        <Select
          value={customConfig.inputMethod || 'all'}
          onValueChange={(value) => handleConfigChange('inputMethod', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select input method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gps">GPS Only</SelectItem>
            <SelectItem value="coordinates">Manual Coordinates Only</SelectItem>
            <SelectItem value="all">GPS + Manual Coordinates</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose how users can input their location
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="showAddress"
          checked={customConfig.showAddress !== false}
          onCheckedChange={(checked) => handleConfigChange('showAddress', checked)}
        />
        <Label htmlFor="showAddress">Show address from coordinates</Label>
      </div>
      <p className="text-xs text-muted-foreground ml-6">
        Automatically fetch and display address when location is captured
      </p>
    </div>
  );
}
