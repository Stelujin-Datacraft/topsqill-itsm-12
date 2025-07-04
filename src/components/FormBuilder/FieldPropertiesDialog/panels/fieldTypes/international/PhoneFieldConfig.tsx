
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface PhoneFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function PhoneFieldConfig({ field, onConfigChange }: PhoneFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="defaultCountry">Default Country</Label>
        <Input
          id="defaultCountry"
          value={config.defaultCountry || 'US'}
          onChange={(e) => onConfigChange({ defaultCountry: e.target.value })}
          placeholder="US"
        />
      </div>

      <div>
        <Label htmlFor="format">Display Format</Label>
        <select
          id="format"
          value={config.format || 'international'}
          onChange={(e) => onConfigChange({ format: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="international">International (+1 234 567 8900)</option>
          <option value="national">National (234 567 8900)</option>
          <option value="e164">E.164 (+12345678900)</option>
        </select>
      </div>

      <div>
        <Label htmlFor="allowedCountries">Allowed Countries</Label>
        <Input
          id="allowedCountries"
          value={config.allowedCountries?.join(', ') || ''}
          onChange={(e) => onConfigChange({ 
            allowedCountries: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
          })}
          placeholder="e.g., US, CA, GB (leave empty for all)"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showCountrySelector"
            checked={config.showCountrySelector !== false}
            onCheckedChange={(checked) => onConfigChange({ showCountrySelector: checked })}
          />
          <Label htmlFor="showCountrySelector">Show country selector</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="autoFormat"
            checked={config.autoFormat !== false}
            onCheckedChange={(checked) => onConfigChange({ autoFormat: checked })}
          />
          <Label htmlFor="autoFormat">Auto-format as user types</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="validateFormat"
            checked={config.validateFormat !== false}
            onCheckedChange={(checked) => onConfigChange({ validateFormat: checked })}
          />
          <Label htmlFor="validateFormat">Validate phone number format</Label>
        </div>
      </div>
    </div>
  );
}
