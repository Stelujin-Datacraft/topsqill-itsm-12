
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface FileFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function FileFieldConfig({ field, onConfigChange }: FileFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="maxFiles">Maximum Files</Label>
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
          value={config.maxFileSizeMB || 10}
          onChange={(e) => onConfigChange({ maxFileSizeMB: parseInt(e.target.value) || 10 })}
          min="1"
        />
      </div>

      <div>
        <Label htmlFor="acceptedTypes">Accepted File Types</Label>
        <Input
          id="acceptedTypes"
          value={config.acceptedTypes || ''}
          onChange={(e) => onConfigChange({ acceptedTypes: e.target.value })}
          placeholder="e.g., .pdf,.doc,.docx,.jpg,.png"
        />
        <p className="text-xs text-gray-500 mt-1">
          Comma-separated list of file extensions or MIME types
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowMultiple"
            checked={config.allowMultiple || false}
            onCheckedChange={(checked) => onConfigChange({ allowMultiple: checked })}
          />
          <Label htmlFor="allowMultiple">Allow multiple files</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showPreview"
            checked={config.showPreview !== false}
            onCheckedChange={(checked) => onConfigChange({ showPreview: checked })}
          />
          <Label htmlFor="showPreview">Show file preview</Label>
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
