import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';

interface TextFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function TextFieldConfig({ config, onUpdate, errors }: TextFieldConfigProps) {
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
      <h3 className="text-lg font-semibold">Text Field Configuration</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="min-length">Minimum Length</Label>
          <Input
            id="min-length"
            type="number"
            value={config.validation?.minLength ?? ''}
            onChange={(e) => updateValidation('minLength', e.target.value ? Number(e.target.value) : undefined)}
            min={0}
          />
        </div>
        <div>
          <Label htmlFor="max-length">Maximum Length</Label>
          <Input
            id="max-length"
            type="number"
            value={config.validation?.maxLength ?? ''}
            onChange={(e) => updateValidation('maxLength', e.target.value ? Number(e.target.value) : undefined)}
            min={1}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="pattern">Pattern (RegEx)</Label>
        <Input
          id="pattern"
          value={config.validation?.pattern ?? ''}
          onChange={(e) => updateValidation('pattern', e.target.value)}
          placeholder="e.g., ^[A-Za-z]+$"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="auto-trim"
            checked={config.customConfig?.autoTrim !== false}
            onCheckedChange={(checked) => updateCustomConfig('autoTrim', Boolean(checked))}
          />
          <Label htmlFor="auto-trim">Auto-trim whitespace</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="spell-check"
            checked={config.customConfig?.spellCheck !== false}
            onCheckedChange={(checked) => updateCustomConfig('spellCheck', Boolean(checked))}
          />
          <Label htmlFor="spell-check">Enable spell check</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="read-only"
            checked={config.customConfig?.readOnly || false}
            onCheckedChange={(checked) => updateCustomConfig('readOnly', Boolean(checked))}
          />
          <Label htmlFor="read-only">Read-only</Label>
        </div>
      </div>

      {errors.validation && <p className="text-sm text-red-500">{errors.validation}</p>}
    </div>
  );
}
