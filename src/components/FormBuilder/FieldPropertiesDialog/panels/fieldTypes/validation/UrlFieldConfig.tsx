
import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UrlFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const PROTOCOL_OPTIONS = [
  { value: 'any', label: 'Any Protocol (http/https)' },
  { value: 'https', label: 'HTTPS Only' },
  { value: 'http', label: 'HTTP Only' },
];

export function UrlFieldConfig({ config, onUpdate, errors }: UrlFieldConfigProps) {
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
          id="real-time-validation"
          checked={customConfig.realTimeValidation !== false}
          onCheckedChange={(checked) => handleConfigUpdate('realTimeValidation', checked)}
        />
        <Label htmlFor="real-time-validation">Real-time Validation</Label>
      </div>

      <div>
        <Label htmlFor="protocol-restriction">Protocol Restriction</Label>
        <Select
          value={customConfig.protocolRestriction || 'any'}
          onValueChange={(value) => handleConfigUpdate('protocolRestriction', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select protocol restriction" />
          </SelectTrigger>
          <SelectContent>
            {PROTOCOL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="custom-validation-message">Custom Validation Message</Label>
        <Input
          id="custom-validation-message"
          value={customConfig.validationMessage || ''}
          onChange={(e) => handleConfigUpdate('validationMessage', e.target.value)}
          placeholder="Please enter a valid URL"
        />
      </div>
    </div>
  );
}
