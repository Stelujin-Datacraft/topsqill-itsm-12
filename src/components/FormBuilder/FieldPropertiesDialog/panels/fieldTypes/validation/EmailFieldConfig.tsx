
import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface EmailFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

export function EmailFieldConfig({ config, onUpdate, errors }: EmailFieldConfigProps) {
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
        <Label htmlFor="custom-validation-message">Custom Validation Message</Label>
        <Input
          id="custom-validation-message"
          value={customConfig.validationMessage || ''}
          onChange={(e) => handleConfigUpdate('validationMessage', e.target.value)}
          placeholder="Please enter a valid email address"
        />
      </div>

    </div>
  );
}
