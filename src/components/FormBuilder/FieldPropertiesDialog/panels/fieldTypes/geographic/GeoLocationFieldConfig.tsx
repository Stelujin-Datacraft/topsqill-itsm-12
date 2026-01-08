import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="requiredAccuracy">Required Accuracy (meters)</Label>
        <Input
          id="requiredAccuracy"
          type="number"
          min="1"
          max="1000"
          value={customConfig.requiredAccuracy || 100}
          onChange={(e) => handleConfigChange('requiredAccuracy', parseInt(e.target.value) || 100)}
        />
        <p className="text-xs text-muted-foreground">
          GPS readings with accuracy worse than this will show a warning
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
    </div>
  );
}
