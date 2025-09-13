import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// For Rating (if you are using lucide-react icons)
import { Star } from "lucide-react";
import axios from 'axios';

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
        initialData[submission.id] = { ...submission.submission_data };
        originalValues[submission.id] = { ...submission.submission_data };
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

  // const handleFieldChange = (submissionId: string, fieldId: string, value: any) => {
  //   if (submissionId === 'master') {
  //     handleMasterValueChange(fieldId, value);
  //   } else {
  //     setEditedData(prev => ({
  //       ...prev,
  //       [submissionId]: {
  //         ...prev[submissionId],
  //         [fieldId]: value
  //       }
  //     }));
  //   }
  // };

  // ✅ updated handleFieldChange with master sync
const handleFieldChange = (submissionId: string, fieldId: string, value: any) => {
  setEditedData((prev: any) => {
    const updated = { ...prev };

    if (submissionId === 'master') {
      // Update master
      updated['master'] = { ...updated['master'], [fieldId]: value };

      // Sync to all child records
      submissions.forEach((sub) => {
        if (!updated[sub.id]) updated[sub.id] = {};
        updated[sub.id][fieldId] = value;
      });
    } else {
      // Update only this record
      updated[submissionId] = {
        ...updated[submissionId],
        [fieldId]: value,
      };
    }

    return updated;
  });
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
// ensure options are always [{ value: string, label: string }]
const normalizeOptions = (field: any) => {
  let raw = field.field_options?.options ?? field.options ?? [];

  if (typeof raw === "string") {
    // "A,B,C" or '["A","B"]'
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) raw = parsed;
    } catch (e) {
      raw = raw.split(",").map((s: string) => s.trim());
    }
  }

  if (!Array.isArray(raw)) return [];

  return raw.map((opt: any) => {
    if (typeof opt === "string") {
      return { value: String(opt), label: opt };
    }
    // handle various shapes like { value, label } or { id, name } etc.
    const value = opt.value ?? opt.id ?? opt.key ?? opt.name ?? opt.label;
    const label = opt.label ?? opt.name ?? opt.title ?? String(value);
    return { value: String(value), label: String(label) };
  });
};

// get display label(s) for a stored value or array of values
const getLabelForValue = (field: any, value: any) => {
  const opts = normalizeOptions(field);
  if (Array.isArray(value)) {
    return value
      .map((v) => opts.find((o) => String(o.value) === String(v))?.label ?? String(v))
      .join(", ");
  }
  return opts.find((o) => String(o.value) === String(value))?.label ?? (value ?? "");
};

// normalize stored field value into the type we expect in UI
const normalizeStoredValue = (field: any, raw: any): string | string[] => {
  const t = field.field_type;
  if (t === "multi-select") {
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch (e) {}
      return raw === "" ? [] : raw.split(",").map((s) => s.trim());
    }
    return [];
  }
  // single-value case
  return raw == null ? "" : String(raw);
};


