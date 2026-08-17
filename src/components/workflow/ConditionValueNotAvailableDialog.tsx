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

export interface ConditionValueNotAvailableDialogProps {
  open: boolean;
  fieldLabel: string;
  valueLabel: string;
  onCreateValue: () => void;
  onChooseExisting: () => void;
  onCancel: () => void;
  isCreating?: boolean;
}

/**
 * Shown when an AI-suggested option value is not on a dropdown/radio/checkbox/toggle field.
 * Never creates anything until the user confirms.
 */
export function ConditionValueNotAvailableDialog({
  open,
  fieldLabel,
  valueLabel,
  onCreateValue,
  onChooseExisting,
  onCancel,
  isCreating = false,
}: ConditionValueNotAvailableDialogProps) {
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
          <DialogTitle className="text-center text-xl">Value Not Available</DialogTitle>
          <DialogDescription className="text-center text-base pt-1 space-y-2">
            <span className="block">
              The value &quot;{valueLabel}&quot; is not available for &quot;{fieldLabel}&quot;.
            </span>
            <span className="block text-muted-foreground">
              Would you like to create this value?
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full"
            onClick={onCreateValue}
            disabled={isCreating}
          >
            {isCreating ? "Creating…" : "Create Value"}
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
