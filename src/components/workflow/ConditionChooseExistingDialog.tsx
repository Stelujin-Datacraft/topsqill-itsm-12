import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConditionFormFieldMeta } from "@/lib/ai/resolveWorkflowConditions";

export interface ConditionChooseExistingDialogProps {
  open: boolean;
  mode: "field" | "value";
  title: string;
  description: string;
  fields?: ConditionFormFieldMeta[];
  options?: Array<{ label: string; value: string }>;
  onConfirm: (selectedIdOrValue: string) => void;
  onCancel: () => void;
}

/**
 * Lets the user pick an existing form field or option instead of creating a new one.
 */
export function ConditionChooseExistingDialog({
  open,
  mode,
  title,
  description,
  fields = [],
  options = [],
  onConfirm,
  onCancel,
}: ConditionChooseExistingDialogProps) {
  const [selected, setSelected] = useState("");

  const items = useMemo(() => {
    if (mode === "field") {
      return fields.map((f) => ({
        id: f.id,
        label: `${f.label} (${f.type})`,
      }));
    }
    return options.map((o) => ({
      id: o.value,
      label: o.label || o.value,
    }));
  }, [mode, fields, options]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue
                placeholder={mode === "field" ? "Select a field…" : "Select a value…"}
              />
            </SelectTrigger>
            <SelectContent>
              {items.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No options available
                </SelectItem>
              ) : (
                items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected || selected === "__none__"}
            onClick={() => onConfirm(selected)}
          >
            Use Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
