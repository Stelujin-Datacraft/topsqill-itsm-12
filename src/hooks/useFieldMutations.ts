import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';
import { toast } from '@/hooks/use-toast';
import { logFormAuditEvent } from '@/utils/formAuditLogger';

export function useFieldMutations() {
  // Single field update (used for individual field changes outside of save)
  const updateField = async (fieldId: string, updates: Partial<FormField>, auditInfo?: { userId: string; formId: string; formName?: string }) => {
    try {
      const updateData: any = {};
      if (updates.label !== undefined) updateData.label = updates.label;
      if (updates.placeholder !== undefined) updateData.placeholder = updates.placeholder;
      if (updates.required !== undefined) updateData.required = updates.required;
      
      if (updates.defaultValue !== undefined) {
        if (typeof updates.defaultValue === 'boolean') {
          updateData.default_value = updates.defaultValue.toString();
        } else if (Array.isArray(updates.defaultValue)) {
          updateData.default_value = JSON.stringify(updates.defaultValue);
        } else {
          updateData.default_value = String(updates.defaultValue);
        }
      }
      
      if (updates.options !== undefined) {
        updateData.options = JSON.stringify(updates.options);
      }
      if (updates.validation !== undefined) updateData.validation = JSON.stringify(updates.validation);
      if (updates.permissions !== undefined) updateData.permissions = JSON.stringify(updates.permissions);
      if (updates.triggers !== undefined) updateData.triggers = JSON.stringify(updates.triggers);
      if (updates.isVisible !== undefined) updateData.is_visible = updates.isVisible;
      if (updates.isEnabled !== undefined) updateData.is_enabled = updates.isEnabled;
      if (updates.currentValue !== undefined) updateData.current_value = updates.currentValue;
      if (updates.tooltip !== undefined) updateData.tooltip = updates.tooltip;
      if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage;
      
      if (updates.customConfig !== undefined) {
        updateData.custom_config = JSON.stringify(updates.customConfig);
      }

      const { error } = await supabase
        .from('form_fields')
        .update(updateData)
        .eq('id', fieldId);

      if (error) {
        console.error('useFieldMutations: Error updating field:', error);
        throw error;
      }

      // Log audit event if audit info is provided
      if (auditInfo?.userId && auditInfo?.formId) {
        await logFormAuditEvent({
          userId: auditInfo.userId,
          eventType: 'form_field_updated',
          formId: auditInfo.formId,
          formName: auditInfo.formName,
          fieldId: fieldId,
          fieldLabel: updates.label,
          description: `Updated field "${updates.label || fieldId}"`,
        });
      }
    } catch (error) {
      console.error('useFieldMutations: Error updating field:', error);
      throw error;
    }
  };

  // Batch update/insert multiple fields at once using upsert - OPTIMIZED
  const batchUpdateFields = async (formId: string, fields: FormField[], existingFieldIds: Set<string>) => {
    try {
      if (fields.length === 0) return;

      const allFields = fields.map((field, index) => {
        let defaultValueStr = '';
        if (field.defaultValue !== undefined) {
          if (typeof field.defaultValue === 'boolean') {
            defaultValueStr = field.defaultValue.toString();
          } else if (Array.isArray(field.defaultValue)) {
            defaultValueStr = JSON.stringify(field.defaultValue);
          } else {
            defaultValueStr = String(field.defaultValue);
          }
        }

        return {
          id: field.id,
          form_id: formId,
          field_type: field.type,
          label: field.label,
          placeholder: field.placeholder || '',
          required: field.required || false,
          default_value: defaultValueStr,
          options: field.options ? JSON.stringify(field.options) : null,
          validation: field.validation ? JSON.stringify(field.validation) : null,
          permissions: JSON.stringify(field.permissions || { read: ['*'], write: ['*'] }),
          triggers: JSON.stringify(field.triggers || []),
          is_visible: field.isVisible !== false,
          is_enabled: field.isEnabled !== false,
          current_value: field.currentValue || '',
          tooltip: field.tooltip || '',
          error_message: field.errorMessage || '',
          field_order: index,
          custom_config: field.customConfig ? JSON.stringify(field.customConfig) : null,
        };
      });
      
      const { error } = await supabase
        .from('form_fields')
        .upsert(allFields as any[], { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('useFieldMutations: Error batch saving fields:', error);
        throw error;
      }
    } catch (error) {
      console.error('useFieldMutations: Error in batch update:', error);
      throw error;
    }
  };

  // Batch delete multiple fields at once
  const batchDeleteFields = async (fieldIds: string[]) => {
    try {
      if (fieldIds.length === 0) return;

      const { error } = await supabase
        .from('form_fields')
        .delete()
        .in('id', fieldIds);

      if (error) {
        console.error('useFieldMutations: Error batch deleting fields:', error);
        throw error;
      }
    } catch (error) {
      console.error('useFieldMutations: Error in batch delete:', error);
      throw error;
    }
  };

  const addField = async (formId: string, fieldData: Omit<FormField, 'id'> & { id?: string }, userProfile: any) => {
    if (!userProfile?.organization_id) {
      toast({
        title: "Authentication required",
        description: "Please log in to add fields.",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Check if field with this ID already exists
      if (fieldData.id) {
        const { data: existingField } = await supabase
          .from('form_fields')
          .select('id')
          .eq('id', fieldData.id)
          .maybeSingle();
        
        if (existingField) {
          await updateField(fieldData.id, fieldData);
          return { id: fieldData.id, ...fieldData } as FormField;
        }
      }
      
      // Get the max field_order to add new field at the end
      const { data: existingFields } = await supabase
        .from('form_fields')
        .select('field_order')
        .eq('form_id', formId)
        .order('field_order', { ascending: false })
        .limit(1);
      
      const maxOrder = existingFields && existingFields.length > 0 
        ? (existingFields[0].field_order || 0) + 1 
        : 0;
      
      let defaultValueStr = '';
      if (fieldData.defaultValue !== undefined) {
        if (typeof fieldData.defaultValue === 'boolean') {
          defaultValueStr = fieldData.defaultValue.toString();
        } else if (Array.isArray(fieldData.defaultValue)) {
          defaultValueStr = JSON.stringify(fieldData.defaultValue);
        } else {
          defaultValueStr = String(fieldData.defaultValue);
        }
      }

      const insertData: Record<string, any> = {
        form_id: formId,
        field_type: fieldData.type,
        label: fieldData.label,
        placeholder: fieldData.placeholder || '',
        required: fieldData.required || false,
        default_value: defaultValueStr,
        options: fieldData.options ? JSON.stringify(fieldData.options) : null,
        validation: fieldData.validation ? JSON.stringify(fieldData.validation) : null,
        permissions: JSON.stringify(fieldData.permissions || { read: ['*'], write: ['*'] }),
        triggers: JSON.stringify(fieldData.triggers || []),
        is_visible: fieldData.isVisible !== false,
        is_enabled: fieldData.isEnabled !== false,
        current_value: fieldData.currentValue || '',
        tooltip: fieldData.tooltip || '',
        error_message: fieldData.errorMessage || '',
        field_order: maxOrder,
        custom_config: fieldData.customConfig ? JSON.stringify(fieldData.customConfig) : null,
      };

      if (fieldData.id) {
        insertData.id = fieldData.id;
      }

      const { data, error } = await supabase
        .from('form_fields')
        .insert(insertData as any)
        .select()
        .single();

      if (error) {
        console.error('useFieldMutations: Error adding field:', error);
        toast({
          title: "Error adding field",
          description: `Failed to add the field: ${error.message}`,
          variant: "destructive",
        });
        return null;
      }

      let parsedDefaultValue: string | boolean | string[] = data.default_value || '';
      if (fieldData.type === 'toggle-switch') {
        if (data.default_value === 'true') parsedDefaultValue = true;
        else if (data.default_value === 'false') parsedDefaultValue = false;
      } else if (fieldData.type === 'checkbox' && data.default_value) {
        try {
          const parsed = JSON.parse(data.default_value);
          if (Array.isArray(parsed)) parsedDefaultValue = parsed;
        } catch { }
      }

      let parsedCustomConfig = {};
      const dataWithCustomConfig = data as any;
      if (dataWithCustomConfig.custom_config) {
        try {
          parsedCustomConfig = JSON.parse(dataWithCustomConfig.custom_config);
        } catch { }
      }

      return {
        id: data.id,
        type: data.field_type as FormField['type'],
        label: data.label,
        placeholder: data.placeholder || '',
        required: data.required || false,
        defaultValue: parsedDefaultValue,
        options: data.options ? JSON.parse(String(data.options)) : undefined,
        validation: data.validation ? JSON.parse(String(data.validation)) : undefined,
        permissions: JSON.parse(String(data.permissions)),
        triggers: JSON.parse(String(data.triggers)),
        isVisible: data.is_visible !== false,
        isEnabled: data.is_enabled !== false,
        currentValue: data.current_value || '',
        tooltip: data.tooltip || '',
        errorMessage: data.error_message || '',
        pageId: fieldData.pageId || 'default',
        customConfig: parsedCustomConfig,
      } as FormField;
    } catch (error) {
      console.error('useFieldMutations: Unexpected error adding field:', error);
      toast({
        title: "Unexpected error",
        description: "An unexpected error occurred while adding the field.",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteField = async (fieldId: string, auditInfo?: { userId: string; formId: string; formName?: string; fieldLabel?: string }) => {
    try {
      const { error } = await supabase
        .from('form_fields')
        .delete()
        .eq('id', fieldId);

      if (error) {
        throw error;
      }

      // Log audit event if audit info is provided
      if (auditInfo?.userId && auditInfo?.formId) {
        await logFormAuditEvent({
          userId: auditInfo.userId,
          eventType: 'form_field_deleted',
          formId: auditInfo.formId,
          formName: auditInfo.formName,
          fieldId: fieldId,
          fieldLabel: auditInfo.fieldLabel,
          description: `Deleted field "${auditInfo.fieldLabel || fieldId}"`,
        });
      }
    } catch (error) {
      console.error('useFieldMutations: Error deleting field:', error);
      toast({
        title: "Error deleting field",
        description: "Failed to delete the field. Please try again.",
        variant: "destructive",
      });
    }
  };

  const reorderFields = async (formId: string, startIndex: number, endIndex: number, fields: FormField[]) => {
    try {
      const reorderedFields = [...fields];
      const [removed] = reorderedFields.splice(startIndex, 1);
      reorderedFields.splice(endIndex, 0, removed);

      const updates = reorderedFields.map((field, index) => ({
        id: field.id,
        field_order: index,
      }));

      const { error } = await supabase
        .from('form_fields')
        .upsert(updates.map(u => ({ id: u.id, field_order: u.field_order })) as any[], {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        throw error;
      }

      return reorderedFields;
    } catch (error) {
      console.error('useFieldMutations: Error reordering fields:', error);
      toast({
        title: "Error reordering fields",
        description: "Failed to reorder the fields. Please try again.",
        variant: "destructive",
      });
      return fields;
    }
  };

  return {
    addField,
    updateField,
    deleteField,
    reorderFields,
    batchUpdateFields,
    batchDeleteFields,
  };
}
