
import React from 'react';
import { FieldConfiguration } from '../../../hooks/useFieldConfiguration';
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
