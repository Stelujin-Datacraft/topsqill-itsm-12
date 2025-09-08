import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';

interface NumberFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function NumberFieldConfig({ config, onUpdate, errors }: NumberFieldConfigProps) {
  const updateValidation = (key: string, value: any) => {
    onUpdate({
      validation: { ...config.validation, [key]: value }
    });
  };

  const updateCustomConfig = (key: string, value: any) => {
    onUpdate({
      customConfig: { ...config.customConfig, [key]: value }
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Number Field Configuration</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="min">Minimum Value</Label>
          <Input
            id="min"
            type="number"
            value={config.validation?.min ?? ''}
            onChange={(e) => updateValidation('min', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>

        <div>
          <Label htmlFor="max">Maximum Value</Label>
          <Input
            id="max"
            type="number"
            value={config.validation?.max ?? ''}
            onChange={(e) => updateValidation('max', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>

        <div>
          <Label htmlFor="step">Step</Label>
          <Input
            id="step"
            type="number"
            step="0.01"
            value={config.customConfig?.step ?? 1}
            onChange={(e) => updateCustomConfig('step', Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="maxDigits">Maximum Digits</Label>
        <Input
          id="maxDigits"
          type="number"
          value={config.customConfig?.maxDigits ?? ''}
          onChange={(e) => updateCustomConfig('maxDigits', e.target.value ? Number(e.target.value) : undefined)}
          min={1}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="read-only"
          checked={config.customConfig?.readOnly || false}
          onCheckedChange={(checked) => updateCustomConfig('readOnly', Boolean(checked))}
        />
        <Label htmlFor="read-only">Read-only</Label>
      </div>

      {errors.validation && <p className="text-sm text-red-500">{errors.validation}</p>}
    </div>
  );
}
