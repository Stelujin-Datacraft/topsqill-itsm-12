
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useTriggerManagement() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const createTrigger = async (
    workflowId: string,
    triggerType: 'onFormSubmit' | 'onFormCompletion' | 'onFormApproval' | 'onFormRejection',
    sourceFormId: string,
    metadata: any = {}
  ) => {
    if (!userProfile?.organization_id) return null;

    try {
      setLoading(true);

      const triggerPayload = {
        organization_id: userProfile.organization_id,
        trigger_id: `${workflowId}_${triggerType}_${sourceFormId}`,
        target_workflow_id: workflowId,
        trigger_type: triggerType,
        source_form_id: sourceFormId,
        metadata,
        created_by: userProfile.id
      };

      const { data, error } = await supabase
        .from('workflow_triggers')
        .insert(triggerPayload)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating trigger:', error);
        toast({
          title: "Error",
          description: "Failed to create workflow trigger.",
          variant: "destructive",
        });
        return null;
      }

      console.log('✅ Created workflow trigger:', data.id);
      toast({
        title: "Success!",
        description: "Workflow trigger created successfully.",
      });

      return data;
    } catch (error) {
      console.error('❌ Error creating trigger:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteTrigger = async (triggerId: string) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('workflow_triggers')
        .delete()
        .eq('id', triggerId);

      if (error) {
        console.error('❌ Error deleting trigger:', error);
        toast({
          title: "Error",
          description: "Failed to delete workflow trigger.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Success!",
        description: "Workflow trigger deleted successfully.",
      });

      return true;
    } catch (error) {
      console.error('❌ Error deleting trigger:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loadTriggersForWorkflow = async (workflowId: string) => {
    try {
      const { data, error } = await supabase
        .from('workflow_triggers')
        .select(`
          *,
          forms!inner(name)
        `)
        .eq('target_workflow_id', workflowId);

      if (error) {
        console.error('❌ Error loading triggers:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error loading triggers:', error);
      return [];
    }
  };

  return {
    createTrigger,
    deleteTrigger,
    loadTriggersForWorkflow,
    loading
  };
}
