import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReportMedia } from '@/types/dashboard';

interface EditMediaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (mediaId: string, updates: Partial<ReportMedia>) => Promise<void>;
  media: ReportMedia | null;
}

type SizePreset = 'small' | 'medium' | 'large' | 'full' | 'custom';

const SIZE_PRESETS: Record<SizePreset, { width?: number; height?: number; label: string }> = {
  small: { width: 200, height: 150, label: 'Small (200×150)' },
  medium: { width: 400, height: 300, label: 'Medium (400×300)' },
  large: { width: 800, height: 600, label: 'Large (800×600)' },
  full: { width: undefined, height: undefined, label: 'Full Width (Auto)' },
  custom: { width: undefined, height: undefined, label: 'Custom' },
};

const detectSizePreset = (width?: number, height?: number): SizePreset => {
  if (!width && !height) return 'full';
  for (const [key, preset] of Object.entries(SIZE_PRESETS)) {
    if (preset.width === width && preset.height === height && key !== 'custom' && key !== 'full') {
      return key as SizePreset;
    }
  }
  return 'custom';
}

export function EditMediaDialog({ isOpen, onClose, onSave, media }: EditMediaDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [sizePreset, setSizePreset] = useState<SizePreset>('full');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (media) {
      setTitle(media.title || '');
      setDescription(media.description || '');
      setUrl(media.url || media.file_path || '');
      const currentWidth = media.metadata?.width;
      const currentHeight = media.metadata?.height;
      const detectedPreset = detectSizePreset(currentWidth, currentHeight);
      setSizePreset(detectedPreset);
      setWidth(currentWidth?.toString() || '');
      setHeight(currentHeight?.toString() || '');
    }
  }, [media]);

  const handleSubmit = async () => {
    if (!media) return;
    
    setSaving(true);
    try {
      // Calculate final dimensions based on preset or custom values
      let finalWidth: number | undefined;
      let finalHeight: number | undefined;
      
      if (sizePreset === 'custom') {
        finalWidth = width ? parseInt(width, 10) : undefined;
        finalHeight = height ? parseInt(height, 10) : undefined;
      } else if (sizePreset !== 'full') {
        finalWidth = SIZE_PRESETS[sizePreset].width;
        finalHeight = SIZE_PRESETS[sizePreset].height;
      }

      await onSave(media.id, {
        title,
        description,
        url: media.media_type === 'link' || media.media_type === 'video' ? url : media.url,
        metadata: {
          ...media.metadata,
          width: finalWidth,
          height: finalHeight,
        },
      });
      onClose();
    } catch (error) {
      console.error('Error updating media:', error);
    } finally {
      setSaving(false);
    }
  };

  const getMediaTypeLabel = () => {
    switch (media?.media_type) {
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'link': return 'Link';
      case 'document': return 'Document';
      default: return 'Media';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {getMediaTypeLabel()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              rows={3}
            />
          </div>

          {(media?.media_type === 'link' || media?.media_type === 'video') && (
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URL..."
              />
            </div>
          )}

          {(media?.media_type === 'image' || media?.media_type === 'document') && media?.file_path && (
            <div className="space-y-2">
              <Label>File</Label>
              <p className="text-sm text-muted-foreground truncate">
                {media.file_path.split('/').pop()}
              </p>
            </div>
          )}

          {(media?.media_type === 'image' || media?.media_type === 'video') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Size</Label>
                <Select value={sizePreset} onValueChange={(v) => setSizePreset(v as SizePreset)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SIZE_PRESETS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {sizePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-width">Width (px)</Label>
                    <Input
                      id="edit-width"
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      placeholder="Auto"
                      min="50"
                      max="1920"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-height">Height (px)</Label>
                    <Input
                      id="edit-height"
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="Auto"
                      min="50"
                      max="1080"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
