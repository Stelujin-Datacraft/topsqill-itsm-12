import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface InlineEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: any[];
  formFields: any[];
  onSave: () => void;
}

export function InlineEditDialog({ isOpen, onOpenChange, submissions, formFields, onSave }: InlineEditDialogProps) {
  const [editedData, setEditedData] = useState<Record<string, Record<string, any>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && submissions.length > 0) {
      const initialData: Record<string, Record<string, any>> = {};
      submissions.forEach(submission => {
        initialData[submission.id] = { ...submission.submission_data };
      });
      setEditedData(initialData);
    }
  }, [isOpen, submissions]);

  const handleFieldChange = (submissionId: string, fieldId: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [fieldId]: value
      }
    }));
  };

  const handleAutoFill = (fieldId: string, value: any) => {
    setEditedData(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(submissionId => {
        updated[submissionId] = {
          ...updated[submissionId],
          [fieldId]: value
        };
      });
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(editedData).map(([submissionId, data]) => ({
        id: submissionId,
        submission_data: data
      }));

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
        description: `Updated ${updates.length} submission(s) successfully`,
      });
      
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating submissions:', error);
      toast({
        title: "Error",
        description: "Failed to update submissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderFieldInput = (field: any, submissionId: string, value: any) => {
    const fieldValue = value || '';
    
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <Input
            type={field.field_type === 'number' ? 'number' : 'text'}
            value={fieldValue}
            onChange={(e) => handleFieldChange(submissionId, field.id, e.target.value)}
            className="w-full"
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            value={fieldValue}
            onChange={(e) => handleFieldChange(submissionId, field.id, e.target.value)}
            className="w-full min-h-[60px]"
          />
        );
      
      case 'select':
        return (
          <Select 
            value={fieldValue} 
            onValueChange={(value) => handleFieldChange(submissionId, field.id, value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: any) => (
                <SelectItem key={option.value || option} value={option.value || option}>
                  {option.label || option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'checkbox':
        return (
          <Checkbox
            checked={fieldValue === true || fieldValue === 'true'}
            onCheckedChange={(checked) => handleFieldChange(submissionId, field.id, checked)}
          />
        );
      
      default:
        return (
          <Input
            value={fieldValue}
            onChange={(e) => handleFieldChange(submissionId, field.id, e.target.value)}
            className="w-full"
          />
        );
    }
  };

  if (submissions.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Edit {submissions.length} Submission{submissions.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {formFields.map((field) => (
              <div key={field.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{field.label}</Label>
                  {submissions.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const firstValue = editedData[submissions[0].id]?.[field.id];
                        handleAutoFill(field.id, firstValue);
                      }}
                      className="text-xs"
                    >
                      Auto-fill all
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {submissions.map((submission, index) => (
                    <div key={submission.id} className="p-3 border rounded-lg bg-muted/20">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
                          Record {index + 1}:
                        </span>
                        <div className="flex-1">
                          {renderFieldInput(
                            field, 
                            submission.id, 
                            editedData[submission.id]?.[field.id]
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : `Save ${submissions.length} Record${submissions.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}