import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export interface ConditionFieldNotAvailableDialogProps {
  open: boolean;
  fieldLabel: string;
  onCreateField: () => void;
  onChooseExisting: () => void;
  onCancel: () => void;
  isCreating?: boolean;
}

/**
 * Shown when an AI-suggested condition references a field that is not on the form.
 * Never creates anything until the user confirms.
 */
export function ConditionFieldNotAvailableDialog({
  open,
  fieldLabel,
  onCreateField,
  onChooseExisting,
  onCancel,
  isCreating = false,
}: ConditionFieldNotAvailableDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isCreating) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center text-xl">Field Not Available</DialogTitle>
          <DialogDescription className="text-center text-base pt-1 space-y-2">
            <span className="block">
              The field &quot;{fieldLabel}&quot; is not available.
            </span>
            <span className="block text-muted-foreground">
              Would you like to create this field?
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full"
            onClick={onCreateField}
            disabled={isCreating}
          >
            {isCreating ? "Creating…" : "Create Field"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onChooseExisting}
            disabled={isCreating}
          >
            Choose Existing
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onCancel}
            disabled={isCreating}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
