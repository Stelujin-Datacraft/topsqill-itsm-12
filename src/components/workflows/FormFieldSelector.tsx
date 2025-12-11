import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';
import { Loader2 } from 'lucide-react';

interface ExtendedFormField extends FormField {
  customConfig?: any;
}

interface FormFieldSelectorProps {
  formId: string;
  value: string;
  onValueChange: (fieldId: string, fieldName: string, fieldType?: string, fieldOptions?: any[], customConfig?: any) => void;
  placeholder?: string;
  filterTypes?: string[]; // Optional filter to show only specific field types
}

export function FormFieldSelector({ formId, value, onValueChange, placeholder = "Select field", filterTypes }: FormFieldSelectorProps) {
  const [fields, setFields] = useState<ExtendedFormField[]>([]);
  const [loading, setLoading] = useState(false);

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
          // Filter out non-data fields (layout-only fields)
          let dataFields = fieldsData
            .filter(field => !['header', 'description', 'section-break', 'horizontal-line'].includes(field.field_type))
            .map(field => ({
              id: field.id,
              type: field.field_type,
              label: field.label,
              options: field.options || [],
              customConfig: field.custom_config || {},
            } as ExtendedFormField));
          
          // Apply type filter if provided
          if (filterTypes && filterTypes.length > 0) {
            dataFields = dataFields.filter(field => filterTypes.includes(field.type));
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
  }, [formId, filterTypes]);

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
        console.log('🔍 Field selected:', fieldId);
        const selectedField = fields.find(f => f.id === fieldId);
        console.log('📋 Selected field details:', selectedField);
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
