import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ReportMedia } from '@/types/dashboard';

interface EditMediaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (mediaId: string, updates: Partial<ReportMedia>) => Promise<void>;
  media: ReportMedia | null;
}

export function EditMediaDialog({ isOpen, onClose, onSave, media }: EditMediaDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (media) {
      setTitle(media.title || '');
      setDescription(media.description || '');
      setUrl(media.url || media.file_path || '');
    }
  }, [media]);

  const handleSubmit = async () => {
    if (!media) return;
    
    setSaving(true);
    try {
      await onSave(media.id, {
        title,
        description,
        url: media.media_type === 'link' || media.media_type === 'video' ? url : media.url,
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
