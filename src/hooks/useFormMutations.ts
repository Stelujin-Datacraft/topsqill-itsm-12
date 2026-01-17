import { supabase } from '@/integrations/supabase/client';
import { Form } from '@/types/form';
import { toast } from '@/hooks/use-toast';
import { logFormAuditEvent, describeFormChanges } from '@/utils/formAuditLogger';

export function useFormMutations() {
  const createForm = async (formData: Omit<Form, 'id' | 'createdAt' | 'updatedAt' | 'fields'>, userProfile: any) => {
    if (!userProfile?.organization_id || !userProfile?.id) {
      console.error('useFormMutations: No organization or user ID for creating form');
      toast({
        title: "Authentication required",
        description: "Please log in to create forms.",
        variant: "destructive",
      });
      return null;
    }

    try {
      const insertData = {
        name: formData.name,
        description: formData.description,
        organization_id: userProfile.organization_id,
        project_id: formData.projectId,
        status: formData.status,
        permissions: JSON.stringify(formData.permissions),
        created_by: userProfile.id,
        is_public: formData.isPublic || false,
        share_settings: JSON.stringify(formData.shareSettings || { allowPublicAccess: false, sharedUsers: [] }),
        field_rules: JSON.stringify(formData.fieldRules || []),
        form_rules: JSON.stringify(formData.formRules || []),
        layout: JSON.stringify(formData.layout || { columns: 1 }),
        pages: JSON.stringify(formData.pages || []),
      };

      const { data, error } = await supabase
        .from('forms')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('useFormMutations: Error creating form:', error);
        
        if (error.message?.includes('permission denied')) {
          toast({
            title: "Permission denied",
            description: "You don't have permission to create forms.",
            variant: "destructive",
          });
        } else if (error.message?.includes('row-level security')) {
          toast({
            title: "Security policy violation",
            description: "Form creation blocked by security policy.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error creating form",
            description: `Failed to create the form: ${error.message}`,
            variant: "destructive",
          });
        }
        return null;
      }

      const newForm: Form = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        organizationId: data.organization_id || '',
        projectId: data.project_id || '',
        status: data.status as Form['status'],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        createdBy: data.created_by,
        isPublic: data.is_public || false,
        fields: [],
        permissions: JSON.parse(data.permissions as string),
        shareSettings: JSON.parse(data.share_settings as string),
        fieldRules: JSON.parse(data.field_rules as string),
        formRules: JSON.parse(data.form_rules as string),
        layout: JSON.parse(data.layout as string),
        pages: JSON.parse(data.pages as string),
      };

      // Log audit event for form creation - MUST happen before returning
      console.log('🔵 About to log form_created event for:', newForm.id, newForm.name);
      const logResult = await logFormAuditEvent({
        userId: userProfile.id,
        eventType: 'form_created',
        formId: newForm.id,
        formName: newForm.name,
        description: `Created form "${newForm.name}"`,
      });
      console.log('🔵 form_created log result:', logResult);

      return newForm;
    } catch (error) {
      console.error('useFormMutations: Unexpected error creating form:', error);
      toast({
        title: "Unexpected error",
        description: "An unexpected error occurred while creating the form.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateForm = async (id: string, updates: Partial<Form>, userProfile?: any, formName?: string) => {
    try {
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status) updateData.status = updates.status;
      if (updates.permissions) updateData.permissions = JSON.stringify(updates.permissions);
      if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
      if (updates.shareSettings) updateData.share_settings = JSON.stringify(updates.shareSettings);
      if (updates.fieldRules) updateData.field_rules = JSON.stringify(updates.fieldRules);
      if (updates.formRules) updateData.form_rules = JSON.stringify(updates.formRules);
      if (updates.layout) updateData.layout = JSON.stringify(updates.layout);
      if (updates.pages) updateData.pages = JSON.stringify(updates.pages);
      if (updates.projectId) updateData.project_id = updates.projectId;

      const { error } = await supabase
        .from('forms')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('useFormMutations: Error updating form:', error);
        throw error;
      }

      // Log audit event if user profile is available
      if (userProfile?.id) {
        console.log('🟡 About to log form_updated event for:', id, formName);
        const logResult = await logFormAuditEvent({
          userId: userProfile.id,
          eventType: 'form_updated',
          formId: id,
          formName: formName || updates.name,
          description: `Updated form "${formName || updates.name || id}"`,
          changes: updates as Record<string, unknown>,
        });
        console.log('🟡 form_updated log result:', logResult);
      }
    } catch (error) {
      console.error('useFormMutations: Error updating form:', error);
      toast({
        title: "Error updating form",
        description: "Failed to update the form. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteForm = async (id: string, userProfile?: any, formName?: string) => {
    // Log audit event BEFORE deleting the form (so the form_id reference still exists)
    if (userProfile?.id) {
      console.log('🔴 About to log form_deleted event for:', id, formName);
      const logResult = await logFormAuditEvent({
        userId: userProfile.id,
        eventType: 'form_deleted',
        formId: id,
        formName: formName,
        description: `Deleted form "${formName || id}"`,
      });
      console.log('🔴 form_deleted log result:', logResult);
    } else {
      console.warn('🔴 Cannot log form_deleted - userProfile is missing:', userProfile);
    }

    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('useFormMutations: Error deleting form:', error);
        throw error;
      }
    } catch (error) {
      console.error('useFormMutations: Error deleting form:', error);
      toast({
        title: "Error deleting form",
        description: "Failed to delete the form. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    createForm,
    updateForm,
    deleteForm,
  };
}
