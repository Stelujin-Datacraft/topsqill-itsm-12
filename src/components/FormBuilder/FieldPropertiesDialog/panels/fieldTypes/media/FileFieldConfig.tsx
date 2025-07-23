import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FileFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function FileFieldConfig({ field, onConfigChange }: FileFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="acceptedTypes">Accepted File Types</Label>
        <Input
          id="acceptedTypes"
          value={(config as any).acceptedTypes || ''}
          onChange={(e) => onConfigChange({ acceptedTypes: e.target.value })}
          placeholder="e.g., .pdf,.doc,.docx"
        />
        <p className="text-xs text-gray-500 mt-1">
          Comma-separated file extensions or MIME types
        </p>
      </div>

      <div>
        <Label htmlFor="maxFileSize">Max File Size (MB)</Label>
        <Input
          id="maxFileSize"
          type="number"
          value={(config as any).maxFileSize || 10}
          onChange={(e) => onConfigChange({ maxFileSize: parseInt(e.target.value) })}
          min="1"
          max="100"
        />
      </div>

      <div>
        <Label htmlFor="uploadMode">Upload Mode</Label>
        <Select
          value={(config as any).uploadMode || 'single'}
          onValueChange={(value) => onConfigChange({ uploadMode: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single File</SelectItem>
            <SelectItem value="multiple">Multiple Files</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showPreview"
            checked={(config as any).showPreview !== false}
            onCheckedChange={(checked) => onConfigChange({ showPreview: checked })}
          />
          <Label htmlFor="showPreview">Show file preview</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowDownload"
            checked={(config as any).allowDownload !== false}
            onCheckedChange={(checked) => onConfigChange({ allowDownload: checked })}
          />
          <Label htmlFor="allowDownload">Allow file download</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireDescription"
            checked={(config as any).requireDescription || false}
            onCheckedChange={(checked) => onConfigChange({ requireDescription: checked })}
          />
          <Label htmlFor="requireDescription">Require file description</Label>
        </div>
      </div>
    </div>
  );
}