
import React from 'react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface CountryFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function CountryFieldConfig({ config, onUpdate, errors }: CountryFieldConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="defaultCountry">Default Country</Label>
        <Input
          id="defaultCountry"
          value={config.customConfig?.defaultCountry || ''}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              defaultCountry: e.target.value 
            } 
          })}
          placeholder="e.g., US, GB, CA"
        />
      </div>

      <div>
        <Label htmlFor="allowedCountries">Allowed Countries</Label>
        <Input
          id="allowedCountries"
          value={config.customConfig?.allowedCountries?.join(', ') || ''}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              allowedCountries: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
            } 
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
          value={config.customConfig?.preferred?.join(', ') || ''}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              preferred: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
            } 
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
            checked={config.customConfig?.showFlags !== false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                showFlags: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="showFlags">Show country flags</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="searchable"
            checked={config.customConfig?.searchable !== false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                searchable: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="searchable">Enable search</Label>
        </div>
      </div>
    </div>
  );
}
