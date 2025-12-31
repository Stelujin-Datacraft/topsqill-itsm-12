import React, { useEffect, useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  STATIC_LAYOUT_FIELD_TYPES, 
  areTypesCompatible,
  getTypeCompatibilityLabel 
} from '@/utils/workflowFieldFiltering';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FieldMapping {
  sourceFieldId: string;
  sourceFieldName?: string;
  sourceFieldType?: string;
  targetFieldId: string;
  targetFieldName?: string;
  targetFieldType?: string;
}

interface FieldMappingConfigProps {
  triggerFormId?: string;
  targetFormId: string;
  fieldMappings: FieldMapping[];
  onFieldMappingsChange: (mappings: FieldMapping[]) => void;
  showTypeCompatibility?: boolean;
  sourceLabel?: string; // Custom label for source fields (default: "From Trigger Form")
  targetLabel?: string; // Custom label for target fields (default: "To Target Form")
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
  onFieldMappingsChange,
  showTypeCompatibility = true,
  sourceLabel = "From Trigger Form",
  targetLabel = "To Target Form"
}: FieldMappingConfigProps) {
  const [triggerFields, setTriggerFields] = useState<FormField[]>([]);
  const [targetFields, setTargetFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch fields from both forms with static field filtering
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
          // Filter out static/layout fields
          const filteredFields = triggerResult.data.filter(
            field => !STATIC_LAYOUT_FIELD_TYPES.includes(field.field_type as any)
          );
          setTriggerFields(filteredFields);
        }
        if (targetResult.data) {
          // Filter out static/layout fields
          const filteredFields = targetResult.data.filter(
            field => !STATIC_LAYOUT_FIELD_TYPES.includes(field.field_type as any)
          );
          setTargetFields(filteredFields);
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
      [field === 'sourceFieldId' ? 'sourceFieldName' : 'targetFieldName']: selectedField?.label,
      [field === 'sourceFieldId' ? 'sourceFieldType' : 'targetFieldType']: selectedField?.field_type
    };
    onFieldMappingsChange(newMappings);
  };

  // Check mapping compatibility
  const getMappingCompatibility = (mapping: FieldMapping): { isCompatible: boolean; message: string } => {
    if (!mapping.sourceFieldId || !mapping.targetFieldId) {
      return { isCompatible: true, message: '' };
    }
    
    const sourceField = triggerFields.find(f => f.id === mapping.sourceFieldId);
    const targetField = targetFields.find(f => f.id === mapping.targetFieldId);
    
    if (!sourceField || !targetField) {
      return { isCompatible: true, message: '' };
    }
    
    const isCompatible = areTypesCompatible(sourceField.field_type, targetField.field_type);
    const message = isCompatible 
      ? `${sourceField.field_type} → ${targetField.field_type}`
      : `Warning: ${sourceField.field_type} may not be compatible with ${targetField.field_type}`;
    
    return { isCompatible, message };
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

      {fieldMappings.map((mapping, index) => {
        const compatibility = getMappingCompatibility(mapping);
        
        return (
          <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">{sourceLabel}</Label>
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
            
            <div className="flex flex-col items-center flex-shrink-0 mt-5">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              {showTypeCompatibility && mapping.sourceFieldId && mapping.targetFieldId && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-1">
                        {compatibility.isCompatible ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{compatibility.message}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">{targetLabel}</Label>
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
        );
      })}

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
