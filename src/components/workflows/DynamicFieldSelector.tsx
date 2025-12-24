import React, { useEffect, useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { 
  STATIC_LAYOUT_FIELD_TYPES, 
  getCompatibleTypes,
  getTypeCompatibilityLabel 
} from '@/utils/workflowFieldFiltering';

interface DynamicFieldSelectorProps {
  triggerFormId?: string;
  targetFormId?: string;
  targetFieldType?: string;
  value: string;
  onValueChange: (fieldId: string, fieldName: string, sourceForm: 'trigger' | 'target') => void;
  placeholder?: string;
}

interface FieldWithSource extends FormField {
  sourceForm: 'trigger' | 'target';
  formName: string;
}

export function DynamicFieldSelector({ 
  triggerFormId, 
  targetFormId, 
  targetFieldType,
  value, 
  onValueChange, 
  placeholder = "Select source field" 
}: DynamicFieldSelectorProps) {
  const [triggerFields, setTriggerFields] = useState<FormField[]>([]);
  const [targetFields, setTargetFields] = useState<FormField[]>([]);
  const [triggerFormName, setTriggerFormName] = useState<string>('');
  const [targetFormName, setTargetFormName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFields = async () => {
      setLoading(true);
      try {
        // Fetch trigger form fields
        if (triggerFormId) {
          const { data: triggerFieldsData, error: triggerFieldsError } = await supabase
            .from('form_fields')
            .select('*')
            .eq('form_id', triggerFormId)
            .order('field_order', { ascending: true });

        if (!triggerFieldsError && triggerFieldsData) {
            // Use centralized static field filtering
            const dataFields = triggerFieldsData
              .filter(field => !STATIC_LAYOUT_FIELD_TYPES.includes(field.field_type as any))
              .map(field => ({
                id: field.id,
                type: field.field_type,
                label: field.label,
                options: field.options || [],
              } as FormField));
            setTriggerFields(dataFields);
          }

          const { data: triggerFormData } = await supabase
            .from('forms')
            .select('name')
            .eq('id', triggerFormId)
            .single();

          if (triggerFormData) {
            setTriggerFormName(triggerFormData.name);
          }
        }

        // Fetch target form fields (if different from trigger)
        if (targetFormId && targetFormId !== triggerFormId) {
          const { data: targetFieldsData, error: targetFieldsError } = await supabase
            .from('form_fields')
            .select('*')
            .eq('form_id', targetFormId)
            .order('field_order', { ascending: true });

          if (!targetFieldsError && targetFieldsData) {
            // Use centralized static field filtering
            const dataFields = targetFieldsData
              .filter(field => !STATIC_LAYOUT_FIELD_TYPES.includes(field.field_type as any))
              .map(field => ({
                id: field.id,
                type: field.field_type,
                label: field.label,
                options: field.options || [],
              } as FormField));
            setTargetFields(dataFields);
          }

          const { data: targetFormData } = await supabase
            .from('forms')
            .select('name')
            .eq('id', targetFormId)
            .single();

          if (targetFormData) {
            setTargetFormName(targetFormData.name);
          }
        } else {
          setTargetFields([]);
          setTargetFormName('');
        }
      } catch (error) {
        console.error('Error loading fields:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [triggerFormId, targetFormId]);

  // Filter and combine fields based on compatibility
  const compatibleFields = useMemo(() => {
    const compatibleTypes = getCompatibleTypes(targetFieldType || '');
    const result: FieldWithSource[] = [];

    // Add compatible trigger form fields
    triggerFields.forEach(field => {
      if (compatibleTypes.includes(field.type.toLowerCase())) {
        result.push({
          ...field,
          sourceForm: 'trigger',
          formName: triggerFormName || 'Trigger Form'
        });
      }
    });

    // Add compatible target form fields (if different from trigger)
    if (targetFormId !== triggerFormId) {
      targetFields.forEach(field => {
        if (compatibleTypes.includes(field.type.toLowerCase())) {
          result.push({
            ...field,
            sourceForm: 'target',
            formName: targetFormName || 'Target Form'
          });
        }
      });
    }

    return result;
  }, [triggerFields, targetFields, targetFieldType, triggerFormId, targetFormId, triggerFormName, targetFormName]);

  // Group fields by source form
  const groupedFields = useMemo(() => {
    const groups: { trigger: FieldWithSource[]; target: FieldWithSource[] } = {
      trigger: [],
      target: []
    };

    compatibleFields.forEach(field => {
      if (field.sourceForm === 'trigger') {
        groups.trigger.push(field);
      } else {
        groups.target.push(field);
      }
    });

    return groups;
  }, [compatibleFields]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading compatible fields...
      </div>
    );
  }

  const hasNoFields = compatibleFields.length === 0;
  const compatibleTypes = getCompatibleTypes(targetFieldType || '');

  return (
    <div className="space-y-2">
      <Label>Select Source Field *</Label>
      <Select 
        value={value} 
        onValueChange={(fieldId) => {
          const selectedField = compatibleFields.find(f => f.id === fieldId);
          if (selectedField) {
            onValueChange(fieldId, selectedField.label, selectedField.sourceForm);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-background z-50 max-h-[300px]">
          {hasNoFields ? (
            <div className="p-2 text-sm text-muted-foreground">
              No compatible fields found for type "{targetFieldType}"
            </div>
          ) : (
            <>
              {/* Trigger Form Fields */}
              {groupedFields.trigger.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                    📥 From Trigger Form ({triggerFormName})
                  </div>
                  {groupedFields.trigger.map((field) => (
                    <SelectItem key={`trigger-${field.id}`} value={field.id}>
                      <div className="flex items-center gap-2">
                        <span>{field.label}</span>
                        <span className="text-xs text-muted-foreground">({field.type})</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}

              {/* Target Form Fields */}
              {groupedFields.target.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-1">
                    📤 From Target Form ({targetFormName})
                  </div>
                  {groupedFields.target.map((field) => (
                    <SelectItem key={`target-${field.id}`} value={field.id}>
                      <div className="flex items-center gap-2">
                        <span>{field.label}</span>
                        <span className="text-xs text-muted-foreground">({field.type})</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </>
          )}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Showing fields compatible with <span className="font-medium">{targetFieldType}</span> type
        {compatibleTypes.length > 1 && (
          <span className="block mt-1">
            Compatible types: {compatibleTypes.slice(0, 5).join(', ')}{compatibleTypes.length > 5 ? '...' : ''}
          </span>
        )}
      </p>
    </div>
  );
}
