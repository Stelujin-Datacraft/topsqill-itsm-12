import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { CheckCircle, ListFilter, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EXCLUDED_TYPES = ['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'];
const RECORD_NAME_ALLOWED_TYPES = ['text', 'number', 'date', 'time', 'datetime', 'short-text', 'long-text', 'email', 'url', 'phone'];

interface PolicyRecordSelectorProps {
  formId: string;
  selectedFieldIds: string[];
  selectedRecordIds: string[];
  onSelectedRecordsChange: (ids: string[]) => void;
  onSelectedFieldsChange?: (ids: string[]) => void;
  recordNameFieldId?: string;
  onRecordNameFieldChange?: (id: string) => void;
}

export function PolicyRecordSelector({
  formId,
  selectedFieldIds,
  selectedRecordIds,
  onSelectedRecordsChange,
  onSelectedFieldsChange,
  recordNameFieldId,
  onRecordNameFieldChange,
}: PolicyRecordSelectorProps) {
  // Fetch all records
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["form-submissions", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("id, submission_data, submission_ref_id, submitted_at")
        .eq("form_id", formId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Fetch all fields
  const { data: allFields = [] } = useQuery({
    queryKey: ["form-fields-for-record-select", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("id, label, field_type")
        .eq("form_id", formId)
        .order("field_order");
      if (error) throw error;
      return (data || []).filter(f => !EXCLUDED_TYPES.includes(f.field_type));
    },
    enabled: !!formId,
  });

  const fieldLabelMap: Record<string, string> = allFields.reduce((acc, field) => {
    acc[field.id] = field.label;
    return acc;
  }, {} as Record<string, string>);

  const fieldsToShow = selectedFieldIds.length > 0 ? selectedFieldIds : allFields.map(f => f.id);

  const toggleRecord = (id: string) => {
    if (selectedRecordIds.includes(id)) {
      onSelectedRecordsChange(selectedRecordIds.filter((r) => r !== id));
    } else {
      onSelectedRecordsChange([...selectedRecordIds, id]);
    }
  };

  const toggleField = (fieldId: string) => {
    if (!onSelectedFieldsChange) return;
    if (selectedFieldIds.includes(fieldId)) {
      onSelectedFieldsChange(selectedFieldIds.filter(id => id !== fieldId));
    } else {
      onSelectedFieldsChange([...selectedFieldIds, fieldId]);
    }
  };

  const selectAllFields = () => onSelectedFieldsChange?.(allFields.map(f => f.id));
  const clearAllFields = () => onSelectedFieldsChange?.([]);

  if (recordsLoading) return <p className="text-sm text-muted-foreground">Loading records...</p>;

  return (
    <div className="space-y-4">
      {/* Record Name Field Selector */}
      {onRecordNameFieldChange && (
        <div className="p-3 border rounded-md bg-muted/30 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-primary" />
            <Label className="text-xs font-medium">Record Name Field</Label>
          </div>
          <p className="text-[11px] text-muted-foreground">Select a field whose value will be used as the record title instead of "Record 1, Record 2..."</p>
          <Select value={recordNameFieldId || '__none__'} onValueChange={v => onRecordNameFieldChange(v === '__none__' ? '' : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default (Record 1, 2...)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Default (Record 1, 2...)</SelectItem>
              {allFields.filter(f => RECORD_NAME_ALLOWED_TYPES.includes(f.field_type)).map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                  <span className="ml-1.5 text-[10px] text-muted-foreground">({f.field_type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Field Selection */}
      {onSelectedFieldsChange && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Select Fields to Display</Label>
              {selectedFieldIds.length > 0 && (
                <span className="text-xs text-muted-foreground">({selectedFieldIds.length} selected)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAllFields} className="text-xs text-primary hover:underline" type="button">Select All</button>
              <span className="text-xs text-muted-foreground">|</span>
              <button onClick={clearAllFields} className="text-xs text-muted-foreground hover:underline" type="button">Clear</button>
            </div>
          </div>
          <div className="border rounded-md max-h-[160px] overflow-y-auto">
            {allFields.map(field => {
              const isSelected = selectedFieldIds.includes(field.id);
              return (
                <div
                  key={field.id}
                  onClick={() => toggleField(field.id)}
                  className={`flex items-center gap-3 px-3 py-1.5 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                    {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm flex-1">{field.label}</span>
                  <Badge variant="outline" className="text-[10px] py-0 shrink-0">{field.field_type}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Selection */}
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records found.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Select Records</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => onSelectedRecordsChange(records.map((r) => r.id))}
              >
                Select All
              </button>
              <span className="text-xs text-muted-foreground">|</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => onSelectedRecordsChange([])}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <table className="w-max min-w-full text-sm table-auto">
              <thead className="bg-muted/20">
                <tr>
                  <th className="p-2"></th>
                  <th className="p-2 text-left">Record ID</th>
                  {fieldsToShow.map((fid) => (
                    <th key={fid} className="p-2 text-left">
                      {fieldLabelMap[fid] || fid}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const isSelected = selectedRecordIds.includes(record.id);
                  return (
                    <tr
                      key={record.id}
                      className={`border-b hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                    >
                      <td className="p-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                            isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                          }`}
                          onClick={() => toggleRecord(record.id)}
                        >
                          {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </td>
                      <td className="p-2">{record.submission_ref_id || record.id}</td>
                      {fieldsToShow.map((fid) => {
                        const value = record.submission_data?.[fid];
                        let displayValue = "-";
                        if (Array.isArray(value)) {
                          displayValue = value.map((v: any) => v.submission_ref_id || v.id).join(", ");
                        } else if (value) displayValue = value;
                        return <td key={fid} className="p-2">{displayValue}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
