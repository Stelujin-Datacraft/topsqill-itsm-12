import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

interface DeleteSubmissionButtonProps {
  submissionId: string;
  onDelete: () => Promise<void>;
  checkPermission: () => Promise<boolean>;
}

export function DeleteSubmissionButton({ submissionId, onDelete, checkPermission }: DeleteSubmissionButtonProps) {
  const [canDelete, setCanDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const checkDeletePermission = async () => {
      const hasPermission = await checkPermission();
      setCanDelete(hasPermission);
    };

    checkDeletePermission();
  }, [checkPermission]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete();
      toast({
        title: "Success",
        description: "Submission deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting submission:', error);
      toast({
        title: "Error",
        description: "Failed to delete submission",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canDelete) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
          title="Delete submission"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Submission</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this submission? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}