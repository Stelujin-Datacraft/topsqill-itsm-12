
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RichTextFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const TOOLBAR_OPTIONS = [
  { id: 'bold', label: 'Bold' },
  { id: 'italic', label: 'Italic' },
  { id: 'underline', label: 'Underline' },
  { id: 'list', label: 'Lists' },
  { id: 'link', label: 'Links' },
  { id: 'image', label: 'Images' },
  { id: 'align', label: 'Text Alignment' },
  { id: 'color', label: 'Text Color' },
];

export function RichTextFieldConfig({ config, onUpdate, errors }: RichTextFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const editorToolbar = customConfig.editorToolbar || ['bold', 'italic', 'underline', 'list'];

  const handleConfigUpdate = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value,
      },
    });
  };

  const handleToolbarToggle = (toolbarItem: string, checked: boolean) => {
    const updatedToolbar = checked
      ? [...editorToolbar, toolbarItem]
      : editorToolbar.filter((item: string) => item !== toolbarItem);
    
    handleConfigUpdate('editorToolbar', updatedToolbar);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Editor Toolbar Options</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {TOOLBAR_OPTIONS.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={option.id}
                checked={editorToolbar.includes(option.id)}
                onCheckedChange={(checked) => handleToolbarToggle(option.id, checked as boolean)}
              />
              <Label htmlFor={option.id}>{option.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="allow-html"
          checked={customConfig.allowHtml || false}
          onCheckedChange={(checked) => handleConfigUpdate('allowHtml', checked)}
        />
        <Label htmlFor="allow-html">Allow Raw HTML</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max-content-length">Maximum Content Length</Label>
        <Input
          id="max-content-length"
          type="number"
          value={customConfig.maxContentLength || ''}
          onChange={(e) => handleConfigUpdate('maxContentLength', parseInt(e.target.value) || undefined)}
          placeholder="Leave empty for no limit"
        />
      </div>
    </div>
  );
}
