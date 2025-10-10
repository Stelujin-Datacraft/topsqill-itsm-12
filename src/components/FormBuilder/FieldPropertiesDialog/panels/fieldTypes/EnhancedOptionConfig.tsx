import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, GripVertical, List, FileText, Upload, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface Option {
  id: string;
  value: string;
  label: string;
  color?: string;
  image?: string;
}

interface EnhancedOptionConfigProps {
  options: Option[];
  onChange: (options: Option[]) => void;
  fieldType: 'select' | 'multi-select' | 'radio' | 'checkbox';
}

export function EnhancedOptionConfig({ options, onChange, fieldType }: EnhancedOptionConfigProps) {
  const [activeTab, setActiveTab] = useState<'individual' | 'bulk'>('individual');
  const [bulkInput, setBulkInput] = useState('');

  // Generate a random color for new options
  const generateRandomColor = () => {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleBulkInputChange = (value: string) => {
    setBulkInput(value);
    
    // Parse comma-separated values
    const lines = value.split('\n').filter(line => line.trim());
    const newOptions: Option[] = [];
    
    lines.forEach(line => {
      const items = line.split(',').map(item => item.trim()).filter(item => item);
      items.forEach(item => {
        const existingOption = options.find(opt => opt.value === item || opt.label === item);
        newOptions.push({
          id: existingOption?.id || `option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          value: item,
          label: item,
          color: existingOption?.color || generateRandomColor()
        });
      });
    });
    
    onChange(newOptions);
  };

  const handleOptionChange = (index: number, key: keyof Option, value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    onChange(newOptions);
  };

  const addOption = () => {
    const newOptions = [...options, { 
      id: `option-${Date.now()}`, 
      value: '', 
      label: '', 
      color: generateRandomColor() 
    }];
    onChange(newOptions);
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    onChange(newOptions);
  };

  const duplicateOption = (index: number) => {
    const optionToDuplicate = options[index];
    const newOptions = [...options];
    newOptions.splice(index + 1, 0, {
      ...optionToDuplicate,
      id: `option-${Date.now()}`,
      value: `${optionToDuplicate.value}_copy`,
      label: `${optionToDuplicate.label} (Copy)`
    });
    onChange(newOptions);
  };

  const handleImageUpload = (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Image = e.target?.result as string;
      handleOptionChange(index, 'image', base64Image);
      toast.success('Image uploaded successfully');
    };
    reader.onerror = () => {
      toast.error('Failed to upload image');
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    handleOptionChange(index, 'image', '');
  };

  // Convert options to bulk format for display
  const optionsToBulkText = () => {
    return options.map(option => option.value || option.label).join('\n');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Options Configuration</Label>
        <div className="text-xs text-muted-foreground">
          {options.length} option{options.length !== 1 ? 's' : ''}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'individual' | 'bulk')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Bulk Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-3">
          <div className="space-y-2">
            {options.map((option, index) => (
              <Card key={option.id} className="relative">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    
                    {/* Color picker */}
                    <div className="flex flex-col items-center gap-1">
                      <input
                        type="color"
                        value={option.color || '#3B82F6'}
                        onChange={(e) => handleOptionChange(index, 'color', e.target.value)}
                        className="w-8 h-8 rounded border-2 border-border cursor-pointer"
                        title="Choose color"
                      />
                      <Label className="text-xs text-muted-foreground">Color</Label>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Value</Label>
                          <Input
                            placeholder="Option value"
                            value={option.value}
                            onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Label</Label>
                          <Input
                            placeholder="Display label"
                            value={option.label}
                            onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Image</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Image URL or upload from device"
                            value={option.image && !option.image.startsWith('data:') ? option.image : ''}
                            onChange={(e) => handleOptionChange(index, 'image', e.target.value)}
                            className="h-8 flex-1"
                          />
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(index, file);
                                e.target.value = '';
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id={`image-upload-${option.id}`}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-3"
                              title="Upload from device"
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                          </div>
                          {option.image && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeImage(index)}
                              className="h-8 px-2 text-destructive"
                              title="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateOption(index)}
                        className="h-8 w-8 p-0"
                        title="Duplicate option"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeOption(index)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Remove option"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Preview */}
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    {option.image ? (
                      <img 
                        src={option.image} 
                        alt={option.label || 'Option'} 
                        className="w-10 h-10 object-cover rounded border border-border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div 
                        className="w-3 h-3 rounded-full border" 
                        style={{ backgroundColor: option.color || '#3B82F6' }}
                      />
                    )}
                    <span className="truncate">Preview: {option.label || option.value || 'Empty option'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Button onClick={addOption} variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">Bulk Import Options</Label>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Enter one option per line</p>
              <p>• Use commas to separate multiple options on the same line</p>
              <p>• Colors will be assigned automatically</p>
              <p>• Value and label will be the same initially</p>
            </div>
            <Textarea
              placeholder="Option 1&#10;Option 2, Option 3&#10;Option 4"
              value={bulkInput}
              onChange={(e) => handleBulkInputChange(e.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />
          </div>
          
          {options.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Current Options Preview</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                    <div 
                      className="w-3 h-3 rounded-full border" 
                      style={{ backgroundColor: option.color || '#3B82F6' }}
                    />
                    <span className="truncate">{option.label || option.value || 'Empty'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <Button 
            onClick={() => {
              setBulkInput(optionsToBulkText());
            }}
            variant="outline" 
            size="sm"
            className="w-full"
          >
            Load Current Options to Editor
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}