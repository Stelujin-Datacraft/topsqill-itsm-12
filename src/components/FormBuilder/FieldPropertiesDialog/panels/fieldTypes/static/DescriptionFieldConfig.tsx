
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface DescriptionFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const FONT_FAMILIES = [
  { value: 'inherit', label: 'Default' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Courier New, monospace', label: 'Courier New' },
];

const ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
];

export function DescriptionFieldConfig({ config, onUpdate, errors }: DescriptionFieldConfigProps) {
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
        <Label htmlFor="description-content">Description Content</Label>
        <RichTextEditor
          id="description-content"
          value={customConfig.content || ''}
          onChange={(content) => handleConfigUpdate('content', content)}
          placeholder="Enter description text..."
          rows={4}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="collapsible"
          checked={customConfig.collapsible || false}
          onCheckedChange={(checked) => handleConfigUpdate('collapsible', checked)}
        />
        <Label htmlFor="collapsible">Make Collapsible</Label>
      </div>

      {customConfig.collapsible && (
        <div className="flex items-center space-x-2">
          <Switch
            id="start-collapsed"
            checked={customConfig.startCollapsed || false}
            onCheckedChange={(checked) => handleConfigUpdate('startCollapsed', checked)}
          />
          <Label htmlFor="start-collapsed">Start Collapsed</Label>
        </div>
      )}

      <div>
        <Label htmlFor="font-family">Font Family</Label>
        <Select
          value={customConfig.fontFamily || 'inherit'}
          onValueChange={(value) => handleConfigUpdate('fontFamily', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select font family" />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="font-size">Font Size (px)</Label>
        <Input
          id="font-size"
          type="number"
          value={customConfig.fontSize?.replace('px', '') || ''}
          onChange={(e) => handleConfigUpdate('fontSize', e.target.value ? `${e.target.value}px` : undefined)}
          placeholder="14"
          min="10"
          max="24"
        />
      </div>

      <div>
        <Label htmlFor="font-weight">Font Weight</Label>
        <Select
          value={customConfig.fontWeight || 'normal'}
          onValueChange={(value) => handleConfigUpdate('fontWeight', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select font weight" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
            <SelectItem value="lighter">Light</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="text-alignment">Text Alignment</Label>
        <Select
          value={customConfig.alignment || 'left'}
          onValueChange={(value) => handleConfigUpdate('alignment', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select alignment" />
          </SelectTrigger>
          <SelectContent>
            {ALIGNMENTS.map((alignment) => (
              <SelectItem key={alignment.value} value={alignment.value}>
                {alignment.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="text-color">Text Color</Label>
        <Input
          id="text-color"
          type="color"
          value={customConfig.color || '#666666'}
          onChange={(e) => handleConfigUpdate('color', e.target.value)}
          className="w-full h-10"
        />
      </div>
    </div>
  );
}
