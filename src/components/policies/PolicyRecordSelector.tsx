import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";

interface PolicyRecordSelectorProps {
  formId: string;
  selectedFieldIds: string[]; // fields selected in Select Fields
  selectedRecordIds: string[];
  onSelectedRecordsChange: (ids: string[]) => void;
}

export function PolicyRecordSelector({
  formId,
  selectedFieldIds,
  selectedRecordIds,
  onSelectedRecordsChange,
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

  // Fetch all fields to get labels
  const { data: allFields = [] } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("id, label")
        .eq("form_id", formId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Map field IDs to labels
  const fieldLabelMap: Record<string, string> = allFields.reduce((acc, field) => {
    acc[field.id] = field.label;
    return acc;
  }, {} as Record<string, string>);

  // Fields to display: either selected or all
  const fieldsToShow = selectedFieldIds.length > 0 ? selectedFieldIds : allFields.map(f => f.id);

  const toggleRecord = (id: string) => {
    if (selectedRecordIds.includes(id)) {
      onSelectedRecordsChange(selectedRecordIds.filter((r) => r !== id));
    } else {
      onSelectedRecordsChange([...selectedRecordIds, id]);
    }
  };

  if (recordsLoading) return <p>Loading records...</p>;
  if (records.length === 0) return <p>No records found.</p>;

  return (
    <div className="space-y-2">
      {/* Header with Select All / Clear */}
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

      {/* Table */}
      <div className="overflow-x-auto border rounded-md">
        <table className="w-max min-w-full text-sm table-auto"> {/* w-max + table-auto prevents wrapping */}
          <thead className="bg-muted/20">
            <tr>
              <th className="p-2"></th> {/* checkbox */}
              <th className="p-2 text-left">Record ID</th> {/* new column */}
              {fieldsToShow.map((fid) => (
                <th key={fid} className="p-2 text-left">
                  {fieldLabelMap[fid] || fid}
                </th>
              ))}
              {/* <th className="p-2 text-left">Submitted At</th> */}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const isSelected = selectedRecordIds.includes(record.id);
              return (
                <tr
                  key={record.id}
                  className={`border-b hover:bg-muted/50 transition-colors ${
                    isSelected ? "bg-primary/5" : ""
                  }`}
                >
                  {/* Checkbox */}
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

                  {/* Record ID / Ref ID */}
                  <td className="p-2">
                    {record.submission_ref_id || record.id}
                  </td>

                  {/* Selected fields */}
                  {fieldsToShow.map((fid) => {
                    const value = record.submission_data?.[fid];
                    let displayValue = "-";
                    if (Array.isArray(value)) {
                      displayValue = value.map((v: any) => v.submission_ref_id || v.id).join(", ");
                    } else if (value) displayValue = value;
                    return <td key={fid} className="p-2">{displayValue}</td>;
                  })}

                  {/* Submitted At */}
                  {/* <td className="p-2">{new Date(record.submitted_at).toLocaleString()}</td> */}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}