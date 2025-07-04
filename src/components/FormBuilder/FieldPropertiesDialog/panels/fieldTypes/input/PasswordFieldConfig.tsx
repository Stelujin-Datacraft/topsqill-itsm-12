
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface PasswordFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function PasswordFieldConfig({ field, onConfigChange }: PasswordFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="minLength">Minimum Length</Label>
        <Input
          id="minLength"
          type="number"
          value={config.minLength || ''}
          onChange={(e) => onConfigChange({ minLength: e.target.value ? parseInt(e.target.value) : undefined })}
          min="1"
        />
      </div>

      <div>
        <Label htmlFor="maxLength">Maximum Length</Label>
        <Input
          id="maxLength"
          type="number"
          value={config.maxLength || ''}
          onChange={(e) => onConfigChange({ maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
          min="1"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showStrength"
            checked={config.showStrength || false}
            onCheckedChange={(checked) => onConfigChange({ showStrength: checked })}
          />
          <Label htmlFor="showStrength">Show password strength indicator</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showToggle"
            checked={config.showToggle !== false}
            onCheckedChange={(checked) => onConfigChange({ showToggle: checked })}
          />
          <Label htmlFor="showToggle">Show show/hide toggle</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireUppercase"
            checked={config.requireUppercase || false}
            onCheckedChange={(checked) => onConfigChange({ requireUppercase: checked })}
          />
          <Label htmlFor="requireUppercase">Require uppercase letters</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireLowercase"
            checked={config.requireLowercase || false}
            onCheckedChange={(checked) => onConfigChange({ requireLowercase: checked })}
          />
          <Label htmlFor="requireLowercase">Require lowercase letters</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireNumbers"
            checked={config.requireNumbers || false}
            onCheckedChange={(checked) => onConfigChange({ requireNumbers: checked })}
          />
          <Label htmlFor="requireNumbers">Require numbers</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireSpecialChars"
            checked={config.requireSpecialChars || false}
            onCheckedChange={(checked) => onConfigChange({ requireSpecialChars: checked })}
          />
          <Label htmlFor="requireSpecialChars">Require special characters</Label>
        </div>
      </div>
    </div>
  );
}
