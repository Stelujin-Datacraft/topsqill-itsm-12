import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface BulkDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submissionIds: string[];
  onDelete: () => void;
}

export function BulkDeleteDialog({ isOpen, onOpenChange, submissionIds, onDelete }: BulkDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('form_submissions')
        .delete()
        .in('id', submissionIds);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Deleted ${submissionIds.length} submission(s) successfully`,
      });
      
      onDelete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting submissions:', error);
      toast({
        title: "Error",
        description: "Failed to delete submissions",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Submissions</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {submissionIds.length} submission{submissionIds.length > 1 ? 's' : ''}? 
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Deleting...' : `Delete ${submissionIds.length} Record${submissionIds.length > 1 ? 's' : ''}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}