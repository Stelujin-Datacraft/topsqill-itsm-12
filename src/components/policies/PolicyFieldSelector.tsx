import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, ListFilter, Tag } from 'lucide-react';

interface PolicyFieldSelectorProps {
  formId: string;
  selectedFieldIds: string[];
  onSelectedFieldsChange: (ids: string[]) => void;
  recordNameFieldId?: string;
  onRecordNameFieldChange?: (id: string) => void;
}

const EXCLUDED_TYPES = ['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'];

export function PolicyFieldSelector({ formId, selectedFieldIds, onSelectedFieldsChange, recordNameFieldId, onRecordNameFieldChange }: PolicyFieldSelectorProps) {
  const fieldsQuery = useQuery({
    queryKey: ['form-fields-for-policy-select', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId)
        .order('field_order');
      if (error) throw error;
      return (data || []).filter(f => !EXCLUDED_TYPES.includes(f.field_type));
    },
    enabled: !!formId,
  });

  const fields = fieldsQuery.data || [];

  const toggleField = (fieldId: string) => {
    if (selectedFieldIds.includes(fieldId)) {
      onSelectedFieldsChange(selectedFieldIds.filter(id => id !== fieldId));
    } else {
      onSelectedFieldsChange([...selectedFieldIds, fieldId]);
    }
  };

  const selectAll = () => onSelectedFieldsChange(fields.map(f => f.id));
  const clearAll = () => onSelectedFieldsChange([]);

  if (fieldsQuery.isLoading) {
    return <p className="text-xs text-muted-foreground py-2">Loading fields...</p>;
  }

  if (fields.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No fields found in the linked form.</p>;
  }

  return (
    <div className="space-y-3">
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
              {fields.filter(f => ['text', 'email', 'number', 'select', 'radio'].includes(f.field_type)).map(f => (
                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Select Fields to Display</Label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="text-xs text-primary hover:underline" type="button">Select All</button>
          <span className="text-xs text-muted-foreground">|</span>
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:underline" type="button">Clear</button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Choose fields.
        {selectedFieldIds.length > 0 && <span className="font-medium text-foreground ml-1">({selectedFieldIds.length} selected)</span>}
      </p>
      <div className="border rounded-md max-h-[200px] overflow-y-auto">
        {fields.map(field => {
          const isSelected = selectedFieldIds.includes(field.id);
          return (
            <div
              key={field.id}
              onClick={() => toggleField(field.id)}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
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
  );
}
