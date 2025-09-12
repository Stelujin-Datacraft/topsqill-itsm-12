import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Users, Star, Calendar } from 'lucide-react';

interface MultiLineEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: any[];
  formFields: any[];
  onSave: () => void;
}

export function MultiLineEditDialog({
  isOpen,
  onOpenChange,
  submissions,
  formFields,
  onSave
}: MultiLineEditDialogProps) {
  const [editData, setEditData] = useState<Record<string, Record<string, any>>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Initialize edit data when dialog opens - each submission gets its own data
  useEffect(() => {
    if (isOpen && Array.isArray(submissions) && submissions.length > 0) {
      const initialData: Record<string, Record<string, any>> = {};
      
      submissions.forEach(submission => {
        initialData[submission.id] = { ...submission.submission_data };
      });
      
      setEditData(initialData);
    }
  }, [isOpen, submissions]);

  const handleFieldValueChange = (submissionId: string, fieldId: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [fieldId]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!Array.isArray(submissions)) {
        throw new Error('Invalid submissions data');
      }
      
      const updates = submissions.map(submission => ({
        id: submission.id,
        submission_data: editData[submission.id]
      }));

      // Perform bulk update
      for (const update of updates) {
        const { error } = await supabase
          .from('form_submissions')
          .update({ submission_data: update.submission_data })
          .eq('id', update.id);

        if (error) {
          throw error;
        }
      }

      toast({
        title: "Success",
        description: `Updated ${submissions.length} records successfully.`
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating submissions:', error);
      toast({
        title: "Error",
        description: "Failed to update submissions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const renderFieldInput = (field: any, value: any, submissionId: string) => {
    const fieldType = field.field_type || field.type;
    
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
      case 'ip-address':
      case 'submission-access':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm w-full min-w-[200px]"
            type={fieldType === 'email' ? 'email' : fieldType === 'url' ? 'url' : 'text'}
          />
        );
      
      case 'textarea':
      case 'rich-text':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            rows={2}
            className="text-sm w-full min-w-[200px] resize-none"
          />
        );
      
      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm w-full min-w-[200px]"
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.customConfig?.step || 1}
          />
        );
      
      case 'date':
      case 'time':
      case 'datetime':
        return (
          <div className="flex items-center space-x-2 min-w-[200px]">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type={fieldType === 'date' ? 'date' : fieldType === 'time' ? 'time' : 'datetime-local'}
              value={value || ''}
              onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
              className="text-sm flex-1"
            />
          </div>
        );
      
      case 'select':
      case 'dropdown':
      case 'country':
      case 'multi-select':
        return (
          <Select
            value={value || ''}
            onValueChange={(newValue) => handleFieldValueChange(submissionId, field.id, newValue)}
          >
            <SelectTrigger className="text-sm w-full min-w-[200px]">
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-md z-50">
              {Array.isArray(field.options) ? field.options.map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              )) : null}
            </SelectContent>
          </Select>
        );
      
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2 min-w-[200px]">
            <Checkbox
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => handleFieldValueChange(submissionId, field.id, checked)}
            />
            <label className="text-sm truncate">{field.label}</label>
          </div>
        );
      
      case 'toggle-switch':
        return (
          <div className="flex items-center space-x-2 min-w-[200px]">
            <Switch
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => handleFieldValueChange(submissionId, field.id, checked)}
            />
            <label className="text-sm truncate">{field.label}</label>
          </div>
        );
      
      case 'radio':
        return (
          <div className="space-y-2 min-w-[200px]">
            {Array.isArray(field.options) ? field.options.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={`${submissionId}-${field.id}`}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
                  className="h-4 w-4"
                />
                <label className="text-sm truncate">{option.label}</label>
              </div>
            )) : null}
          </div>
        );
      
      case 'rating':
        const maxRating = field.customConfig?.ratingScale || 5;
        return (
          <div className="flex items-center space-x-1 min-w-[200px]">
            {[...Array(maxRating)].map((_, index) => {
              const starValue = index + 1;
              return (
                <Star
                  key={index}
                  className={`h-4 w-4 cursor-pointer transition-colors ${
                    starValue <= (value || 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                  onClick={() => handleFieldValueChange(submissionId, field.id, starValue)}
                />
              );
            })}
            {value > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                {value}/{maxRating}
              </span>
            )}
          </div>
        );
      
      case 'slider':
        const min = field.validation?.min || 0;
        const max = field.validation?.max || 100;
        return (
          <div className="space-y-2 min-w-[200px]">
            <Slider
              value={[value || min]}
              onValueChange={(newValue) => handleFieldValueChange(submissionId, field.id, newValue[0])}
              min={min}
              max={max}
              step={field.customConfig?.step || 1}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground text-center">
              {value || min} / {max}
            </div>
          </div>
        );
      
      case 'color':
        return (
          <div className="flex items-center space-x-2 min-w-[200px]">
            <Input
              type="color"
              value={value || '#000000'}
              onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
              className="w-12 h-8 p-1 border rounded"
            />
            <Input
              type="text"
              value={value || ''}
              onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
              placeholder="#000000"
              className="text-sm flex-1"
            />
          </div>
        );
      
      case 'file':
      case 'image':
      case 'signature':
        return (
          <div className="min-w-[200px]">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFieldValueChange(submissionId, field.id, file.name);
                }
              }}
              className="text-sm w-full"
              accept={fieldType === 'image' ? 'image/*' : undefined}
            />
            {value && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                Current: {value}
              </div>
            )}
          </div>
        );
      
      case 'tags':
        return (
          <Input
            value={Array.isArray(value) ? value.join(', ') : value || ''}
            onChange={(e) => {
              const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
              handleFieldValueChange(submissionId, field.id, tags);
            }}
            placeholder="Enter tags separated by commas"
            className="text-sm w-full min-w-[200px]"
          />
        );
      
      case 'address':
        const addressValue = typeof value === 'object' ? value : {};
        return (
          <div className="space-y-1 min-w-[200px]">
            <Input
              value={addressValue.street || ''}
              onChange={(e) => handleFieldValueChange(submissionId, field.id, { ...addressValue, street: e.target.value })}
              placeholder="Street"
              className="text-xs w-full"
            />
            <div className="grid grid-cols-2 gap-1">
              <Input
                value={addressValue.city || ''}
                onChange={(e) => handleFieldValueChange(submissionId, field.id, { ...addressValue, city: e.target.value })}
                placeholder="City"
                className="text-xs"
              />
              <Input
                value={addressValue.zip || ''}
                onChange={(e) => handleFieldValueChange(submissionId, field.id, { ...addressValue, zip: e.target.value })}
                placeholder="ZIP"
                className="text-xs"
              />
            </div>
          </div>
        );
      
      case 'user-picker':
      case 'group-picker':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Select ${field.label}`}
            className="text-sm w-full min-w-[200px]"
          />
        );
      
      case 'barcode':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder="Scan or enter barcode"
            className="text-sm w-full min-w-[200px]"
          />
        );
      
      case 'geo-location':
        const geoValue = typeof value === 'object' ? value : {};
        return (
          <div className="grid grid-cols-2 gap-1 min-w-[200px]">
            <Input
              type="number"
              value={geoValue.lat || ''}
              onChange={(e) => handleFieldValueChange(submissionId, field.id, { ...geoValue, lat: parseFloat(e.target.value) })}
              placeholder="Latitude"
              className="text-xs"
              step="any"
            />
            <Input
              type="number"
              value={geoValue.lng || ''}
              onChange={(e) => handleFieldValueChange(submissionId, field.id, { ...geoValue, lng: parseFloat(e.target.value) })}
              placeholder="Longitude"
              className="text-xs"
              step="any"
            />
          </div>
        );
      
      // Non-editable field types
      case 'header':
      case 'description':
      case 'section-break':
      case 'horizontal-line':
      case 'full-width-container':
      case 'record-table':
      case 'matrix-grid':
      case 'cross-reference':
      case 'child-cross-reference':
      case 'calculated':
      case 'conditional-section':
      case 'workflow-trigger':
      case 'query-field':
        return (
          <div className="text-xs text-muted-foreground italic min-w-[200px] p-2 bg-muted/20 rounded">
            Non-editable field type: {fieldType}
          </div>
        );
      
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm w-full min-w-[200px]"
          />
        );
    }
  };

