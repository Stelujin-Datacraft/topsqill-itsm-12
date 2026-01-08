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

const FILE_TYPE_OPTIONS = [
  { value: '', label: 'All Files' },
  { value: '.pdf', label: 'PDF Documents (.pdf)' },
  { value: '.doc,.docx', label: 'Word Documents (.doc, .docx)' },
  { value: '.xls,.xlsx', label: 'Excel Spreadsheets (.xls, .xlsx)' },
  { value: '.ppt,.pptx', label: 'PowerPoint (.ppt, .pptx)' },
  { value: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx', label: 'All Office Documents' },
  { value: '.jpg,.jpeg,.png,.gif,.webp', label: 'Images (.jpg, .png, .gif, .webp)' },
  { value: '.mp4,.avi,.mov,.wmv', label: 'Videos (.mp4, .avi, .mov)' },
  { value: '.mp3,.wav,.ogg', label: 'Audio (.mp3, .wav, .ogg)' },
  { value: '.zip,.rar,.7z', label: 'Archives (.zip, .rar, .7z)' },
  { value: '.txt,.csv', label: 'Text Files (.txt, .csv)' },
];

export function FileFieldConfig({ field, onConfigChange }: FileFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="acceptedTypes">Accepted File Types</Label>
        <Select
          value={(config as any).acceptedTypes || ''}
          onValueChange={(value) => onConfigChange({ acceptedTypes: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select file types" />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value || 'all'}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="maxFileSizeMB">Max File Size (MB)</Label>
        <Input
          id="maxFileSizeMB"
          type="number"
          value={(config as any).maxFileSizeMB || 10}
          onChange={(e) => onConfigChange({ maxFileSizeMB: parseInt(e.target.value) || 10 })}
          min="1"
          max="100"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Files exceeding this size will be rejected
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="allowMultiple"
          checked={(config as any).allowMultiple || false}
          onCheckedChange={(checked) => onConfigChange({ allowMultiple: checked })}
        />
        <Label htmlFor="allowMultiple">Allow multiple files</Label>
      </div>

      {(config as any).allowMultiple && (
        <div>
          <Label htmlFor="maxFiles">Maximum Number of Files</Label>
          <Input
            id="maxFiles"
            type="number"
            value={(config as any).maxFiles || 5}
            onChange={(e) => onConfigChange({ maxFiles: parseInt(e.target.value) || 5 })}
            min="2"
            max="20"
          />
        </div>
      )}
    </div>
  );
}
