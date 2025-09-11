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
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm w-full"
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
            className="text-sm w-full resize-none"
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm w-full"
          />
        );
      
      case 'select':
      case 'dropdown':
        return (
          <Select
            value={value || ''}
            onValueChange={(newValue) => handleFieldValueChange(submissionId, field.id, newValue)}
          >
            <SelectTrigger className="text-sm w-full">
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
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
                <label className="text-sm">{option.label}</label>
              </div>
            )) : null}
          </div>
        );
      
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldValueChange(submissionId, field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            className="text-sm w-full"
          />
        );
    }
  };

return (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
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
          <div className="space-y-4 overflow-x-auto">
            {/* Header with field labels */}
            <div className="bg-muted/50 p-3 rounded-lg min-w-full">
              <div className="grid grid-cols-[200px_repeat(auto-fit,minmax(200px,1fr))] gap-2 text-xs font-medium text-muted-foreground">
                <div className="w-[200px]">Record ID</div>
                {Array.isArray(formFields)
                  ? formFields.slice(0, 10).map((field) => (
                      <div key={field.id} className="truncate">
                        {field.label}
                      </div>
                    ))
                  : null}
              </div>
            </div>

            {/* Records for editing */}
            <div className="space-y-3 min-w-full">
              {Array.isArray(submissions)
                ? submissions.map((submission) => (
                    <div key={submission.id} className="border rounded-lg p-3">
                      <div className="grid grid-cols-[200px_repeat(auto-fit,minmax(200px,1fr))] gap-2 items-start">
                        {/* Record ID */}
                        <div className="flex items-center w-[200px]">
                          <Badge variant="outline" className="text-xs">
                            #{submission.submission_ref_id ||
                              submission.id.slice(0, 8)}
                          </Badge>
                        </div>

                        {/* Field inputs */}
                        {Array.isArray(formFields)
                          ? formFields.slice(0, 10).map((field) => (
                              <div key={field.id}>
                                {renderFieldInput(
                                  field,
                                  editData[submission.id]?.[field.id],
                                  submission.id
                                )}
                              </div>
                            ))
                          : null}
                      </div>

                      {/* Show remaining fields if more than 10 */}
                      {Array.isArray(formFields) &&
                        formFields.length > 10 && (
                          <div className="mt-3 pt-3 border-t grid grid-cols-[200px_repeat(auto-fit,minmax(200px,1fr))] gap-2 items-start">
                            <div className="text-xs text-muted-foreground w-[200px]">
                              More fields:
                            </div>
                            {formFields.slice(10).map((field) => (
                              <div key={field.id}>
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
                  ))
                : null}
            </div>
          </div>
        </ScrollArea>
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