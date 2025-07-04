
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface CountryFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function CountryFieldConfig({ field, onConfigChange }: CountryFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="defaultCountry">Default Country</Label>
        <Input
          id="defaultCountry"
          value={config.defaultCountry || ''}
          onChange={(e) => onConfigChange({ defaultCountry: e.target.value })}
          placeholder="e.g., US, GB, CA"
        />
      </div>

      <div>
        <Label htmlFor="allowedCountries">Allowed Countries</Label>
        <Input
          id="allowedCountries"
          value={config.allowedCountries?.join(', ') || ''}
          onChange={(e) => onConfigChange({ 
            allowedCountries: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
          })}
          placeholder="e.g., US, CA, GB, FR (leave empty for all)"
        />
        <p className="text-xs text-gray-500 mt-1">
          Comma-separated list of country codes
        </p>
      </div>

      <div>
        <Label htmlFor="preferred">Preferred Countries</Label>
        <Input
          id="preferred"
          value={config.preferred?.join(', ') || ''}
          onChange={(e) => onConfigChange({ 
            preferred: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
          })}
          placeholder="e.g., US, CA, GB"
        />
        <p className="text-xs text-gray-500 mt-1">
          Show these countries at the top of the list
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showFlags"
            checked={config.showFlags !== false}
            onCheckedChange={(checked) => onConfigChange({ showFlags: checked })}
          />
          <Label htmlFor="showFlags">Show country flags</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="searchable"
            checked={config.searchable !== false}
            onCheckedChange={(checked) => onConfigChange({ searchable: checked })}
          />
          <Label htmlFor="searchable">Enable search</Label>
        </div>
      </div>
    </div>
  );
}
