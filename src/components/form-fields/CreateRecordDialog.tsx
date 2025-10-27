import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormViewLayoutRenderer } from '@/components/FormViewLayoutRenderer';
import { Form } from '@/types/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useFormLoader } from '@/hooks/useFormLoader';

interface CreateRecordDialogProps {
  open: boolean;
  onClose: () => void;
  targetForm: Form;
  onRecordCreated?: () => void;
}

export function CreateRecordDialog({ 
  open, 
  onClose, 
  targetForm,
  onRecordCreated 
}: CreateRecordDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Load the full form with all fields when dialog opens
  const { form: loadedForm, loading: formLoading } = useFormLoader(open ? targetForm.id : undefined);

  const handleSubmit = async (formData: Record<string, any>) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Generate submission reference ID
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const submission_ref_id = `${targetForm.reference_id || targetForm.name.substring(0, 3).toUpperCase()}-${timestamp}-${randomSuffix}`;

      // Prepare submission data
      const submissionData = {
        form_id: targetForm.id,
        submission_ref_id,
        submission_data: formData,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      };

      // Insert the submission
      const { data, error } = await supabase
        .from('form_submissions')
        .insert(submissionData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Record created successfully');
      
      // Call the callback to refresh the parent table
      if (onRecordCreated) {
        onRecordCreated();
      }
      
      // Close the dialog
      onClose();
    } catch (error) {
      console.error('Error creating record:', error);
      toast.error('Failed to create record');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use the loaded form with fields if available, otherwise fall back to targetForm
  const formToRender = loadedForm || targetForm;
  const hasValidForm = formToRender && formToRender.fields && Array.isArray(formToRender.fields) && formToRender.fields.length > 0;

  console.log('CreateRecordDialog - Rendering:', { 
    open, 
    formName: targetForm?.name, 
    formLoading,
    hasValidForm,
    fieldsCount: formToRender?.fields?.length 
  });

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && !isSubmitting) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New {targetForm.name} Record</DialogTitle>
        </DialogHeader>
        
        {formLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading form...</span>
          </div>
        ) : !hasValidForm ? (
          <div className="py-8 text-center text-muted-foreground">
            Unable to load form fields. Please try again.
          </div>
        ) : isSubmitting ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Creating record...</span>
          </div>
        ) : (
          <div className="py-4">
            <FormViewLayoutRenderer 
              form={formToRender}
              onSubmit={handleSubmit}
              showNavigation={false}
              showPublicHeader={false}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
