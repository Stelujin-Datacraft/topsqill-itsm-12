
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface SectionBreakFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const WIDTH_OPTIONS = [
  { value: 'full', label: 'Full Width' },
  { value: 'half', label: 'Half Width' },
  { value: 'quarter', label: 'Quarter Width' },
];

const BREAK_TYPES = [
  { value: 'empty', label: 'Empty Space' },
  { value: 'bordered', label: 'With Border' },
  { value: 'colored', label: 'Colored Background' },
];

const BORDER_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

export function SectionBreakFieldConfig({ config, onUpdate, errors }: SectionBreakFieldConfigProps) {
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
      <div>
        <Label htmlFor="section-title">Section Title (Optional)</Label>
        <Input
          id="section-title"
          value={customConfig.title || ''}
          onChange={(e) => handleConfigUpdate('title', e.target.value)}
          placeholder="Enter section title..."
        />
      </div>

      <div>
        <Label htmlFor="width-option">Width</Label>
        <Select
          value={customConfig.width || 'full'}
          onValueChange={(value) => handleConfigUpdate('width', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select width" />
          </SelectTrigger>
          <SelectContent>
            {WIDTH_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="break-type">Section Break Type</Label>
        <Select
          value={customConfig.breakType || 'empty'}
          onValueChange={(value) => handleConfigUpdate('breakType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select break type" />
          </SelectTrigger>
          <SelectContent>
            {BREAK_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {customConfig.breakType === 'bordered' && (
        <div>
          <Label htmlFor="border-style">Border Style</Label>
          <Select
            value={customConfig.borderStyle || 'solid'}
            onValueChange={(value) => handleConfigUpdate('borderStyle', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select border style" />
            </SelectTrigger>
            <SelectContent>
              {BORDER_STYLES.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(customConfig.breakType === 'colored' || customConfig.breakType === 'bordered') && (
        <div>
          <Label htmlFor="background-color">
            {customConfig.breakType === 'colored' ? 'Background Color' : 'Border Color'}
          </Label>
          <Input
            id="background-color"
            type="color"
            value={customConfig.backgroundColor || '#f3f4f6'}
            onChange={(e) => handleConfigUpdate('backgroundColor', e.target.value)}
            className="w-full h-10"
          />
        </div>
      )}

      <div>
        <Label htmlFor="spacing">Spacing (px)</Label>
        <Input
          id="spacing"
          type="number"
          value={customConfig.spacing || '20'}
          onChange={(e) => handleConfigUpdate('spacing', e.target.value)}
          placeholder="20"
          min="0"
          max="100"
        />
      </div>
    </div>
  );
}
