
import { backend as supabase } from '@/services/api';
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

  static async handleRuleTrigger(
    formId: string, 
    ruleId: string, 
    ruleName: string, 
    success: boolean, 
    submissionData: any, 
    submissionId?: string, 
    userId?: string
  ) {
    const triggerType = success ? 'rule_success' : 'rule_failure';
    console.log(`📋 Handling ${triggerType} trigger:`, { formId, ruleId, ruleName, submissionId });

    try {
      // Find workflows triggered by this specific rule
      const { data: workflows, error: workflowError } = await supabase
        .from('workflows')
        .select('id, name')
        .eq('status', 'active');

      if (workflowError) {
        console.error('❌ Error fetching workflows for rule trigger:', workflowError);
        return [];
      }

      if (!workflows || workflows.length === 0) {
        console.log('📝 No active workflows found');
        return [];
      }

      const executionResults = [];

      // Check each workflow for matching start nodes
      for (const workflow of workflows) {
        const { data: nodes, error: nodesError } = await supabase
          .from('workflow_nodes')
          .select('*')
          .eq('workflow_id', workflow.id)
          .eq('node_type', 'start');

        if (nodesError || !nodes) continue;

        // Find start node that matches this rule trigger
        const matchingNode = nodes.find(node => {
          let config: any = {};
          try {
            config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
          } catch (e) {
            config = node.config || {};
          }

          const nodeFormId = config.triggerFormId || config.formId || config.sourceFormId;
          const nodeRuleId = config.ruleId;
          const nodeTriggerType = config.triggerType;

          return nodeTriggerType === triggerType && 
                 nodeFormId === formId && 
                 nodeRuleId === ruleId;
        });

        if (matchingNode) {
          console.log(`🎯 Found matching workflow for rule trigger: ${workflow.name}`);

          const triggerData = {
            triggerType,
            formId,
            ruleId,
            ruleName,
            ruleSuccess: success,
            submissionId,
            submissionData,
            triggeredBy: userId,
            timestamp: new Date().toISOString()
          };

          try {
            const executionId = await WorkflowExecutor.executeWorkflow(
              workflow.id,
              triggerData,
              submissionId,
              userId
            );

            if (executionId) {
              console.log(`✅ Rule-triggered workflow execution started:`, {
                workflowName: workflow.name,
                executionId
              });
              executionResults.push({
                workflowId: workflow.id,
                workflowName: workflow.name,
                executionId,
                success: true
              });
            }
          } catch (execError) {
            console.error(`❌ Error executing workflow ${workflow.name}:`, execError);
            executionResults.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              success: false,
              error: execError instanceof Error ? execError.message : 'Unknown error'
            });
          }
        }
      }

      console.log(`📊 Rule trigger results:`, {
        triggerType,
        ruleName,
        workflowsTriggered: executionResults.length
      });

      return executionResults;
    } catch (error) {
      console.error('❌ Error in rule trigger handler:', error);
      return [];
    }
  }
}
