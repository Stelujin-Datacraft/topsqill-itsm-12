import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';
import { toast } from '@/hooks/use-toast';
import { schemaCache } from '@/services/schemaCache';

export function useFieldMutations() {
  const addField = async (formId: string, fieldData: Omit<FormField, 'id'>, userProfile: any) => {
    if (!userProfile?.organization_id) {
      console.error('useFieldMutations: No organization for adding field');
      toast({
        title: "Authentication required",
        description: "Please log in to add fields.",
        variant: "destructive",
      });
      return null;
    }

    try {
      console.log('useFieldMutations: Adding field to form:', formId, fieldData);
      
      // First, get the current max field order for this form
      const { data: maxOrderData } = await supabase
        .from('form_fields')
        .select('field_order')
        .eq('form_id', formId)
        .order('field_order', { ascending: false })
        .limit(1);

      const newOrder = (maxOrderData?.[0]?.field_order || 0) + 1;

      // Convert defaultValue to string for database storage
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

      const insertData = {
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
        field_order: newOrder,
        custom_config: fieldData.customConfig ? JSON.stringify(fieldData.customConfig) : null,
      };

      const { data, error } = await supabase
        .from('form_fields')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('useFieldMutations: Error adding field:', error);

        if (error.message?.includes('permission denied')) {
          toast({
            title: "Permission denied",
            description: "You don't have permission to add fields to this form.",
            variant: "destructive",
          });
        } else if (error.message?.includes('row-level security')) {
          toast({
            title: "Security policy violation",
            description: "Field creation blocked by security policy. Please contact your administrator.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error adding field",
            description: `Failed to add the field: ${error.message}`,
            variant: "destructive",
          });
        }
        return null;
      }

      // Parse defaultValue back from string
      let parsedDefaultValue: string | boolean | string[] = data.default_value || '';
      if (fieldData.type === 'toggle-switch') {
        if (data.default_value === 'true') parsedDefaultValue = true;
        else if (data.default_value === 'false') parsedDefaultValue = false;
      } else if (fieldData.type === 'checkbox' && data.default_value) {
        try {
          const parsed = JSON.parse(data.default_value);
          if (Array.isArray(parsed)) parsedDefaultValue = parsed;
        } catch {
          // Keep as string if not valid JSON
        }
      }

      // Parse customConfig from database - use type assertion to access the new column
      let parsedCustomConfig = {};
      const dataWithCustomConfig = data as any;
      if (dataWithCustomConfig.custom_config) {
        try {
          parsedCustomConfig = JSON.parse(dataWithCustomConfig.custom_config);
        } catch (error) {
          console.warn('Failed to parse custom_config:', error);
        }
      }

      const newField: FormField = {
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
      };

      console.log('useFieldMutations: Field added successfully:', newField);
      
      // Invalidate schema cache to refresh query explorer
      schemaCache.invalidateCache();
      
      return newField;
    } catch (error) {
      console.error('useFieldMutations: Unexpected error adding field:', error);
      toast({
        title: "Unexpected error",
        description: "An unexpected error occurred while adding the field. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateField = async (fieldId: string, updates: Partial<FormField>) => {
    try {
      console.log('useFieldMutations: Starting field update for fieldId:', fieldId);
      console.log('useFieldMutations: Updates received:', updates);
      
      const updateData: any = {};
      if (updates.label !== undefined) updateData.label = updates.label;
      if (updates.placeholder !== undefined) updateData.placeholder = updates.placeholder;
      if (updates.required !== undefined) updateData.required = updates.required;
      
      // Handle defaultValue properly - convert to string for database storage
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
        console.log('useFieldMutations: Setting options:', updates.options);
      }
      if (updates.validation !== undefined) updateData.validation = JSON.stringify(updates.validation);
      if (updates.permissions !== undefined) updateData.permissions = JSON.stringify(updates.permissions);
      if (updates.triggers !== undefined) updateData.triggers = JSON.stringify(updates.triggers);
      if (updates.isVisible !== undefined) updateData.is_visible = updates.isVisible;
      if (updates.isEnabled !== undefined) updateData.is_enabled = updates.isEnabled;
      if (updates.currentValue !== undefined) updateData.current_value = updates.currentValue;
      if (updates.tooltip !== undefined) updateData.tooltip = updates.tooltip;
      if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage;
      
      // Properly handle customConfig updates with comprehensive logging
      if (updates.customConfig !== undefined) {
        const customConfigString = JSON.stringify(updates.customConfig);
        updateData.custom_config = customConfigString;
        console.log('useFieldMutations: Setting custom_config for field:', fieldId);
        console.log('useFieldMutations: Custom config object:', updates.customConfig);
        console.log('useFieldMutations: Custom config JSON string:', customConfigString);
        
        // Validate JSON can be parsed back
        try {
          const testParse = JSON.parse(customConfigString);
          console.log('useFieldMutations: Custom config JSON validation successful:', testParse);
        } catch (parseError) {
          console.error('useFieldMutations: Custom config JSON validation failed:', parseError);
          throw new Error('Invalid custom configuration JSON');
        }
      }

      console.log('useFieldMutations: Final update data being sent to database:', updateData);

      const { error } = await supabase
        .from('form_fields')
        .update(updateData)
        .eq('id', fieldId);

      if (error) {
        console.error('useFieldMutations: Database error updating field:', error);
        throw error;
      }

      console.log('useFieldMutations: Field updated successfully in database');
      
      // Verify the update by reading back the data
      const { data: verificationData, error: verificationError } = await supabase
        .from('form_fields')
        .select('custom_config, options')
        .eq('id', fieldId)
        .single();
      
      if (verificationError) {
        console.warn('useFieldMutations: Could not verify update:', verificationError);
      } else {
        console.log('useFieldMutations: Verification - field data after update:', verificationData);
      }
      
      // Invalidate schema cache to refresh query explorer
      schemaCache.invalidateCache();
    } catch (error) {
      console.error('useFieldMutations: Error updating field:', error);
      toast({
        title: "Error updating field",
        description: "Failed to update the field. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to allow caller to handle
    }
  };

  const deleteField = async (fieldId: string) => {
    try {
      console.log('useFieldMutations: Deleting field:', fieldId);
      
      const { error } = await supabase
        .from('form_fields')
        .delete()
        .eq('id', fieldId);

      if (error) {
        console.error('useFieldMutations: Error deleting field:', error);
        throw error;
      }

      console.log('useFieldMutations: Field deleted successfully');
      
      // Invalidate schema cache to refresh query explorer
      schemaCache.invalidateCache();
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
      console.log('useFieldMutations: Reordering fields:', formId, startIndex, endIndex);
      
      // Reorder the fields array
      const reorderedFields = [...fields];
      const [removed] = reorderedFields.splice(startIndex, 1);
      reorderedFields.splice(endIndex, 0, removed);

      // Update field order in database
      const updates = reorderedFields.map((field, index) => ({
        id: field.id,
        field_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('form_fields')
          .update({ field_order: update.field_order })
          .eq('id', update.id);

        if (error) {
          console.error('useFieldMutations: Error updating field order:', error);
          throw error;
        }
      }

      console.log('useFieldMutations: Fields reordered successfully');
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
  };
}
