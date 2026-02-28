import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Braces, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PolicyDynamicFieldInserterProps {
  formId: string;
  onInsert: (placeholder: string) => void;
}

export function PolicyDynamicFieldInserter({ formId, onInsert }: PolicyDynamicFieldInserterProps) {
  const fieldsQuery = useQuery({
    queryKey: ['form-fields-for-policy', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId)
        .order('field_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  if (!formId) return null;

  const fields = fieldsQuery.data || [];

  const handleInsert = (field: { id: string; label: string }) => {
    const placeholder = `{{${field.label}}}`;
    onInsert(placeholder);
    toast.success(`Inserted ${placeholder}`);
  };

  return (
    <div className="space-y-2 rounded-md border p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Braces className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Insert Dynamic Fields</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Click a field below to insert its placeholder into the policy content. These will be replaced with actual values.
      </p>
      {fieldsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground py-2">Loading fields...</p>
      ) : fields.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No fields found in the linked form.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {fields.map(field => (
            <Badge
              key={field.id}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors gap-1 py-1"
              onClick={() => handleInsert(field)}
            >
              <Plus className="h-3 w-3" />
              {field.label}
              <span className="text-[10px] text-muted-foreground ml-0.5">({field.field_type})</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
