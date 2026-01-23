import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, Video, Link2, FileText, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ReportMedia } from '@/types/dashboard';

interface AddMediaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (mediaData: Omit<ReportMedia, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  reportId: string;
}

type MediaType = 'image' | 'video' | 'link' | 'document';

export function AddMediaDialog({ isOpen, onClose, onAdd, reportId }: AddMediaDialogProps) {
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setUrl('');
    setMediaType('image');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 50MB",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${reportId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('report-media')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('report-media')
        .getPublicUrl(fileName);

      setUrl(publicUrl);
      
      if (!title) {
        setTitle(file.name);
      }

      toast({
        title: "Success",
        description: "File uploaded successfully"
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!url.trim() && mediaType !== 'link') {
      toast({
        title: "Error",
        description: "Please provide a URL or upload a file",
        variant: "destructive"
      });
      return;
    }

    if (mediaType === 'link' && !url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      await onAdd({
        report_id: reportId,
        media_type: mediaType,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        url: url.trim(),
        layout: { x: 0, y: 0, w: 6, h: 4 },
        display_order: 0,
        created_by: userProfile?.id || '',
      });

      toast({
        title: "Success",
        description: "Media added successfully"
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error adding media:', error);
      toast({
        title: "Error",
        description: "Failed to add media",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getAcceptedFileTypes = () => {
    switch (mediaType) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'document':
        return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
      default:
        return '*';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Media</DialogTitle>
          <DialogDescription>
            Add an image, video, link, or document to your report.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as MediaType)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="image" className="flex items-center gap-1">
              <Image className="h-3 w-3" />
              Image
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              Video
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              Link
            </TabsTrigger>
            <TabsTrigger value="document" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Document
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {mediaType !== 'link' && (
              <div className="grid gap-2">
                <Label>Upload File</Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={getAcceptedFileTypes()}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Choose File'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Or enter a URL below
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  mediaType === 'video' 
                    ? 'https://youtube.com/watch?v=... or direct video URL'
                    : mediaType === 'link'
                    ? 'https://example.com'
                    : 'https://...'
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this media"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a description"
                rows={2}
              />
            </div>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? 'Adding...' : 'Add Media'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
