import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PolicyFormLinkProps {
  formId: string;
  onFormIdChange: (formId: string) => void;
}

export function PolicyFormLink({ formId, onFormIdChange }: PolicyFormLinkProps) {
  const { currentProject } = useProject();

  const formsQuery = useQuery({
    queryKey: ['forms-for-policy', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const { data, error } = await supabase
        .from('forms')
        .select('id, name, reference_id, status')
        .eq('project_id', currentProject.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProject?.id,
  });

  const selectedForm = formsQuery.data?.find(f => f.id === formId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Link to Form (Dynamic Fields)</Label>
      </div>
      <div className="flex items-center gap-2">
        <Select value={formId || '_none'} onValueChange={v => onFormIdChange(v === '_none' ? '' : v)}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="No form linked" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">No form linked</SelectItem>
            {formsQuery.data?.map(form => (
              <SelectItem key={form.id} value={form.id}>
                <span className="flex items-center gap-2">
                  {form.name}
                  {form.reference_id && (
                    <Badge variant="outline" className="text-[10px] py-0">{form.reference_id}</Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onFormIdChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {selectedForm && (
        <p className="text-xs text-muted-foreground">
          Linked: <span className="font-medium text-foreground">{selectedForm.name}</span> — Form fields will be available as dynamic document fields.
        </p>
      )}
    </div>
  );
}
