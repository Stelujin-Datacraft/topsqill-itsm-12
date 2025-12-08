import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FieldMapping {
  sourceFieldId: string;
  sourceFieldName?: string;
  targetFieldId: string;
  targetFieldName?: string;
}

interface FieldMappingConfigProps {
  triggerFormId?: string;
  targetFormId: string;
  fieldMappings: FieldMapping[];
  onFieldMappingsChange: (mappings: FieldMapping[]) => void;
}

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

export function FieldMappingConfig({
  triggerFormId,
  targetFormId,
  fieldMappings,
  onFieldMappingsChange
}: FieldMappingConfigProps) {
  const [triggerFields, setTriggerFields] = useState<FormField[]>([]);
  const [targetFields, setTargetFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch fields from both forms
  useEffect(() => {
    const fetchFields = async () => {
      if (!triggerFormId || !targetFormId) return;
      
      setLoading(true);
      try {
        const [triggerResult, targetResult] = await Promise.all([
          supabase
            .from('form_fields')
            .select('id, label, field_type')
            .eq('form_id', triggerFormId)
            .order('field_order'),
          supabase
            .from('form_fields')
            .select('id, label, field_type')
            .eq('form_id', targetFormId)
            .order('field_order')
        ]);

        if (triggerResult.data) {
          setTriggerFields(triggerResult.data);
        }
        if (targetResult.data) {
          setTargetFields(targetResult.data);
        }
      } catch (error) {
        console.error('Error fetching form fields:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [triggerFormId, targetFormId]);

  const handleAddMapping = () => {
    onFieldMappingsChange([
      ...fieldMappings,
      { sourceFieldId: '', targetFieldId: '' }
    ]);
  };

  const handleRemoveMapping = (index: number) => {
    const newMappings = [...fieldMappings];
    newMappings.splice(index, 1);
    onFieldMappingsChange(newMappings);
  };

  const handleMappingChange = (index: number, field: 'sourceFieldId' | 'targetFieldId', value: string) => {
    const newMappings = [...fieldMappings];
    const selectedField = field === 'sourceFieldId' 
      ? triggerFields.find(f => f.id === value)
      : targetFields.find(f => f.id === value);
    
    newMappings[index] = {
      ...newMappings[index],
      [field]: value,
      [field === 'sourceFieldId' ? 'sourceFieldName' : 'targetFieldName']: selectedField?.label
    };
    onFieldMappingsChange(newMappings);
  };

  if (!triggerFormId) {
    return (
      <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded">
        Please configure a trigger form in the Start node first
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading fields...</div>;
  }

  return (
    <div className="space-y-3 mt-2 pl-4 border-l-2 border-muted">
      <Label className="text-sm font-medium">Field Mappings</Label>
      <p className="text-xs text-muted-foreground mb-2">
        Map fields from the <span className="font-medium text-primary">Trigger Form (Start Node)</span> to fields in the <span className="font-medium text-primary">Target Form (This Action)</span>
      </p>
      
      {fieldMappings.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No mappings configured. Click "Add Field Mapping" to map trigger form fields to target form fields.
        </p>
      )}

      {fieldMappings.map((mapping, index) => (
        <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">From Trigger Form</Label>
            <Select
              value={mapping.sourceFieldId}
              onValueChange={(value) => handleMappingChange(index, 'sourceFieldId', value)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select trigger field" />
              </SelectTrigger>
              <SelectContent>
                {triggerFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label} ({field.field_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-5" />
          
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">To Target Form</Label>
            <Select
              value={mapping.targetFieldId}
              onValueChange={(value) => handleMappingChange(index, 'targetFieldId', value)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select target field" />
              </SelectTrigger>
              <SelectContent>
                {targetFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label} ({field.field_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 mt-5"
            onClick={() => handleRemoveMapping(index)}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddMapping}
        className="w-full text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Field Mapping
      </Button>
    </div>
  );
}
