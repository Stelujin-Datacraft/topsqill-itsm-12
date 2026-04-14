
import React, { useRef, useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, File as FileIcon, X, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FileMetadata {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface FileFieldProps {
  field: FormField;
  value: FileMetadata[];
  onChange: (value: FileMetadata[]) => void;
  error?: string;
  disabled?: boolean;
}

export function FileField({ field, value = [], onChange, error, disabled }: FileFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const config = field.customConfig || {};
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const maxSizeMB = config.maxFileSizeMB || 10;
  const maxSize = maxSizeMB * 1024 * 1024;
  const maxFiles = config.maxFiles || (config.allowMultiple ? 5 : 1);

  const getAcceptTypes = () => {
    const types = config.acceptedTypes;
    if (!types || types === 'all') return undefined;
    return types;
  };

  // Normalize value to always be FileMetadata array
  const normalizedValue: FileMetadata[] = Array.isArray(value)
    ? value.filter(v => v && typeof v === 'object' && 'url' in v)
    : [];

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    setValidationError(null);
    
    const newFiles = Array.from(files);
    const rejectedFiles: string[] = [];
    
    // Filter files by size and type
    const validFiles = newFiles.filter(file => {
      if (file.size > maxSize) {
        rejectedFiles.push(`${file.name} exceeds ${maxSizeMB}MB limit`);
        return false;
      }
      const acceptedTypes = config.acceptedTypes;
      if (acceptedTypes && acceptedTypes !== 'all') {
        const types = acceptedTypes.split(',').map((t: string) => t.trim().toLowerCase());
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
        const isValidType = types.some((type: string) => 
          fileExt === type.toLowerCase() || file.type.includes(type.replace('.', ''))
        );
        if (!isValidType) {
          rejectedFiles.push(`${file.name} is not an accepted file type`);
          return false;
        }
      }
      return true;
    });
    
    if (rejectedFiles.length > 0) {
      setValidationError(rejectedFiles.join('. '));
    }

    if (validFiles.length === 0) return;

    // Upload files to Supabase Storage
    setUploading(true);
    const uploadedFiles: FileMetadata[] = [];

    for (const file of validFiles) {
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${field.id}/${timestamp}_${safeName}`;

        const { data, error: uploadError } = await supabase.storage
          .from('form-attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          rejectedFiles.push(`${file.name}: Upload failed`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('form-attachments')
          .getPublicUrl(data.path);

        uploadedFiles.push({
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type,
        });
      } catch (err) {
        console.error('File upload error:', err);
        rejectedFiles.push(`${file.name}: Upload failed`);
      }
    }

    setUploading(false);

    if (rejectedFiles.length > 0) {
      setValidationError(rejectedFiles.join('. '));
    }

    if (uploadedFiles.length > 0) {
      const finalFiles = config.allowMultiple
        ? [...normalizedValue, ...uploadedFiles].slice(0, maxFiles)
        : uploadedFiles.slice(0, 1);
      onChange(finalFiles);
      toast({
        title: 'Files uploaded',
        description: `${uploadedFiles.length} file(s) uploaded successfully.`,
      });
    }
  };

  const removeFile = async (index: number) => {
    const file = normalizedValue[index];
    if (file?.url) {
      // Extract path from URL to delete from storage
      try {
        const url = new URL(file.url);
        const pathMatch = url.pathname.match(/\/object\/public\/form-attachments\/(.+)/);
        if (pathMatch) {
          await supabase.storage.from('form-attachments').remove([pathMatch[1]]);
        }
      } catch (err) {
        console.error('Error deleting file from storage:', err);
      }
    }
    const newFiles = normalizedValue.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <div className={`border-2 border-dashed rounded-lg p-4 text-center ${
        error ? 'border-destructive' : 'border-muted'
      } ${disabled ? 'bg-muted/50' : 'bg-background'}`}>
        <input
          ref={fileRef}
          type="file"
          id={field.id}
          onChange={(e) => handleFileSelect(e.target.files)}
          accept={getAcceptTypes()}
          multiple={config.allowMultiple}
          disabled={disabled || uploading}
          className="hidden"
        />
        
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground mb-2">Uploading files...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              {config.allowDragDrop !== false ? 'Drag files here or' : 'Click to upload files'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
            >
              Select Files
            </Button>
          </>
        )}
        
        <p className="text-xs text-muted-foreground mt-2">
          Max file size: {maxSizeMB}MB
          {config.allowMultiple && ` • Max ${maxFiles} files`}
        </p>
        
        {validationError && (
          <div className="flex items-center gap-1 mt-2 text-destructive">
            <AlertCircle className="h-3 w-3" />
            <p className="text-xs">{validationError}</p>
          </div>
        )}
      </div>
      
      {normalizedValue.length > 0 && (
        <div className="space-y-2">
          {normalizedValue.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <a 
                  href={file.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm text-primary hover:underline truncate"
                >
                  {file.name}
                </a>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      
      {field.tooltip && (
        <p className="text-xs text-muted-foreground">{field.tooltip}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
