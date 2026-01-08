
import React, { useRef, useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, File, X, AlertCircle } from 'lucide-react';

interface FileFieldProps {
  field: FormField;
  value: File[];
  onChange: (value: File[]) => void;
  error?: string;
  disabled?: boolean;
}

export function FileField({ field, value = [], onChange, error, disabled }: FileFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const config = field.customConfig || {};
  const [validationError, setValidationError] = useState<string | null>(null);

  const maxSizeMB = config.maxFileSizeMB || 10;
  const maxSize = maxSizeMB * 1024 * 1024;
  const maxFiles = config.maxFiles || (config.allowMultiple ? 5 : 1);

  const getAcceptTypes = () => {
    const types = config.acceptedTypes;
    if (!types || types === 'all') return undefined;
    return types;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    setValidationError(null);
    
    const newFiles = Array.from(files);
    const rejectedFiles: string[] = [];
    
    // Filter files by size and type
    const validFiles = newFiles.filter(file => {
      // Check file size
      if (file.size > maxSize) {
        rejectedFiles.push(`${file.name} exceeds ${maxSizeMB}MB limit`);
        return false;
      }
      
      // Check file type
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
    
    const finalFiles = config.allowMultiple 
      ? [...value, ...validFiles].slice(0, maxFiles)
      : validFiles.slice(0, 1);
      
    onChange(finalFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = value.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className={`border-2 border-dashed rounded-lg p-4 text-center ${
        error ? 'border-red-500' : 'border-gray-300'
      } ${disabled ? 'bg-gray-50' : 'bg-white'}`}>
        <input
          ref={fileRef}
          type="file"
          id={field.id}
          onChange={(e) => handleFileSelect(e.target.files)}
          accept={getAcceptTypes()}
          multiple={config.allowMultiple}
          disabled={disabled}
          className="hidden"
        />
        
        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 mb-2">
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
      
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-gray-500">
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
        <p className="text-xs text-gray-500">{field.tooltip}</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
