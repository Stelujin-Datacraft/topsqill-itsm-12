import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import type { Solution } from '@/lib/solutions/solutionBoard';

interface DeleteSolutionDialogProps {
  solution: Solution | null;
  formCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function DeleteSolutionDialog({ solution, formCount, onOpenChange, onConfirm }: DeleteSolutionDialogProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  return (
    <AlertDialog open={!!solution} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('solutions.deleteTitle', 'Delete "{{name}}"?', { name: solution?.name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {formCount > 0
              ? t(
                'solutions.deleteDescriptionForms',
                'The {{count}} form(s) in this solution are not deleted. They stay in the project and show as "Not in a solution".',
                { count: formCount },
              )
              : t('solutions.deleteDescriptionEmpty', 'This solution has no forms.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={async (event) => {
              event.preventDefault();
              setDeleting(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('solutions.deleteFailed', 'Could not delete the solution.'));
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? t('solutions.deleting', 'Deleting…') : t('solutions.delete', 'Delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
