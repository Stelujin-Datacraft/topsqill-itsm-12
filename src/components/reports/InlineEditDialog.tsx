import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FieldEditorFactory } from './field-editors/FieldEditorFactory';
import { Save, Edit3 } from 'lucide-react';

interface InlineEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: any[];
  formFields: any[];
  onSave: () => void;
}

export function InlineEditDialog({ isOpen, onOpenChange, submissions, formFields, onSave }: InlineEditDialogProps) {
  const [editedData, setEditedData] = useState<Record<string, Record<string, any>>>({});
  const [originalData, setOriginalData] = useState<Record<string, Record<string, any>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && submissions.length > 0) {
      const initialData: Record<string, Record<string, any>> = {};
      const originalValues: Record<string, Record<string, any>> = {};
      
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
        originalValues[submission.id] = { ...submissionData };
      });
      
      // Initialize master values for bulk editing
      if (submissions.length > 1) {
        initialData['master'] = {};
      }
      
      setEditedData(initialData);
      setOriginalData(originalValues);
    }
  }, [isOpen, submissions]);

  const handleMasterValueChange = (fieldId: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      master: {
        ...prev.master,
        [fieldId]: value
      }
    }));
    
    // If master value is cleared, restore original values; otherwise auto-fill with new value
    if (!value || value === '') {
      handleRestoreOriginalValues(fieldId);
    } else {
      handleAutoFill(fieldId, value);
    }
  };

  const handleFieldChange = (submissionId: string, fieldId: string, value: any) => {
    if (submissionId === 'master') {
      handleMasterValueChange(fieldId, value);
    } else {
      setEditedData(prev => ({
        ...prev,
        [submissionId]: {
          ...prev[submissionId],
          [fieldId]: value
        }
      }));
    }
  };

  const handleAutoFill = (fieldId: string, value: any) => {
    setEditedData(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(submissionId => {
        if (submissionId !== 'master') {
          updated[submissionId] = {
            ...updated[submissionId],
            [fieldId]: value
          };
        }
      });
      return updated;
    });
  };

  const handleRestoreOriginalValues = (fieldId: string) => {
    setEditedData(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(submissionId => {
        if (submissionId !== 'master') {
          updated[submissionId] = {
            ...updated[submissionId],
            [fieldId]: originalData[submissionId]?.[fieldId] || ''
          };
        }
      });
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(editedData)
        .filter(([submissionId]) => submissionId !== 'master')
        .map(([submissionId, data]) => ({
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

  const renderFieldInput = (field: any, submissionId: string, value: any, isBulkEdit: boolean = false) => {
    const isDisabled = isBulkEdit && submissionId !== 'master';
    
    return (
      <FieldEditorFactory
        field={field}
        value={value}
        onChange={(newValue) => handleFieldChange(submissionId, field.id, newValue)}
        className="w-full"
        disabled={isDisabled}
      />
    );
  };

  if (submissions.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Bulk Edit - {submissions.length} Record{submissions.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Display fields horizontally */}
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {/* Master row for bulk editing */}
                {submissions.length > 1 && (
                  <div className="mb-4 p-4 border rounded-lg bg-primary/5">
                    <div className="text-sm font-medium text-muted-foreground mb-3">Master Values (auto-fills all records):</div>
                     <div className="flex gap-4">
                          {formFields.filter(field => {
                            const excludedFieldTypes = [
                              'header', 'description', 'section-break', 'horizontal-line', 
                              'full-width-container', 'user-picker', 'approval', 'cross-reference', 
                              'query-field', 'geo-location', 'conditional-section', 
                              'submission-access', 'signature', 'dynamic-dropdown', 'rich-text',
                              'record-table', 'matrix-grid', 'workflow-trigger'
                            ];
                            
                            // Exclude by field type
                            if (excludedFieldTypes.includes(field.field_type)) return false;
                            
                            // Exclude auto-generated cross-reference fields
                            if (field.label && field.label.startsWith('Reference from ')) return false;
                            
                            return true;
                          }).map((field) => (
                           <div key={field.id} className="flex-1 min-w-[200px]">
                             <Label className="text-sm font-medium mb-2 block">
                               {field.label}
                               {field.required && <span className="text-destructive ml-1">*</span>}
                             </Label>
                             {renderFieldInput(
                               field, 
                               'master', 
                               editedData['master']?.[field.id] || '',
                               false
                             )}
                           </div>
                         ))}
                    </div>
                  </div>
                )}
                
                {/* Records */}
                <div className="space-y-3">
                  {submissions.map((submission, index) => (
                    <div key={submission.id} className="p-4 border rounded-lg bg-muted/20">
                      <div className="text-sm font-medium text-muted-foreground mb-3">
                        Record {index + 1} (ID: {String(submission.submission_ref_id || submission.id.slice(0, 8) + '...')})
                      </div>
                       <div className="flex gap-4">
                          {formFields.filter(field => {
                            const excludedFieldTypes = [
                              'header', 'description', 'section-break', 'horizontal-line', 
                              'full-width-container', 'user-picker', 'approval', 'cross-reference', 
                              'query-field', 'geo-location', 'conditional-section', 
                              'submission-access', 'signature', 'dynamic-dropdown', 'rich-text',
                              'record-table', 'matrix-grid', 'workflow-trigger'
                            ];
                            
                            // Exclude by field type
                            if (excludedFieldTypes.includes(field.field_type)) return false;
                            
                            // Exclude auto-generated cross-reference fields
                            if (field.label && field.label.startsWith('Reference from ')) return false;
                            
                            return true;
                          }).map((field) => (
                           <div key={field.id} className="flex-1 min-w-[200px]">
                             <Label className="text-sm font-medium mb-2 block">
                               {field.label}
                               {field.required && <span className="text-destructive ml-1">*</span>}
                             </Label>
                             {renderFieldInput(
                               field, 
                               submission.id, 
                               editedData[submission.id]?.[field.id],
                               submissions.length > 1
                             )}
                           </div>
                         ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : `Update ${submissions.length} Record${submissions.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}