const renderFieldInput = (
  field: any,
  submissionId: string,
  value: any,
  isBulkEdit: boolean = false
) => {
  const fieldValue = value ?? '';
  const isDisabled = isBulkEdit && submissionId !== 'master';

  switch (field.field_type) {
    case 'text':
    case 'email':
    case 'number':
      return (
        <Input
          type={field.field_type === 'number' ? 'number' : 'text'}
          value={fieldValue}
          onChange={(e) =>
            handleFieldChange(submissionId, field.id, e.target.value)
          }
          className="w-full"
          disabled={isDisabled}
        />
      );

    case 'textarea':
      return (
        <Textarea
          value={fieldValue}
          onChange={(e) =>
            handleFieldChange(submissionId, field.id, e.target.value)
          }
          className="w-full min-h-[60px]"
          disabled={isDisabled}
        />
      );
case "select":{
  const selectOptions = normalizeOptions(field);
  const normalizedValue = normalizeStoredValue(field, value);

  return (
    <Select
      value={typeof normalizedValue === "string" ? normalizedValue : ""}
      onValueChange={(val) => handleFieldChange(submissionId, field.id, val)}
      disabled={isDisabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select option" />
      </SelectTrigger>
      <SelectContent>
        {selectOptions.map((option: any) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}



case "radio": {
  const selectOptions = normalizeOptions(field);
  // ensure single-value string
  const normalizedValue = normalizeStoredValue(field, value) as string;

  // make a safe unique group name per record/master
  const safeSubmissionId = String(submissionId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const groupName = `${field.id}_radio_${safeSubmissionId}`;

  return (
    <div className="flex flex-col gap-2">
      {selectOptions.map((opt: any) => (
        <label key={opt.value} className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={groupName} // << unique per record
            value={opt.value}
            checked={String(normalizedValue) === String(opt.value)}
            onChange={() => handleFieldChange(submissionId, field.id, opt.value)}
            disabled={isDisabled}
          />
          <span>{opt.label}</span> {/* show only label */}
        </label>
      ))}
    </div>
  );
}

case "multi-select": {
  const selectOptions = normalizeOptions(field);
  const selectedValues = Array.isArray(normalizeStoredValue(field, value))
    ? (normalizeStoredValue(field, value) as string[])
    : [];

  const toggle = (val: string) => {
    const updated = selectedValues.includes(val)
      ? selectedValues.filter((v) => v !== val)
      : [...selectedValues, val];
    handleFieldChange(submissionId, field.id, updated);
  };

  return (
    <div className="flex flex-col gap-2">
      {selectOptions.map((opt: any) => (
        <label key={opt.value} className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selectedValues.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            disabled={isDisabled}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

    case 'date':
      return (
        <Input
          type="date"
          value={fieldValue}
          onChange={(e) =>
            handleFieldChange(submissionId, field.id, e.target.value)
          }
          className="w-full"
          disabled={isDisabled}
        />
      );

    case 'time':
      return (
        <Input
          type="time"
          value={fieldValue}
          onChange={(e) =>
            handleFieldChange(submissionId, field.id, e.target.value)
          }
          className="w-full"
          disabled={isDisabled}
        />
      );

    case 'datetime':
      return (
        <Input
          type="datetime-local"
          value={fieldValue}
          onChange={(e) =>
            handleFieldChange(submissionId, field.id, e.target.value)
          }
          className="w-full"
          disabled={isDisabled}
        />
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={fieldValue === true}
            onCheckedChange={(checked) =>
              handleFieldChange(submissionId, field.id, checked === true)
            }
            disabled={isDisabled}
          />
          <span className="text-sm">{field.label}</span>
        </div>
      );

    case 'toggle-switch':
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={fieldValue === true}
            onCheckedChange={(checked) =>
              handleFieldChange(submissionId, field.id, checked === true)
            }
            disabled={isDisabled}
          />
          <span className="text-sm">{field.label}</span>
        </div>
      );

    case 'rating': {
      const maxRating = field.customConfig?.ratingScale || 5;
      return (
        <div className="flex items-center gap-1">
          {[...Array(maxRating)].map((_, index) => {
            const starValue = index + 1;
            return (
              <Star
                key={index}
                className={`h-4 w-4 cursor-pointer transition-colors ${
                  starValue <= (fieldValue || 0)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
                onClick={() =>
                  !isDisabled &&
                  handleFieldChange(submissionId, field.id, starValue)
                }
              />
            );
          })}
          {fieldValue > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {fieldValue}/{maxRating}
            </span>
          )}
        </div>
      );
    }

    case 'slider': {
      const min = field.validation?.min ?? 0;
      const max = field.validation?.max ?? 100;
      return (
        <div className="space-y-2 w-full">
          <Slider
            value={[fieldValue || min]}
            onValueChange={(newVal) =>
              handleFieldChange(submissionId, field.id, newVal[0])
            }
            min={min}
            max={max}
            step={field.customConfig?.step || 1}
            disabled={isDisabled}
          />
          <div className="text-xs text-muted-foreground text-center">
            {fieldValue || min} / {max}
          </div>
        </div>
      );
    }

    case "tags": {
  const tags = Array.isArray(value) ? value : [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value.trim()) {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim();
      const updated = [...tags, newTag];
      handleFieldChange(submissionId, field.id, updated);
      e.currentTarget.value = ""; // clear input
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    handleFieldChange(submissionId, field.id, updated);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag: string, idx: number) => (
          <span
            key={idx}
            className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-xs text-red-500 hover:text-red-700"
              disabled={isDisabled}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {!isDisabled && (
        <Input
          type="text"
          placeholder="Type and press Enter..."
          onKeyDown={handleKeyDown}
          className="w-full"
        />
      )}
    </div>
  );
}




    case 'header':
    case 'description':
    case 'section-break':
    case 'horizontal-line':
    case 'full-width-container':
    case 'record-table':
    case 'matrix-grid':
    case 'cross-reference':
    case 'child-cross-reference':
    case 'calculated':
    case 'conditional-section':
    case 'workflow-trigger':
    case 'query-field':
    case 'barcode':
    case 'address':
    case 'file': 
    {
      return (
        <div className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded">
          Non-editable field
        </div>
      );
    }

    default:
      return (
        <Input
          value={fieldValue}
          onChange={(e) =>
            handleFieldChange(submissionId, field.id, e.target.value)
          }
          className="w-full"
          disabled={isDisabled}
        />
      );
  }
};

  if (submissions.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Edit {submissions.length} Submission{submissions.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Display fields horizontally */}
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {/* Master row for bulk editing */}
{/* Master row for bulk editing */}
{submissions.length > 1 && (
  <div className="mb-4 p-4 border rounded-lg bg-primary/5">
    <div className="text-sm font-medium text-muted-foreground mb-3">
      Master Values (auto-fills all records):
    </div>
    <div className="flex gap-4">
      {formFields
        .filter((field) => {
          const excludedFieldTypes = [
            'header',
            'description',
            'section-break',
            'horizontal-line',
            'full-width-container',
            'user-picker',
            'approval',
            'cross-reference',
            'query-field',
            'geo-location',
            'conditional-section',
            'submission-access',
            'signature',
            'dynamic-dropdown',
            'rich-text',
            'record-table',
            'matrix-grid',
            'workflow-trigger',
          ];

          if (excludedFieldTypes.includes(field.field_type)) return false;
          if (field.label && field.label.startsWith('Reference from '))
            return false;

          return true;
        })
        .map((field) => (
          <div key={field.id} className="flex-1 min-w-[200px]">
            <Label className="text-sm font-medium mb-2 block">
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            {renderFieldInput(
              field,
              'master',
              editedData['master']?.[field.id] || '',
              true // ✅ pass bulkEdit true here
            )}
          </div>
        ))}
    </div>
  </div>
)}

{/* Records */}
<div className="space-y-3">
  {submissions.map((submission, index) => (
    <div
      key={submission.id}
      className="p-4 border rounded-lg bg-muted/20"
    >
      <div className="text-sm font-medium text-muted-foreground mb-3">
        Record {index + 1} (ID:{' '}
        {submission.submission_ref_id ||
          submission.id.slice(0, 8) + '...'}
        )
      </div>
      <div className="flex gap-4">
        {formFields
          .filter((field) => {
            const excludedFieldTypes = [
              'header',
              'description',
              'section-break',
              'horizontal-line',
              'full-width-container',
              'user-picker',
              'approval',
              'cross-reference',
              'query-field',
              'geo-location',
              'conditional-section',
              'submission-access',
              'signature',
              'dynamic-dropdown',
              'rich-text',
              'record-table',
              'matrix-grid',
              'workflow-trigger',
            ];

            if (excludedFieldTypes.includes(field.field_type)) return false;
            if (field.label && field.label.startsWith('Reference from '))
              return false;

            return true;
          })
          .map((field) => (
            <div key={field.id} className="flex-1 min-w-[250px]">
              <Label className="text-sm font-medium mb-2 block">
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : `Save ${submissions.length} Record${submissions.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}