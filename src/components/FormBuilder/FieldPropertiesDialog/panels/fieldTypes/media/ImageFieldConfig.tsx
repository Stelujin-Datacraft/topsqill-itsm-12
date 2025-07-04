
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface ImageFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function ImageFieldConfig({ field, onConfigChange }: ImageFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="maxFiles">Maximum Images</Label>
        <Input
          id="maxFiles"
          type="number"
          value={config.maxFiles || 1}
          onChange={(e) => onConfigChange({ maxFiles: parseInt(e.target.value) || 1 })}
          min="1"
        />
      </div>

      <div>
        <Label htmlFor="maxFileSizeMB">Max File Size (MB)</Label>
        <Input
          id="maxFileSizeMB"
          type="number"
          value={config.maxFileSizeMB || 5}
          onChange={(e) => onConfigChange({ maxFileSizeMB: parseInt(e.target.value) || 5 })}
          min="1"
        />
      </div>

      <div>
        <Label htmlFor="cropAspectRatio">Crop Aspect Ratio</Label>
        <select
          id="cropAspectRatio"
          value={config.cropAspectRatio || ''}
          onChange={(e) => onConfigChange({ cropAspectRatio: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="">No cropping</option>
          <option value="1:1">Square (1:1)</option>
          <option value="4:3">Standard (4:3)</option>
          <option value="16:9">Widescreen (16:9)</option>
          <option value="3:2">Photo (3:2)</option>
        </select>
      </div>

      <div>
        <Label htmlFor="thumbnailSize">Thumbnail Size</Label>
        <select
          id="thumbnailSize"
          value={config.thumbnailSize || 'medium'}
          onChange={(e) => onConfigChange({ thumbnailSize: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="small">Small (100px)</option>
          <option value="medium">Medium (200px)</option>
          <option value="large">Large (300px)</option>
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowMultiple"
            checked={config.allowMultiple || false}
            onCheckedChange={(checked) => onConfigChange({ allowMultiple: checked })}
          />
          <Label htmlFor="allowMultiple">Allow multiple images</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="enableCrop"
            checked={config.enableCrop || false}
            onCheckedChange={(checked) => onConfigChange({ enableCrop: checked })}
          />
          <Label htmlFor="enableCrop">Enable image cropping</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowDragDrop"
            checked={config.allowDragDrop !== false}
            onCheckedChange={(checked) => onConfigChange({ allowDragDrop: checked })}
          />
          <Label htmlFor="allowDragDrop">Enable drag & drop</Label>
        </div>
      </div>
    </div>
  );
}
