import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormViewLayoutRenderer } from '@/components/FormViewLayoutRenderer';
import { Form } from '@/types/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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

  return (
    <Dialog open={open} onOpenChange={(newOpen) => !newOpen && !isSubmitting && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New {targetForm.name} Record</DialogTitle>
        </DialogHeader>
        
        {isSubmitting ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Creating record...</span>
          </div>
        ) : (
          <div className="py-4">
            <FormViewLayoutRenderer 
              form={targetForm}
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
