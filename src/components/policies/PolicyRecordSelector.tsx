import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { CheckCircle, Tag, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

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

  if (recordsLoading) return <p className="text-sm text-muted-foreground">Loading records...</p>;

  // Build selected preview data
  const hasSelections = selectedFieldIds.length > 0 || selectedRecordIds.length > 0;
  const selectedRecordsData = records.filter(r => selectedRecordIds.includes(r.id));

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

      {/* Records & Fields Selection Table */}
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records found.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Select Records & Fields</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => onSelectedRecordsChange(records.map((r) => r.id))}
              >
                All Records
              </button>
              <span className="text-xs text-muted-foreground">|</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => onSelectedRecordsChange([])}
              >
                Clear Records
              </button>
              {onSelectedFieldsChange && (
                <>
                  <span className="text-xs text-muted-foreground">|</span>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => onSelectedFieldsChange(allFields.map(f => f.id))}
                  >
                    All Fields
                  </button>
                  <span className="text-xs text-muted-foreground">|</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => onSelectedFieldsChange([])}
                  >
                    Clear Fields
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Check the checkboxes in column headers to select fields, and row checkboxes to select records.
            {selectedFieldIds.length > 0 && <span className="font-medium text-foreground ml-1">({selectedFieldIds.length} fields selected)</span>}
            {selectedRecordIds.length > 0 && <span className="font-medium text-foreground ml-1">({selectedRecordIds.length} records selected)</span>}
          </p>

          <div className="overflow-x-auto border rounded-md">
            <table className="w-max min-w-full text-sm table-auto">
              <thead className="bg-muted/20">
                <tr>
                  <th className="p-2 w-10"></th>
                  <th className="p-2 text-left text-xs font-medium">Record ID</th>
                  {allFields.map((field) => {
                    const isFieldSelected = selectedFieldIds.includes(field.id);
                    return (
                      <th key={field.id} className="p-2 text-left">
                        <div className="flex items-center gap-1.5">
                          {onSelectedFieldsChange && (
                            <Checkbox
                              checked={isFieldSelected}
                              onCheckedChange={() => toggleField(field.id)}
                              className="h-3.5 w-3.5"
                            />
                          )}
                          <span className={`text-xs font-medium ${isFieldSelected ? 'text-primary' : ''}`}>
                            {field.label}
                          </span>
                        </div>
                      </th>
                    );
                  })}
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
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRecord(record.id)}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="p-2 text-xs">{record.submission_ref_id || record.id.slice(0, 8)}</td>
                      {allFields.map((field) => {
                        const value = record.submission_data?.[field.id];
                        let displayValue = "—";
                        if (Array.isArray(value)) {
                          displayValue = value.map((v: any) => v.submission_ref_id || v.id || v).join(", ");
                        } else if (value !== null && value !== undefined && value !== '') {
                          displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        }
                        return <td key={field.id} className="p-2 text-xs max-w-[200px] truncate">{displayValue}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selection Preview */}
      {hasSelections && selectedRecordsData.length > 0 && selectedFieldIds.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="py-2 px-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Selection Preview</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {selectedRecordsData.length} records × {selectedFieldIds.length} fields
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Record</TableHead>
                    {selectedFieldIds.map(fid => (
                      <TableHead key={fid} className="text-xs">{fieldLabelMap[fid] || fid}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRecordsData.map((record, idx) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs font-medium">
                        {record.submission_ref_id || `Record ${idx + 1}`}
                      </TableCell>
                      {selectedFieldIds.map(fid => {
                        const value = record.submission_data?.[fid];
                        let displayValue = "—";
                        if (Array.isArray(value)) {
                          displayValue = value.map((v: any) => v.submission_ref_id || v.id || v).join(", ");
                        } else if (value !== null && value !== undefined && value !== '') {
                          displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        }
                        return <TableCell key={fid} className="text-xs">{displayValue}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
