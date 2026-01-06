import React, { useEffect, useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';
import { Loader2 } from 'lucide-react';
import { 
  STATIC_LAYOUT_FIELD_TYPES, 
  filterCompatibleFields,
  getCompatibleTypes 
} from '@/utils/workflowFieldFiltering';

interface ExtendedFormField extends FormField {
  customConfig?: any;
}

interface FormFieldSelectorProps {
  formId: string;
  value: string;
  onValueChange: (fieldId: string, fieldName: string, fieldType?: string, fieldOptions?: any[], customConfig?: any) => void;
  placeholder?: string;
  filterTypes?: string[]; // Optional filter to show only specific field types
  excludeStaticFields?: boolean; // Whether to exclude static/layout fields (default: true)
  targetFieldType?: string; // If provided, only show compatible types
}

export function FormFieldSelector({ 
  formId, 
  value, 
  onValueChange, 
  placeholder = "Select field", 
  filterTypes,
  excludeStaticFields = true,
  targetFieldType
}: FormFieldSelectorProps) {
  const [fields, setFields] = useState<ExtendedFormField[]>([]);
  const [loading, setLoading] = useState(false);

  // Memoize filterTypes to prevent infinite re-renders
  const filterTypesKey = useMemo(() => filterTypes?.join(',') || '', [filterTypes]);

  useEffect(() => {
    if (!formId) {
      setFields([]);
      return;
    }

    const fetchFields = async () => {
      setLoading(true);
      try {
        const { data: fieldsData, error } = await supabase
          .from('form_fields')
          .select('*')
          .eq('form_id', formId)
          .order('field_order', { ascending: true });

        if (error) {
          console.error('Error fetching form fields:', error);
          return;
        }

        if (fieldsData) {
          // Filter out static/layout fields using centralized utility
          let dataFields = fieldsData
            .filter(field => !excludeStaticFields || !STATIC_LAYOUT_FIELD_TYPES.includes(field.field_type as any))
            .map(field => ({
              id: field.id,
              type: field.field_type,
              label: field.label,
              options: field.options || [],
              customConfig: field.custom_config || {},
            } as ExtendedFormField));
          
          // Apply type filter if provided
          const typesToFilter = filterTypesKey ? filterTypesKey.split(',') : [];
          if (typesToFilter.length > 0) {
            dataFields = dataFields.filter(field => typesToFilter.includes(field.type));
          }
          
          // Apply target type compatibility filter if provided
          if (targetFieldType) {
            dataFields = filterCompatibleFields(dataFields, targetFieldType);
          }
          
          setFields(dataFields);
        }
      } catch (error) {
        console.error('Error loading fields:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [formId, filterTypesKey, excludeStaticFields, targetFieldType]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading fields...
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-2">
        {filterTypes && filterTypes.length > 0 
          ? `No ${filterTypes.join(' or ')} fields available in this form`
          : 'No fields available in this form'}
      </div>
    );
  }

  return (
    <Select 
      value={value} 
      onValueChange={(fieldId) => {
        const selectedField = fields.find(f => f.id === fieldId);
        onValueChange(
          fieldId, 
          selectedField?.label || fieldId,
          selectedField?.type,
          selectedField?.options,
          selectedField?.customConfig
        );
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-background z-50">
        {fields.map((field) => (
          <SelectItem key={field.id} value={field.id}>
            <div className="flex items-center gap-2">
              <span>{field.label}</span>
              <span className="text-xs text-muted-foreground">({field.type})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