return (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Multi-Line Edit - {submissions.length} Records
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Edit fields horizontally. Scroll left/right to view all fields.
        </p>
      </DialogHeader>

      <div className="flex-1 overflow-hidden">
        {/* Horizontal scrollable container */}
        <div className="h-full overflow-auto">
          <div className="min-w-max">
            {/* Sticky header with field labels */}
            <div className="sticky top-0 bg-background border-b z-10">
              <div className="flex bg-muted/50 p-3 rounded-t-lg">
                <div className="w-[200px] flex-shrink-0 text-xs font-medium text-muted-foreground border-r border-border pr-3">
                  Record ID
                </div>
                {Array.isArray(formFields)
                  ? formFields.map((field) => (
                      <div key={field.id} className="w-[220px] flex-shrink-0 text-xs font-medium text-muted-foreground px-3 border-r border-border/50 last:border-r-0">
                        <div className="truncate" title={field.label}>
                          {field.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 mt-1">
                          {field.field_type || field.type}
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>

            {/* Records for editing */}
            <div className="space-y-0">
              {Array.isArray(submissions)
                ? submissions.map((submission, index) => (
                    <div 
                      key={submission.id} 
                      className={`flex border-b hover:bg-muted/20 transition-colors ${
                        index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                      }`}
                    >
                      {/* Record ID - Fixed width */}
                      <div className="w-[200px] flex-shrink-0 flex items-center p-3 border-r border-border">
                        <Badge variant="outline" className="text-xs">
                          #{submission.submission_ref_id ||
                            submission.id.slice(0, 8)}
                        </Badge>
                      </div>

                      {/* Field inputs - Horizontal layout */}
                      {Array.isArray(formFields)
                        ? formFields.map((field) => (
                            <div key={field.id} className="w-[220px] flex-shrink-0 p-3 border-r border-border/50 last:border-r-0">
                              {renderFieldInput(
                                field,
                                editData[submission.id]?.[field.id],
                                submission.id
                              )}
                            </div>
                          ))
                        : null}
                    </div>
                  ))
                : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Editing {Array.isArray(submissions) ? submissions.length : 0} record
          {Array.isArray(submissions) && submissions.length !== 1 ? "s" : ""} with{" "}
          {Array.isArray(formFields) ? formFields.length : 0} field
          {Array.isArray(formFields) && formFields.length !== 1 ? "s" : ""}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving
              ? "Saving..."
              : `Update ${Array.isArray(submissions) ? submissions.length : 0} Records`}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

}