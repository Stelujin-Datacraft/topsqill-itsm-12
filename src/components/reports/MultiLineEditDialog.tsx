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
  const [editData, setEditData] = useState<Record<string, Record<string, any>>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Initialize edit data when dialog opens - each submission gets its own data
  useEffect(() => {
    if (isOpen && submissions.length > 0) {
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
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm"
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
            className="text-sm"
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm"
          />
        );
      
      case 'select':
      case 'dropdown':
        return (
          <Select
            value={value || ''}
            onValueChange={(newValue) => handleFieldValueChange(submissionId, field.id, newValue)}
          >
            <SelectTrigger className="text-sm">
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
              onCheckedChange={(checked) => handleFieldValueChange(submissionId, field.id, checked)}
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
                  name={`${submissionId}-${field.id}`}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
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
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm"
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
              {/* Header with field labels */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-2">Record ID</div>
                  {formFields.slice(0, 10).map(field => (
                    <div key={field.id} className="col-span-1 truncate">
                      {field.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Records for editing */}
              <div className="space-y-3">
                {submissions.map((submission, submissionIndex) => (
                  <div key={submission.id} className="border rounded-lg p-3">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      {/* Record ID */}
                      <div className="col-span-2 flex items-center">
                        <Badge variant="outline" className="text-xs">
                          #{submission.submission_ref_id || submission.id.slice(0, 8)}
                        </Badge>
                      </div>
                      
                      {/* Field inputs */}
                      {formFields.slice(0, 10).map(field => (
                        <div key={field.id} className="col-span-1">
                          {renderFieldInput(
                            field, 
                            editData[submission.id]?.[field.id], 
                            submission.id
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Show remaining fields if more than 10 */}
                    {formFields.length > 10 && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-2 text-xs text-muted-foreground">
                          More fields:
                        </div>
                        {formFields.slice(10).map(field => (
                          <div key={field.id} className="col-span-2">
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              {field.label}
                            </Label>
                            {renderFieldInput(
                              field, 
                              editData[submission.id]?.[field.id], 
                              submission.id
                            )}
                          </div>
                        ))}
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
            Editing {submissions.length} record{submissions.length !== 1 ? 's' : ''} with {formFields.length} field{formFields.length !== 1 ? 's' : ''}
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
              {saving ? 'Saving...' : `Update ${submissions.length} Records`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}