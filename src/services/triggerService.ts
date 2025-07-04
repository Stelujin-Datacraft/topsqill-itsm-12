
import { supabase } from '@/integrations/supabase/client';
import { WorkflowExecutor } from './workflowExecutor';

export class TriggerService {
  static async handleFormSubmissionTrigger(formId: string, submissionData: any, submissionId: string, submitterId?: string) {
    console.log('🎯 Handling form submission trigger:', { formId, submissionId, submitterId });

    try {
      // Find active workflow triggers for this form
      console.log('🔍 Searching for triggers with criteria:', {
        source_form_id: formId,
        trigger_type: 'form_submission',
        is_active: true
      });

      const { data: triggers, error } = await supabase
        .from('workflow_triggers')
        .select(`
          *,
          workflows!inner(id, name, status)
        `)
        .eq('source_form_id', formId)
        .eq('trigger_type', 'form_submission')
        .eq('is_active', true)
        .eq('workflows.status', 'active');

      if (error) {
        console.error('❌ Error fetching triggers:', error);
        return;
      }

      console.log('📊 Trigger query results:', {
        triggersFound: triggers?.length || 0,
        triggers: triggers?.map(t => ({
          id: t.id,
          trigger_type: t.trigger_type,
          target_workflow_id: t.target_workflow_id,
          workflow_name: t.workflows?.name,
          workflow_status: t.workflows?.status
        }))
      });

      if (!triggers || triggers.length === 0) {
        console.log('📝 No active triggers found for form:', formId);
        console.log('💡 To create a trigger, go to the workflow designer and configure a form submission trigger');
        return;
      }

      console.log(`🔄 Found ${triggers.length} active trigger(s) for form:`, formId);

      // Execute each workflow
      for (const trigger of triggers) {
        const triggerData = {
          triggerType: 'form_submission',
          formId,
          submissionId,
          submissionData,
          submittedBy: submitterId,
          userEmail: submissionData.email || submissionData.user_email,
          timestamp: new Date().toISOString()
        };

        console.log('🚀 Executing workflow:', {
          workflowId: trigger.target_workflow_id,
          workflowName: trigger.workflows?.name,
          triggerData
        });

        const executionId = await WorkflowExecutor.executeWorkflow(
          trigger.target_workflow_id,
          triggerData,
          submissionId,
          submitterId
        );

        if (executionId) {
          console.log('✅ Workflow execution started:', {
            executionId,
            workflowName: trigger.workflows?.name
          });
        } else {
          console.error('❌ Failed to start workflow execution for:', {
            workflowId: trigger.target_workflow_id,
            workflowName: trigger.workflows?.name
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in form submission trigger handler:', error);
    }
  }

  static async handleFormApprovalTrigger(formId: string, approvalData: any, approverId?: string) {
    console.log('✅ Handling form approval trigger:', { formId, approverId });

    try {
      const { data: triggers, error } = await supabase
        .from('workflow_triggers')
        .select(`
          *,
          workflows!inner(id, name, status)
        `)
        .eq('source_form_id', formId)
        .eq('trigger_type', 'form_approval')
        .eq('is_active', true)
        .eq('workflows.status', 'active');

      if (error) {
        console.error('❌ Error fetching approval triggers:', error);
        return;
      }

      if (!triggers || triggers.length === 0) {
        console.log('📝 No active approval triggers found for form:', formId);
        return;
      }

      for (const trigger of triggers) {
        const triggerData = {
          triggerType: 'form_approval',
          formId,
          approvalData,
          approvedBy: approverId,
          timestamp: new Date().toISOString()
        };

        const executionId = await WorkflowExecutor.executeWorkflow(
          trigger.target_workflow_id,
          triggerData,
          undefined,
          approverId
        );

        if (executionId) {
          console.log('✅ Approval workflow execution started:', executionId);
        }
      }
    } catch (error) {
      console.error('❌ Error in form approval trigger handler:', error);
    }
  }

  static async handleManualTrigger(workflowId: string, triggerData: any, userId?: string) {
    console.log('👤 Handling manual workflow trigger:', { workflowId, userId });

    try {
      const manualTriggerData = {
        triggerType: 'manual',
        workflowId,
        triggeredBy: userId,
        data: triggerData,
        timestamp: new Date().toISOString()
      };

      const executionId = await WorkflowExecutor.executeWorkflow(
        workflowId,
        manualTriggerData,
        undefined,
        userId
      );

      if (executionId) {
        console.log('✅ Manual workflow execution started:', executionId);
        return executionId;
      } else {
        throw new Error('Failed to start manual workflow execution');
      }
    } catch (error) {
      console.error('❌ Error in manual trigger handler:', error);
      throw error;
    }
  }
}
