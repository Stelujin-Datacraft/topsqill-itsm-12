
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldConfiguration } from '../hooks/useFieldConfiguration';

interface BasicConfigPanelProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  fieldType: string;
  errors: Record<string, string>;
}

export function BasicConfigPanel({ config, onUpdate, fieldType, errors }: BasicConfigPanelProps) {
  const hideBasicFields = ['header', 'description', 'section-break', 'horizontal-line', 'rich-text'];
  const showRequiredField = !hideBasicFields.includes(fieldType);
  const showPlaceholder = !hideBasicFields.includes(fieldType);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="field-label">Label *</Label>
        <Input
          id="field-label"
          value={config.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className={errors.label ? 'border-red-500' : ''}
        />
        {errors.label && <p className="text-sm text-red-500 mt-1">{errors.label}</p>}
      </div>

      {showPlaceholder && (
        <div>
          <Label htmlFor="field-placeholder">Placeholder</Label>
          <Input
            id="field-placeholder"
            value={config.placeholder}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            placeholder="Enter placeholder text..."
          />
        </div>
      )}

      <div>
        <Label htmlFor="field-tooltip">Help Text / Tooltip</Label>
        <Textarea
          id="field-tooltip"
          value={config.tooltip}
          onChange={(e) => onUpdate({ tooltip: e.target.value })}
          rows={2}
          placeholder="Optional help text for users..."
        />
      </div>

      {showRequiredField && (
        <>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="field-required"
              checked={config.required}
              onCheckedChange={(checked) => onUpdate({ required: Boolean(checked) })}
            />
            <Label htmlFor="field-required">Required field</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="field-unique"
              checked={config.validation?.unique || false}
              onCheckedChange={(checked) => onUpdate({ 
                validation: { ...config.validation, unique: Boolean(checked) }
              })}
            />
            <Label htmlFor="field-unique" className="text-sm">
              Unique field (prevent duplicate values)
            </Label>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="field-default">Default Value</Label>
        <Input
          id="field-default"
          value={String(config.defaultValue || '')}
          onChange={(e) => onUpdate({ defaultValue: e.target.value })}
          placeholder="Optional default value..."
        />
      </div>
    </div>
  );
}
