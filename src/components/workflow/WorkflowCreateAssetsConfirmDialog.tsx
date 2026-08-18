import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FilePlus2, ListPlus } from "lucide-react";
import {
  describeFieldType,
  type WorkflowAssetPlan,
} from "@/lib/ai/ensureWorkflowFormAssets";

export interface WorkflowCreateAssetsConfirmDialogProps {
  open: boolean;
  plan: WorkflowAssetPlan;
  onConfirm: () => void;
  /** Skip creating new fields/options and continue with existing form assets. */
  onSkipContinue: () => void;
  onCancel: () => void;
  isCreating?: boolean;
}

/**
 * Confirmation before creating missing form fields / option values
 * needed to complete an AI-generated workflow.
 */
export function WorkflowCreateAssetsConfirmDialog({
  open,
  plan,
  onConfirm,
  onSkipContinue,
  onCancel,
  isCreating = false,
}: WorkflowCreateAssetsConfirmDialogProps) {
  const formLabel = plan.formName?.trim() || "the selected form";
  const fieldCount = plan.fieldsToCreate.length;
  const optionCount = plan.optionsToCreate.length;
  const total = fieldCount + optionCount;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isCreating) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Confirm form updates</DialogTitle>
          <DialogDescription className="text-base pt-1 space-y-2">
            <span className="block">
              To finish creating this workflow,{" "}
              {total === 1 ? "the following may be added" : `${total} items may be added`}{" "}
              to <span className="font-medium text-foreground">{formLabel}</span>.
            </span>
            <span className="block text-muted-foreground">
              Create them, continue without creating (use existing fields/options only), or cancel.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(50vh,22rem)] space-y-4 overflow-y-auto py-1">
          {fieldCount > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New fields ({fieldCount})
              </p>
              <ul className="space-y-2">
                {plan.fieldsToCreate.map((field) => (
                  <li
                    key={`field-${field.label}`}
                    className="flex gap-3 rounded-md border border-border/80 bg-muted/30 px-3 py-2.5"
                  >
                    <FilePlus2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" aria-hidden />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-snug">
                        {field.label}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          · {describeFieldType(field.type)}
                        </span>
                      </p>
                      {field.options.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Options: {field.options.join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{field.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {optionCount > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New options ({optionCount})
              </p>
              <ul className="space-y-2">
                {plan.optionsToCreate.map((opt) => (
                  <li
                    key={`opt-${opt.fieldId}-${opt.valueLabel}`}
                    className="flex gap-3 rounded-md border border-border/80 bg-muted/30 px-3 py-2.5"
                  >
                    <ListPlus className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" aria-hidden />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-snug">
                        &quot;{opt.valueLabel}&quot;
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          on {opt.fieldLabel}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{opt.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.reusedFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Reusing existing fields: {plan.reusedFields.join(", ")}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full"
            onClick={onConfirm}
            disabled={isCreating}
          >
            {isCreating
              ? "Creating…"
              : total === 1
                ? "Create & continue"
                : `Create ${total} items & continue`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onSkipContinue}
            disabled={isCreating}
          >
            No & continue
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
