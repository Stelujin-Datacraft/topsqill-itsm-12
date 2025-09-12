import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Users } from 'lucide-react';
import { FieldEditorFactory } from './field-editors/FieldEditorFactory';

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
        const submissionData: Record<string, any> = {};
        
        // Extract primitive values from submission_data objects
        if (submission.submission_data && typeof submission.submission_data === 'object') {
          Object.keys(submission.submission_data).forEach(fieldId => {
            const fieldData = submission.submission_data[fieldId];
            
            // If the field data is an object with a 'value' property, extract it
            if (fieldData && typeof fieldData === 'object' && 'value' in fieldData) {
              submissionData[fieldId] = fieldData.value === 'undefined' ? '' : fieldData.value;
            } else {
              // Otherwise, use the value directly
              submissionData[fieldId] = fieldData;
            }
          });
        }
        
        initialData[submission.id] = submissionData;
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

  const getEditableFields = () => {
    return Array.isArray(formFields) 
      ? formFields.filter(field => {
          const excludedFieldTypes = [
            'header', 'description', 'section-break', 'horizontal-line', 
            'full-width-container', 'record-table', 'matrix-grid', 
            'cross-reference', 'child-cross-reference', 'calculated',
            'conditional-section', 'workflow-trigger', 'query-field'
          ];
          
          // Exclude by field type
          if (excludedFieldTypes.includes(field.field_type || field.type)) return false;
          
          // Exclude auto-generated cross-reference fields
          if (field.label && field.label.startsWith('Reference from ')) return false;
          
          return true;
        })
      : [];
  };

  const renderFieldInput = (field: any, value: any, submissionId: string) => {
    return (
      <FieldEditorFactory
        field={field}
        value={value}
        onChange={(newValue) => {
          handleFieldValueChange(submissionId, field.id, newValue);
        }}
        className="w-full min-w-[220px]"
      />
    );
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
                {getEditableFields().map((field) => (
                  <div key={field.id} className="w-[220px] flex-shrink-0 text-xs font-medium text-muted-foreground px-3 border-r border-border/50 last:border-r-0">
                    <div className="truncate" title={field.label}>
                      {field.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      {field.field_type || field.type}
                    </div>
                  </div>
                ))}
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
                          #{String(submission.submission_ref_id || submission.id.slice(0, 8))}
                        </Badge>
                      </div>

                      {/* Field inputs - Horizontal layout */}
                      {getEditableFields().map((field) => (
                        <div key={field.id} className="w-[220px] flex-shrink-0 p-3 border-r border-border/50 last:border-r-0">
                          {renderFieldInput(
                            field,
                            editData[submission.id]?.[field.id],
                            submission.id
                          )}
                        </div>
                      ))}
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
          {getEditableFields().length} editable field
          {getEditableFields().length !== 1 ? "s" : ""}
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