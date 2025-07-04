
import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

interface AddressFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const ADDRESS_FIELDS = [
  { id: 'street', label: 'Street Address', required: true },
  { id: 'city', label: 'City', required: true },
  { id: 'state', label: 'State/Province', required: true },
  { id: 'postal', label: 'Postal/ZIP Code', required: true },
  { id: 'country', label: 'Country', required: true },
];

export function AddressFieldConfig({ config, onUpdate, errors }: AddressFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const addressFields = customConfig.addressFields || ADDRESS_FIELDS.map(f => f.id);

  const handleConfigUpdate = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value,
      },
    });
  };

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    const updatedFields = checked
      ? [...addressFields, fieldId]
      : addressFields.filter((id: string) => id !== fieldId);
    
    handleConfigUpdate('addressFields', updatedFields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="gps-autofill"
          checked={customConfig.enableGPS || false}
          onCheckedChange={(checked) => handleConfigUpdate('enableGPS', checked)}
        />
        <Label htmlFor="gps-autofill">Enable GPS Auto-fill</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="postal-autofill"
          checked={customConfig.postalAutoFill || false}
          onCheckedChange={(checked) => handleConfigUpdate('postalAutoFill', checked)}
        />
        <Label htmlFor="postal-autofill">Auto-fill from Postal Code</Label>
      </div>

      <div>
        <Label>Visible Address Fields</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {ADDRESS_FIELDS.map((field) => (
            <div key={field.id} className="flex items-center space-x-2">
              <Checkbox
                id={field.id}
                checked={addressFields.includes(field.id)}
                onCheckedChange={(checked) => handleFieldToggle(field.id, checked as boolean)}
                disabled={field.required}
              />
              <Label htmlFor={field.id} className={field.required ? 'text-gray-500' : ''}>
                {field.label}
                {field.required && ' (Required)'}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
