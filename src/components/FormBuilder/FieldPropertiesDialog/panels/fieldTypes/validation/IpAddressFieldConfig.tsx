
import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IpAddressFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const IP_VERSIONS = [
  { value: 'both', label: 'IPv4 and IPv6' },
  { value: 'ipv4', label: 'IPv4 Only' },
  { value: 'ipv6', label: 'IPv6 Only' },
];

export function IpAddressFieldConfig({ config, onUpdate, errors }: IpAddressFieldConfigProps) {
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
        <Label htmlFor="ip-version">IP Version</Label>
        <Select
          value={customConfig.version || 'both'}
          onValueChange={(value) => handleConfigUpdate('version', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select IP version" />
          </SelectTrigger>
          <SelectContent>
            {IP_VERSIONS.map((version) => (
              <SelectItem key={version.value} value={version.value}>
                {version.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="input-mask"
          checked={customConfig.showInputMask || false}
          onCheckedChange={(checked) => handleConfigUpdate('showInputMask', checked)}
        />
        <Label htmlFor="input-mask">Show Input Format Guide</Label>
      </div>

      <div>
        <Label htmlFor="custom-validation-message">Custom Validation Message</Label>
        <Input
          id="custom-validation-message"
          value={customConfig.validationMessage || ''}
          onChange={(e) => handleConfigUpdate('validationMessage', e.target.value)}
          placeholder="Please enter a valid IP address"
        />
      </div>
    </div>
  );
}
