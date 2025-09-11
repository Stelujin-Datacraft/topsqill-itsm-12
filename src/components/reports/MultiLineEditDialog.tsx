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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Users } from 'lucide-react';

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
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Initialize edit data when dialog opens
  useEffect(() => {
    if (isOpen && submissions.length > 0) {
      const initialData: Record<string, any> = {};
      
      // Initialize with empty values for all fields
      formFields.forEach(field => {
        initialData[field.id] = '';
      });
      
      setEditData(initialData);
      setSelectedFields(new Set());
    }
  }, [isOpen, submissions, formFields]);

  const handleFieldSelect = (fieldId: string, checked: boolean) => {
    const newSelected = new Set(selectedFields);
    if (checked) {
      newSelected.add(fieldId);
    } else {
      newSelected.delete(fieldId);
    }
    setSelectedFields(newSelected);
  };

  const handleFieldValueChange = (fieldId: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSave = async () => {
    if (selectedFields.size === 0) {
      toast({
        title: "No Fields Selected",
        description: "Please select at least one field to edit.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const updates = submissions.map(submission => {
        const updatedData = { ...submission.submission_data };
        
        // Only update the selected fields
        selectedFields.forEach(fieldId => {
          updatedData[fieldId] = editData[fieldId];
        });

        return {
          id: submission.id,
          submission_data: updatedData
        };
      });

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

  const renderFieldInput = (field: any, value: any) => {
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
          />
        );
      
      case 'textarea':
      case 'rich-text':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            rows={3}
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
          />
        );
      
      case 'select':
      case 'dropdown':
        return (
          <Select
            value={value || ''}
            onValueChange={(newValue) => handleFieldValueChange(field.id, newValue)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => handleFieldValueChange(field.id, checked)}
            />
            <label className="text-sm">{field.label}</label>
          </div>
        );
      
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={field.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                  className="h-4 w-4"
                />
                <label className="text-sm">{option.label}</label>
              </div>
            ))}
          </div>
        );
      
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
          />
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Multi-Line Edit - {submissions.length} Records
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select fields and set values to apply to all selected records
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {/* Selected Records Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Selected Records:</h4>
                <div className="flex flex-wrap gap-2">
                  {submissions.slice(0, 10).map(submission => (
                    <Badge key={submission.id} variant="outline">
                      #{submission.submission_ref_id || submission.id.slice(0, 8)}
                    </Badge>
                  ))}
                  {submissions.length > 10 && (
                    <Badge variant="secondary">
                      +{submissions.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Field Selection and Editing */}
              <div className="space-y-6">
                <h4 className="font-medium">Select Fields to Edit:</h4>
                
                {formFields.map(field => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedFields.has(field.id)}
                        onCheckedChange={(checked) => handleFieldSelect(field.id, Boolean(checked))}
                      />
                      <Label className="font-medium">{field.label}</Label>
                      <Badge variant="secondary" className="text-xs">
                        {field.field_type}
                      </Badge>
                    </div>
                    
                    {selectedFields.has(field.id) && (
                      <div className="pl-6">
                        <Label className="text-sm text-muted-foreground mb-2 block">
                          New value (will be applied to all {submissions.length} records):
                        </Label>
                        {renderFieldInput(field, editData[field.id])}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
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
              disabled={saving || selectedFields.size === 0}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : `Update ${submissions.length} Records`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}