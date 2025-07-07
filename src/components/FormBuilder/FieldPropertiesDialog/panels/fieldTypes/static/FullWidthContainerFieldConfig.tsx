
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface FullWidthContainerFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

export function FullWidthContainerFieldConfig({ config, onUpdate, errors }: FullWidthContainerFieldConfigProps) {
  const customConfig = config.customConfig || {};

  const handleConfigUpdate = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value,
      },
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Convert file to base64 for persistence
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        handleConfigUpdate('mediaUrl', base64Data);
        handleConfigUpdate('mediaFileName', file.name);
        handleConfigUpdate('mediaFileType', file.type);
        handleConfigUpdate('mediaFileSize', file.size);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="media-type">Media Type</Label>
        <Select
          value={customConfig.mediaType || 'image'}
          onValueChange={(value) => handleConfigUpdate('mediaType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select media type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="image">Image (PNG, JPG, SVG)</SelectItem>
            <SelectItem value="video">Video (MP4, YouTube)</SelectItem>
            <SelectItem value="svg">SVG Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {customConfig.mediaType === 'video' ? (
        <div className="space-y-2">
          <Label htmlFor="video-url">Video URL</Label>
          <Input
            id="video-url"
            value={customConfig.mediaUrl || ''}
            onChange={(e) => handleConfigUpdate('mediaUrl', e.target.value)}
            placeholder="https://youtube.com/watch?v=... or direct MP4 URL"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Upload Media File</Label>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('media-upload')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
            <input
              id="media-upload"
              type="file"
              accept={customConfig.mediaType === 'svg' ? '.svg' : 'image/*'}
              onChange={handleFileUpload}
              className="hidden"
            />
            {customConfig.mediaUrl && (
              <span className="text-sm text-gray-500">
                {customConfig.mediaFileName || 'File selected'}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
        <Select
          value={customConfig.aspectRatio || 'auto'}
          onValueChange={(value) => handleConfigUpdate('aspectRatio', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select aspect ratio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
            <SelectItem value="4:3">4:3 (Standard)</SelectItem>
            <SelectItem value="1:1">1:1 (Square)</SelectItem>
            <SelectItem value="21:9">21:9 (Ultra-wide)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {customConfig.mediaType === 'video' && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="auto-play"
            checked={customConfig.autoPlay || false}
            onCheckedChange={(checked) => handleConfigUpdate('autoPlay', checked)}
          />
          <Label htmlFor="auto-play">Auto-play video</Label>
        </div>
      )}
    </div>
  );
}
